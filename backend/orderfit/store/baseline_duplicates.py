"""One duplicate policy for manual writes, CSV confirmation and canonical review.

Call write helpers under the business lock. Matching is deliberately conservative:
unknown counterparties match; known different counterparties do not. Descriptions
and certainty are never identities. Explicit human review binds both row versions.
"""

import json

from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.workflow import ErrorDetail

MAX_MATCHES = 200
EFFECTIVE = """({alias}.deal_id IS NULL OR EXISTS(
 SELECT FROM commitment_projection cp WHERE cp.business_id={alias}.business_id
 AND cp.cash_event_id={alias}.id))"""
MATCH = """a.direction=b.direction AND a.kind=b.kind
 AND (a.customer_id IS NULL OR b.customer_id IS NULL OR a.customer_id=b.customer_id)
 AND (a.payee_id IS NULL OR b.payee_id IS NULL OR a.payee_id=b.payee_id)
 AND ((a.event_date=b.event_date AND a.amount_minor=b.amount_minor)
  OR (baseline_invoice_key(b.invoice_ref)<>''
      AND baseline_invoice_key(a.invoice_ref)=baseline_invoice_key(b.invoice_ref)))"""
UNREVIEWED = """NOT EXISTS(SELECT FROM cash_event_duplicate_review r
 WHERE r.business_id=a.business_id
 AND r.event_id=least(a.id,b.id) AND r.matching_event_id=greatest(a.id,b.id)
 AND r.event_version=CASE WHEN a.id<b.id THEN a.version ELSE b.version END
 AND r.matching_event_version=CASE WHEN a.id<b.id THEN b.version ELSE a.version END)"""


def matches(c, business_id, event, *, exclude_id=None, unresolved=False, event_version=None):
    fields = event.model_dump() if hasattr(event, "model_dump") else event
    rows = c.execute(text("""WITH b AS (SELECT CAST(:date AS date) event_date,
     CAST(:amt AS bigint) amount_minor, CAST(:dir AS text) direction,
     CAST(:kind AS text) kind, CAST(:invoice AS text) invoice_ref,
     CAST(:customer AS uuid) customer_id, CAST(:payee AS uuid) payee_id,
     CAST(:id AS bigint) id, CAST(:version AS integer) version)
     SELECT a.* FROM cash_event a CROSS JOIN b WHERE a.business_id=:business
     AND a.voided_at IS NULL AND (:id IS NULL OR a.id<>:id) AND """
     + EFFECTIVE.format(alias="a") + " AND " + MATCH
     + (" AND " + UNREVIEWED if unresolved else "") + " ORDER BY a.id LIMIT 201"),
     dict(business=business_id, date=fields["event_date"], amt=int(fields["amount_minor"]),
          dir=fields["direction"], kind=fields["kind"], invoice=fields["invoice_ref"],
          customer=fields["customer_id"], payee=fields["payee_id"], id=exclude_id,
          version=event_version)).mappings().all()
    if len(rows) > MAX_MATCHES:
        raise ApplicationError(409, "TOO_MANY_DUPLICATE_MATCHES",
                               "Reconcile the baseline before adding more matching entries.")
    return rows


def require_review(rows, review, *, source_row=None):
    expected = {str(r["id"]) for r in rows}
    supplied = set(review.matching_event_ids) if review else set()
    if expected != supplied or (expected and review is None):
        raise ApplicationError(409, "BASELINE_DUPLICATE_REVIEW_REQUIRED",
            "Review matching baseline entries. Void a duplicate or confirm distinct obligations with a reason.",
            details=ErrorDetail(field="duplicate_review", matching_event_ids=sorted(expected, key=int),
                                source_row=source_row))
    if review is not None and not expected:
        raise ApplicationError(422, "UNEXPECTED_DUPLICATE_REVIEW", "No matching entries need this review.")


def record_review(c, scope, event_id, version, rows, review):
    if review is None:
        return
    for row in rows:
        left, right = sorted([(event_id, version), (row["id"], row["version"])])
        c.execute(text("""INSERT INTO cash_event_duplicate_review
          (business_id,event_id,event_version,matching_event_id,matching_event_version,reviewed_by,reason)
          VALUES(:b,:id,:v,:mid,:mv,:u,:reason) ON CONFLICT DO NOTHING"""),
          dict(b=scope.business_id, id=left[0], v=left[1], mid=right[0], mv=right[1],
               u=scope.user_id, reason=review.reason.strip()))


def unresolved_pairs(c, business_id, *, excluding_deal_id=None):
    return c.execute(text("""SELECT a.id event_id,b.id matching_event_id
      FROM cash_event a JOIN cash_event b ON b.business_id=a.business_id AND a.id<b.id
      WHERE a.business_id=:business AND a.voided_at IS NULL AND b.voided_at IS NULL
      AND """ + EFFECTIVE.format(alias="a") + " AND " + EFFECTIVE.format(alias="b")
      + " AND " + MATCH + " AND " + UNREVIEWED
      + " AND (:deal IS NULL OR (a.deal_id IS DISTINCT FROM :deal AND b.deal_id IS DISTINCT FROM :deal))"
      + " ORDER BY a.id,b.id LIMIT 201"),
      dict(business=business_id, deal=excluding_deal_id)).mappings().all()


def check_source(c, business_id, digest, source_row, *, preview_id=None):
    existing = c.execute(text("""SELECT cash_event_id FROM cash_event_source_claim
      WHERE business_id=:b AND content_hash=:h AND source_row=:r"""),
      dict(b=business_id, h=bytes.fromhex(digest), r=source_row)).scalar_one_or_none()
    # Legacy edits may have replaced the cash row's document/quote attribution.
    # Immutable prior confirmation still proves this artifact row was imported.
    # Exclude the confirmation being inserted by the current transaction.
    previously_confirmed = False
    if existing is None:
        previously_confirmed = c.execute(text("""SELECT EXISTS(
          SELECT FROM document d JOIN csv_preview p ON p.business_id=d.business_id AND p.document_id=d.id
          JOIN csv_confirmation cf ON cf.business_id=p.business_id AND cf.preview_id=p.id
          WHERE d.business_id=:b AND d.content_hash=:h AND p.id IS DISTINCT FROM CAST(:preview AS uuid)
          AND EXISTS(SELECT FROM jsonb_array_elements(p.events) e WHERE e->>'row'=CAST(:r AS text)))"""),
          dict(b=business_id, h=bytes.fromhex(digest), r=source_row, preview=preview_id)).scalar_one()
    if existing is not None or previously_confirmed:
        raise ApplicationError(409, "BASELINE_SOURCE_ALREADY_IMPORTED",
            "This source row was already imported. Correct or void the existing event instead.",
            details=ErrorDetail(field="preview_id", matching_event_ids=[str(existing)] if existing is not None else [], source_row=source_row))


def claim_source(c, business_id, digest, source_row, event_id):
    c.execute(text("""INSERT INTO cash_event_source_claim(business_id,content_hash,source_row,cash_event_id)
     VALUES(:b,:h,:r,:id)"""), dict(b=business_id, h=bytes.fromhex(digest), r=source_row, id=event_id))


def csv_matches(c, events):
    """Find earlier matching staged rows without exposing IDs of rolled-back inserts.

    CSV has no counterparty IDs. Normalize references using the same SQL function
    as persisted matching; indexed in-memory keys avoid a quadratic batch join.
    """
    normalized = c.execute(text("""SELECT value->>'row' row_number,
      baseline_invoice_key(value->>'invoice_ref') invoice_key
      FROM jsonb_array_elements(CAST(:events AS jsonb))"""),
      {"events": json.dumps(events)}).mappings().all()
    invoice_keys = {int(r["row_number"]): r["invoice_key"] for r in normalized}
    date_keys, ref_keys, result = {}, {}, {}
    for event in events:
        row = event["row"]
        date_key = (event["direction"], event["kind"], event["event_date"], event["amount_minor"])
        ref_key = (event["direction"], event["kind"], invoice_keys[row])
        matches = set(date_keys.get(date_key, ()))
        if invoice_keys[row]:
            matches.update(ref_keys.get(ref_key, ()))
        if len(matches) > MAX_MATCHES:
            raise ApplicationError(409, "TOO_MANY_DUPLICATE_MATCHES")
        result[row] = matches
        date_keys.setdefault(date_key, []).append(row)
        if invoice_keys[row]:
            ref_keys.setdefault(ref_key, []).append(row)
    return result


def require_csv_review(rows, staged_matches, row_review, source_row):
    expected = {str(r["id"]) for r in rows}
    supplied = set(row_review.duplicate_review.matching_event_ids) if row_review else set()
    supplied_rows = set(row_review.matching_source_rows) if row_review else set()
    if expected != supplied or staged_matches != supplied_rows or ((expected or staged_matches) and row_review is None):
        raise ApplicationError(409, "BASELINE_DUPLICATE_REVIEW_REQUIRED",
            "Review matching saved entries and earlier CSV rows before confirming distinct obligations.",
            details=ErrorDetail(field="duplicate_reviews", matching_event_ids=sorted(expected, key=int),
                                source_row=source_row, matching_source_rows=sorted(staged_matches)))
    if row_review is not None and not (expected or staged_matches):
        raise ApplicationError(422, "UNEXPECTED_DUPLICATE_REVIEW")

"""Authorized immutable decision files and PostgreSQL's exact canonical audit bytes."""

import csv
import hashlib
import io
import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.exports import DecisionRecordV1
from orderfit.contracts.financial import ConfirmedInputV1
from orderfit.contracts.primitives import Page
from orderfit.contracts.protocol import PERMISSIONS, canonical_bytes
from orderfit.contracts.resources import AuditExport, AuditRow, ExportView
from orderfit.services.documents import CSV_HEADER
from orderfit.services.pagination import page_limit, split_page
from orderfit.store.repositories import EvaluationRepository, append_audit

AUDIT_ROW_LIMIT = 5000
ZERO_HASH = "00" * 32
AUDIT_LIMITATIONS = [
    "No external anchor is attached. Retain the exported head outside the database to detect later tail deletion.",
    "A partial range verifies only its supplied links; compare its predecessor and head with independently retained evidence.",
    "An empty range is not a verified chain.",
]


def audit_export(connection, business_id, from_sequence=None, to_sequence=None):
    if from_sequence is not None and to_sequence is not None and from_sequence > to_sequence:
        raise ApplicationError(422, "INVALID_AUDIT_RANGE")
    # One statement captures range and head under the same READ COMMITTED snapshot.
    rows = connection.execute(text("""
        WITH head AS MATERIALIZED (
          SELECT seq,encode(row_hash,'hex') AS hash FROM operation_log
          WHERE business_id=:b ORDER BY seq DESC LIMIT 1
        ), selected AS MATERIALIZED (
          SELECT id,seq,operation_log_canonical(l) AS canonical_text,
                 encode(prev_hash,'hex') AS previous_hash,encode(row_hash,'hex') AS row_hash
          FROM operation_log l WHERE business_id=:b AND seq>=:first
            AND seq<=coalesce(CAST(:last AS bigint),9223372036854775807)
          ORDER BY seq LIMIT :bound
        )
        SELECT selected.*,head.seq AS head_sequence,head.hash AS head_hash
        FROM (SELECT 1) one LEFT JOIN head ON true LEFT JOIN selected ON true
        ORDER BY selected.seq
    """), {"b": business_id, "first": from_sequence or 1,
           "last": to_sequence, "bound": AUDIT_ROW_LIMIT + 1}).mappings().all()
    included = [row for row in rows if row["id"] is not None]
    if len(included) > AUDIT_ROW_LIMIT:
        raise ApplicationError(413, "AUDIT_RANGE_TOO_LARGE", "Export a smaller sequence range.")
    return AuditExport(
        schema_version="audit-export.v1", canonicalization="postgres-jsonb-array-text.v1",
        business_id=business_id, exported_at=datetime.now(UTC),
        from_sequence=str(included[0]["seq"]) if included else None,
        to_sequence=str(included[-1]["seq"]) if included else None,
        predecessor_hash=included[0]["previous_hash"] if included else None,
        head_sequence=str(rows[0]["head_sequence"]) if rows[0]["head_sequence"] else None,
        head_hash=rows[0]["head_hash"],
        rows=[AuditRow(id=str(r["id"]), sequence=str(r["seq"]),
                       canonical_text=r["canonical_text"], previous_hash=r["previous_hash"],
                       row_hash=r["row_hash"]) for r in included],
        external_anchor=None, limitations=AUDIT_LIMITATIONS,
    )


def verify_audit_export(value):
    """Verify supplied PG bytes verbatim; never reserialize PostgreSQL canonical JSON."""
    try:
        exported = AuditExport.model_validate(value)
        if not exported.rows:
            return {"ok": False, "rows_checked": 0, "reason": "empty_range"}
        expected_seq = int(exported.from_sequence)
        previous = exported.predecessor_hash
        if expected_seq == 1 and previous != ZERO_HASH:
            raise ValueError("invalid_genesis")
        for row in exported.rows:
            if int(row.sequence) != expected_seq or row.previous_hash != previous:
                raise ValueError("broken_link")
            canonical = json.loads(row.canonical_text)
            if canonical[0] != expected_seq or canonical[1] != str(exported.business_id):
                raise ValueError("scope_or_sequence_mismatch")
            computed = hashlib.sha256(bytes.fromhex(previous) + row.canonical_text.encode()).hexdigest()
            if computed != row.row_hash:
                raise ValueError("content_hash_mismatch")
            previous = row.row_hash
            expected_seq += 1
        last = exported.rows[-1]
        if exported.to_sequence != last.sequence:
            raise ValueError("range_mismatch")
        if exported.head_sequence is None or exported.head_hash is None or int(last.sequence) > int(exported.head_sequence):
            raise ValueError("invalid_head")
        if last.sequence == exported.head_sequence and last.row_hash != exported.head_hash:
            raise ValueError("head_mismatch")
        return {"ok": True, "rows_checked": len(exported.rows), "reason": "supplied_range_only"}
    except (ValueError, TypeError, IndexError, KeyError):
        return {"ok": False, "rows_checked": 0, "reason": "invalid_chain"}


def create_decision_export(connection, scope, deal_id):
    row = connection.execute(text("""
        SELECT e.id,e.snapshot_id,s.payload,s.snapshot_hash FROM evaluation e
        JOIN input_snapshot s ON s.business_id=e.business_id AND s.deal_id=e.deal_id AND s.id=e.snapshot_id
        WHERE e.business_id=:b AND e.deal_id=:d AND e.superseded_at IS NULL
    """), {"b": scope.business_id, "d": deal_id}).mappings().one_or_none()
    if row is None:
        exists = connection.execute(text("SELECT id FROM deal WHERE business_id=:b AND id=:d"),
                                    {"b": scope.business_id, "d": deal_id}).scalar_one_or_none()
        raise ApplicationError(409 if exists else 404, "EVALUATION_REQUIRED" if exists else "NOT_FOUND")
    evaluation = EvaluationRepository.get_evaluation(connection, scope.business_id, row["id"])
    head = connection.execute(text("SELECT seq,encode(row_hash,'hex') AS hash FROM operation_log WHERE business_id=:b ORDER BY seq DESC LIMIT 1"),
                              {"b": scope.business_id}).mappings().one_or_none()
    now = datetime.now(UTC)
    payload = DecisionRecordV1(
        schema_version="decision-export.v1", scope="manual_evaluation", exported_at=now,
        business_id=scope.business_id, deal_id=deal_id, snapshot_id=row["snapshot_id"], snapshot_hash=bytes(row["snapshot_hash"]).hex(),
        snapshot=ConfirmedInputV1.model_validate(row["payload"]), evaluation=evaluation,
        audit_head_sequence=str(head["seq"]) if head else None, audit_head_hash=head["hash"] if head else None,
        limitations=["This record contains a manual evaluation, not approval or sandbox execution evidence.",
                     "Freshness is recorded at export time; later input changes do not modify this evidence."],
    )
    content = canonical_bytes(payload)
    if len(content) > 26214400:
        raise ApplicationError(413, "DECISION_EXPORT_TOO_LARGE")
    identity, expires = uuid4(), now + timedelta(hours=24)
    digest = hashlib.sha256(content).digest()
    connection.execute(text("""
        INSERT INTO decision_export(id,business_id,deal_id,evaluation_id,snapshot_id,created_by,created_at,expires_at,content,content_hash)
        VALUES(:id,:b,:d,:e,:s,:u,:created,:expires,:content,:hash)
    """), {"id": identity, "b": scope.business_id, "d": deal_id, "e": row["id"],
           "s": row["snapshot_id"], "u": scope.user_id, "created": now,
           "expires": expires, "content": content, "hash": digest})
    append_audit(connection, scope, "decision.export", deal_id=deal_id,
                 payload={"export_id": str(identity), "evaluation_id": str(row["id"]), "content_hash": digest.hex()})
    return ExportView(id=identity, schema_version="decision-export.v1", content_hash=digest.hex(),
        download_url=f"/api/v1/businesses/{scope.business_id}/exports/{identity}/download", expires_at=expires)


def decision_download(connection, business_id, export_id):
    row = connection.execute(text("SELECT content,content_hash,expires_at FROM decision_export WHERE business_id=:b AND id=:id"),
                             {"b": business_id, "id": export_id}).mappings().one_or_none()
    if row is None:
        raise ApplicationError(404, "NOT_FOUND")
    if row["expires_at"] <= datetime.now(UTC):
        raise ApplicationError(409, "EXPORT_EXPIRED", "Create a new export to download this decision.")
    content = bytes(row["content"])
    if hashlib.sha256(content).digest() != bytes(row["content_hash"]):
        raise ApplicationError(503, "EXPORT_INTEGRITY_FAILURE")
    return content


AUDIT_LISTING = "audit"


def audit_page(connection, scope, cursors, cursor, limit) -> Page[AuditRow]:
    """Newest-first tenant log with PostgreSQL's exact canonical text (keyset on seq)."""
    limit = page_limit(limit)
    after = cursors.decode(cursor, business_id=scope.business_id, user_id=scope.user_id, listing=AUDIT_LISTING)
    rows = connection.execute(text("""
        SELECT id,seq,operation_log_canonical(l) AS canonical_text,
               encode(prev_hash,'hex') AS previous_hash,encode(row_hash,'hex') AS row_hash
        FROM operation_log l WHERE scope=:b AND business_id=:b
          AND (CAST(:after AS bigint) IS NULL OR seq<CAST(:after AS bigint))
        ORDER BY seq DESC LIMIT :n
    """), {"b": scope.business_id, "after": after[0] if after else None, "n": limit + 1}).mappings().all()
    rows, more = split_page(rows, limit)
    next_cursor = None
    if more:
        next_cursor = cursors.encode(business_id=scope.business_id, user_id=scope.user_id,
                                     listing=AUDIT_LISTING, position=[rows[-1]["seq"]])
    return Page[AuditRow](items=[AuditRow(id=str(r["id"]), sequence=str(r["seq"]), canonical_text=r["canonical_text"],
                                          previous_hash=r["previous_hash"], row_hash=r["row_hash"]) for r in rows],
                          next_cursor=next_cursor)


CASH_EXPORT_ROWS = 50000
CASH_COLUMNS = ["event_id", *CSV_HEADER, "amount_minor", "currency"]
FORMULA_PREFIXES = ("=", "+", "-", "@")
# Control characters some spreadsheet parsers treat as separators ahead of a formula.
CONTROL_PREFIXES = ("\t", "\r", "\n", "\v", "\f")


def csv_cell(value) -> str:
    """Spreadsheet formula-injection guard: formula-leading text is prefixed with '.

    Also covers a formula character after leading whitespace (spreadsheets trim it, so
    `` =1+1`` still evaluates) and cells beginning with a tab, carriage return, newline,
    vertical tab or form feed.
    """
    text_value = "" if value is None else str(value)
    if text_value.startswith(CONTROL_PREFIXES) or text_value.lstrip().startswith(FORMULA_PREFIXES):
        return "'" + text_value
    return text_value


def major_units(minor: int) -> str:
    """Exponent-2 decimal string from integer minor units (no float arithmetic)."""
    sign = "-" if minor < 0 else ""
    whole, cents = divmod(abs(minor), 100)
    return f"{sign}{whole}.{cents:02d}"


def cash_csv(rows, currency) -> bytes:
    """Baseline events in the importer's columns (amount in major units) plus identity/minor
    units; re-importable because the importer ignores the extra columns."""
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\r\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(CASH_COLUMNS)
    for r in rows:
        writer.writerow([csv_cell(v) for v in (
            r["id"], r["event_date"].isoformat(), major_units(r["amount_minor"]), r["direction"], r["kind"],
            r["certainty"], r["description"], r["invoice_ref"], "true" if r["is_deferrable"] else "false",
            r["amount_minor"], currency)])
    return stream.getvalue().encode("utf-8")


def create_cash_export(connection, scope) -> ExportView:
    business = connection.execute(text("SELECT currency,financial_revision FROM business WHERE id=:b"),
                                  {"b": scope.business_id}).mappings().one()
    rows = connection.execute(text("""
        SELECT id,event_date,amount_minor,direction,kind,certainty,description,invoice_ref,is_deferrable
        FROM cash_event WHERE business_id=:b AND deal_id IS NULL AND voided_at IS NULL
        ORDER BY event_date,id LIMIT :n
    """), {"b": scope.business_id, "n": CASH_EXPORT_ROWS + 1}).mappings().all()
    if len(rows) > CASH_EXPORT_ROWS:
        raise ApplicationError(413, "CASH_EXPORT_TOO_LARGE")
    content = cash_csv(rows, business["currency"].strip())
    if len(content) > 26214400:
        raise ApplicationError(413, "CASH_EXPORT_TOO_LARGE")
    identity, now = uuid4(), datetime.now(UTC)
    expires, digest = now + timedelta(hours=24), hashlib.sha256(content).digest()
    connection.execute(text("""
        INSERT INTO cash_export(id,business_id,created_by,created_at,expires_at,financial_revision,row_count,content,content_hash)
        VALUES(:id,:b,:u,:created,:expires,:revision,:count,:content,:hash)
    """), {"id": identity, "b": scope.business_id, "u": scope.user_id, "created": now, "expires": expires,
           "revision": business["financial_revision"], "count": len(rows), "content": content, "hash": digest})
    append_audit(connection, scope, "cash.export",
                 payload={"export_id": str(identity), "rows": len(rows), "content_hash": digest.hex(),
                          "financial_revision": business["financial_revision"]})
    return ExportView(id=identity, schema_version="cash-csv.v1", content_hash=digest.hex(),
                      download_url=f"/api/v1/businesses/{scope.business_id}/exports/{identity}/download",
                      expires_at=expires)


def export_download(connection, scope, export_id):
    """Returns (bytes, media type, filename). Decision exports also require audit permission."""
    cash = connection.execute(text("SELECT content,content_hash,expires_at FROM cash_export WHERE business_id=:b AND id=:id"),
                              {"b": scope.business_id, "id": export_id}).mappings().one_or_none()
    if cash is None:
        if scope.role not in PERMISSIONS["audit"]:
            exists = connection.execute(text("SELECT EXISTS(SELECT FROM decision_export WHERE business_id=:b AND id=:id)"),
                                        {"b": scope.business_id, "id": export_id}).scalar_one()
            raise ApplicationError(403 if exists else 404, "FORBIDDEN" if exists else "NOT_FOUND")
        return decision_download(connection, scope.business_id, export_id), "application/json", f"orderfit-decision-{export_id}.json"
    if cash["expires_at"] <= datetime.now(UTC):
        raise ApplicationError(409, "EXPORT_EXPIRED", "Create a new export to download this file.")
    content = bytes(cash["content"])
    if hashlib.sha256(content).digest() != bytes(cash["content_hash"]):
        raise ApplicationError(503, "EXPORT_INTEGRITY_FAILURE")
    return content, "text/csv; charset=utf-8", f"orderfit-cash-{export_id}.csv"

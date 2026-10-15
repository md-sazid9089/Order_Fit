"""Persistence for documents, immutable parse/extraction evidence, field review and CSV previews."""

import hashlib
import json
from uuid import UUID, uuid4

from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.protocol import canonical_hash
from orderfit.contracts.resources import (
    CashEventCreate,
    CashEventInput,
    CashEventView,
    CSVConfirm,
    CSVPreview,
    DocumentView,
    ExtractedFieldView,
    ExtractionCandidateView,
    FieldResolution,
)
from orderfit.contracts.workflow import Finding
from orderfit.services.documents import ParseResult
from orderfit.store.repositories import CashEventRepository, append_audit

ROLE_DEFAULT = "other"


def _row_to_view(row, parse_status) -> DocumentView:
    base = f"/api/v1/businesses/{row['business_id']}/deals/{row['deal_id']}/documents/{row['id']}"
    return DocumentView(
        id=row["id"],
        deal_id=row["deal_id"],
        kind=row["kind"],
        source_role=row["source_role"] or ROLE_DEFAULT,
        content_hash=bytes(row["content_hash"]).hex(),
        original_filename=row["original_filename"],
        mime_type=row["mime_type"],
        size_bytes=row["size_bytes"],
        uploaded_at=row["uploaded_at"],
        parse_status=parse_status or "pending",
        untrusted=True,
        download_url=f"{base}/download",
    )


_DOC_SQL = """SELECT d.*, (SELECT p.status FROM document_parse p WHERE p.business_id=d.business_id
  AND p.document_id=d.id ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS parse_status
  FROM document d WHERE d.business_id=:b AND d.deal_id=:d"""


class DocumentRepository:
    @staticmethod
    def _deal_guard(c, business_id, deal_id, req):
        row = c.execute(
            text(
                "SELECT d.version,d.input_version,b.financial_revision FROM deal d JOIN business b ON b.id=d.business_id"
                " WHERE d.business_id=:b AND d.id=:d FOR UPDATE OF d"
            ),
            {"b": business_id, "d": deal_id},
        ).mappings().one_or_none()
        if row is None:
            raise ApplicationError(404, "NOT_FOUND")
        if (row["version"], row["input_version"]) != (
            req.expected_version,
            req.expected_input_version,
        ):
            raise ApplicationError(409, "STALE_INPUT_VERSION")
        if row["financial_revision"] != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")

    @staticmethod
    def find_duplicate(c, business_id, deal_id, digest: bytes):
        row = c.execute(
            text(_DOC_SQL + " AND d.content_hash=:h"),
            {"b": business_id, "d": deal_id, "h": digest},
        ).mappings().one_or_none()
        return _row_to_view(row, row["parse_status"]) if row else None

    @staticmethod
    def create(c, scope, deal_id, meta, *, doc_id, filename, mime, storage_key, digest, size, parse: ParseResult):
        DocumentRepository._deal_guard(c, scope.business_id, deal_id, meta)
        c.execute(
            text(
                "INSERT INTO document(id,business_id,deal_id,kind,content_hash,storage_key,original_filename,mime_type,size_bytes,untrusted,uploaded_by,source_role)"
                " VALUES(:id,:b,:d,:kind,:h,:key,:name,:mime,:size,true,:u,:role)"
            ),
            {
                "id": doc_id, "b": scope.business_id, "d": deal_id, "kind": meta.kind, "h": digest,
                "key": storage_key, "name": filename, "mime": mime, "size": size,
                "u": scope.user_id, "role": meta.source_role,
            },
        )
        c.execute(
            text(
                "INSERT INTO document_parse(business_id,deal_id,document_id,parser,parser_version,status,error_code,pages)"
                " VALUES(:b,:d,:doc,:parser,:ver,:status,:err,CAST(:pages AS jsonb))"
            ),
            {
                "b": scope.business_id, "d": deal_id, "doc": doc_id, "parser": parse.parser,
                "ver": "p4.1", "status": parse.status, "err": parse.error_code,
                "pages": json.dumps(parse.pages),
            },
        )
        append_audit(c, scope, "upload_document", deal_id=deal_id,
                     payload={"document_id": str(doc_id), "size_bytes": size, "kind": meta.kind})
        return DocumentRepository.get(c, scope.business_id, deal_id, doc_id)

    @staticmethod
    def get(c, business_id, deal_id, doc_id) -> DocumentView:
        row = c.execute(
            text(_DOC_SQL + " AND d.id=:id"), {"b": business_id, "d": deal_id, "id": doc_id}
        ).mappings().one_or_none()
        if row is None:
            raise ApplicationError(404, "NOT_FOUND")
        return _row_to_view(row, row["parse_status"])

    @staticmethod
    def list_documents(c, business_id, deal_id, limit, offset):
        rows = c.execute(
            text(_DOC_SQL + " ORDER BY d.uploaded_at DESC, d.id LIMIT :l OFFSET :o"),
            {"b": business_id, "d": deal_id, "l": limit, "o": offset},
        ).mappings().all()
        return [_row_to_view(r, r["parse_status"]) for r in rows]

    @staticmethod
    def storage(c, business_id, deal_id, doc_id):
        row = c.execute(
            text("SELECT original_filename,mime_type FROM document WHERE business_id=:b AND deal_id=:d AND id=:id"),
            {"b": business_id, "d": deal_id, "id": doc_id},
        ).mappings().one_or_none()
        if row is None:
            raise ApplicationError(404, "NOT_FOUND")
        return row

    # ---------------------------------------------------------------- extraction projection
    @staticmethod
    def list_fields(c, business_id, deal_id) -> list[ExtractedFieldView]:
        fields = c.execute(
            text("SELECT * FROM extracted_field WHERE business_id=:b AND deal_id=:d ORDER BY id"),
            {"b": business_id, "d": deal_id},
        ).mappings().all()
        candidates = c.execute(
            text("SELECT * FROM extraction_candidate WHERE business_id=:b AND deal_id=:d ORDER BY created_at, id"),
            {"b": business_id, "d": deal_id},
        ).mappings().all()
        out = []
        for f in fields:
            mine = [
                ExtractionCandidateView(
                    id=cand["id"],
                    field=cand["field"],
                    value=None if cand["value"] is None else _plain(cand["value"]),
                    status=cand["status"],
                    source_page=cand["source_page"],
                    source_quote=cand["source_quote"],
                    confidence=float(cand["confidence"]),
                    source_role=cand["source_role"],
                    flags=[],
                )
                for cand in candidates
                if cand["document_id"] == f["document_id"] and cand["field"] == f["field"]
            ]
            value = f["confirmed_value"] if f["confirmed_value"] is not None else f["value"]
            out.append(
                ExtractedFieldView(
                    field_id=str(f["id"]),
                    document_id=f["document_id"],
                    field=f["field"],
                    value=_plain(value),
                    status=f["status"],
                    candidate_id=f["candidate_id"],
                    candidates=mine,
                    version=f["version"],
                )
            )
        return out

    @staticmethod
    def resolve_field(c, scope, deal_id, req: FieldResolution):
        DocumentRepository._deal_guard(c, scope.business_id, deal_id, req)
        field = c.execute(
            text("SELECT * FROM extracted_field WHERE business_id=:b AND deal_id=:d AND id=:id FOR UPDATE"),
            {"b": scope.business_id, "d": deal_id, "id": int(req.field_id)},
        ).mappings().one_or_none()
        if field is None:
            raise ApplicationError(404, "NOT_FOUND")
        if req.resolution == "rejected":
            c.execute(
                text(
                    "UPDATE extracted_field SET status='rejected',confirmed_value=NULL,confirmed_by=NULL,"
                    "confirmed_at=NULL,resolution_reason=:r WHERE id=:id"
                ),
                {"id": field["id"], "r": req.evidence.override_reason},
            )
        else:
            candidate_id = req.selected_candidate_id or field["candidate_id"]
            if candidate_id is None:
                raise ApplicationError(422, "CANDIDATE_REQUIRED")
            cand = c.execute(
                text(
                    "SELECT * FROM extraction_candidate WHERE business_id=:b AND deal_id=:d AND id=:id AND field=:f"
                ),
                {"b": scope.business_id, "d": deal_id, "id": candidate_id, "f": field["field"]},
            ).mappings().one_or_none()
            if cand is None:
                raise ApplicationError(404, "NOT_FOUND")
            if cand["status"] == "missing" or cand["value"] in (None, ""):
                raise ApplicationError(422, "CANDIDATE_HAS_NO_VALUE")
            changed = candidate_id != field["candidate_id"]
            if req.resolution == "overridden" and (not req.evidence.override_reason):
                raise ApplicationError(422, "OVERRIDE_REASON_REQUIRED")
            if req.resolution == "confirmed" and changed:
                raise ApplicationError(422, "USE_OVERRIDE_FOR_DIFFERENT_CANDIDATE")
            c.execute(
                text(
                    "UPDATE extracted_field SET status=:s,value=CAST(:v AS jsonb),confirmed_value=CAST(:v AS jsonb),"
                    "source_page=:p,source_quote=:q,confidence=:conf,candidate_id=:cid,confirmed_by=:u,"
                    "confirmed_at=clock_timestamp(),resolution_reason=:r WHERE id=:id"
                ),
                {
                    "s": req.resolution, "v": json.dumps(cand["value"]), "p": cand["source_page"],
                    "q": cand["source_quote"], "conf": cand["confidence"], "cid": candidate_id,
                    "u": scope.user_id, "r": req.evidence.override_reason, "id": field["id"],
                },
            )
        append_audit(c, scope, "resolve_extracted_field", deal_id=deal_id,
                     payload={"field_id": str(field["id"]), "resolution": req.resolution})

    # ---------------------------------------------------------------- CSV
    @staticmethod
    def csv_document(c, business_id, document_id):
        row = c.execute(
            text(
                "SELECT d.id,d.deal_id,d.kind,dl.version,dl.input_version FROM document d JOIN deal dl ON dl.business_id=d.business_id AND dl.id=d.deal_id"
                " WHERE d.business_id=:b AND d.id=:id"
            ),
            {"b": business_id, "id": document_id},
        ).mappings().one_or_none()
        if row is None:
            raise ApplicationError(404, "NOT_FOUND")
        if row["kind"] != "csv":
            raise ApplicationError(422, "NOT_A_CSV_DOCUMENT")
        return row

    @staticmethod
    def get_preview(c, business_id, preview_id) -> CSVPreview:
        row = c.execute(
            text(
                "SELECT p.*, d.content_hash AS document_hash FROM csv_preview p JOIN document d ON d.business_id=p.business_id"
                " AND d.id=p.document_id WHERE p.business_id=:b AND p.id=:id"
            ),
            {"b": business_id, "id": preview_id},
        ).mappings().one_or_none()
        if row is None:
            raise ApplicationError(404, "NOT_FOUND")
        return _preview_dto(row)

    @staticmethod
    def confirm_csv(c, scope, req: CSVConfirm) -> list[CashEventView]:
        rev = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
            {"b": scope.business_id},
        ).scalar_one()
        if rev != req.expected_financial_revision:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        row = c.execute(
            text("SELECT * FROM csv_preview WHERE business_id=:b AND id=:id"),
            {"b": scope.business_id, "id": req.preview_id},
        ).mappings().one_or_none()
        if row is None:
            raise ApplicationError(404, "NOT_FOUND")
        if bytes(row["preview_hash"]).hex() != req.preview_hash:
            raise ApplicationError(409, "PREVIEW_HASH_MISMATCH")
        if row["financial_revision"] != rev:
            raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
        if any(e for e in row["errors"]):
            raise ApplicationError(422, "PREVIEW_HAS_ERRORS")
        inserted = c.execute(
            text(
                "INSERT INTO csv_confirmation(preview_id,business_id,confirmed_by) VALUES(:p,:b,:u) ON CONFLICT DO NOTHING RETURNING 1"
            ),
            {"p": req.preview_id, "b": scope.business_id, "u": scope.user_id},
        ).scalar_one_or_none()
        if not inserted:
            raise ApplicationError(409, "PREVIEW_ALREADY_CONFIRMED")
        doc = c.execute(
            text("SELECT content_hash FROM document WHERE business_id=:b AND id=:id"),
            {"b": scope.business_id, "id": row["document_id"]},
        ).mappings().one()
        digest = bytes(doc["content_hash"]).hex()
        created = []
        for ev in row["events"]:
            quote = f"row {ev['row']}"
            event = CashEventInput(
                deal_id=None, event_date=ev["event_date"], amount_minor=ev["amount_minor"],
                direction=ev["direction"], kind=ev["kind"], certainty=ev["certainty"],
                description=ev["description"], invoice_ref=ev["invoice_ref"],
                is_deferrable=ev["is_deferrable"], incremental=False, customer_id=None,
                payee_id=None,
                evidence={
                    "document_id": str(row["document_id"]), "content_hash": digest,
                    "candidate_id": None, "confirmed_field_id": None, "source_role": "baseline",
                    "page": 1, "quote": quote, "manual_attestation": None, "override_reason": None,
                },
            )
            current = c.execute(
                text("SELECT financial_revision FROM business WHERE id=:b"), {"b": scope.business_id}
            ).scalar_one()
            created.append(
                CashEventRepository.create_event(
                    c, scope, CashEventCreate(expected_financial_revision=current, event=event)
                )
            )
        append_audit(c, scope, "csv_confirm", deal_id=row["deal_id"],
                     payload={"preview_id": str(req.preview_id), "events": len(created)})
        return created


def _plain(value):
    if value is None:
        return None
    return value if isinstance(value, str) else json.dumps(value)


def _preview_dto(row) -> CSVPreview:
    events = [
        {
            "deal_id": None, "event_date": e["event_date"], "amount_minor": e["amount_minor"],
            "direction": e["direction"], "kind": e["kind"], "certainty": e["certainty"],
            "description": e["description"], "invoice_ref": e["invoice_ref"],
            "is_deferrable": e["is_deferrable"], "incremental": False, "customer_id": None,
            "payee_id": None,
            "evidence": {
                "document_id": str(row["document_id"]), "content_hash": bytes(row["document_hash"]).hex(),
                "candidate_id": None, "confirmed_field_id": None, "source_role": "baseline",
                "page": 1, "quote": f"row {e['row']}", "manual_attestation": None,
                "override_reason": None,
            },
        }
        for e in row["events"]
    ]
    return CSVPreview(
        id=row["id"], preview_hash=bytes(row["preview_hash"]).hex(),
        financial_revision=row["financial_revision"], events=events,
        errors=[Finding.model_validate(e) for e in row["errors"]],
        duplicate_keys=row["duplicate_keys"], canonical_changed=False,
    )


def preview_hash(events, errors, duplicate_keys, document_digest: str, as_of: str, currency: str) -> bytes:
    payload = json.dumps(
        [events, errors, duplicate_keys, document_digest, as_of, currency], sort_keys=True
    ).encode()
    return hashlib.sha256(payload).digest()


def new_id() -> UUID:
    return uuid4()


__all__ = ["DocumentRepository", "canonical_hash", "preview_hash", "new_id"]

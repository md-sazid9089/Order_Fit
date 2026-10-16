"""Durable extract and csv_preview job handlers.

The provider call happens outside any database transaction. Evidence rows are immutable;
the current reviewed projection (extracted_field) is only updated for unreviewed fields.
"""

import asyncio
import hashlib
import json
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import text

from orderfit.agent import llm
from orderfit.contracts.language import LanguageRequest, ParsedLanguage, SourceExcerpt
from orderfit.contracts.workflow import (
    BlockedResult,
    CompletedResult,
    Finding,
)
from orderfit.services.documents import injection_flags, parse_cash_csv, quote_supports
from orderfit.store.document_repository import preview_hash
from orderfit.store.repositories import append_audit

PROMPT_VERSION = "extract_order.v1"
MAX_SOURCES = 20


@dataclass
class Runtime:
    llm: llm.LLMSettings
    documents: object  # PrivateDocuments
    job_attempts: int = 3


def _stale():
    return BlockedResult(
        kind="blocked",
        outcome="stale",
        findings=[
            Finding(code="STALE_INPUT_VERSION", field=None, message="Inputs changed. Refresh before continuing.",
                    blocking=True, resolution="refresh")
        ],
    )


def _needs_input(code, message):
    return BlockedResult(
        kind="blocked",
        outcome="needs_input",
        findings=[Finding(code=code, field=None, message=message, blocking=True, resolution="provide_evidence")],
    )


def _page_texts(pages) -> list[str]:
    return [p for p in pages if isinstance(p, str)]


def dropped_pages(pages) -> int:
    """Readable pages beyond the extraction window; they must never be dropped silently."""
    return sum(1 for p in _page_texts(pages)[MAX_SOURCES:] if p.strip())


def build_request(doc, parse_row) -> LanguageRequest | None:
    pages = _page_texts(parse_row["pages"])
    sources = [
        SourceExcerpt(
            document_id=doc["id"],
            content_hash=bytes(doc["content_hash"]).hex(),
            source_role=doc["source_role"] or "other",
            page=index,
            text=body,
        )
        for index, body in enumerate(pages[:MAX_SOURCES], start=1)
        if body.strip()
    ]
    if not sources:
        return None
    digest = hashlib.sha256(
        json.dumps([[str(s.document_id), s.page, s.text] for s in sources], sort_keys=True).encode()
    ).hexdigest()
    return LanguageRequest(
        task="extract", input_schema_version="extract-input.v1", input_hash=digest,
        prompt_version=PROMPT_VERSION, sources=sources, allowed_fact_ids=[], user_instruction=None,
    )


def run_extract(operations, claim, job, runtime: Runtime):
    from orderfit.workflow.worker import RetryableJobError, failure

    with operations.database.job(claim["id"], claim["lease_token"]) as (c, scope):
        op = c.execute(text("SELECT source_document_id,deal_id,input_version FROM operation WHERE id=:id"),
                       {"id": claim["id"]}).mappings().one()
        doc = c.execute(text("SELECT * FROM document WHERE business_id=:b AND id=:d"),
                        {"b": claim["business_id"], "d": op["source_document_id"]}).mappings().one_or_none()
        parse_row = None if doc is None else c.execute(
            text("SELECT * FROM document_parse WHERE business_id=:b AND document_id=:d ORDER BY created_at DESC, id DESC LIMIT 1"),
            {"b": claim["business_id"], "d": doc["id"]}).mappings().one_or_none()
    if doc is None or parse_row is None:
        return failure("DOCUMENT_UNAVAILABLE")
    if parse_row["status"] != "parsed":
        return _needs_input("DOCUMENT_NOT_PARSED", "This document has no readable text. Enter the values manually.")
    if dropped_pages(parse_row["pages"]):
        return _needs_input(
            "DOCUMENT_TOO_LONG",
            f"Only the first {MAX_SOURCES} pages can be read automatically. "
            "Split the document or enter the values manually.",
        )
    request = build_request(doc, parse_row)
    if request is None:
        return _needs_input("DOCUMENT_NOT_PARSED", "This document has no readable text. Enter the values manually.")

    outcome = asyncio.run(llm.extract(request, runtime.llm))

    if outcome.result.kind != "parsed":
        retryable = outcome.result.retryable and job.attempt < runtime.job_attempts
        if retryable:
            raise RetryableJobError
    with operations.database.job(claim["id"], claim["lease_token"]) as (c, scope):
        fresh = c.execute(
            text("SELECT d.input_version FROM deal d WHERE d.business_id=:b AND d.id=:d FOR UPDATE"),
            {"b": claim["business_id"], "d": op["deal_id"]}).scalar_one_or_none()
        if fresh is None or fresh != op["input_version"]:
            return _stale()
        pages = _page_texts(parse_row["pages"])
        result = outcome.result
        run_id = c.execute(
            text(
                "INSERT INTO extraction_run(business_id,deal_id,document_id,parse_id,operation_id,llm_mode,model,prompt_name,prompt_hash,schema_name,input_hash,status,error_code)"
                " VALUES(:b,:d,:doc,:parse,:op,:mode,:model,:prompt,:ph,:schema,:ih,:status,:err) RETURNING id"
            ),
            {
                "b": claim["business_id"], "d": op["deal_id"], "doc": doc["id"], "parse": parse_row["id"],
                "op": claim["id"], "mode": runtime.llm.mode,
                "model": result.model if result.kind == "parsed" else runtime.llm.model,
                "prompt": PROMPT_VERSION,
                "ph": hashlib.sha256((llm.PROMPTS / "extract_order.md").read_bytes()).digest(),
                "schema": llm.SCHEMA_VERSION, "ih": bytes.fromhex(request.input_hash),
                "status": "completed" if result.kind == "parsed" else "unavailable",
                "err": None if result.kind == "parsed" else result.code,
            },
        ).scalar_one()
        if not isinstance(result, ParsedLanguage):
            append_audit(c, scope, "extraction_unavailable", deal_id=op["deal_id"], payload={"code": result.code})
            return _needs_input("EXTRACTION_UNAVAILABLE",
                                "Automatic extraction is unavailable. Enter the values manually.")
        stored = 0
        for cand in result.proposal.candidates:
            page_text = pages[cand.source.page - 1] if cand.source.page <= len(pages) else ""
            verdict = quote_supports(cand.field, cand.normalized_value, cand.exact_quote, page_text)
            if verdict == "quote_mismatch" and cand.status != "missing":
                continue  # unsupported claim is dropped, never stored as evidence
            status = "ambiguous" if verdict == "ambiguous" else cand.status
            flags = injection_flags([cand.exact_quote])
            value = json.dumps(cand.normalized_value)
            quote = cand.exact_quote or None
            if cand.status == "missing" or cand.normalized_value is None:
                status, value, quote = "missing", "null", None
            elif flags:
                status = "ambiguous"  # injection-like quote: a person must look before it counts
            cid = c.execute(
                text(
                    "INSERT INTO extraction_candidate(business_id,deal_id,document_id,run_id,field,value,source_page,source_quote,confidence,status,source_role)"
                    " VALUES(:b,:d,:doc,:run,:f,CAST(:v AS jsonb),:p,:q,:conf,:s,:role) RETURNING id"
                ),
                {
                    "b": claim["business_id"], "d": op["deal_id"], "doc": doc["id"], "run": run_id,
                    "f": cand.field, "v": value, "p": cand.source.page,
                    "q": quote, "conf": 0.5 if status != "extracted" else 0.8,
                    "s": status, "role": doc["source_role"],
                },
            ).scalar_one()
            stored += 1
            _project(c, claim["business_id"], op["deal_id"], doc["id"], cand, status, value, cid, quote)
        _mark_conflicts(c, claim["business_id"], op["deal_id"])
        append_audit(c, scope, "extraction_completed", deal_id=op["deal_id"],
                     payload={"run_id": str(run_id), "candidates": stored})
        return CompletedResult(
            kind="completed", resource_id=run_id,
            resource_url=f"/api/v1/businesses/{claim['business_id']}/deals/{op['deal_id']}/fields",
        )


def _project(c, business_id, deal_id, doc_id, cand, status, value, candidate_id, quote):
    """Upsert the current projection unless a human has already reviewed that field."""
    c.execute(
        text(
            "INSERT INTO extracted_field(business_id,deal_id,document_id,field,value,source_page,source_quote,confidence,status,candidate_id)"
            " VALUES(:b,:d,:doc,:f,CAST(:v AS jsonb),:p,:q,:conf,:s,:cid)"
            " ON CONFLICT (deal_id,document_id,field) DO UPDATE SET value=EXCLUDED.value,source_page=EXCLUDED.source_page,"
            " source_quote=EXCLUDED.source_quote,confidence=EXCLUDED.confidence,status=EXCLUDED.status,candidate_id=EXCLUDED.candidate_id"
            " WHERE extracted_field.status NOT IN ('confirmed','overridden','rejected')"
        ),
        {
            "b": business_id, "d": deal_id, "doc": doc_id, "f": cand.field, "v": value,
            "p": cand.source.page, "q": quote,
            "conf": 0.5 if status != "extracted" else 0.8, "s": status, "cid": candidate_id,
        },
    )


def _mark_conflicts(c, business_id, deal_id):
    """Different unreviewed values for one field across documents are conflicting."""
    c.execute(
        text(
            "UPDATE extracted_field e SET status='conflicting' WHERE e.business_id=:b AND e.deal_id=:d"
            " AND e.status IN ('extracted','ambiguous') AND EXISTS (SELECT 1 FROM extracted_field o"
            " WHERE o.business_id=e.business_id AND o.deal_id=e.deal_id AND o.field=e.field"
            " AND o.document_id<>e.document_id AND o.status<>'rejected' AND o.status<>'missing'"
            " AND COALESCE(o.confirmed_value,o.value)<>COALESCE(e.confirmed_value,e.value))"
        ),
        {"b": business_id, "d": deal_id},
    )


def handle_csv_preview(job, c, scope, runtime: Runtime):
    from orderfit.workflow.worker import failure

    op = c.execute(text("SELECT source_document_id,deal_id,financial_revision,input_version FROM operation WHERE id=:id"),
                   {"id": job.operation_id}).mappings().one()
    doc = c.execute(text("SELECT * FROM document WHERE business_id=:b AND id=:d"),
                    {"b": scope.business_id, "d": op["source_document_id"]}).mappings().one_or_none()
    if doc is None:
        return failure("DOCUMENT_UNAVAILABLE")
    parse_row = c.execute(
        text("SELECT * FROM document_parse WHERE business_id=:b AND document_id=:d ORDER BY created_at DESC, id DESC LIMIT 1"),
        {"b": scope.business_id, "d": doc["id"]}).mappings().one_or_none()
    if parse_row is None or parse_row["status"] != "parsed" or doc["mime_type"] != "text/csv":
        return _needs_input("DOCUMENT_NOT_PARSED", "This document is not a readable CSV file.")
    raw = runtime.documents.read(scope.business_id, doc["deal_id"], doc["id"]).decode("utf-8-sig")
    from datetime import date

    as_of_text, currency = _csv_parameters(c, job.operation_id, scope.business_id)
    business_currency = c.execute(
        text("SELECT currency FROM business WHERE id=:b"), {"b": scope.business_id}
    ).scalar_one()
    if currency != str(business_currency).strip():
        return _needs_input("CSV-CURRENCY", "The import currency must match the business currency.")
    outcome = parse_cash_csv(raw, date.fromisoformat(as_of_text))
    digest = bytes(doc["content_hash"]).hex()
    h = preview_hash(outcome.events, outcome.errors, outcome.duplicate_keys, digest, as_of_text, currency)
    pid = c.execute(
        text(
            "INSERT INTO csv_preview(business_id,deal_id,document_id,financial_revision,currency,as_of,events,errors,duplicate_keys,preview_hash)"
            " VALUES(:b,:d,:doc,:fr,:cur,:as_of,CAST(:ev AS jsonb),CAST(:er AS jsonb),CAST(:dk AS jsonb),:h) RETURNING id"
        ),
        {
            "b": scope.business_id, "d": doc["deal_id"], "doc": doc["id"], "fr": op["financial_revision"],
            "cur": currency, "as_of": as_of_text, "ev": json.dumps(outcome.events),
            "er": json.dumps(outcome.errors), "dk": json.dumps(outcome.duplicate_keys), "h": h,
        },
    ).scalar_one()
    append_audit(c, scope, "csv_preview", deal_id=doc["deal_id"], payload={"preview_id": str(pid)})
    return CompletedResult(
        kind="completed", resource_id=pid,
        resource_url=f"/api/v1/businesses/{scope.business_id}/cash-events/csv-previews/{pid}",
    )


def _csv_parameters(c, operation_id: UUID, business_id: UUID):
    params = c.execute(
        text("SELECT parameters FROM operation WHERE business_id=:b AND id=:o"),
        {"b": business_id, "o": operation_id},
    ).scalar_one()
    return params["as_of"], params["currency"]


__all__ = ["Runtime", "run_extract", "handle_csv_preview"]

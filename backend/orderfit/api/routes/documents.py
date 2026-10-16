"""Documents, extraction candidates/review and CSV baseline import (P4)."""

import hashlib
import re
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import ValidationError

from orderfit.api.deps import identity_service, mutation, session_token
from orderfit.api.errors import ApplicationError
from orderfit.contracts.primitives import ExpectedVersions, Page
from orderfit.contracts.protocol import IdempotencyMaterial, canonical_hash
from orderfit.contracts.resources import (
    CashEventView,
    CSVConfirm,
    CSVPreview,
    CSVPreviewRequest,
    DocumentUpload,
    DocumentView,
    ExtractedFieldView,
    FieldResolution,
)
from orderfit.contracts.workflow import OperationAccepted, Review
from orderfit.services.documents import UploadRejected, parse, sniff_mime
from orderfit.store.document_repository import DocumentRepository
from orderfit.store.documents import DocumentStorageUnavailable
from orderfit.store.repositories import DealRepository, IdempotencyRepository
from orderfit.workflow.operations import Admission, Operations

router = APIRouter(prefix="/api/v1/businesses/{business_id}")
MAX_BYTES = 26214400


def _fingerprint(request, business_id, scope, body):
    return bytes.fromhex(
        canonical_hash(
            IdempotencyMaterial(
                schema_version="idempotency.v1",
                business_id=business_id,
                actor_id=scope.user_id,
                method=request.method,
                path=str(request.url.path),
                body_hash=canonical_hash(body),
            )
        )
    )


def _safe_name(name: str | None) -> str:
    base = re.split(r"[\\/]", name or "document")[-1]
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).strip() or "document"
    return base[:255]


@router.post(
    "/deals/{deal_id}/documents",
    response_model=DocumentView,
    operation_id="document_upload",
    status_code=201,
)
def upload_document(
    business_id: UUID,
    deal_id: UUID,
    request: Request,
    metadata: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
):
    service, _key, _ = mutation(request)
    try:
        meta = DocumentUpload.model_validate_json(metadata)
    except ValidationError:
        raise ApplicationError(422, "INVALID_INPUT") from None
    data = file.file.read(MAX_BYTES + 1)
    if not data:
        raise ApplicationError(422, "EMPTY_DOCUMENT")
    if len(data) > MAX_BYTES:
        raise ApplicationError(413, "REQUEST_TOO_LARGE")
    try:
        mime = sniff_mime(data, file.content_type or "")
    except UploadRejected as exc:
        raise ApplicationError(415 if exc.code == "UNSUPPORTED_MEDIA_TYPE" else 422, exc.code) from None
    if (meta.kind == "csv") != (mime == "text/csv"):
        raise ApplicationError(422, "KIND_MIME_MISMATCH")
    digest = hashlib.sha256(data).digest()
    # FastAPI has already received and spooled the multipart body before this function runs;
    # this route cannot prevent that. BodyLimit (api/main.py) admits a body above 1 MiB only
    # after its own database check of session, prepare membership and deal, and caps
    # concurrent large uploads per process and per source. Here, authorize before the
    # document parser runs: a non-member or a missing deal gets 404 without parsing. This
    # short read-only check holds no business write lock; the write transaction below
    # re-checks membership/role and versions after parsing.
    with service.database.tenant(session_token(request), business_id, "prepare", readonly=True) as (c, _):
        DealRepository.get_deal(c, business_id, deal_id)
    try:
        parsed = parse(data, mime)
    except UploadRejected as exc:
        # Capacity refusal persists neither a failed parse nor immutable source metadata;
        # the caller can retry the same upload once a parser slot is available.
        raise ApplicationError(429, exc.code, "Document processing is busy. Try again shortly.") from None
    with service.database.tenant(session_token(request), business_id, "prepare") as (c, scope):
        existing = DocumentRepository.find_duplicate(c, business_id, deal_id, digest)
        if existing:
            return existing
        doc_id = uuid4()
        try:
            key, stored_hash, size = request.app.state.documents.put(
                business_id, deal_id, doc_id, [data]
            )
        except DocumentStorageUnavailable:
            raise ApplicationError(503, "DEPENDENCY_UNAVAILABLE") from None
        if bytes.fromhex(stored_hash) != digest:
            request.app.state.documents.discard(business_id, deal_id, doc_id)
            raise ApplicationError(503, "DEPENDENCY_UNAVAILABLE")
        try:
            return DocumentRepository.create(
                c, scope, deal_id, meta, doc_id=doc_id, filename=_safe_name(file.filename),
                mime=mime, storage_key=key, digest=digest, size=size, parse=parsed,
            )
        except Exception:
            # A rejected upload (stale versions, role, constraint) leaves no orphaned bytes.
            request.app.state.documents.discard(business_id, deal_id, doc_id)
            raise


@router.get("/deals/{deal_id}/documents", response_model=Page[DocumentView], operation_id="documents")
def list_documents(
    business_id: UUID,
    deal_id: UUID,
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    cursor: str | None = Query(None, max_length=2048),
):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, scope):
        DealRepository.get_deal(c, business_id, deal_id)
        return DocumentRepository.list_documents(c, business_id, deal_id, limit, offset,
                                                  cursors=service.cursors, scope=scope, cursor=cursor)


@router.get(
    "/deals/{deal_id}/documents/{document_id}", response_model=DocumentView, operation_id="document_get"
)
def get_document(business_id: UUID, deal_id: UUID, document_id: UUID, request: Request):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, _):
        return DocumentRepository.get(c, business_id, deal_id, document_id)


@router.get(
    "/deals/{deal_id}/documents/{document_id}/download", operation_id="document_download"
)
def download_document(business_id: UUID, deal_id: UUID, document_id: UUID, request: Request):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, _):
        meta = DocumentRepository.storage(c, business_id, deal_id, document_id)
    try:
        content = request.app.state.documents.read(business_id, deal_id, document_id)
    except (FileNotFoundError, ValueError):
        raise ApplicationError(404, "NOT_FOUND") from None
    except DocumentStorageUnavailable:
        raise ApplicationError(503, "DEPENDENCY_UNAVAILABLE") from None
    name = _safe_name(meta["original_filename"]).replace('"', "")
    ascii_name = name.encode("ascii", "ignore").decode() or "document"
    return Response(
        content,
        media_type=meta["mime_type"],
        headers={
            "Content-Disposition": f"attachment; filename=\"{ascii_name}\"",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
            "Content-Security-Policy": "sandbox",
        },
    )


@router.post(
    "/deals/{deal_id}/documents/{document_id}/extract",
    response_model=OperationAccepted,
    operation_id="document_extract",
    status_code=202,
)
def extract_document(
    business_id: UUID, deal_id: UUID, document_id: UUID, data: ExpectedVersions, request: Request
):
    service, key, _ = mutation(request)
    admission = Admission(
        kind="extract", deal_id=deal_id, expected_version=data.expected_version,
        expected_input_version=data.expected_input_version,
        expected_financial_revision=data.expected_financial_revision, snapshot_id=None,
        source_document_id=document_id,
    )
    return Operations(service.database).admit(session_token(request), business_id, key, admission)


@router.get("/deals/{deal_id}/fields", response_model=Page[ExtractedFieldView], operation_id="deal_fields")
def list_fields(business_id: UUID, deal_id: UUID, request: Request):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, _):
        DealRepository.get_deal(c, business_id, deal_id)
        return Page(items=DocumentRepository.list_fields(c, business_id, deal_id), next_cursor=None)


@router.post("/deals/{deal_id}/fields/resolve", response_model=Review, operation_id="field_resolve")
def resolve_field(business_id: UUID, deal_id: UUID, data: FieldResolution, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "prepare") as (c, scope):
        cached = IdempotencyRepository.reserve(
            c, business_id, key, str(request.url.path), _fingerprint(request, business_id, scope, data)
        )
        if cached:
            return Review.model_validate(cached)
        DocumentRepository.resolve_field(c, scope, deal_id, data)
        result = DealRepository.build_review(c, business_id, deal_id)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.post(
    "/cash-events/csv-preview",
    response_model=OperationAccepted,
    operation_id="csv_preview_create",
    status_code=202,
)
def create_csv_preview(business_id: UUID, data: CSVPreviewRequest, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, _s):
        doc = DocumentRepository.csv_document(c, business_id, data.document_id)
    admission = Admission(
        kind="csv_preview", deal_id=doc["deal_id"], expected_version=doc["version"],
        expected_input_version=doc["input_version"],
        expected_financial_revision=data.expected_financial_revision, snapshot_id=None,
        source_document_id=data.document_id,
        parameters={"as_of": str(data.as_of), "currency": data.currency},
    )
    return Operations(service.database).admit(session_token(request), business_id, key, admission)


@router.get(
    "/cash-events/csv-previews/{preview_id}", response_model=CSVPreview, operation_id="csv_preview_get"
)
def get_csv_preview(business_id: UUID, preview_id: UUID, request: Request):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, _):
        return DocumentRepository.get_preview(c, business_id, preview_id)


@router.post(
    "/cash-events/csv-confirm",
    response_model=Page[CashEventView],
    operation_id="csv_confirm",
    status_code=201,
)
def confirm_csv(business_id: UUID, data: CSVConfirm, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, scope):
        cached = IdempotencyRepository.reserve(
            c, business_id, key, str(request.url.path), _fingerprint(request, business_id, scope, data)
        )
        if cached:
            return Page[CashEventView].model_validate(cached)
        events = DocumentRepository.confirm_csv(c, scope, data)
        result = Page[CashEventView](items=events, next_cursor=None)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result

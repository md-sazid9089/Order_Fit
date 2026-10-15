"""Tenant-authorized P3 decision downloads and canonical audit export."""

import hashlib
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Query, Request, Response

from orderfit.api.deps import identity_service, mutation, session_token
from orderfit.contracts.primitives import BigId
from orderfit.contracts.protocol import IdempotencyMaterial, canonical_hash
from orderfit.contracts.resources import AuditExport, ExportView
from orderfit.services.exports import audit_export, create_decision_export, decision_download
from orderfit.store.repositories import IdempotencyRepository

router = APIRouter(prefix="/api/v1/businesses/{business_id}")


@router.get("/audit/export", response_model=AuditExport, operation_id="audit_export")
def get_audit_export(business_id: UUID, request: Request,
                     from_sequence: Annotated[BigId | None, Query()] = None,
                     to_sequence: Annotated[BigId | None, Query()] = None):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "audit") as (c, _):
        return audit_export(c, business_id, int(from_sequence) if from_sequence else None,
                            int(to_sequence) if to_sequence else None)


@router.post("/deals/{deal_id}/decision-export", response_model=ExportView,
             status_code=201, operation_id="decision_export")
def export_decision(business_id: UUID, deal_id: UUID, request: Request,
                    payload: Annotated[None, Body()] = None):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "audit") as (c, scope):
        fingerprint = bytes.fromhex(canonical_hash(IdempotencyMaterial(
            schema_version="idempotency.v1", business_id=business_id, actor_id=scope.user_id,
            method="POST", path=str(request.url.path), body_hash=hashlib.sha256(b"null").hexdigest())))
        cached = IdempotencyRepository.reserve(c, business_id, key, str(request.url.path), fingerprint)
        if cached:
            return ExportView.model_validate(cached)
        result = create_decision_export(c, scope, deal_id)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.get("/exports/{export_id}/download", operation_id="export_download")
def download_decision(business_id: UUID, export_id: UUID, request: Request):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "audit") as (c, _):
        content = decision_download(c, business_id, export_id)
    return Response(content=content, media_type="application/json", headers={
        "Content-Disposition": f'attachment; filename="orderfit-decision-{export_id}.json"',
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})

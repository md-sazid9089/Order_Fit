"""P6 exact bundles, approvals and sandbox execution. Effects run only in the worker."""

from uuid import UUID

from fastapi import APIRouter, Query, Request

from orderfit.api.deps import identity_service, mutation, session_token
from orderfit.contracts.primitives import Page, ReasonCommand
from orderfit.contracts.protocol import IdempotencyMaterial, canonical_hash
from orderfit.contracts.resources import CompensationRequest, PrepareBundle
from orderfit.contracts.workflow import (
    ActionView,
    ApprovalRequest,
    ApprovalView,
    BundleView,
    ExecuteRequest,
    ExecutionRun,
    OperationAccepted,
)
from orderfit.services import bundles, execution
from orderfit.store.repositories import IdempotencyRepository

router = APIRouter(prefix="/api/v1/businesses/{business_id}", tags=["bundles"])


def idempotent(request, business_id, data, permission, handler):
    """Key reservation, command and audit commit together; replay returns the original body."""
    service, key, _ = mutation(request)
    path = str(request.url.path)
    with service.database.tenant(session_token(request), business_id, permission) as (c, scope):
        fingerprint = bytes.fromhex(
            canonical_hash(
                IdempotencyMaterial(
                    schema_version="idempotency.v1",
                    business_id=business_id,
                    actor_id=scope.user_id,
                    method=request.method,
                    path=path,
                    body_hash=canonical_hash(data),
                )
            )
        )
        cached = IdempotencyRepository.reserve(c, business_id, key, path, fingerprint)
        if cached:
            return cached
        result = handler(c, scope, key, fingerprint)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


def read(request, business_id, handler):
    with identity_service(request).database.tenant(session_token(request), business_id, "read") as (
        c,
        scope,
    ):
        return handler(c, scope)


@router.post(
    "/deals/{deal_id}/bundles",
    response_model=BundleView,
    status_code=201,
    operation_id="bundle_prepare",
)
def bundle_prepare(business_id: UUID, deal_id: UUID, data: PrepareBundle, request: Request):
    return idempotent(
        request, business_id, data, "prepare", lambda c, s, *_: bundles.prepare(c, s, deal_id, data)
    )


@router.get("/bundles/{bundle_id}", response_model=BundleView, operation_id="bundle_get")
def bundle_get(business_id: UUID, bundle_id: UUID, request: Request):
    return read(request, business_id, lambda c, s: bundles.bundle_view(c, s, bundle_id))


@router.post(
    "/bundles/{bundle_id}/approvals",
    response_model=ApprovalView,
    status_code=201,
    operation_id="approval_create",
)
def approval_create(business_id: UUID, bundle_id: UUID, data: ApprovalRequest, request: Request):
    return idempotent(
        request,
        business_id,
        data,
        "execute",
        lambda c, s, key, _: bundles.decide(c, s, bundle_id, data, key),
    )


@router.get("/approvals/{approval_id}", response_model=ApprovalView, operation_id="approval_get")
def approval_get(business_id: UUID, approval_id: UUID, request: Request):
    return read(request, business_id, lambda c, s: bundles.approval_view(c, s, approval_id))


@router.post(
    "/approvals/{approval_id}/revoke", response_model=ApprovalView, operation_id="approval_revoke"
)
def approval_revoke(business_id: UUID, approval_id: UUID, data: ReasonCommand, request: Request):
    return idempotent(
        request,
        business_id,
        data,
        "execute",
        lambda c, s, *_: bundles.revoke(c, s, approval_id, data),
    )


@router.post(
    "/bundles/{bundle_id}/execute",
    response_model=OperationAccepted,
    status_code=202,
    operation_id="bundle_execute",
)
def bundle_execute(business_id: UUID, bundle_id: UUID, data: ExecuteRequest, request: Request):
    """Admit one durable sandbox run for the exact approved bundle (202 + operation)."""
    return idempotent(
        request,
        business_id,
        data,
        "execute",
        lambda c, s, key, fingerprint: execution.admit(c, s, bundle_id, data, key, fingerprint),
    )


@router.get("/execution-runs/{run_id}", response_model=ExecutionRun, operation_id="execution_get")
def execution_get(business_id: UUID, run_id: UUID, request: Request):
    return read(request, business_id, lambda c, s: execution.run_view(c, s, run_id))


@router.get("/deals/{deal_id}/actions", response_model=Page[ActionView], operation_id="actions")
def actions(
    business_id: UUID,
    deal_id: UUID,
    request: Request,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    return read(request, business_id, lambda c, s: execution.actions_page(c, s, deal_id, offset, limit))


@router.post(
    "/deals/{deal_id}/compensation-bundles",
    response_model=BundleView,
    status_code=201,
    operation_id="compensation_prepare",
)
def compensation_prepare(business_id: UUID, deal_id: UUID, data: CompensationRequest, request: Request):
    return idempotent(
        request,
        business_id,
        data,
        "execute",
        lambda c, s, *_: execution.prepare_compensation(c, s, deal_id, data),
    )

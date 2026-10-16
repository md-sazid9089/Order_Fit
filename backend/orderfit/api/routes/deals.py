"""Deal lifecycle, review, confirm, and evaluation admission routes."""

from uuid import UUID

from fastapi import APIRouter, Query, Request

from orderfit.api.deps import identity_service, mutation, session_token
from orderfit.contracts.primitives import Page, ReasonCommand
from orderfit.contracts.protocol import IdempotencyMaterial, canonical_hash
from orderfit.contracts.resources import DealView, DealWrite, FlagResolution
from orderfit.contracts.workflow import (
    ConfirmInputs,
    CreateDeal,
    EvaluateRequest,
    EvaluationResultV1,
    OperationAccepted,
    Review,
    SnapshotConfirmed,
)
from orderfit.store.repositories import DealRepository, EvaluationRepository, IdempotencyRepository
from orderfit.workflow.operations import Admission, Operations

router = APIRouter(prefix="/api/v1/businesses/{business_id}/deals")


@router.get("", response_model=Page[DealView], operation_id="deals")
def list_deals(
    business_id: UUID,
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, _):
        return DealRepository.list_deals(c, business_id, limit, offset)


@router.post("", response_model=DealView, operation_id="deal_create", status_code=200)
def create_deal(business_id: UUID, data: CreateDeal, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "prepare") as (c, scope):
        fp = bytes.fromhex(
            canonical_hash(
                IdempotencyMaterial(
                    schema_version="idempotency.v1",
                    business_id=business_id,
                    actor_id=scope.user_id,
                    method="POST",
                    path=str(request.url.path),
                    body_hash=canonical_hash(data),
                )
            )
        )
        cached = IdempotencyRepository.reserve(c, business_id, key, str(request.url.path), fp)
        if cached:
            return DealView.model_validate(cached)
        result = DealRepository.create_deal(c, scope, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.get("/{deal_id}", response_model=DealView, operation_id="deal_get")
def get_deal(business_id: UUID, deal_id: UUID, request: Request):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, _):
        return DealRepository.get_deal(c, business_id, deal_id)


@router.patch("/{deal_id}", response_model=DealView, operation_id="deal_update")
def update_deal(business_id: UUID, deal_id: UUID, data: DealWrite, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "prepare") as (c, scope):
        fp = bytes.fromhex(
            canonical_hash(
                IdempotencyMaterial(
                    schema_version="idempotency.v1",
                    business_id=business_id,
                    actor_id=scope.user_id,
                    method="PATCH",
                    path=str(request.url.path),
                    body_hash=canonical_hash(data),
                )
            )
        )
        cached = IdempotencyRepository.reserve(c, business_id, key, str(request.url.path), fp)
        if cached:
            return DealView.model_validate(cached)
        result = DealRepository.update_deal(c, scope, deal_id, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.post("/{deal_id}/close", response_model=DealView, operation_id="deal_close")
def close_deal(business_id: UUID, deal_id: UUID, data: ReasonCommand, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "prepare") as (c, scope):
        fp = bytes.fromhex(
            canonical_hash(
                IdempotencyMaterial(
                    schema_version="idempotency.v1",
                    business_id=business_id,
                    actor_id=scope.user_id,
                    method="POST",
                    path=str(request.url.path),
                    body_hash=canonical_hash(data),
                )
            )
        )
        cached = IdempotencyRepository.reserve(c, business_id, key, str(request.url.path), fp)
        if cached:
            return DealView.model_validate(cached)
        result = DealRepository.close_deal(c, scope, deal_id, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.post("/{deal_id}/reopen-for-review", response_model=DealView, operation_id="deal_reopen_for_review")
def reopen_deal(business_id: UUID, deal_id: UUID, data: ReasonCommand, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "prepare") as (c, scope):
        fp = bytes.fromhex(
            canonical_hash(
                IdempotencyMaterial(
                    schema_version="idempotency.v1",
                    business_id=business_id,
                    actor_id=scope.user_id,
                    method="POST",
                    path=str(request.url.path),
                    body_hash=canonical_hash(data),
                )
            )
        )
        cached = IdempotencyRepository.reserve(c, business_id, key, str(request.url.path), fp)
        if cached:
            return DealView.model_validate(cached)
        result = DealRepository.reopen_for_review(c, scope, deal_id, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.post("/{deal_id}/hold", response_model=DealView, operation_id="deal_hold")
def hold_deal(business_id: UUID, deal_id: UUID, data: ReasonCommand, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "prepare") as (c, scope):
        fp = bytes.fromhex(
            canonical_hash(
                IdempotencyMaterial(
                    schema_version="idempotency.v1",
                    business_id=business_id,
                    actor_id=scope.user_id,
                    method="POST",
                    path=str(request.url.path),
                    body_hash=canonical_hash(data),
                )
            )
        )
        cached = IdempotencyRepository.reserve(c, business_id, key, str(request.url.path), fp)
        if cached:
            return DealView.model_validate(cached)
        result = DealRepository.hold_deal(c, scope, deal_id, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.post("/{deal_id}/flags/{flag_id}/resolve", response_model=DealView, operation_id="flag_resolve")
def resolve_flag(
    business_id: UUID, deal_id: UUID, flag_id: int, data: FlagResolution, request: Request
):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "prepare") as (c, scope):
        fp = bytes.fromhex(
            canonical_hash(
                IdempotencyMaterial(
                    schema_version="idempotency.v1",
                    business_id=business_id,
                    actor_id=scope.user_id,
                    method="POST",
                    path=str(request.url.path),
                    body_hash=canonical_hash(data),
                )
            )
        )
        cached = IdempotencyRepository.reserve(c, business_id, key, str(request.url.path), fp)
        if cached:
            return DealView.model_validate(cached)
        result = DealRepository.resolve_flag(c, scope, deal_id, flag_id, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.get("/{deal_id}/review", response_model=Review, operation_id="review")
def get_review(business_id: UUID, deal_id: UUID, request: Request):
    service = identity_service(request)
    with service.database.tenant(
        session_token(request), business_id, "prepare", readonly=True
    ) as (c, _):
        return DealRepository.build_review(c, business_id, deal_id)


@router.post("/{deal_id}/confirm", response_model=SnapshotConfirmed, operation_id="confirm")
def confirm_deal(business_id: UUID, deal_id: UUID, data: ConfirmInputs, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "prepare") as (c, scope):
        fp = bytes.fromhex(
            canonical_hash(
                IdempotencyMaterial(
                    schema_version="idempotency.v1",
                    business_id=business_id,
                    actor_id=scope.user_id,
                    method="POST",
                    path=str(request.url.path),
                    body_hash=canonical_hash(data),
                )
            )
        )
        cached = IdempotencyRepository.reserve(c, business_id, key, str(request.url.path), fp)
        if cached:
            return SnapshotConfirmed.model_validate(cached)
        result = DealRepository.confirm(c, scope, deal_id, data, key)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.post("/{deal_id}/evaluations", response_model=OperationAccepted, operation_id="evaluate", status_code=202)
def evaluate_deal(business_id: UUID, deal_id: UUID, data: EvaluateRequest, request: Request):
    service, key, _ = mutation(request)
    ops = Operations(service.database)
    admission = Admission(
        kind="evaluate",
        deal_id=deal_id,
        expected_version=data.expected_version,
        expected_input_version=data.expected_input_version,
        expected_financial_revision=data.expected_financial_revision,
        snapshot_id=data.snapshot_id,
        source_document_id=None,
    )
    return ops.admit(session_token(request), business_id, key, admission)


@router.get("/{deal_id}/evaluations", response_model=Page[EvaluationResultV1], operation_id="evaluations")
def list_evaluations(
    business_id: UUID,
    deal_id: UUID,
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, _):
        return EvaluationRepository.list_evaluations(c, business_id, deal_id, limit, offset)

"""Business profile, baseline, constraints, cash events, customers, payees, and offers."""

from uuid import UUID

from fastapi import APIRouter, Query, Request

from orderfit.api.deps import identity_service, mutation, session_token
from orderfit.contracts.primitives import Page, RevisionReason
from orderfit.contracts.protocol import IdempotencyMaterial, canonical_hash
from orderfit.contracts.resources import (
    BaselineView,
    BaselineWrite,
    BusinessView,
    CashEventCreate,
    CashEventView,
    CashEventWrite,
    ConstraintsView,
    ConstraintWrite,
    CustomerCreate,
    CustomerView,
    CustomerWrite,
    OfferCreate,
    OfferView,
    OfferWrite,
    PayeeCreate,
    PayeeView,
    PayeeWrite,
)
from orderfit.contracts.workflow import Series
from orderfit.store.repositories import (
    BusinessRepository,
    CashEventRepository,
    ConstraintsRepository,
    CustomerRepository,
    IdempotencyRepository,
    OfferRepository,
    PayeeRepository,
)

router = APIRouter(prefix="/api/v1/businesses/{business_id}")


# --- Profile & Baseline ---


@router.get("/profile", response_model=BusinessView, operation_id="business_profile")
def get_profile(business_id: UUID, request: Request):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, _):
        return BusinessRepository.get_profile(c, business_id)


@router.get("/baseline", response_model=BaselineView, operation_id="baseline_get")
def get_baseline(business_id: UUID, request: Request):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, _):
        return BusinessRepository.get_baseline(c, business_id)


@router.patch("/baseline", response_model=BaselineView, operation_id="baseline_update")
def update_baseline(business_id: UUID, data: BaselineWrite, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, scope):
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
            return BaselineView.model_validate(cached)
        result = BusinessRepository.update_baseline(c, scope, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


# --- Constraints ---


@router.get("/constraints", response_model=Page[ConstraintsView], operation_id="constraints_list")
def list_constraints(
    business_id: UUID,
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    cursor: str | None = Query(None, max_length=2048),
    default_only: bool = Query(False),
):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, scope):
        return ConstraintsRepository.list_constraints(c, business_id, limit, offset, cursor=cursor, cursors=service.cursors, scope=scope,
                                                     default_only=default_only)


@router.get("/constraints/{constraints_id}", response_model=ConstraintsView, operation_id="constraints_get")
def get_constraints(business_id: UUID, constraints_id: UUID, request: Request):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, _):
        return ConstraintsRepository.get_constraints(c, business_id, constraints_id)


@router.post("/constraints", response_model=ConstraintsView, operation_id="constraints_create", status_code=200)
def create_constraints(business_id: UUID, data: ConstraintWrite, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, scope):
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
            return ConstraintsView.model_validate(cached)
        result = ConstraintsRepository.create_version(c, scope, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


# --- Cash Events & Cash Flow ---


@router.get("/cash-events", response_model=Page[CashEventView], operation_id="cash_events")
def list_cash_events(
    business_id: UUID,
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    cursor: str | None = Query(None, max_length=2048),
):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, scope):
        return CashEventRepository.list_events(c, business_id, None, limit, offset, cursor=cursor, cursors=service.cursors, scope=scope)


@router.post("/cash-events", response_model=CashEventView, operation_id="cash_event_create", status_code=200)
def create_cash_event(business_id: UUID, data: CashEventCreate, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, scope):
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
            return CashEventView.model_validate(cached)
        result = CashEventRepository.create_event(c, scope, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.patch("/cash-events/{event_id}", response_model=CashEventView, operation_id="cash_event_update")
def update_cash_event(business_id: UUID, event_id: int, data: CashEventWrite, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, scope):
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
            return CashEventView.model_validate(cached)
        result = CashEventRepository.update_event(c, scope, event_id, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.post("/cash-events/{event_id}/void", response_model=CashEventView, operation_id="cash_event_void")
def void_cash_event(business_id: UUID, event_id: int, data: RevisionReason, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, scope):
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
            return CashEventView.model_validate(cached)
        result = CashEventRepository.void_event(c, scope, event_id, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.get("/cash-flow", response_model=Series, operation_id="cash_flow")
def get_cash_flow(business_id: UUID, request: Request):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, _):
        return CashEventRepository.get_cash_flow_series(c, business_id)


# --- Customers ---


@router.get("/customers", response_model=Page[CustomerView], operation_id="customers")
def list_customers(
    business_id: UUID,
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    cursor: str | None = Query(None, max_length=2048),
):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, scope):
        return CustomerRepository.list_customers(c, business_id, limit, offset, cursor=cursor, cursors=service.cursors, scope=scope)


@router.post("/customers", response_model=CustomerView, operation_id="customer_create", status_code=200)
def create_customer(business_id: UUID, data: CustomerCreate, request: Request):
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
            return CustomerView.model_validate(cached)
        result = CustomerRepository.create_customer(c, scope, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.patch("/customers/{customer_id}", response_model=CustomerView, operation_id="customer_update")
def update_customer(business_id: UUID, customer_id: UUID, data: CustomerWrite, request: Request):
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
            return CustomerView.model_validate(cached)
        result = CustomerRepository.update_customer(c, scope, customer_id, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.post("/customers/{customer_id}/archive", response_model=CustomerView, operation_id="customer_archive")
def archive_customer(business_id: UUID, customer_id: UUID, data: RevisionReason, request: Request):
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
            return CustomerView.model_validate(cached)
        result = CustomerRepository.archive_customer(c, scope, customer_id, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


# --- Payees ---


@router.get("/payees", response_model=Page[PayeeView], operation_id="payees")
def list_payees(
    business_id: UUID,
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    cursor: str | None = Query(None, max_length=2048),
):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, scope):
        return PayeeRepository.list_payees(c, business_id, limit, offset, cursor=cursor, cursors=service.cursors, scope=scope)


@router.post("/payees", response_model=PayeeView, operation_id="payee_create", status_code=200)
def create_payee(business_id: UUID, data: PayeeCreate, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, scope):
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
            return PayeeView.model_validate(cached)
        result = PayeeRepository.create_payee(c, scope, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.patch("/payees/{payee_id}", response_model=PayeeView, operation_id="payee_update")
def update_payee(business_id: UUID, payee_id: UUID, data: PayeeWrite, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, scope):
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
            return PayeeView.model_validate(cached)
        result = PayeeRepository.update_payee(c, scope, payee_id, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.post("/payees/{payee_id}/archive", response_model=PayeeView, operation_id="payee_archive")
def archive_payee(business_id: UUID, payee_id: UUID, data: RevisionReason, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, scope):
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
            return PayeeView.model_validate(cached)
        result = PayeeRepository.archive_payee(c, scope, payee_id, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


# --- Financing Offers ---


@router.get("/financing-offers", response_model=Page[OfferView], operation_id="offers")
def list_offers(
    business_id: UUID,
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    cursor: str | None = Query(None, max_length=2048),
):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, scope):
        return OfferRepository.list_offers(c, business_id, limit, offset, cursor=cursor, cursors=service.cursors, scope=scope)


@router.post("/financing-offers", response_model=OfferView, operation_id="offer_create", status_code=200)
def create_offer(business_id: UUID, data: OfferCreate, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, scope):
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
            return OfferView.model_validate(cached)
        result = OfferRepository.create_offer(c, scope, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.patch("/financing-offers/{offer_id}", response_model=OfferView, operation_id="offer_update")
def update_offer(business_id: UUID, offer_id: UUID, data: OfferWrite, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, scope):
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
            return OfferView.model_validate(cached)
        result = OfferRepository.update_offer(c, scope, offer_id, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.post("/financing-offers/{offer_id}/archive", response_model=OfferView, operation_id="offer_archive")
def archive_offer(business_id: UUID, offer_id: UUID, data: RevisionReason, request: Request):
    service, key, _ = mutation(request)
    with service.database.tenant(session_token(request), business_id, "manage_finance") as (c, scope):
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
            return OfferView.model_validate(cached)
        result = OfferRepository.archive_offer(c, scope, offer_id, data)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result

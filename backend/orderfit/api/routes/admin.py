"""Typed, capability-gated, read-only platform administration."""

from fastapi import APIRouter, Depends, Query, Request

from orderfit.api.deps import identity_service, require_admin, session_token
from orderfit.contracts.admin import (
    AdminCapabilities,
    AdminOrder,
    AdminOverview,
    AdminSystem,
    AdminTenant,
    AdminUser,
)
from orderfit.contracts.primitives import Page
from orderfit.contracts.workflow import ErrorEnvelope
from orderfit.services import admin

router = APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/capabilities", response_model=AdminCapabilities, operation_id="admin_capabilities")
def capabilities(request: Request):
    return admin.capabilities(identity_service(request))


@router.get("/overview", response_model=AdminOverview, operation_id="admin_overview")
def overview(request: Request):
    return admin.overview(identity_service(request), session_token(request))


@router.get("/users", response_model=Page[AdminUser], operation_id="admin_users")
def users(request: Request, limit: int = Query(50, ge=1, le=100),
          cursor: str | None = Query(None, max_length=2048)):
    return admin.listing(identity_service(request), session_token(request), "users", limit, cursor)


@router.get("/tenants", response_model=Page[AdminTenant], operation_id="admin_tenants")
def tenants(request: Request, limit: int = Query(50, ge=1, le=100),
            cursor: str | None = Query(None, max_length=2048)):
    return admin.listing(identity_service(request), session_token(request), "tenants", limit, cursor)


@router.get("/orders", response_model=Page[AdminOrder], operation_id="admin_orders")
def orders(request: Request, limit: int = Query(50, ge=1, le=100),
           cursor: str | None = Query(None, max_length=2048)):
    return admin.listing(identity_service(request), session_token(request), "orders", limit, cursor)


@router.get("/logs", response_model=ErrorEnvelope, status_code=503, operation_id="admin_logs")
def logs(request: Request):
    raise admin.unavailable()


@router.get("/system", response_model=AdminSystem, operation_id="admin_system")
def system(request: Request):
    return admin.system(identity_service(request), session_token(request), getattr(request.app.state, "documents", None))

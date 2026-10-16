"""P7 per-recipient notifications (own rows only) and customer invoice history."""

import hashlib
from datetime import date
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Body, Path, Query, Request

from orderfit.api.commands import command, read
from orderfit.api.errors import ApplicationError
from orderfit.contracts.primitives import Acknowledgement, BigId, EmptyRequest, Page
from orderfit.contracts.resources import (
    CustomerHistory,
    InvoiceImport,
    InvoiceView,
    Notification,
    NotificationsRead,
)
from orderfit.services import invoices, notifications

router = APIRouter(prefix="/api/v1/businesses/{business_id}", tags=["notifications"])


@router.get("/notifications", response_model=Page[Notification], operation_id="notifications")
def list_notifications(business_id: UUID, request: Request, cursor: str | None = Query(None, max_length=2048),
                       limit: int = Query(50, ge=1, le=100)):
    return read(request, business_id, "read",
                lambda c, s, svc: notifications.list_own(c, s, svc.cursors, cursor, limit))


@router.post("/notifications/read", response_model=Acknowledgement, operation_id="notifications_read")
def notifications_read(business_id: UUID, data: NotificationsRead, request: Request):
    return command(request, business_id, data, "read",
                   lambda c, s, _: notifications.read_through(c, s, data, str(uuid4())))


@router.post("/notifications/{notification_id}/read", response_model=Notification, operation_id="notification_read")
def notification_read(business_id: UUID, notification_id: Annotated[BigId, Path()], request: Request,
                      payload: Annotated[EmptyRequest | None, Body()] = None):
    return command(request, business_id, None, "read",
                   lambda c, s, _: notifications.read_one(c, s, int(notification_id)),
                   body_hash=hashlib.sha256(b"null").hexdigest())


@router.get("/customers/{customer_id}/invoices", response_model=Page[InvoiceView], operation_id="invoices")
def list_invoices(business_id: UUID, customer_id: UUID, request: Request,
                  cursor: str | None = Query(None, max_length=2048), limit: int = Query(50, ge=1, le=100)):
    return read(request, business_id, "read",
                lambda c, s, svc: invoices.list_invoices(c, s, svc.cursors, customer_id, cursor, limit))


@router.post("/customers/{customer_id}/invoices/import", response_model=Page[InvoiceView], status_code=201,
             operation_id="invoices_import")
def import_invoices(business_id: UUID, customer_id: UUID, data: InvoiceImport, request: Request):
    return command(request, business_id, data, "prepare",
                   lambda c, s, svc: invoices.import_invoices(c, s, svc.cursors, customer_id, data))


@router.get("/customers/{customer_id}/history", response_model=CustomerHistory, operation_id="customer_history")
def customer_history(business_id: UUID, customer_id: UUID, request: Request, as_of: Annotated[date, Query()]):
    if not date(2000, 1, 1) <= as_of <= date(2100, 12, 31):
        raise ApplicationError(422, "INVALID_INPUT", "Check the request fields.")
    return read(request, business_id, "read",
                lambda c, s, _: invoices.history_as_of(c, s, customer_id, as_of))

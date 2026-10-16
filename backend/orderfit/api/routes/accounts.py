"""P7 payee bank accounts: fingerprints and human-recorded verification evidence."""

from uuid import UUID

from fastapi import APIRouter, Query, Request

from orderfit.api.commands import command, read
from orderfit.api.deps import identity_service
from orderfit.contracts.primitives import Page, RevisionReason
from orderfit.contracts.protocol import request_body_digest
from orderfit.contracts.resources import AccountCreate, AccountVerification, AccountView
from orderfit.services import accounts

router = APIRouter(prefix="/api/v1/businesses/{business_id}/payees/{payee_id}", tags=["payees"])


def fingerprinter(request) -> accounts.Fingerprinter:
    config = identity_service(request).config
    return accounts.Fingerprinter(
        config.account_fingerprint_key.get_secret_value().encode("utf-8"),
        config.account_fingerprint_key_version,
    )


@router.get("/accounts", response_model=Page[AccountView], operation_id="accounts")
def list_accounts(business_id: UUID, payee_id: UUID, request: Request,
                  cursor: str | None = Query(None, max_length=2048), limit: int = Query(50, ge=1, le=100)):
    return read(request, business_id, "read",
                lambda c, s, svc: accounts.list_accounts(c, s, svc.cursors, payee_id, cursor, limit))


@router.post("/accounts", response_model=AccountView, status_code=201, operation_id="account_create")
def account_create(business_id: UUID, payee_id: UUID, data: AccountCreate, request: Request):
    # The account number is secret: the replay fingerprint is a keyed digest, never a hash
    # of Pydantic's redacted form, and no raw number reaches cache, audit or logs.
    service = identity_service(request)
    return command(request, business_id, data, "manage_finance",
                   lambda c, s, _: accounts.add_account(c, s, fingerprinter(request), payee_id, data),
                   body_hash=request_body_digest(data, service.request_key))


@router.post("/accounts/{account_id}/verify", response_model=AccountView, operation_id="account_verify")
def account_verify(business_id: UUID, payee_id: UUID, account_id: UUID, data: AccountVerification, request: Request):
    return command(request, business_id, data, "manage_finance",
                   lambda c, s, _: accounts.verify_account(c, s, payee_id, account_id, data))


@router.post("/accounts/{account_id}/revoke", response_model=AccountView, operation_id="account_revoke")
def account_revoke(business_id: UUID, payee_id: UUID, account_id: UUID, data: RevisionReason, request: Request):
    return command(request, business_id, data, "manage_finance",
                   lambda c, s, _: accounts.revoke_account(c, s, payee_id, account_id, data))

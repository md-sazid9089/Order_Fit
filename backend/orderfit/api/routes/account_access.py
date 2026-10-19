"""Browser account commands and signature-authenticated provider callbacks."""

from fastapi import APIRouter, Request, Response
from starlette.concurrency import run_in_threadpool

from orderfit.api.deps import identity_service, mutation, session_token
from orderfit.api.errors import ApplicationError
from orderfit.contracts.account_access import (
    AccountAccessCapabilities,
    InvitationRegister,
    PasswordResetConfirm,
    PasswordResetRequest,
    TokenConfirm,
    VerificationRequest,
)
from orderfit.contracts.primitives import Acknowledgement
from orderfit.services.account_access import AccountAccess

router = APIRouter(prefix="/api/v1", tags=["account-access"])


def service(request):
    return AccountAccess(identity_service(request))


def source(request):
    return request.client.host if request.client else "unknown"


@router.get(
    "/auth/account-access",
    response_model=AccountAccessCapabilities,
    operation_id="account_access_capabilities",
)
def capabilities(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return service(request).capabilities()


@router.post(
    "/auth/email-verification/request",
    response_model=Acknowledgement,
    status_code=202,
    operation_id="email_verification_request",
)
def verification_request(data: VerificationRequest, request: Request, response: Response):
    _, key, _ = mutation(request)
    response.headers["Cache-Control"] = "no-store"
    return service(request).request(
        "verify_email", data, key, source(request), session_token(request)
    )


@router.post(
    "/auth/email-verification/confirm",
    response_model=Acknowledgement,
    operation_id="email_verification_confirm",
)
def verification_confirm(data: TokenConfirm, request: Request, response: Response):
    _, key, _ = mutation(request)
    response.headers["Cache-Control"] = "no-store"
    return service(request).confirm(
        "verify_email", data, key, source(request), session_token(request)
    )


@router.post(
    "/auth/password-reset/request",
    response_model=Acknowledgement,
    status_code=202,
    operation_id="password_reset_request",
)
def reset_request(data: PasswordResetRequest, request: Request, response: Response):
    _, key, _ = mutation(request, authenticated=False)
    response.headers["Cache-Control"] = "no-store"
    return service(request).request("reset_password", data, key, source(request))


@router.post(
    "/auth/password-reset/confirm",
    response_model=Acknowledgement,
    operation_id="password_reset_confirm",
)
def reset_confirm(data: PasswordResetConfirm, request: Request, response: Response):
    _, key, _ = mutation(request, authenticated=False)
    result = service(request).confirm("reset_password", data, key, source(request))
    response.headers["Cache-Control"] = "no-store"
    response.delete_cookie("orderfit_session", path="/")
    response.delete_cookie("orderfit_csrf", path="/")
    return result


@router.post(
    "/auth/invitations/register",
    response_model=Acknowledgement,
    status_code=201,
    operation_id="invitation_register",
)
def invitation_register(data: InvitationRegister, request: Request, response: Response):
    _, key, _ = mutation(request, authenticated=False)
    response.headers["Cache-Control"] = "no-store"
    return service(request).register(data, key, source(request))


@router.post("/webhooks/resend", response_model=Acknowledgement, operation_id="resend_webhook")
async def resend_webhook(request: Request):
    from orderfit.services.resend import accept_webhook

    config = identity_service(request).config
    if config.account_email_mode != "resend" or not config.resend_webhook_secret:
        raise ApplicationError(503, "ACCOUNT_EMAIL_UNAVAILABLE")
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 256 * 1024:
            raise ApplicationError(413, "REQUEST_TOO_LARGE")
    return await run_in_threadpool(
        accept_webhook,
        identity_service(request).database,
        config,
        bytes(raw),
        dict(request.headers),
    )

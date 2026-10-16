"""CSRF-protected WebAuthn commands; never return the session credential in JSON."""

from uuid import uuid4

from fastapi import APIRouter, Request, Response

from orderfit.api.deps import mutation
from orderfit.api.routes.identity import cookies
from orderfit.contracts.primitives import Acknowledgement
from orderfit.contracts.resources import (
    PasskeyOptions,
    PasskeyPassword,
    PasskeyResponse,
    SessionView,
    SignIn,
)
from orderfit.services.passkeys import Passkeys

router = APIRouter(prefix="/api/v1/auth/passkeys", tags=["identity"])


def command(request, purpose):
    identity, _, csrf = mutation(request, authenticated=purpose == "enroll")
    token = request.cookies.get("orderfit_session")
    source = request.client.host if request.client else "unknown"
    return Passkeys(identity), token, csrf, source


@router.post("/enroll/options", response_model=PasskeyOptions, operation_id="passkey_enroll_options")
def enroll_options(data: PasskeyPassword, request: Request):
    service, token, csrf, source = command(request, "enroll")
    return service.begin("enroll", data, token, csrf, source)


@router.post("/enroll/verify", response_model=Acknowledgement, operation_id="passkey_enroll_verify")
def enroll_verify(data: PasskeyResponse, request: Request, response: Response):
    service, token, csrf, source = command(request, "enroll")
    service.finish("enroll", data, token, csrf, source)
    response.delete_cookie("orderfit_session", path="/")
    response.delete_cookie("orderfit_csrf", path="/")
    return Acknowledgement(request_id=str(uuid4()), completed=True)


@router.post("/login/options", response_model=PasskeyOptions, operation_id="passkey_login_options")
def login_options(data: SignIn, request: Request):
    service, token, csrf, source = command(request, "login")
    return service.begin("login", data, token, csrf, source)


@router.post("/login/verify", response_model=SessionView, operation_id="passkey_login_verify")
def login_verify(data: PasskeyResponse, request: Request, response: Response):
    service, token, csrf, source = command(request, "login")
    view, token, csrf = service.finish("login", data, token, csrf, source)
    cookies(response, service.config, token, csrf)
    return view

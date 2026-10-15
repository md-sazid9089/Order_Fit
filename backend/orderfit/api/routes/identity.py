"""P1 HTTP identity and operation reads/commands; no future business routes mounted."""

from uuid import UUID, uuid4

from fastapi import APIRouter, Request, Response

from orderfit.api.deps import identity_service, mutation, session_token
from orderfit.api.errors import ApplicationError
from orderfit.contracts.catalogue import ENDPOINTS
from orderfit.contracts.primitives import Acknowledgement
from orderfit.contracts.resources import (
    Capabilities,
    CSRFChallenge,
    PasswordChange,
    SessionView,
    SignIn,
    SignUp,
)
from orderfit.contracts.workflow import CancelOperation, Operation

router = APIRouter(prefix="/api/v1")
IMPLEMENTED = {
    "csrf_challenge",
    "signup",
    "signin",
    "signout",
    "session",
    "password_change",
    "capabilities",
    "operation_get",
    "operation_cancel",
    # P4 documents and extraction
    "document_upload",
    "documents",
    "document_get",
    "document_download",
    "document_extract",
    "deal_fields",
    "field_resolve",
    "csv_preview_create",
    "csv_preview_get",
    "csv_confirm",
    # P3 operations
    "business_profile",
    "baseline_get",
    "baseline_update",
    "constraints_list",
    "constraints_get",
    "constraints_create",
    "cash_events",
    "cash_event_create",
    "cash_event_update",
    "cash_event_void",
    "cash_flow",
    "customers",
    "customer_create",
    "customer_update",
    "customer_archive",
    "payees",
    "payee_create",
    "payee_update",
    "payee_archive",
    "offers",
    "offer_create",
    "offer_update",
    "offer_archive",
    "deals",
    "deal_create",
    "deal_get",
    "deal_update",
    "deal_close",
    "deal_reopen_for_review",
    "deal_hold",
    "flag_resolve",
    "review",
    "confirm",
    "evaluate",
    "evaluations",
    "evaluation_get",
    "evaluation_series",
    "audit_export",
    "decision_export",
    "export_download",
}


def cookies(response, config, token, csrf):
    options = {"httponly": True, "secure": config.cookie_secure, "samesite": "lax", "path": "/"}
    if token:
        response.set_cookie("orderfit_session", token, max_age=28800, **options)
    response.set_cookie("orderfit_csrf", csrf, max_age=1800, **options)


@router.get("/auth/csrf", response_model=CSRFChallenge, operation_id="csrf_challenge")
def challenge(request: Request, response: Response):
    service = identity_service(request)
    if request.headers.get("Sec-Fetch-Site") == "cross-site" or (
        request.headers.get("Origin")
        and request.headers["Origin"] not in service.config.allowed_origins
    ):
        raise ApplicationError(403, "CSRF_REJECTED")
    csrf, expires_at = service.challenge(request.cookies.get("orderfit_session"), request.cookies.get("orderfit_csrf"))
    cookies(response, service.config, None, csrf)
    response.headers["Cache-Control"] = "no-store"
    return CSRFChallenge(csrf_token=csrf, expires_at=expires_at)


def authenticate(request, response, data):
    service, key, csrf = mutation(request, authenticated=False)
    view, token, new_csrf = service.authenticate(
        data,
        key,
        request.cookies.get("orderfit_session"),
        csrf,
        request.client.host if request.client else "unknown",
    )
    cookies(response, service.config, token, new_csrf)
    response.headers["Cache-Control"] = "no-store"
    return view


@router.post("/auth/signup", response_model=SessionView, status_code=201, operation_id="signup")
def signup(data: SignUp, request: Request, response: Response):
    return authenticate(request, response, data)


@router.post("/auth/signin", response_model=SessionView, operation_id="signin")
def signin(data: SignIn, request: Request, response: Response):
    return authenticate(request, response, data)


@router.get("/auth/me", response_model=SessionView, operation_id="session")
def me(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return identity_service(request).view(
        session_token(request), request.cookies.get("orderfit_csrf")
    )


@router.post("/auth/signout", response_model=Acknowledgement, operation_id="signout")
def signout(request: Request, response: Response):
    service, _, _ = mutation(request)
    service.signout(session_token(request))
    response.headers["Cache-Control"] = "no-store"
    response.delete_cookie("orderfit_session", path="/")
    response.delete_cookie("orderfit_csrf", path="/")
    return Acknowledgement(request_id=str(uuid4()), completed=True)


@router.post("/auth/password", response_model=Acknowledgement, operation_id="password_change")
def password_change(data: PasswordChange, request: Request, response: Response):
    service, _, _ = mutation(request)
    service.change_password(
        session_token(request), data, request.client.host if request.client else "unknown"
    )
    response.headers["Cache-Control"] = "no-store"
    response.delete_cookie("orderfit_session", path="/")
    response.delete_cookie("orderfit_csrf", path="/")
    return Acknowledgement(request_id=str(uuid4()), completed=True)


@router.get(
    "/businesses/{business_id}/capabilities",
    response_model=Capabilities,
    operation_id="capabilities",
)
def capabilities(business_id: UUID, request: Request):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id):
        return Capabilities(
            contract_version="api.v1",
            sandbox_only=True,
            llm_mode=service.config.llm_mode,
            capabilities=[
                {
                    "name": e.operation_id,
                    "status": "implemented" if e.operation_id in IMPLEMENTED else "planned",
                    "reason": None
                    if e.operation_id in IMPLEMENTED
                    else "Not implemented in this phase.",
                    "phase": e.phase,
                }
                for e in ENDPOINTS
            ],
        )


@router.get(
    "/businesses/{business_id}/operations/{operation_id}",
    response_model=Operation,
    operation_id="operation_get",
)
def operation_get(business_id: UUID, operation_id: UUID, request: Request):
    return request.app.state.operations.get(session_token(request), business_id, operation_id)


@router.post(
    "/businesses/{business_id}/operations/{operation_id}/cancel",
    response_model=Operation,
    operation_id="operation_cancel",
)
def operation_cancel(
    business_id: UUID, operation_id: UUID, data: CancelOperation, request: Request
):
    _, key, _ = mutation(request)
    return request.app.state.operations.cancel(
        session_token(request), business_id, operation_id, key, data
    )

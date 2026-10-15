"""Verified session dependencies. There is no demo or posted-actor identity path."""

from fastapi import Request

from orderfit.api.errors import ApplicationError


def identity_service(request: Request):
    service = getattr(request.app.state, "identity", None)
    if service is None:
        raise ApplicationError(503, "SERVICE_NOT_STARTED")
    return service


def session_token(request: Request):
    token = request.cookies.get("orderfit_session")
    if not token:
        raise ApplicationError(401, "INVALID_SESSION")
    return token


def mutation(request: Request, *, authenticated=True):
    service = identity_service(request)
    if request.url.query:
        raise ApplicationError(400, "MUTATION_QUERY_UNSUPPORTED")
    key = request.headers.get("Idempotency-Key", "")
    if not key.strip() or len(key) > 200:
        raise ApplicationError(422, "INVALID_IDEMPOTENCY_KEY")
    csrf = request.cookies.get("orderfit_csrf")
    service.validate_csrf(csrf, request.headers.get("X-CSRF-Token"), request.headers.get("Origin"))
    if authenticated:
        service.mutation_session(session_token(request), csrf)
    return service, key, csrf

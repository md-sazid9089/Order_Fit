"""Curated HTTP errors; no driver/provider text or validation input is returned."""

import logging
from uuid import uuid4

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException

from orderfit.contracts.protocol import sql_error_contract
from orderfit.contracts.workflow import ErrorDetail, ErrorEnvelope, SafeError


class ApplicationError(Exception):
    def __init__(
        self, status: int, code: str, message: str = "The request could not be completed.",
        *, details: ErrorDetail | None = None,
    ):
        self.status, self.code, self.message = status, code, message
        self.details = details or ErrorDetail()


# Outcomes worth an immutable security_event row. Everything else (anonymous probes,
# unknown routes, request validation) is operational noise and must not write to the
# append-only table: recording it would be unbounded write amplification.
_SECURITY_CODES = frozenset({"INVALID_CREDENTIALS", "AUTH_RATE_LIMIT", "CSRF_REJECTED"})


def is_security_relevant(exc: Exception, status: int, code: str, has_session: bool) -> bool:
    """Decide whether a handled error is recorded as a security event.

    Only requests carrying a session cookie qualify, and only when the failure was
    raised by application code after authentication: 403/CSRF denials, authentication
    failures on an existing session, cross-tenant/unknown business-resource 404s and
    stale-input rejections. Framework routing 404/405 and request-validation 422 are
    never recorded, and an unresolvable session (INVALID_SESSION) is not attributable.
    """
    if not has_session or code == "INVALID_SESSION":
        return False
    if isinstance(exc, RequestValidationError):
        return False
    if isinstance(exc, HTTPException) and not isinstance(exc, ApplicationError):
        return status == 403
    if isinstance(exc, ApplicationError):
        return (
            status == 403
            or code in _SECURITY_CODES
            or status == 404
            or (status == 409 and code.startswith("STALE_"))
        )
    return isinstance(exc, DBAPIError) and status == 403


LOG = logging.getLogger("orderfit.api")


def _origin(exc) -> str:
    """Innermost frame as module:line; never the exception message (it may echo inputs)."""
    tb = exc.__traceback__
    while tb is not None and tb.tb_next is not None:
        tb = tb.tb_next
    if tb is None:
        return "unknown"
    return f"{tb.tb_frame.f_globals.get('__name__', '?')}:{tb.tb_lineno}"


def log_failure(request, exc, status, code, request_id):
    """Unhandled/dependency failures are logged with the request id the client receives.

    Logged: request id, method, route template (no query string), status, safe code, exception
    type, SQLSTATE and origin line. Never bodies, headers, cookies, messages or parameters.
    """
    if status < 500 and not isinstance(exc, DBAPIError):
        return
    route = request.scope.get("route")
    LOG.error(
        "request_failed request_id=%s method=%s route=%s status=%s code=%s error_type=%s sqlstate=%s origin=%s",
        request_id,
        request.method,
        getattr(route, "path", "unmatched"),
        status,
        code,
        type(exc).__name__,
        getattr(getattr(exc, "orig", None), "sqlstate", None) or "-",
        _origin(exc),
    )


def install_errors(app):
    async def handle(request: Request, exc: Exception):
        if isinstance(exc, ApplicationError):
            status, code, message = exc.status, exc.code, exc.message
        elif isinstance(exc, RequestValidationError):
            status, code, message = 422, "INVALID_INPUT", "Check the request fields."
        elif isinstance(exc, HTTPException):
            status = exc.status_code
            code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(status, "REQUEST_REJECTED")
            message = "The request could not be completed."
        elif isinstance(exc, DBAPIError):
            status, code = sql_error_contract(getattr(exc.orig, "sqlstate", ""))
            message = "The database could not complete this request."
        else:
            status, code, message = (
                503,
                "DEPENDENCY_UNAVAILABLE",
                "The service is temporarily unavailable.",
            )
        # Denials persist after the failed business transaction has rolled back.
        database = getattr(request.app.state, "database", None)
        token = request.cookies.get("orderfit_session")
        if database is not None and is_security_relevant(exc, status, code, bool(token)):
            await run_in_threadpool(
                database.record_security, token, code)
        request_id = uuid4()
        log_failure(request, exc, status, code, request_id)
        error = ErrorEnvelope(
            error=SafeError(
                code=code,
                message=message,
                request_id=request_id,
                details=exc.details if isinstance(exc, ApplicationError) else ErrorDetail(),
                retryable=status in {429, 503},
            )
        )
        return JSONResponse(status_code=status, content=error.model_dump(mode="json"),
                            headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})

    for error_type in (
        ApplicationError,
        RequestValidationError,
        HTTPException,
        DBAPIError,
        Exception,
    ):
        app.add_exception_handler(error_type, handle)

"""Curated HTTP errors; no driver/provider text or validation input is returned."""

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
        self, status: int, code: str, message: str = "The request could not be completed."
    ):
        self.status, self.code, self.message = status, code, message


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
        if database is not None:
            await run_in_threadpool(
                database.record_security, request.cookies.get("orderfit_session"), code
            )
        error = ErrorEnvelope(
            error=SafeError(
                code=code,
                message=message,
                request_id=uuid4(),
                details=ErrorDetail(),
                retryable=status in {429, 503},
            )
        )
        return JSONResponse(status_code=status, content=error.model_dump(mode="json"))

    for error_type in (
        ApplicationError,
        RequestValidationError,
        HTTPException,
        DBAPIError,
        Exception,
    ):
        app.add_exception_handler(error_type, handle)

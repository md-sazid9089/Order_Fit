"""P1 startup validates runtime credentials and schema before accepting traffic."""

import os
import re
from contextlib import asynccontextmanager
from uuid import UUID, uuid4

import anyio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from orderfit.api.errors import ApplicationError, install_errors
from orderfit.api.routes.accounts import router as accounts_router
from orderfit.api.routes.admin import router as admin_router
from orderfit.api.routes.bundles import router as bundles_router
from orderfit.api.routes.business import router as business_router
from orderfit.api.routes.deals import router as deals_router
from orderfit.api.routes.documents import router as documents_router
from orderfit.api.routes.evaluations import router as evaluations_router
from orderfit.api.routes.exports import router as exports_router
from orderfit.api.routes.identity import router
from orderfit.api.routes.members import router as members_router
from orderfit.api.routes.notifications import router as notifications_router
from orderfit.api.routes.preparation import router as preparation_router
from orderfit.api.security_headers import SecurityHeaders
from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.contracts.resources import Readiness
from orderfit.services.identity import IdentityService
from orderfit.store.db import Database
from orderfit.store.documents import DocumentStorageUnavailable, create_document_store
from orderfit.store.repositories import DealRepository
from orderfit.workflow.operations import Operations

SMALL_BODY_LIMIT = 1048576  # 1 MiB for every JSON/auth request
UPLOAD_BODY_LIMIT = 27262976  # 26 MiB file + multipart overhead
UPLOAD_PATH = re.compile(
    r"^/api/v1/businesses/(?P<business>[0-9A-Fa-f-]{36})/deals/(?P<deal>[0-9A-Fa-f-]{36})/documents$"
)


def _error(status, code, message, retryable, headers=None):
    return JSONResponse(
        {
            "error": {
                "code": code,
                "message": message,
                "request_id": str(uuid4()),
                "details": {},
                "retryable": retryable,
            }
        },
        status_code=status,
        headers=headers,
    )


def _too_large():
    return _error(413, "REQUEST_TOO_LARGE", "Request exceeds the supported size.", False)


def _body_timeout():
    return _error(408, "REQUEST_TIMEOUT", "The request body was not received in time.", True,
                  {"Connection": "close"})


def _session_cookie(scope) -> str | None:
    """The orderfit_session cookie value, or None. Presence is not authentication."""
    for name, value in scope.get("headers", ()):
        if name == b"cookie":
            for part in value.split(b";"):
                key, _, token = part.strip().partition(b"=")
                if key == b"orderfit_session" and token:
                    return token.decode("latin-1")
    return None


def _has_session_cookie(scope) -> bool:
    return _session_cookie(scope) is not None


def _declared_length(scope) -> int:
    for name, value in scope.get("headers", ()):
        if name == b"content-length" and value.isdigit():
            return int(value)
    return 0


class UploadGate:
    """Bounded admission for large upload bodies: per API process and per verified principal.

    Only requests that already passed ``authorize_upload`` acquire a slot, so anonymous or
    forged-cookie traffic can never hold one. The per-key cap is keyed by the verified user
    (the ``source`` argument is that principal key), not by network address: behind a shared
    proxy every caller has the same address. A slot is held at most ``body_seconds`` and is
    released when no body bytes arrive for ``idle_seconds``. Counters are only touched on the
    event-loop thread, so no lock is needed. A refused request is answered before any body
    byte is read.
    """

    def __init__(self, total: int, per_source: int, *, body_seconds: float = 120,
                 idle_seconds: float = 30):
        self.total, self.per_source = total, per_source
        self.body_seconds, self.idle_seconds = body_seconds, idle_seconds
        self.active = 0
        self.by_source: dict[str, int] = {}

    def try_acquire(self, source: str) -> bool:
        if self.active >= self.total or self.by_source.get(source, 0) >= self.per_source:
            return False
        self.active += 1
        self.by_source[source] = self.by_source.get(source, 0) + 1
        return True

    def release(self, source: str) -> None:
        self.active -= 1
        remaining = self.by_source.get(source, 1) - 1
        if remaining:
            self.by_source[source] = remaining
        else:
            self.by_source.pop(source, None)


class DependencyUnavailable(Exception):
    """The pre-body authorization could not reach its dependencies."""


async def authorize_upload(scope) -> str | bool:
    """Verified session + current ``prepare`` membership + existing deal, before the body.

    Returns the verified user id (the upload gate's per-principal key), or False on any
    authorization failure: the request then keeps the 1 MiB limit, takes no upload slot and
    the route returns its normal 401/403/404 (or 413 for a larger body). The route repeats
    every check; this only decides whether the large body may be received and spooled at all.
    """
    database = getattr(getattr(scope.get("app"), "state", None), "database", None)
    token = _session_cookie(scope)
    match = UPLOAD_PATH.match(scope.get("path", ""))
    if database is None or token is None or match is None:
        return False
    try:
        business_id, deal_id = UUID(match["business"]), UUID(match["deal"])
    except ValueError:
        return False

    def check():
        try:
            with database.tenant(token, business_id, "prepare", readonly=True) as (c, verified):
                DealRepository.get_deal(c, business_id, deal_id)
            return str(verified.user_id)
        except ApplicationError as exc:
            if exc.status >= 500:
                raise DependencyUnavailable from None
            return False
        except Exception as exc:  # noqa: BLE001 - a driver failure must not become a 413
            raise DependencyUnavailable from exc

    return await anyio.to_thread.run_sync(check)


class BodyLimit:
    """Bound request bodies before any route, parser or authentication work.

    FastAPI parses (and spools) multipart form data before the route function runs, so the
    route's own session check cannot protect the upload body. The large limit therefore
    applies only to the document upload route and only after (1) ``authorize_upload``
    verified the session, the caller's current ``prepare`` membership of that business and
    the deal from the database and then (2) an ``UploadGate`` slot was obtained for this
    process and that verified user. Unauthorized requests never take a slot. Everything else
    gets 1 MiB. A declared Content-Length above the limit is refused before the body is read.
    Bodies are streamed to the application (never buffered here) and counted as they arrive,
    so a chunked or understated body is cut off at the limit: the application then sees a
    disconnect, its response is discarded and a 413 is sent. A slot-holding body must also
    arrive within the gate's overall and idle deadlines, otherwise it is cut off the same way
    with a 408 and the slot is released. Residual: an authorized member can still make the
    process spool up to the gate's concurrency times 26 MiB.
    """

    def __init__(self, app, *, authorize=authorize_upload, gate=None, small_deadline=(30, 10)):
        self.app, self.authorize, self.gate = app, authorize, gate
        self.small_deadline = small_deadline

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] in {"GET", "HEAD", "OPTIONS"}:
            return await self.app(scope, receive, send)
        upload = scope["method"] == "POST" and bool(UPLOAD_PATH.match(scope["path"]))
        if not (upload and _has_session_cookie(scope)):
            return await self._limited(scope, receive, send, SMALL_BODY_LIMIT, deadline=self.small_deadline)
        if _declared_length(scope) > UPLOAD_BODY_LIMIT:
            return await _too_large()(scope, receive, send)
        gate = self.gate or getattr(getattr(scope.get("app"), "state", None), "upload_gate", None)
        if gate is None:  # not started: the route answers 503 within the small limit
            return await self._limited(scope, receive, send, SMALL_BODY_LIMIT, deadline=self.small_deadline)
        # Authorize first (no body byte is read yet): anonymous, forged-cookie or
        # foreign-tenant requests never occupy upload capacity.
        try:
            principal = await self.authorize(scope)
        except DependencyUnavailable:
            return await _error(
                503, "DEPENDENCY_UNAVAILABLE", "The service is temporarily unavailable.", True
            )(scope, receive, send)
        if not principal:
            return await self._limited(scope, receive, send, SMALL_BODY_LIMIT, deadline=self.small_deadline)
        if isinstance(principal, str):
            key = "user:" + principal
        else:  # an injected authorizer without a principal key: fall back to the peer address
            client = scope.get("client")
            key = "peer:" + (client[0] if client else "unknown")
        if not gate.try_acquire(key):
            return await _error(
                429, "UPLOAD_CAPACITY", "Too many uploads are in progress. Try again shortly.",
                True, {"Retry-After": "5"},
            )(scope, receive, send)
        try:
            return await self._limited(
                scope, receive, send, UPLOAD_BODY_LIMIT,
                deadline=(gate.body_seconds, gate.idle_seconds),
            )
        finally:
            gate.release(key)

    async def _limited(self, scope, receive, send, limit, *, deadline=None):
        if _declared_length(scope) > limit:
            return await _too_large()(scope, receive, send)
        size = 0
        cut = None  # once the body is cut off: the factory of the replacement response
        started = False
        if deadline is not None:
            total_seconds, idle_seconds = deadline
            ends = anyio.current_time() + total_seconds

        async def limited_receive():
            nonlocal size, cut
            if cut is not None:
                return {"type": "http.disconnect"}
            if deadline is None:
                message = await receive()
            else:
                message = None
                wait = min(idle_seconds, ends - anyio.current_time())
                if wait > 0:
                    with anyio.move_on_after(wait):
                        message = await receive()
                if message is None:  # idle or overall deadline passed: release the slot
                    cut = _body_timeout
                    return {"type": "http.disconnect"}
            if message["type"] == "http.request":
                size += len(message.get("body", b""))
                if size > limit:
                    cut = _too_large
                    return {"type": "http.disconnect"}
            return message

        async def guarded_send(message):
            nonlocal started
            if cut is not None and not started:
                return  # the application's reaction to the cut-off body is replaced
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, guarded_send)
        except Exception:
            if not (cut is not None and not started):
                raise
        if cut is not None and not started:
            await cut()(scope, receive, send)


def create_app(config=None, database=None):
    @asynccontextmanager
    async def lifespan(app):
        if os.environ.get("DATABASE_URL_DIRECT"):
            raise RuntimeError("Migration credentials must not be injected into API")
        resolved = config or RuntimeConfiguration()
        db = database or Database(resolved.database_url.get_secret_value())
        try:
            db.validate_runtime()
            app.state.documents = create_document_store(resolved)
            app.state.database = db
            app.state.identity = IdentityService(db, resolved)
            app.state.operations = Operations(db)
            app.state.upload_gate = UploadGate(
                resolved.upload_concurrency, resolved.upload_source_concurrency,
                body_seconds=resolved.upload_body_timeout_seconds,
                idle_seconds=resolved.upload_idle_timeout_seconds,
            )
            yield
        finally:
            db.close()

    # Interactive docs and the served schema are off unless explicitly enabled; the schema is
    # still built in-process (app.openapi()) for contract export and tests.
    docs = api_docs_enabled(config)
    app = FastAPI(
        title="OrderFit API", version="0.1.0", lifespan=lifespan,
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url="/openapi.json" if docs else None,
    )
    # Settings validation is repeated at lifespan; origins must be known before middleware starts.
    origins = (
        config.allowed_origins
        if config
        else RuntimeConfiguration.model_fields["allowed_origins"].default
    )
    if not isinstance(origins, list):
        import json

        origins = json.loads(os.environ.get("ALLOWED_ORIGINS", "[]"))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Idempotency-Key", "X-CSRF-Token"],
    )
    app.add_middleware(BodyLimit)
    app.add_middleware(SecurityHeaders)
    install_errors(app)
    app.include_router(router)
    app.include_router(business_router)
    app.include_router(deals_router)
    app.include_router(documents_router)
    app.include_router(evaluations_router)
    app.include_router(exports_router)
    app.include_router(preparation_router)
    app.include_router(bundles_router)
    app.include_router(members_router)
    app.include_router(accounts_router)
    app.include_router(notifications_router)
    app.include_router(admin_router)

    @app.get("/health", operation_id="health")
    def health():
        """Liveness only: the process answers HTTP. Not database, schema or worker health."""
        return {"status": "ok"}

    @app.get("/ready", response_model=Readiness, operation_id="ready")
    def ready():
        """Ready only with the restricted runtime login, current schema and writable storage.

        ``worker`` gates readiness on global capacity: at least one unexpired worker
        process heartbeat. Backlog age is separate and never proves liveness.
        """
        database = getattr(app.state, "database", None)
        status = (database.readiness() if database is not None
                  else {"database": False, "schema_current": False, "worker": False})
        storage = storage_writable(getattr(app.state, "documents", None))
        ok = status["database"] and status["schema_current"] and status["worker"] and storage
        body = Readiness(status="ready" if ok else "unavailable", storage=storage, **status)
        return JSONResponse(body.model_dump(mode="json"), status_code=200 if ok else 503,
                            headers={"Cache-Control": "no-store"})

    return app


def api_docs_enabled(config) -> bool:
    """EXPOSE_API_DOCS (default false), known before the lifespan validates all settings."""
    if config is not None:
        return config.expose_api_docs
    from pydantic import TypeAdapter

    raw = os.environ.get("EXPOSE_API_DOCS")
    return False if raw is None else TypeAdapter(bool).validate_python(raw)


def storage_writable(documents) -> bool:
    """Check that the configured private store can persist and remove bytes."""
    if documents is None:
        return False
    try:
        return bool(documents.writable())
    except (OSError, DocumentStorageUnavailable):
        return False


app = create_app()

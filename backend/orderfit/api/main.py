"""P1 startup validates runtime credentials and schema before accepting traffic."""

import os
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from orderfit.api.errors import install_errors
from orderfit.api.routes.business import router as business_router
from orderfit.api.routes.deals import router as deals_router
from orderfit.api.routes.documents import router as documents_router
from orderfit.api.routes.evaluations import router as evaluations_router
from orderfit.api.routes.exports import router as exports_router
from orderfit.api.routes.identity import router
from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.services.identity import IdentityService
from orderfit.store.db import Database
from orderfit.store.documents import PrivateDocuments
from orderfit.workflow.operations import Operations


class BodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] in {"GET", "HEAD", "OPTIONS"}:
            return await self.app(scope, receive, send)
        chunks = []
        size = 0
        upload = scope["method"] == "POST" and scope["path"].endswith("/documents")
        limit = 27262976 if upload else 1048576  # 26 MiB file + multipart overhead
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > limit:
                return await JSONResponse(
                    {
                        "error": {
                            "code": "REQUEST_TOO_LARGE",
                            "message": "Request exceeds the supported size.",
                            "request_id": str(uuid4()),
                            "details": {},
                            "retryable": False,
                        }
                    },
                    status_code=413,
                )(scope, receive, send)
            chunks.append(chunk)
            if not message.get("more_body", False):
                break

        async def replay():
            if chunks:
                body = b"".join(chunks)
                chunks.clear()
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


def create_app(config=None, database=None):
    @asynccontextmanager
    async def lifespan(app):
        if os.environ.get("DATABASE_URL_DIRECT"):
            raise RuntimeError("Migration credentials must not be injected into API")
        resolved = config or RuntimeConfiguration()
        db = database or Database(resolved.database_url.get_secret_value())
        try:
            db.validate_runtime()
            app.state.documents = PrivateDocuments(resolved.document_dir)
            app.state.database = db
            app.state.identity = IdentityService(db, resolved)
            app.state.operations = Operations(db)
            yield
        finally:
            db.close()

    app = FastAPI(title="OrderFit API", version="0.1.0", lifespan=lifespan)
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
    install_errors(app)
    app.include_router(router)
    app.include_router(business_router)
    app.include_router(deals_router)
    app.include_router(documents_router)
    app.include_router(evaluations_router)
    app.include_router(exports_router)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()

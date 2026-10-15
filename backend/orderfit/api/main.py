"""Liveness-only scaffold. P0 target contracts are offline, not mounted.

P1 establishes identity and durable operations before business routes land.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from orderfit.api.routes import actions, deals, documents, stream
from orderfit.config import settings


def create_app() -> FastAPI:
    app = FastAPI(title="OrderFit API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for module in (deals, documents, actions, stream):
        app.include_router(module.router)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()

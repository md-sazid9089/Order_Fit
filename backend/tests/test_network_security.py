"""Hostile-network regressions using synthetic data only."""

import asyncio
import io
import subprocess
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from pypdf import PdfWriter

from orderfit.api.main import BodyLimit, create_app
from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.services.documents import parse


def configuration(**changes):
    return RuntimeConfiguration(**({
        "database_url": "postgresql+psycopg://synthetic:synthetic@localhost/test",
        "session_secret": "s" * 48, "account_fingerprint_key": "f" * 48,
        "account_fingerprint_key_version": 1, "document_dir": "unused",
        "allowed_origins": ["https://orderfit.example"],
    } | changes))


def test_remote_database_requires_verified_tls_and_https_requires_secure_cookie():
    with pytest.raises(ValidationError, match="Secure cookies"):
        configuration(cookie_secure=False)
    for suffix in ("", "?sslmode=disable", "?sslmode=require", "?sslmode=verify-ca"):
        with pytest.raises(ValidationError, match="verify-full"):
            configuration(database_url="postgresql+psycopg://synthetic@db.example/test" + suffix)
    configuration(database_url="postgresql+psycopg://synthetic@db.example/test?sslmode=verify-full")
    configuration(cookie_secure=False, allowed_origins=["http://localhost:3000"])


def test_invalid_startup_configuration_does_not_print_secrets():
    secret = "synthetic-startup-secret-never-print-12345"
    with pytest.raises(ValidationError) as error:
        configuration(session_secret=secret, cookie_secure=False)
    assert secret not in str(error.value)
    assert "synthetic@" not in str(error.value)


def test_no_store_and_security_headers_cover_success_errors_cors_and_body_rejection():
    app = create_app(configuration())
    # No lifespan or database required for these public/invalid requests.
    client = TestClient(app, base_url="https://testserver")
    responses = [
        client.get("/health"), client.get("/missing"),
        client.get("/api/v1/businesses/not-a-uuid/profile"),
        client.post("/api/v1/auth/signin", content=b"x", headers={"Content-Length": "2000000"}),
        client.options("/api/v1/auth/signin", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"}),
    ]
    assert [r.status_code for r in responses] == [200, 404, 422, 413, 400]
    for response in responses:
        assert response.headers["Cache-Control"] == "private, no-store"
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["Strict-Transport-Security"] == "max-age=31536000"
        assert "Access-Control-Allow-Origin" not in response.headers


def test_small_body_idle_and_total_deadlines():
    async def exercise(delays, deadline):
        sent = []
        chunks = iter(delays)

        async def receive():
            await asyncio.sleep(next(chunks))
            return {"type": "http.request", "body": b"x", "more_body": True}

        async def send(message):
            sent.append(message)

        async def app(scope, receive, send):
            while (await receive())["type"] != "http.disconnect":
                pass
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"ignored"})

        await BodyLimit(app, small_deadline=deadline)(
            {"type": "http", "method": "POST", "path": "/api/v1/auth/signin", "headers": []}, receive, send)
        assert [m["status"] for m in sent if m["type"] == "http.response.start"] == [408]

    asyncio.run(exercise([0, 10], (1, 0.02)))
    asyncio.run(exercise([0.01] * 20, (0.04, 1)))


def test_pdf_timeout_kills_parser_and_discards_output(monkeypatch):
    child = Mock()
    child.communicate.side_effect = [subprocess.TimeoutExpired("parser", 10), (b"private", None)]
    monkeypatch.setattr("orderfit.services.documents.subprocess.Popen", lambda *a, **k: child)
    result = parse(b"%PDF-synthetic", "application/pdf")
    assert result.status == "failed" and result.error_code == "PARSER_LIMIT" and result.pages == []
    child.kill.assert_called_once()
    assert child.communicate.call_count == 2


def test_pdf_process_capacity_is_bounded_and_refusal_can_be_retried(monkeypatch):
    from orderfit.services import documents

    child = Mock()
    child.returncode = 0
    child.communicate.return_value = (b'{"parser":"pdf_text","status":"ocr_required"}', None)
    start = Mock(return_value=child)
    monkeypatch.setenv("DATABASE_URL", "synthetic-parser-env-must-not-propagate")
    monkeypatch.setenv("OPENAI_API_KEY", "synthetic-parser-env-must-not-propagate")
    monkeypatch.setattr(documents.subprocess, "Popen", start)
    assert documents.PDF_WORK.acquire(blocking=False)
    assert documents.PDF_WORK.acquire(blocking=False)
    try:
        with pytest.raises(documents.UploadRejected) as error:
            parse(b"%PDF-synthetic", "application/pdf")
        assert error.value.code == "PARSER_CAPACITY"
        start.assert_not_called()
    finally:
        documents.PDF_WORK.release()
        documents.PDF_WORK.release()
    assert parse(b"%PDF-synthetic", "application/pdf").status == "ocr_required"
    environment = start.call_args.kwargs["env"]
    assert "DATABASE_URL" not in environment and "OPENAI_API_KEY" not in environment
    assert environment["PYTHONNOUSERSITE"] == "1"


def test_pdf_real_child_accepts_valid_pdf_and_contains_parser_failure():
    writer, data = PdfWriter(), io.BytesIO()
    writer.add_blank_page(width=100, height=100)
    writer.write(data)
    assert parse(data.getvalue(), "application/pdf").status == "ocr_required"
    result = parse(b"%PDF-malformed", "application/pdf")
    assert result.status == "failed" and result.pages == []


def test_api_entrypoint_bounds_connections_and_omits_sensitive_access_urls(monkeypatch):
    from orderfit.api import serve

    run = Mock()
    monkeypatch.setattr(serve, "RuntimeConfiguration", configuration)
    monkeypatch.setattr(serve.uvicorn, "run", run)
    monkeypatch.setattr("sys.argv", ["orderfit-api"])
    serve.main()
    assert run.call_args.kwargs["access_log"] is False
    assert run.call_args.kwargs["limit_concurrency"] == 64
    assert run.call_args.kwargs["timeout_keep_alive"] == 5


def test_s3_network_timeouts_and_retries_are_bounded(monkeypatch):
    from orderfit.store import s3_documents

    client = Mock()
    monkeypatch.setattr(s3_documents.boto3, "client", client)
    s3_documents.S3PrivateDocuments("synthetic-bucket", "us-east-1")
    config = client.call_args.kwargs["config"]
    assert config.connect_timeout == 5 and config.read_timeout == 15
    assert config.retries["total_max_attempts"] == 3
    assert config.max_pool_connections == 4


def test_password_cpu_and_memory_capacity_is_shared_and_released(monkeypatch):
    from orderfit.api.errors import ApplicationError
    from orderfit.services import identity

    passwords = Mock()
    passwords.verify.return_value = True
    passwords.hash.return_value = "synthetic-hash"
    monkeypatch.setattr(identity, "PASSWORDS", passwords)
    with identity.password_capacity(), identity.password_capacity():
        for attempt in (lambda: identity.IdentityService.verify(None, "synthetic"),
                        lambda: identity.hash_password("synthetic")):
            with pytest.raises(ApplicationError) as error:
                attempt()
            assert error.value.status == 429 and error.value.code == "AUTH_CAPACITY"
        passwords.verify.assert_not_called()
        passwords.hash.assert_not_called()
    assert identity.IdentityService.verify(None, "synthetic") is True
    assert identity.hash_password("synthetic") == "synthetic-hash"

"""Pure tests for JWT token issuance, verification, claims, and extraction."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from orderfit.api.deps import session_token
from orderfit.api.errors import ApplicationError
from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.services.identity import IdentityService


def test_jwt_issuance_and_claims(tmp_path):
    config = RuntimeConfiguration(
        database_url="postgresql+psycopg://orderfit_app:secret@127.0.0.1:5432/orderfit",
        session_secret="test-session-secret-" + "s" * 32,
        account_fingerprint_key="f" * 48,
        account_fingerprint_key_version=1,
        document_dir=str(tmp_path / "documents"),
        allowed_origins=["http://localhost:3000"],
    )
    service = IdentityService(MagicMock(), config)

    user_id = uuid4()
    email = "test@example.com"
    token = service.create_jwt(user_id, email, expires_in=3600)

    assert isinstance(token, str)
    assert token.count(".") == 2

    # Decode and verify claims
    decoded = service.decode_jwt(token)
    assert decoded is not None
    assert decoded["sub"] == str(user_id)
    assert decoded["email"] == email
    assert decoded["iss"] == "orderfit"
    assert decoded["aud"] == "orderfit"
    assert "jti" in decoded
    assert decoded["exp"] > decoded["iat"]


def test_jwt_tampered_or_expired_rejected(tmp_path):
    config = RuntimeConfiguration(
        database_url="postgresql+psycopg://orderfit_app:secret@127.0.0.1:5432/orderfit",
        session_secret="test-session-secret-" + "s" * 32,
        account_fingerprint_key="f" * 48,
        account_fingerprint_key_version=1,
        document_dir=str(tmp_path / "documents"),
        allowed_origins=["http://localhost:3000"],
    )
    service = IdentityService(MagicMock(), config)

    user_id = uuid4()
    token = service.create_jwt(user_id, "test@example.com", expires_in=-10)

    # Expired token decode returns None
    assert service.decode_jwt(token) is None

    # Tampered token
    tampered = token[:-4] + "xxxx"
    assert service.decode_jwt(tampered) is None

    # service.view rejects expired/invalid token
    with pytest.raises(ApplicationError) as exc_info:
        service.view(token, "csrf")
    assert exc_info.value.status == 401
    assert exc_info.value.code == "INVALID_SESSION"


def test_session_token_dependency_extracts_bearer_or_cookie():
    # Bearer header
    req_bearer = MagicMock()
    req_bearer.headers = {"Authorization": "Bearer my-jwt-token-123"}
    req_bearer.cookies = {}
    assert session_token(req_bearer) == "my-jwt-token-123"

    # Cookie fallback
    req_cookie = MagicMock()
    req_cookie.headers = {}
    req_cookie.cookies = {"orderfit_session": "my-cookie-session-456"}
    assert session_token(req_cookie) == "my-cookie-session-456"

    # Missing both raises 401 INVALID_SESSION
    req_none = MagicMock()
    req_none.headers = {}
    req_none.cookies = {}
    with pytest.raises(ApplicationError) as exc:
        session_token(req_none)
    assert exc.value.status == 401
    assert exc.value.code == "INVALID_SESSION"

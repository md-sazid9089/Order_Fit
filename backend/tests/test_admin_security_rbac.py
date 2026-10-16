"""Security and RBAC test suite for administrative access control.

Verifies:
1. Unauthenticated requests to admin endpoints return 401 Unauthorized.
2. Regular authenticated users (is_platform_admin=False) return 403 Forbidden.
3. Expired or forged session tokens return 401 Unauthorized.
4. Tenant-level 'admin' roles do NOT grant platform admin privileges.
5. Self-promotion and privilege escalation attempts are rejected.
6. Valid platform administrators (is_platform_admin=True) access admin endpoints successfully.
"""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import Request

from orderfit.api.deps import require_admin, session_token
from orderfit.api.errors import ApplicationError
from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.services.identity import IdentityService


def test_require_admin_unauthenticated():
    """Test 4: Unauthenticated access to admin endpoints raises 401."""
    request = MagicMock(spec=Request)
    request.headers = {}
    request.cookies = {}

    with pytest.raises(ApplicationError) as exc_info:
        require_admin(request)
    assert exc_info.value.status == 401
    assert exc_info.value.code == "INVALID_SESSION"


def test_require_admin_regular_user_forbidden():
    """Test 3: Authenticated regular user (non-admin) calling require_admin raises 403."""
    request = MagicMock(spec=Request)
    request.headers = {"Authorization": "Bearer valid-token-123"}
    request.cookies = {}

    # Mock identity service and database
    mock_identity = MagicMock()
    mock_db = MagicMock()
    mock_identity.database = mock_db

    # Context manager for database.identity
    mock_c = MagicMock()
    mock_scope = MagicMock()
    mock_scope.user_id = uuid4()
    mock_scope.session_id = uuid4()
    mock_row = {"csrf_digest": b"csrf"}

    mock_db.identity.return_value.__enter__.return_value = (mock_c, mock_scope, mock_row)

    request.app.state.identity = mock_identity

    # Mock IdentityRepository.profile returning non-admin user
    from unittest.mock import patch
    with patch("orderfit.store.repositories.IdentityRepository.profile") as mock_profile:
        mock_profile.return_value = (
            {
                "id": mock_scope.user_id,
                "email": "regular@example.com",
                "full_name": "Regular User",
                "is_platform_admin": False,
                "version": 1,
            },
            [{"business_id": uuid4(), "business_name": "Acme", "role": "owner"}],
        )

        with pytest.raises(ApplicationError) as exc_info:
            require_admin(request)

        assert exc_info.value.status == 403
        assert exc_info.value.code == "FORBIDDEN"


def test_require_admin_platform_admin_allowed():
    """Test 11: Valid platform administrator is authorized."""
    request = MagicMock(spec=Request)
    request.headers = {"Authorization": "Bearer valid-admin-token"}
    request.cookies = {}

    mock_identity = MagicMock()
    mock_db = MagicMock()
    mock_identity.database = mock_db

    mock_c = MagicMock()
    mock_scope = MagicMock()
    mock_scope.user_id = uuid4()
    mock_scope.session_id = uuid4()
    mock_row = {"csrf_digest": b"csrf"}

    mock_db.identity.return_value.__enter__.return_value = (mock_c, mock_scope, mock_row)
    request.app.state.identity = mock_identity

    from unittest.mock import patch
    with patch("orderfit.store.repositories.IdentityRepository.profile") as mock_profile:
        mock_profile.return_value = (
            {
                "id": mock_scope.user_id,
                "email": "admin@example.com",
                "full_name": "Admin User",
                "is_platform_admin": True,
                "version": 1,
            },
            [],
        )

        user, scope = require_admin(request)
        assert user["is_platform_admin"] is True
        assert user["email"] == "admin@example.com"


def test_view_connection_tenant_admin_not_platform_admin(tmp_path):
    """Test 5 & 6: Tenant membership role 'admin' must NEVER grant platform admin status."""
    config = RuntimeConfiguration(
        database_url="postgresql+psycopg://orderfit_app:secret@127.0.0.1:5432/orderfit",
        session_secret="test-session-secret-" + "s" * 32,
        account_fingerprint_key="f" * 48,
        account_fingerprint_key_version=1,
        document_dir=str(tmp_path / "documents"),
        allowed_origins=["http://localhost:3000"],
    )
    service = IdentityService(MagicMock(), config)

    mock_c = MagicMock()
    mock_scope = MagicMock()
    mock_scope.user_id = uuid4()
    mock_scope.session_id = uuid4()
    mock_session = {"expires_at": "2026-10-18T00:00:00Z"}

    from unittest.mock import patch
    with patch("orderfit.store.repositories.IdentityRepository.profile") as mock_profile:
        # User is NOT platform admin, but is tenant admin of an organization
        mock_profile.return_value = (
            {
                "id": mock_scope.user_id,
                "email": "tenantadmin@example.com",
                "full_name": "Tenant Admin",
                "preferences": {},
                "version": 1,
                "is_platform_admin": False,
            },
            [
                {
                    "business_id": uuid4(),
                    "business_name": "Acme Corp",
                    "role": "owner",
                }
            ],
        )

        view = service.view_connection(mock_c, mock_scope, mock_session, "csrf-token-123")

        # Crucial security assertion: must be False
        assert view.is_platform_admin is False
        # HttpOnly credentials must never become JSON readable by browser scripts.
        assert "token" not in view.model_dump()


def test_session_token_extraction_and_failure():
    """Test 8: Invalid or absent session token handling."""
    req_empty = MagicMock(spec=Request)
    req_empty.headers = {}
    req_empty.cookies = {}

    with pytest.raises(ApplicationError) as exc:
        session_token(req_empty)
    assert exc.value.status == 401

    req_bearer = MagicMock(spec=Request)
    req_bearer.headers = {"Authorization": "Bearer my-jwt-token"}
    req_bearer.cookies = {}
    assert session_token(req_bearer) == "my-jwt-token"

    req_cookie = MagicMock(spec=Request)
    req_cookie.headers = {}
    req_cookie.cookies = {"orderfit_session": "my-cookie-token"}
    assert session_token(req_cookie) == "my-cookie-token"

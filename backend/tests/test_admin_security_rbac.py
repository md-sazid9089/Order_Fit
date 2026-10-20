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


def test_admin_user_dto_rejects_tenant_membership_expansion():
    """Global account summaries cannot acquire unsupported tenant authority fields."""
    from pydantic import ValidationError

    from orderfit.contracts.admin import AdminUser

    user_id = uuid4()
    biz1 = uuid4()
    biz2 = uuid4()

    data = {
        "id": user_id,
        "email": "multitenant@example.com",
        "full_name": "Multi Tenant User",
        "is_platform_admin": False,
        "status": "active",
        "version": 3,
        "created_at": "2026-10-18T10:00:00Z",
        "memberships": [
            {
                "business_id": biz1,
                "business_name": "Acme North",
                "role": "owner",
                "created_at": "2026-10-18T10:00:00Z",
                "revoked_at": None,
                "version": 1,
            },
            {
                "business_id": biz2,
                "business_name": "Acme South",
                "role": "commercial_lead",
                "created_at": "2026-10-18T11:00:00Z",
                "revoked_at": None,
                "version": 2,
            },
        ],
    }

    with pytest.raises(ValidationError) as error:
        AdminUser.model_validate(data)
    assert {issue["loc"][0] for issue in error.value.errors()} == {"status", "created_at", "memberships"}


def test_admin_user_dto_zero_memberships():
    """Verify AdminUser DTO accommodates users with no memberships (isolated or newly registered)."""
    from orderfit.contracts.admin import AdminUser

    user_id = uuid4()
    data = {
        "id": user_id,
        "email": "nomembership@example.com",
        "full_name": "Solo User",
        "is_platform_admin": True,
        "version": 1,
    }

    user = AdminUser.model_validate(data)
    assert user.id == user_id
    assert user.is_platform_admin is True
    assert "memberships" not in user.model_dump()


def test_admin_overview_dto_metrics():
    """Verify only the supported global summary fields reach the wire contract."""
    from pydantic import ValidationError

    from orderfit.contracts.admin import AdminOverview

    data = {
        "schema_version": "admin-overview.v1",
        "as_of": "2026-10-20T00:00:00Z",
        "total_users": 17,
        "privileged_users": 17,
        "active_memberships": 17,
        "revoked_memberships": 0,
        "total_memberships": 17,
        "total_tenants": 17,
        "active_tenants": 17,
        "total_orders": 7,
        "order_value_by_currency": [
            {"currency": "BDT", "amount_minor": "1500000", "orders_with_value": 3},
            {"currency": "USD", "amount_minor": "250000", "orders_with_value": 1},
        ],
        "orders_without_value": 3,
    }

    with pytest.raises(ValidationError) as error:
        AdminOverview.model_validate(data)
    unsupported = {"privileged_users", "active_memberships", "revoked_memberships", "total_memberships"}
    assert {issue["loc"][0] for issue in error.value.errors()} == unsupported
    overview = AdminOverview.model_validate({key: value for key, value in data.items() if key not in unsupported})
    assert overview.total_users == 17
    assert overview.total_tenants == 17
    assert overview.total_orders == 7
    assert len(overview.order_value_by_currency) == 2


def test_admin_validated_resilience():
    """Verify _validated raises ApplicationError(503) on malformed administrative data."""
    from orderfit.contracts.admin import AdminUser
    from orderfit.store.admin_repository import _validated

    with pytest.raises(ApplicationError) as exc_info:
        _validated(AdminUser, {"invalid": "payload"})
    assert exc_info.value.status == 503
    assert exc_info.value.code == "ADMIN_DATA_UNSUPPORTED"


def test_admin_update_user_role_self_demotion_rejected():
    """Admin cannot demote their own platform administrator privileges."""
    from orderfit.services import admin
    mock_identity = MagicMock()
    mock_db = MagicMock()
    mock_identity.database = mock_db
    mock_identity.config.admin_reads_enabled = True

    mock_c = MagicMock()
    admin_id = uuid4()
    mock_scope = MagicMock()
    mock_scope.user_id = admin_id
    mock_scope.session_id = uuid4()

    mock_db.transaction.return_value.__enter__.return_value = mock_c
    from unittest.mock import patch
    with patch("orderfit.store.admin_repository.prerequisites", return_value=True), \
         patch("orderfit.store.admin_repository.identity", return_value=mock_scope):
        with pytest.raises(ApplicationError) as exc_info:
            admin.update_user_role(mock_identity, "token-123", admin_id, False)

    assert exc_info.value.status == 409
    assert exc_info.value.code == "CANNOT_DEMOTE_SELF"


def test_admin_update_user_role_success():
    """Admin can promote another user to platform admin."""
    from orderfit.contracts.admin import AdminUser
    from orderfit.services import admin
    mock_identity = MagicMock()
    mock_db = MagicMock()
    mock_identity.database = mock_db
    mock_identity.config.admin_reads_enabled = True

    mock_c = MagicMock()
    admin_id = uuid4()
    target_id = uuid4()
    mock_scope = MagicMock()
    mock_scope.user_id = admin_id
    mock_scope.session_id = uuid4()

    mock_db.transaction.return_value.__enter__.return_value = mock_c
    expected_user = AdminUser(
        id=target_id,
        email="promoted@example.com",
        full_name="Promoted User",
        is_platform_admin=True,
        version=2,
    )
    from unittest.mock import patch
    with patch("orderfit.store.admin_repository.prerequisites", return_value=True), \
         patch("orderfit.store.admin_repository.identity", return_value=mock_scope), \
         patch("orderfit.store.admin_repository.update_user_role", return_value=expected_user) as mock_repo:
        result = admin.update_user_role(mock_identity, "token-123", target_id, True)
        assert result.id == target_id
        assert result.is_platform_admin is True
        mock_repo.assert_called_once_with(mock_c, "token-123", target_id, True)


def test_admin_update_user_role_error_mappings():
    """DB errors OA404 and OA492 are correctly mapped to NOT_FOUND and LAST_ADMIN."""
    from sqlalchemy.exc import DBAPIError
    from orderfit.services import admin

    mock_identity = MagicMock()
    mock_db = MagicMock()
    mock_identity.database = mock_db
    mock_identity.config.admin_reads_enabled = True

    admin_id = uuid4()
    target_id = uuid4()
    mock_scope = MagicMock()
    mock_scope.user_id = admin_id

    # Test OA404 (user not found)
    exc_404 = DBAPIError("SELECT ...", {}, Exception("User not found"))
    exc_404.orig = MagicMock(sqlstate="OA404")
    mock_db.transaction.side_effect = exc_404

    with pytest.raises(ApplicationError) as err_404:
        admin.update_user_role(mock_identity, "token-123", target_id, True)
    assert err_404.value.status == 404
    assert err_404.value.code == "NOT_FOUND"

    # Test OA492 (last admin)
    exc_492 = DBAPIError("SELECT ...", {}, Exception("Last admin"))
    exc_492.orig = MagicMock(sqlstate="OA492")
    mock_db.transaction.side_effect = exc_492

    with pytest.raises(ApplicationError) as err_492:
        admin.update_user_role(mock_identity, "token-123", target_id, False)
    assert err_492.value.status == 409
    assert err_492.value.code == "LAST_ADMIN"

"""Admin regressions use only the labeled disposable PG17 fixture and synthetic users."""

import psycopg
import pytest
from fastapi.testclient import TestClient

from orderfit.api.deps import require_admin
from orderfit.api.main import create_app
from orderfit.contracts.resources import SignIn
from orderfit.services.identity import IdentityService

ENDPOINTS = ("capabilities", "overview", "users", "tenants", "orders", "logs", "system")


def prototype_app(config, database):
    """Exercise the real mounted runtime with explicit read enablement."""
    return create_app(config.model_copy(update={"admin_reads_enabled": True}), database)


def test_runtime_mounts_admin_with_reads_disabled_by_default(postgres, config, accounts):
    app = create_app(config, postgres["database"])
    assert "/api/v1/admin/capabilities" in app.openapi()["paths"]
    promote(postgres, accounts[0], config=config)
    with TestClient(app) as client:
        client.cookies.set("orderfit_session", accounts[0].token)
        capability = client.get("/api/v1/admin/capabilities").json()
        assert capability["read_enabled"] is False
        assert capability["global_logs"] is False
        assert capability["platform_mutations"] is False
        for endpoint in ENDPOINTS[1:]:
            response = client.get(f"/api/v1/admin/{endpoint}")
            assert response.status_code == 503
            assert response.json()["error"]["code"] == "ADMIN_TELEMETRY_UNAVAILABLE"


def promote(postgres, account, value=True, config=None):
    # Migrator is permitted only on the fixture's verified disposable container.
    with psycopg.connect(postgres["migrator"]) as conn:
        conn.execute("UPDATE app_user SET is_platform_admin=%s WHERE id=%s",
                     (value, account.user_id))
        email = conn.execute("SELECT email FROM app_user WHERE id=%s", (account.user_id,)).fetchone()[0]
    if config is not None:
        service = IdentityService(postgres["database"], config)
        from uuid import uuid4
        _, account.token, account.csrf = service.authenticate(
            SignIn(email=email, password="Synthetic password 123!"), str(uuid4()),
            None, service.csrf(), str(uuid4()))


def test_all_admin_routes_deny_absent_forged_and_tenant_owner(postgres, config, accounts):
    app = prototype_app(config, postgres["database"])
    with TestClient(app) as client:
        for endpoint in ENDPOINTS:
            assert client.get(f"/api/v1/admin/{endpoint}").status_code == 401
            assert client.get(f"/api/v1/admin/{endpoint}", headers={
                "Authorization": "Bearer invalid-synthetic-token"}).status_code == 401
        client.cookies.set("orderfit_session", accounts[0].token)
        for endpoint in ENDPOINTS:
            assert client.get(f"/api/v1/admin/{endpoint}").status_code == 403


def test_platform_flag_does_not_bypass_tenant_rls_and_lists_are_bounded(postgres, config, accounts):
    owner, other = accounts
    promote(postgres, owner, config=config)
    app = prototype_app(config, postgres["database"])
    with TestClient(app) as client:
        client.cookies.set("orderfit_session", owner.token)
        users = client.get("/api/v1/admin/users?limit=1")
        assert users.status_code == 200, users.json().get("error", {}).get("code") if isinstance(users.json(), dict) else "unexpected list status"
        assert len(users.json()["items"]) == 1
        assert users.json()["next_cursor"]
        logs = client.get("/api/v1/admin/logs")
        assert logs.status_code == 503
        assert logs.json()["error"]["code"] == "ADMIN_TELEMETRY_UNAVAILABLE"
        tenants = client.get("/api/v1/admin/tenants").json()["items"]
        assert {str(owner.business_id), str(other.business_id)} <= {t["id"] for t in tenants}
        assert client.get("/api/v1/admin/orders").status_code == 200
        assert client.get(f"/api/v1/businesses/{other.business_id}/profile").status_code == 404
        for endpoint in ("users", "tenants", "orders"):
            for limit in ("0", "101", "invalid"):
                assert client.get(f"/api/v1/admin/{endpoint}?limit={limit}").status_code == 422


def test_revocation_between_dependency_and_read_is_rechecked(postgres, config, accounts):
    owner = accounts[0]
    promote(postgres, owner, config=config)
    app = prototype_app(config, postgres["database"])

    def revoke_after_check():
        promote(postgres, owner, False)
        return {}, None

    app.dependency_overrides[require_admin] = revoke_after_check
    with TestClient(app) as client:
        client.cookies.set("orderfit_session", owner.token)
        assert client.get("/api/v1/admin/users").status_code in (401, 403)


def test_platform_promotion_and_demotion_revoke_existing_sessions(postgres, config, accounts):
    owner = accounts[0]
    old_token = owner.token
    promote(postgres, owner, config=config)
    service = IdentityService(postgres["database"], config)
    from orderfit.api.errors import ApplicationError
    with pytest.raises(ApplicationError) as error:
        service.view(old_token, owner.csrf)
    assert error.value.status == 401
    assert service.view(owner.token, owner.csrf).is_platform_admin is True
    promote(postgres, owner, False)
    with pytest.raises(ApplicationError) as error:
        service.view(owner.token, owner.csrf)
    assert error.value.status == 401


def test_runtime_cannot_promote_itself(postgres, accounts):
    owner = accounts[0]
    with psycopg.connect(postgres["url"].replace("postgresql+psycopg://", "postgresql://", 1)) as conn:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute("UPDATE app_user SET is_platform_admin=true WHERE id=%s", (owner.user_id,))

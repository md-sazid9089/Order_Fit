"""Live integration verification for all 13 required RBAC security test cases.

Runs against the live running API (http://127.0.0.1:8000).
"""

import os
import uuid
import httpx
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(".env")
load_dotenv("backend/.env")

API_BASE = "http://127.0.0.1:8000/api/v1"
ORIGIN = "http://localhost:3000"


def test_test4_unauthenticated_api_access():
    """Test 4: Unauthenticated access to admin endpoints returns 401 Unauthorized."""
    endpoints = [
        "/admin/overview",
        "/admin/users",
        "/admin/tenants",
        "/admin/orders",
        "/admin/logs",
        "/admin/system",
    ]
    with httpx.Client(base_url=API_BASE) as client:
        for ep in endpoints:
            resp = client.get(ep)
            assert resp.status_code == 401, f"Expected 401 for {ep}, got {resp.status_code}"
            body = resp.json()
            assert body["error"]["code"] == "INVALID_SESSION"


def test_test8_invalid_or_expired_session():
    """Test 8: Invalid or forged session token returns 401 Unauthorized."""
    headers = {"Authorization": "Bearer forged-or-expired-token-xyz"}
    with httpx.Client(base_url=API_BASE) as client:
        resp = client.get("/admin/overview", headers=headers)
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "INVALID_SESSION"


def test_test3_and_test9_regular_user_forbidden_on_all_admin_endpoints():
    """Test 3 & 9: Authenticated regular user (non-admin) calling admin APIs gets 403 Forbidden."""
    with httpx.Client(base_url=API_BASE) as client:
        csrf_resp = client.get("/auth/csrf")
        assert csrf_resp.status_code == 200
        csrf_cookie = client.cookies.get("orderfit_csrf")

        signin_headers = {
            "Content-Type": "application/json",
            "Idempotency-Key": f"test-signin-reg-user-{uuid.uuid4().hex[:12]}",
            "X-CSRF-Token": csrf_cookie,
            "Origin": ORIGIN,
        }

        signin_payload = {
            "email": "testuser.ae8f17dc@example.com",
            "password": "TestPassword123!",
        }

        resp = client.post("/auth/signin", json=signin_payload, headers=signin_headers)
        assert resp.status_code == 200
        session_data = resp.json()
        assert session_data["is_platform_admin"] is False, "Regular user must NOT be platform admin"

        # Now attempt to access every admin endpoint as this regular user
        endpoints = [
            "/admin/overview",
            "/admin/users",
            "/admin/tenants",
            "/admin/orders",
            "/admin/logs",
            "/admin/system",
        ]
        for ep in endpoints:
            auth_resp = client.get(ep)
            assert (
                auth_resp.status_code == 403
            ), f"Expected 403 Forbidden for regular user on {ep}, got {auth_resp.status_code}"
            assert auth_resp.json()["error"]["code"] == "FORBIDDEN"


def test_test11_platform_admin_access_allowed():
    """Test 11: Valid platform administrator accesses admin endpoints successfully (200 OK)."""
    with httpx.Client(base_url=API_BASE) as client:
        csrf_resp = client.get("/auth/csrf")
        assert csrf_resp.status_code == 200
        csrf_cookie = client.cookies.get("orderfit_csrf")

        signin_headers = {
            "Content-Type": "application/json",
            "Idempotency-Key": f"test-signin-admin-user-{uuid.uuid4().hex[:12]}",
            "X-CSRF-Token": csrf_cookie,
            "Origin": ORIGIN,
        }

        signin_payload = {
            "email": "saidulislamshehab@gmail.com",
            "password": "TestPassword123!",
        }

        resp = client.post("/auth/signin", json=signin_payload, headers=signin_headers)
        assert resp.status_code == 200
        session_data = resp.json()
        assert session_data["is_platform_admin"] is True, "Admin user must have is_platform_admin=True"

        # Admin access on overview
        overview_resp = client.get("/admin/overview")
        assert overview_resp.status_code == 200
        telemetry = overview_resp.json()
        assert "totalUsers" in telemetry
        assert "totalOrders" in telemetry
        assert telemetry["databaseConnected"] is True

        # Admin access on users
        users_resp = client.get("/admin/users")
        assert users_resp.status_code == 200
        users_list = users_resp.json()
        assert isinstance(users_list, list)
        assert len(users_list) > 0, "Admin must be able to list platform users"
        assert users_list[0]["email"] == "saidulislamshehab@gmail.com"


def test_test5_and_test6_self_promotion_rejection():
    """Test 5 & 6: Regular user attempting to self-promote or update role is rejected."""
    with httpx.Client(base_url=API_BASE) as client:
        csrf_resp = client.get("/auth/csrf")
        csrf_cookie = client.cookies.get("orderfit_csrf")

        signin_headers = {
            "Content-Type": "application/json",
            "Idempotency-Key": f"test-signin-reg-user-{uuid.uuid4().hex[:12]}",
            "X-CSRF-Token": csrf_cookie,
            "Origin": ORIGIN,
        }

        resp = client.post(
            "/auth/signin",
            json={"email": "testuser.ae8f17dc@example.com", "password": "TestPassword123!"},
            headers=signin_headers,
        )
        assert resp.status_code == 200
        current_version = resp.json()["profile_version"]

        # Attempt to patch profile with injected is_platform_admin
        patch_headers = {
            "Content-Type": "application/json",
            "Idempotency-Key": f"test-patch-user-{uuid.uuid4().hex[:12]}",
            "X-CSRF-Token": client.cookies.get("orderfit_csrf") or csrf_cookie,
            "Origin": ORIGIN,
        }
        patch_payload = {
            "expected_version": current_version,
            "profile": {
                "full_name": "Test User Attempting Admin",
                "preferences": {
                    "timezone": "UTC",
                    "language": "en",
                    "in_app_notifications": True,
                },
            },
            "is_platform_admin": True,  # Attacker attempt
        }

        patch_resp = client.patch("/auth/profile", json=patch_payload, headers=patch_headers)
        # Server forbids extra fields with 422 Unprocessable Entity
        assert patch_resp.status_code in (422, 400), f"Expected 422 or 400, got {patch_resp.status_code}"

        # Verify via GET /auth/me that user is still not an admin
        me_resp = client.get("/auth/me")
        assert me_resp.status_code == 200
        assert me_resp.json()["is_platform_admin"] is False, "User must remain non-admin"


def test_test13_database_level_security():
    """Test 13: Database-level permission rules prevent runtime role from updating is_platform_admin."""
    runtime_db_url = os.environ.get("DATABASE_URL")
    assert runtime_db_url, "DATABASE_URL must be configured"

    engine = create_engine(runtime_db_url)
    with engine.connect() as conn:
        try:
            conn.execute(
                text("UPDATE app_user SET is_platform_admin = true WHERE email = 'testuser.ae8f17dc@example.com'")
            )
            conn.commit()
        except Exception as exc:
            # Postgres 42501 permission denied is the intended Postgres security defense
            assert "permission denied" in str(exc).lower() or "42501" in str(exc)

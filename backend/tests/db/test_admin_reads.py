"""Admin functions are verified through real restricted roles on disposable PG."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from orderfit.api.main import create_app
from orderfit.services import admin
from orderfit.services.identity import IdentityService
from orderfit.store.db import digest_token
from tests.db.test_admin_security import promote


def enabled(config):
    return config.model_copy(update={"admin_reads_enabled": True})


def seed_orders(postgres, account, count=1, value=100):
    """Only the disposable fixture's migrator writes synthetic unconfirmed orders."""
    with psycopg.connect(postgres["migrator"]) as c:
        policy = c.execute("SELECT id FROM owner_constraints WHERE business_id=%s LIMIT 1",
                           (account.business_id,)).fetchone()[0]
        ids = []
        for _ in range(count):
            ids.append(c.execute(
                "INSERT INTO deal(business_id,public_ref,currency,reserve_minor,constraints_id,created_by,order_value_minor) "
                "SELECT id,%s,currency,0,%s,%s,%s FROM business WHERE id=%s RETURNING id",
                (uuid4().hex, policy, account.user_id, value, account.business_id)).fetchone()[0])
        return ids


def test_global_reads_without_memberships_and_exact_currency_totals(postgres, config, accounts):
    owner, other = accounts
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute("UPDATE business SET currency='USD' WHERE id=%s", (other.business_id,))
    seed_orders(postgres, owner, 2, 9_000_000_000_000_000)
    seed_orders(postgres, other, 1, 250000)
    seed_orders(postgres, other, 1, None)
    promote(postgres, owner, config=config)
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute("INSERT INTO membership(user_id,business_id,role) VALUES(%s,%s,'owner')",
                  (other.user_id, owner.business_id))
        c.execute("UPDATE membership SET revoked_at=clock_timestamp() WHERE user_id=%s", (owner.user_id,))
        expected_counts = c.execute("SELECT (SELECT count(*) FROM app_user),(SELECT count(*) FROM business),"
                                    "(SELECT count(*) FROM deal)").fetchone()
        expected_groups = {cur.strip(): (str(total), n) for cur, total, n in c.execute(
            "SELECT currency,sum(order_value_minor),count(*) FROM deal WHERE order_value_minor IS NOT NULL GROUP BY currency")}
    with TestClient(create_app(enabled(config), postgres["database"])) as client:
        client.cookies.set("orderfit_session", owner.token)
        client.cookies.set("orderfit_csrf", owner.csrf)
        assert client.get("/api/v1/auth/me").json()["memberships"] == []
        assert client.get("/api/v1/admin/capabilities").json()["read_enabled"] is True
        response = client.get("/api/v1/admin/overview")
        assert response.status_code == 200, response.text
        result = response.json()
        assert (result["total_users"], result["total_tenants"], result["total_orders"]) == expected_counts
        groups = {g["currency"]: (g["amount_minor"], g["orders_with_value"]) for g in result["order_value_by_currency"]}
        assert groups == expected_groups
        assert int(groups["BDT"][0]) > 2**53
        assert result["orders_without_value"] >= 1
        assert "currency" not in result and "totalPipelineMinor" not in result
        assert response.headers["cache-control"] == "private, no-store"
        assert client.get(f"/api/v1/businesses/{other.business_id}/profile").status_code == 404
    with postgres["database"].identity(owner.token) as (c, _, _):
        assert c.execute(text("SELECT count(*) FROM business")).scalar_one() == 0
        assert c.execute(text("SELECT count(*) FROM deal")).scalar_one() == 0


@pytest.mark.parametrize("listing", ["users", "tenants", "orders"])
def test_pagination_is_complete_scoped_and_tamper_resistant(postgres, config, accounts, listing):
    owner = accounts[0]
    if listing == "orders":
        seed_orders(postgres, owner, 105)
    elif listing == "users":
        with psycopg.connect(postgres["migrator"]) as c:
            c.execute("INSERT INTO app_user(email,full_name) SELECT %s||i||'@example.test','Synthetic page user' "
                      "FROM generate_series(1,105) i", (uuid4().hex,))
    else:
        with psycopg.connect(postgres["migrator"]) as c:
            c.execute("INSERT INTO business(name,currency,timezone) SELECT 'Synthetic page business','BDT','Asia/Dhaka' "
                      "FROM generate_series(1,105)")
    promote(postgres, owner, config=config)
    with TestClient(create_app(enabled(config), postgres["database"])) as client:
        client.cookies.set("orderfit_session", owner.token)
        first = client.get(f"/api/v1/admin/{listing}?limit=100")
        assert first.status_code == 200, first.text
        first = first.json()
        assert len(first["items"]) == 100 and first["next_cursor"]
        ids = [row["id"] for row in first["items"]]
        cursor = first["next_cursor"]
        while cursor:
            response = client.get(f"/api/v1/admin/{listing}", params={"limit": 100, "cursor": cursor})
            assert response.status_code == 200, response.text
            page = response.json()
            ids.extend(row["id"] for row in page["items"])
            cursor = page["next_cursor"]
        with psycopg.connect(postgres["migrator"]) as c:
            table = {"users": "app_user", "tenants": "business", "orders": "deal"}[listing]
            expected = c.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        assert len(ids) == len(set(ids)) == expected
        cursor = first["next_cursor"]
        for path, bad in [(listing, cursor + "x"), ("tenants" if listing != "tenants" else "users", cursor)]:
            response = client.get(f"/api/v1/admin/{path}", params={"cursor": bad})
            assert response.status_code == 422 and response.json()["error"]["code"] == "INVALID_CURSOR"
        # A new signin session for the same actor cannot reuse the old cursor.
        promote(postgres, owner, config=config)
        client.cookies.set("orderfit_session", owner.token)
        assert client.get(f"/api/v1/admin/{listing}", params={"cursor": cursor}).status_code == 422


def test_privileged_functions_refuse_forged_context_and_worker(postgres, config, accounts):
    owner, regular = accounts
    promote(postgres, owner, config=config)
    with postgres["database"].transaction() as c:
        c.execute(text("SELECT set_config('app.user_id',:u,true),set_config('app.session_id',:s,true)"),
                  {"u": str(owner.user_id), "s": str(uuid4())})
        with pytest.raises(DBAPIError) as error:
            c.execute(text("SELECT public.admin_read_overview(:digest)"), {"digest": digest_token(regular.token)})
        assert error.value.orig.sqlstate == "OA403"
    with postgres["database"].transaction() as c:
        with pytest.raises(DBAPIError) as error:
            c.execute(text("SELECT public.admin_read_overview(:digest)"), {"digest": digest_token("forged")})
        assert error.value.orig.sqlstate == "OA401"
    for url in (postgres["url"], postgres["worker_url"]):
        with psycopg.connect(url.replace("postgresql+psycopg://", "postgresql://", 1)) as c:
            assert not c.execute("SELECT pg_has_role(current_user,'orderfit_admin_reader','MEMBER')").fetchone()[0]
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                c.execute("SET ROLE orderfit_admin_reader")
    with postgres["worker"].transaction() as c:
        with pytest.raises(DBAPIError) as error:
            c.execute(text("SELECT public.admin_read_overview(:digest)"), {"digest": digest_token(owner.token)})
        assert error.value.orig.sqlstate == "42501"


def test_missing_execute_privilege_fails_closed(postgres, config, accounts):
    owner = accounts[0]
    promote(postgres, owner, config=config)
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute("REVOKE EXECUTE ON FUNCTION admin_read_overview(bytea) FROM orderfit_admin_api")
    try:
        with TestClient(create_app(enabled(config), postgres["database"])) as client:
            client.cookies.set("orderfit_session", owner.token)
            assert client.get("/api/v1/admin/capabilities").json()["read_enabled"] is False
            response = client.get("/api/v1/admin/overview")
            assert response.status_code == 503
            assert response.json()["error"]["code"] == "ADMIN_TELEMETRY_UNAVAILABLE"
    finally:
        with psycopg.connect(postgres["migrator"]) as c:
            c.execute("GRANT EXECUTE ON FUNCTION admin_read_overview(bytea) TO orderfit_admin_api")


@pytest.mark.parametrize("state", ["idle", "expired", "revoked"])
def test_privileged_sql_revalidates_session_lifetime(postgres, config, accounts, state):
    owner = accounts[0]
    promote(postgres, owner, config=config)
    changes = {
        "idle": "last_active_at=clock_timestamp()-interval '31 minutes'",
        "expired": "created_at=clock_timestamp()-interval '1 day',expires_at=clock_timestamp()-interval '1 minute'",
        "revoked": "revoked_at=clock_timestamp()",
    }
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute(f"UPDATE auth_session SET {changes[state]} WHERE token_digest=%s", (digest_token(owner.token),))
    with postgres["database"].transaction() as c:
        with pytest.raises(DBAPIError) as error:
            c.execute(text("SELECT public.admin_read_overview(:d)"), {"d": digest_token(owner.token)})
        assert error.value.orig.sqlstate == "OA401"


def test_function_owner_acl_and_schema_are_narrow(postgres):
    with psycopg.connect(postgres["migrator"]) as c:
        roles = c.execute("SELECT rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreaterole FROM pg_roles "
                          "WHERE rolname IN ('orderfit_admin_api','orderfit_admin_reader')").fetchall()
        assert len(roles) == 2 and all(not any(row[1:]) for row in roles)
        functions = c.execute("SELECT p.proname,r.rolname,p.proconfig FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner "
                              "WHERE p.proname LIKE 'admin_read_%' AND p.pronamespace='public'::regnamespace").fetchall()
        assert len(functions) == 5
        assert all(owner == "orderfit_admin_reader" and "search_path=pg_catalog, pg_temp" in config for _, owner, config in functions)
        for role in ("orderfit_admin_reader", "orderfit_admin_api", "orderfit_app", "orderfit_worker"):
            assert not c.execute("SELECT has_schema_privilege(%s,'public','CREATE')", (role,)).fetchone()[0]
        for table in ("document", "security_event", "auth_passkey"):
            assert not c.execute("SELECT has_table_privilege('orderfit_admin_reader',%s,'SELECT')", (table,)).fetchone()[0]
        assert not c.execute("SELECT has_any_column_privilege('orderfit_admin_reader','membership','SELECT')").fetchone()[0]


def test_runtime_rejects_inheritance_of_private_function_owner(postgres):
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute("GRANT orderfit_admin_reader TO p1_runtime")
    try:
        with pytest.raises(RuntimeError, match="restricted non-owner"):
            postgres["database"].validate_runtime()
    finally:
        with psycopg.connect(postgres["migrator"]) as c:
            c.execute("REVOKE orderfit_admin_reader FROM p1_runtime")


def test_admin_read_fails_promptly_on_inverted_session_lock_and_recovers(postgres, config, accounts):
    owner = accounts[0]
    promote(postgres, owner, config=config)
    with psycopg.connect(postgres["migrator"]) as holder:
        holder.execute("SELECT id FROM auth_session WHERE token_digest=%s FOR UPDATE", (digest_token(owner.token),))
        with postgres["database"].transaction() as c:
            with pytest.raises(DBAPIError) as error:
                c.execute(text("SELECT admin_read_overview(:d)"), {"d": digest_token(owner.token)})
            assert error.value.orig.sqlstate == "55P03"
    identity = IdentityService(postgres["database"], enabled(config))
    assert admin.overview(identity, owner.token).total_users > 0


def test_missing_admin_policy_is_unavailable_instead_of_partial_data(postgres, config, accounts):
    owner = accounts[0]
    promote(postgres, owner, config=config)
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute("DROP POLICY admin_summary_read ON business")
    try:
        with TestClient(create_app(enabled(config), postgres["database"])) as client:
            client.cookies.set("orderfit_session", owner.token)
            assert client.get("/api/v1/admin/capabilities").json()["read_enabled"] is False
            assert client.get("/api/v1/admin/overview").status_code == 503
    finally:
        with psycopg.connect(postgres["migrator"]) as c:
            c.execute("CREATE POLICY admin_summary_read ON business FOR SELECT TO orderfit_admin_reader USING(true)")


def test_missing_private_column_grant_is_reported_as_unavailable(postgres, config, accounts):
    owner = accounts[0]
    promote(postgres, owner, config=config)
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute("REVOKE SELECT(name) ON business FROM orderfit_admin_reader")
    try:
        with TestClient(create_app(enabled(config), postgres["database"])) as client:
            client.cookies.set("orderfit_session", owner.token)
            assert client.get("/api/v1/admin/capabilities").json()["read_enabled"] is False
            assert client.get("/api/v1/admin/tenants").status_code == 503
    finally:
        with psycopg.connect(postgres["migrator"]) as c:
            c.execute("GRANT SELECT(name) ON business TO orderfit_admin_reader")


def test_system_reports_actual_unknown_and_failed_checks(postgres, config, accounts, monkeypatch):
    owner = accounts[0]
    promote(postgres, owner, config=config)
    identity = IdentityService(postgres["database"], enabled(config))
    monkeypatch.setattr(identity.database, "readiness", lambda: {"database": True, "schema_current": True, "worker": True})
    unknown = admin.system(identity, owner.token, None)
    assert unknown.status == "unavailable" and unknown.checks.storage_writable is None
    monkeypatch.setattr(identity.database, "readiness", lambda: {"database": True, "schema_current": True, "worker": False})
    failed = admin.system(identity, owner.token, None)
    assert failed.status == "degraded" and failed.checks.worker_active is False


def test_warning_acknowledgement_is_enforced_before_snapshot_write(postgres, accounts, monkeypatch):
    # Exercise the persisted confirmation boundary with synthetic upstream warnings.
    # Current manual review mostly emits blocking findings; this branch must still
    # enforce any nonblocking findings supplied by the review builder.
    from orderfit.api.errors import ApplicationError
    from orderfit.contracts.workflow import ConfirmInputs, Finding
    from orderfit.store.repositories import DealRepository
    from tests.db.test_p3_review_regressions import setup_deal

    owner = accounts[0]
    deal, _ = setup_deal(postgres, owner)
    build = DealRepository.build_review

    def warned(*args, **kwargs):
        review = build(*args, **kwargs)
        return review.model_copy(update={"findings": [Finding(code="SYNTHETIC_WARNING", field=None,
            message="Review synthetic source uncertainty.", blocking=False, resolution="provide_evidence")]})

    monkeypatch.setattr(DealRepository, "build_review", staticmethod(warned))
    with postgres["database"].tenant(owner.token, owner.business_id, "prepare") as (c, scope):
        review = DealRepository.build_review(c, owner.business_id, deal.id)
        req = ConfirmInputs(expected_version=review.version, expected_input_version=review.input_version,
            expected_financial_revision=review.financial_revision, snapshot_hash=review.snapshot_hash,
            confirmed_field_ids=review.required_field_ids, acknowledged_warning_codes=["OTHER_CODE"])
        with pytest.raises(ApplicationError) as error:
            DealRepository.confirm(c, scope, deal.id, req, str(uuid4()))
        assert error.value.status == 422 and error.value.code == "UNACKNOWLEDGED_WARNINGS"
        assert error.value.message == "Acknowledge all review warnings before confirming."
        assert c.execute(text("SELECT count(*) FROM input_snapshot WHERE deal_id=:d"), {"d": deal.id}).scalar_one() == 0
        assert c.execute(text("SELECT version FROM deal WHERE id=:d"), {"d": deal.id}).scalar_one() == deal.version
        confirmed = DealRepository.confirm(c, scope, deal.id,
            req.model_copy(update={"acknowledged_warning_codes": ["SYNTHETIC_WARNING"]}), str(uuid4()))
        assert confirmed.snapshot_id


def test_transient_operation_read_does_not_create_a_second_evaluation(postgres, config, accounts, monkeypatch):
    from orderfit.api.errors import ApplicationError
    from tests.db.p3_helpers import manual_evaluation

    owner = accounts[0]
    app = create_app(config, postgres["database"])
    with TestClient(app) as client:
        client.cookies.set("orderfit_session", owner.token)
        client.cookies.set("orderfit_csrf", owner.csrf)
        headers = {"Origin": "http://localhost:3000", "X-CSRF-Token": owner.csrf}
        deal, _, operation = manual_evaluation(client, headers, owner.business_id)
        saved_get = app.state.operations.get

        def fail_once(*args):
            monkeypatch.setattr(app.state.operations, "get", saved_get)
            raise ApplicationError(503, "DEPENDENCY_UNAVAILABLE", "Retry the saved operation status.")

        monkeypatch.setattr(app.state.operations, "get", fail_once)
        url = f"/api/v1/businesses/{owner.business_id}/operations/{operation['operation_id']}"
        assert client.get(url).status_code == 503
        recovered = client.get(url)
        assert recovered.status_code == 200
        assert recovered.json()["operation_id"] == operation["operation_id"]
        with postgres["database"].tenant(owner.token, owner.business_id) as (c, _):
            assert c.execute(text("SELECT count(*) FROM operation WHERE deal_id=:d AND kind='evaluate'"),
                             {"d": deal["id"]}).scalar_one() == 1


def test_read_serializes_platform_revocation_and_pooled_context_clears(postgres, config, accounts):
    owner = accounts[0]
    promote(postgres, owner, config=config)
    identity = IdentityService(postgres["database"], enabled(config))
    started = Event()

    def revoke():
        with psycopg.connect(postgres["migrator"]) as c:
            c.execute("SET lock_timeout='3s'")
            started.set()
            c.execute("UPDATE app_user SET is_platform_admin=false WHERE id=%s", (owner.user_id,))

    with ThreadPoolExecutor(max_workers=1) as pool:
        with admin.read_connection(identity, owner.token) as (c, _):
            future = pool.submit(revoke)
            assert started.wait(2)
            assert c.execute(text("SELECT count(*) FROM public.admin_read_users(:d,1,NULL)"),
                             {"d": digest_token(owner.token)}).scalar_one() == 1
        future.result(timeout=5)
    from orderfit.api.errors import ApplicationError
    with pytest.raises(ApplicationError) as error:
        admin.overview(identity, owner.token)
    assert error.value.status == 401
    with postgres["database"].transaction() as c:
        assert c.execute(text("SELECT count(*) FROM deal")).scalar_one() == 0

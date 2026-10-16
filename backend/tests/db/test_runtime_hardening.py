"""Runtime-hardening regressions against PG17 with the restricted runtime/worker logins.

Auth throttles per account/source, pre-body upload authorization, transient settlement
retry, narrowed business/document UPDATE privileges and the password/profile lock order.
"""

import json
import threading
import time
from uuid import UUID, uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from orderfit.api.errors import ApplicationError
from orderfit.api.main import create_app
from orderfit.contracts.resources import PasswordChange, SignIn, SignUp
from orderfit.services.identity import IdentityService
from orderfit.workflow import execution as execution_module
from tests.db import test_p6_approval
from tests.db.test_p4_documents import PO_TEXT, Session, make_deal, versions
from tests.db.test_p6_approval import ORIGIN
from tests.db.test_p6_execution import committable, db_rows, drain, execute, run

case = test_p6_approval.case  # shared evaluated-deal fixture
PASSWORD = "Synthetic password 123!"
MIB = 1048576


def new_user(service):
    email = f"{uuid4().hex}@example.test"
    service.authenticate(
        SignUp(email=email, password=PASSWORD, full_name="Synthetic owner",
               business_name="Synthetic business", currency="BDT", timezone="Asia/Dhaka"),
        str(uuid4()), None, service.csrf(), "signup-" + uuid4().hex,
    )
    return email


def sign_in(service, email, password, source):
    try:
        service.authenticate(SignIn(email=email, password=password), str(uuid4()), None,
                             service.csrf(), source)
        return 200
    except ApplicationError as exc:
        return exc.status


# ---- 1: auth throttles ------------------------------------------------------------------
def test_one_shared_source_cannot_lock_out_other_accounts(postgres, config):
    service = IdentityService(postgres["database"], config)
    victim, other = new_user(service), new_user(service)
    edge = "edge-" + uuid4().hex  # every user arrives from one proxy address
    outcomes = [sign_in(service, victim, "Wrong password 000!", edge) for _ in range(16)]
    assert outcomes == [401] * 15 + [429]  # strict per-account limit
    # The same source still serves every other account, and the victim from elsewhere is
    # still throttled (the account key, not the source key, stopped the guessing).
    assert sign_in(service, other, PASSWORD, edge) == 200
    assert sign_in(service, victim, PASSWORD, "elsewhere-" + uuid4().hex) == 429


def test_account_brute_force_is_blocked_across_rotating_sources(postgres, config):
    service = IdentityService(postgres["database"], config)
    target = new_user(service)
    outcomes = [sign_in(service, target, "Wrong password 000!", "rotating-" + uuid4().hex)
                for _ in range(16)]
    assert outcomes == [401] * 15 + [429]


def test_verified_sign_ins_are_not_counted(postgres, config):
    service = IdentityService(postgres["database"], config.model_copy(update={"auth_source_limit": 15}))
    user = new_user(service)
    source = "office-" + uuid4().hex
    assert [sign_in(service, user, PASSWORD, source) for _ in range(20)] == [200] * 20
    # Failures after many successes still have the full budget.
    assert [sign_in(service, user, "Wrong password 000!", source) for _ in range(15)] == [401] * 15
    assert sign_in(service, user, PASSWORD, source) == 429


def test_source_ceiling_is_configurable(postgres, config):
    strict = IdentityService(postgres["database"], config.model_copy(update={"auth_source_limit": 15}))
    users = [new_user(strict) for _ in range(4)]
    source = "ceiling-" + uuid4().hex
    outcomes = [sign_in(strict, users[i % 3], "Wrong password 000!", source) for i in range(15)]
    assert outcomes == [401] * 15  # 5 per account: under every account limit
    assert sign_in(strict, users[3], PASSWORD, source) == 429  # source ceiling reached
    # The refused attempt did not consume users[3]'s account budget; another source works.
    assert sign_in(strict, users[3], PASSWORD, "other-" + uuid4().hex) == 200
    # The default ceiling is far higher: the same pattern on a fresh source is admitted.
    roomy = IdentityService(postgres["database"], config)
    source = "roomy-" + uuid4().hex
    assert [sign_in(roomy, users[i % 3], "Wrong password 000!", source) for i in range(15)] == [401] * 15
    assert sign_in(roomy, users[3], PASSWORD, source) == 200


# ---- 2: upload bodies above 1 MiB need a verified member before they are received --------
def test_large_upload_body_requires_verified_membership(postgres, accounts, config):
    app = create_app(config, postgres["database"])
    a, b = accounts
    big = (PO_TEXT + "Line item filler for a large synthetic purchase order.\n" * 40000).encode()
    assert MIB < len(big) < 25 * MIB
    with TestClient(app) as ca, TestClient(app) as cb, TestClient(app) as forged:
        for client, account in ((ca, a), (cb, b)):
            client.cookies.set("orderfit_session", account.token)
            client.cookies.set("orderfit_csrf", account.csrf)
        sa = Session(ca, a, f"/api/v1/businesses/{a.business_id}")
        deal = make_deal(sa)
        meta = json.dumps(dict(kind="po", source_role="customer_order", **versions(sa, deal["id"])))
        url = f"/api/v1/businesses/{a.business_id}/deals/{deal['id']}/documents"

        def post(client, account_csrf):
            return client.post(url, data={"metadata": meta}, files={"file": ("po.txt", big, "text/plain")},
                               headers={"X-CSRF-Token": account_csrf, "Origin": ORIGIN,
                                        "Idempotency-Key": str(uuid4())})

        # A valid session of another tenant and a forged cookie value stay at 1 MiB.
        assert post(cb, b.csrf).status_code == 413
        forged.cookies.set("orderfit_session", "forged-" + uuid4().hex)
        forged.cookies.set("orderfit_csrf", a.csrf)
        assert post(forged, a.csrf).status_code == 413
        # The member's large upload is received and stored.
        r = post(ca, a.csrf)
        assert r.status_code == 201, r.text
        assert r.json()["size_bytes"] == len(big)
        assert app.state.upload_gate.active == 0  # every slot released


# ---- 3: settlement lock/timeout errors are retried, not reconciliation outcomes ----------
def _statement_timeout(c):
    c.execute(text("SELECT set_config('statement_timeout','10ms',true)"))
    c.execute(text("SELECT pg_sleep(1)"))  # genuine SQLSTATE 57014 from PostgreSQL


def test_settlement_timeout_is_retried_under_the_same_lease(case, postgres, monkeypatch):
    s = case
    bundle, approval = committable(s, confirmation=False)
    before = s["read"](f"/deals/{s['deal']['id']}")
    original = execution_module._settlement_row
    attempts = []

    def flaky(c, scope, run_row, kind):
        attempts.append(kind)
        if len(attempts) == 1:
            _statement_timeout(c)
        return original(c, scope, run_row, kind)

    monkeypatch.setattr(execution_module, "_settlement_row", flaky)
    monkeypatch.setattr(execution_module, "SETTLE_BACKOFF_SECONDS", (0, 0))
    job = execute(s, bundle, approval)
    drain(postgres)
    op = s["read"](f"/operations/{job['operation_id']}")
    assert op["status"] == "succeeded" and op["result"]["kind"] == "completed", op
    assert len(attempts) == 2
    executed = run(s, op["result"]["resource_id"])
    assert executed["status"] == "succeeded" and not executed["reconciliation_required"]
    after = s["read"](f"/deals/{s['deal']['id']}")
    assert after["status"] == "committed"
    assert after["financial_revision"] == before["financial_revision"] + 1  # one bump, not two
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM commitment_gate")[0]["n"] == 0
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM commitment_projection WHERE deal_id=:d",
                   d=UUID(s["deal"]["id"]))[0]["n"] == 1
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM operation_log WHERE action='execution_settlement_failed' "
                   "AND payload->>'run_id'=:r", r=executed["id"])[0]["n"] == 0


def test_settlement_timeouts_exhausting_retries_hold_the_gate(case, postgres, monkeypatch):
    s = case
    bundle, approval = committable(s, confirmation=False)
    attempts = []

    def always(c, scope, run_row, kind):
        attempts.append(kind)
        _statement_timeout(c)

    monkeypatch.setattr(execution_module, "_settlement_row", always)
    monkeypatch.setattr(execution_module, "SETTLE_BACKOFF_SECONDS", (0, 0))
    job = execute(s, bundle, approval)
    drain(postgres)
    op = s["read"](f"/operations/{job['operation_id']}")
    assert op["status"] == "failed" and op["result"]["error"]["code"] == "SETTLEMENT_RECONCILIATION_REQUIRED"
    assert len(attempts) == execution_module.SETTLE_ATTEMPTS
    partial = run(s, s["read"](f"/bundles/{bundle['manifest']['id']}")["run_id"])
    assert partial["status"] == "partial" and partial["reconciliation_required"]
    assert db_rows(postgres, s, "SELECT payload->>'reason' AS reason FROM operation_log "
                   "WHERE action='execution_settlement_failed' AND payload->>'run_id'=:r",
                   r=partial["id"])[0]["reason"] == "transient_retries_exhausted"


# ---- 5: the runtime role cannot rewrite tenancy/status or original-document content ------
FORBIDDEN_BUSINESS = {"status": "'suspended'", "currency": "'USD'", "is_synthetic": "true",
                      "id": "gen_random_uuid()", "created_at": "now()"}
FORBIDDEN_DOCUMENT = {"content_hash": "sha256('x')", "storage_key": "'elsewhere'", "size_bytes": "2",
                      "mime_type": "'application/pdf'", "original_filename": "'renamed.txt'",
                      "kind": "'other'", "untrusted": "false", "uploaded_by": "uploaded_by",
                      "uploaded_at": "now()", "deal_id": "deal_id"}


def test_runtime_login_cannot_update_business_status_or_document_content(postgres, accounts, config):
    a = accounts[0]
    db = postgres["database"]
    with TestClient(create_app(config, db)) as client:
        client.cookies.set("orderfit_session", a.token)
        client.cookies.set("orderfit_csrf", a.csrf)
        sa = Session(client, a, f"/api/v1/businesses/{a.business_id}")
        deal = make_deal(sa)
        meta = dict(kind="po", source_role="customer_order", **versions(sa, deal["id"]))
        doc = sa.write("POST", f"/deals/{deal['id']}/documents", None, data={"metadata": json.dumps(meta)},
                       files={"file": ("po.txt", PO_TEXT.encode(), "text/plain")}).json()
    for column, value in FORBIDDEN_BUSINESS.items():
        with pytest.raises(DBAPIError) as exc:
            with db.tenant(a.token, a.business_id, "manage_members") as (c, _):
                c.execute(text(f"UPDATE business SET {column}={value} WHERE id=:b"), {"b": a.business_id})
        assert exc.value.orig.sqlstate == "42501", column
    for column, value in FORBIDDEN_DOCUMENT.items():
        with pytest.raises(DBAPIError) as exc:
            with db.tenant(a.token, a.business_id, "prepare") as (c, _):
                c.execute(text(f"UPDATE document SET {column}={value} WHERE id=:id"), {"id": UUID(doc["id"])})
        assert exc.value.orig.sqlstate == "42501", column
    # Columns the application writes still work for the restricted login.
    with db.tenant(a.token, a.business_id, "manage_members") as (c, _):
        c.execute(text("UPDATE business SET name='Renamed synthetic business' WHERE id=:b"), {"b": a.business_id})
        c.execute(text("SELECT id FROM document WHERE id=:id FOR UPDATE"), {"id": UUID(doc["id"])})
    with psycopg.connect(postgres["migrator"]) as c:
        rows = c.execute(
            "SELECT r, has_column_privilege(r,'business','status','UPDATE'),"
            " has_column_privilege(r,'business','currency','UPDATE'),"
            " has_column_privilege(r,'document','content_hash','UPDATE'),"
            " has_column_privilege(r,'document','storage_key','UPDATE'),"
            " has_column_privilege(r,'business','financial_revision','UPDATE'),"
            " has_column_privilege(r,'document','source_role','UPDATE')"
            " FROM unnest(ARRAY['orderfit_app','orderfit_worker','p1_runtime','p1_worker']) r").fetchall()
        assert all(row[1:] == (False, False, False, False, True, True) for row in rows), rows
        assert c.execute("SELECT status FROM business WHERE id=%s", (a.business_id,)).fetchone()[0] == "active"


# ---- 7: password change and profile update from two sessions do not deadlock -------------
def test_password_change_and_profile_update_take_locks_in_one_order(postgres, config):
    service = IdentityService(postgres["database"], config)
    email = new_user(service)
    _, first, _ = service.authenticate(SignIn(email=email, password=PASSWORD), str(uuid4()), None,
                                       service.csrf(), "lock-" + uuid4().hex)
    _, second, _ = service.authenticate(SignIn(email=email, password=PASSWORD), str(uuid4()), None,
                                        service.csrf(), "lock-" + uuid4().hex)
    outcome = {}

    def change():
        try:
            service.change_password(first, PasswordChange(current_password=PASSWORD,
                                                           new_password="Another synthetic pw 456!"),
                                    "lock-" + uuid4().hex)
            outcome["password"] = "ok"
        except Exception as exc:  # noqa: BLE001 - reported by the assertion below
            outcome["password"] = getattr(getattr(exc, "orig", None), "sqlstate", None) or type(exc).__name__

    def waiting_on_lock():
        with psycopg.connect(postgres["migrator"]) as c:
            return c.execute("SELECT count(*) FROM pg_stat_activity WHERE usename='p1_runtime' "
                             "AND wait_event_type='Lock'").fetchone()[0]

    thread = None
    try:
        # The profile transaction holds its session row (session_resolve) ...
        with postgres["database"].identity(second) as (c, scope, _):
            thread = threading.Thread(target=change)
            thread.start()
            deadline = time.monotonic() + 30
            while waiting_on_lock() == 0 and thread.is_alive() and time.monotonic() < deadline:
                time.sleep(0.05)
            # ... and then needs app_user, which the password change must not hold yet.
            c.execute(text("SELECT version FROM app_user WHERE id=:u FOR UPDATE"), {"u": scope.user_id})
            c.execute(text("UPDATE app_user SET full_name='Profile edit' WHERE id=:u"), {"u": scope.user_id})
        outcome["profile"] = "ok"
    except DBAPIError as exc:
        outcome["profile"] = exc.orig.sqlstate
    finally:
        if thread is not None:
            thread.join(30)
    assert outcome == {"profile": "ok", "password": "ok"}, outcome
    assert sign_in(service, email, "Another synthetic pw 456!", "lock-" + uuid4().hex) == 200

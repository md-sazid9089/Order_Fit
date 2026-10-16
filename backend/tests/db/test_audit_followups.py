"""Regression tests for the follow-up audit findings (lock order, lease fencing, settlement
failure routing, notification writer, step-up rate limit, upload authorization order).

Real sessions, the restricted runtime/worker logins and PG17 guards. Only lease expiry or
rotation (simulating a slow worker whose lease lapsed or was reclaimed) uses the migrator.
"""

import json
from uuid import UUID, uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, text
from sqlalchemy.exc import DBAPIError

from orderfit.api.main import create_app
from orderfit.store import execution_repository
from orderfit.workflow import execution as execution_module
from orderfit.workflow.operations import Operations
from orderfit.workflow.worker import DEFAULT_HANDLERS, run_once
from tests.db import test_p6_approval
from tests.db.p3_helpers import manual_evaluation
from tests.db.test_p4_documents import PO_TEXT, Session, make_deal, versions
from tests.db.test_p6_approval import ORIGIN, code, member, post, reviewed, step_up
from tests.db.test_p6_execution import (
    approved,
    committable,
    db_rows,
    drain,
    effects_per_action,
    execute,
    expire_leases,
    run,
)

case = test_p6_approval.case  # shared evaluated-deal fixture


# ---- 1: evaluate publication takes business -> deal -> operation as separate statements ----
def test_evaluate_publication_lock_order_business_deal_operation(postgres, accounts, config):
    a = accounts[0]
    statements = []

    def capture(_conn, _cursor, statement, _params, _context, _many):
        if "FOR UPDATE" in statement or "FOR SHARE" in statement:
            statements.append(" ".join(statement.split()))

    with TestClient(create_app(config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", a.token)
        client.cookies.set("orderfit_csrf", a.csrf)
        headers = {"Origin": ORIGIN, "X-CSRF-Token": a.csrf}
        _, _, job = manual_evaluation(client, headers, a.business_id)
        engine = postgres["worker"].engine
        event.listen(engine, "before_cursor_execute", capture)
        try:
            assert run_once(Operations(postgres["worker"]), "lock-order", DEFAULT_HANDLERS)
        finally:
            event.remove(engine, "before_cursor_execute", capture)
        op = client.get(f"/api/v1/businesses/{a.business_id}/operations/{job['operation_id']}").json()
        assert op["status"] == "succeeded" and op["result"]["kind"] == "completed", op
    # A multi-table FOR UPDATE OF lets the planner choose the acquisition order.
    assert not [s for s in statements if "FOR UPDATE OF" in s], statements
    order = [kind for s in statements for kind, prefix in (
        ("business", "SELECT financial_revision FROM business WHERE id="),
        ("deal", "SELECT input_version,status FROM deal WHERE"),
        ("operation", "SELECT id FROM operation WHERE id="),
    ) if s.startswith(prefix)]
    assert order == ["business", "deal", "operation"], statements


# ---- 2: an effect transaction rechecks the lease under the operation row lock -------------
def _lapse(postgres, mode):
    with psycopg.connect(postgres["migrator"], autocommit=True) as c:
        if mode == "expired":
            c.execute("UPDATE operation SET lease_expires_at=clock_timestamp()-interval '1 second' "
                      "WHERE status='running'")
        else:  # another worker reclaimed the job: new token, fresh lease
            c.execute("UPDATE operation SET lease_token=gen_random_uuid(),"
                      "lease_expires_at=clock_timestamp()+interval '60 seconds' WHERE status='running'")


@pytest.mark.parametrize("mode", ["expired", "reclaimed"])
def test_effect_not_committed_after_lease_lost(case, postgres, monkeypatch, mode):
    s = case
    bundle, approval = approved(s, "send_message", [reviewed(s)["identity"]["message_id"]])
    job = execute(s, bundle, approval)
    original = execution_repository.approval_reason
    lapsed = []

    def lapse_after_start(c, approval_id):
        # Runs inside the effect transaction after its opening lease check and locks.
        reason = original(c, approval_id)
        if not lapsed:
            lapsed.append(mode)
            _lapse(postgres, mode)
        return reason

    monkeypatch.setattr(execution_repository, "approval_reason", lapse_after_start)
    assert run_once(Operations(postgres["worker"]), "slow-worker", DEFAULT_HANDLERS)
    assert lapsed == [mode]
    run_id = s["read"](f"/bundles/{bundle['manifest']['id']}")["run_id"]
    assert effects_per_action(postgres, s, run_id) == [0]  # the lapsed worker committed nothing
    monkeypatch.setattr(execution_repository, "approval_reason", original)
    expire_leases(postgres)
    drain(postgres)  # recovery completes the same run exactly once
    op = s["read"](f"/operations/{job['operation_id']}")
    assert op["status"] == "succeeded" and op["result"]["kind"] == "completed", op
    assert effects_per_action(postgres, s, run_id) == [1]


# ---- 3: unexpected settlement errors take the safe reconciliation path --------------------
@pytest.mark.parametrize("error", [KeyError, StopIteration])
def test_unexpected_settlement_error_requires_reconciliation(case, postgres, monkeypatch, caplog, error):
    s = case
    bundle, approval = committable(s, confirmation=False)
    job = execute(s, bundle, approval)

    def broken(*_args, **_kwargs):
        raise error("private-payload-marker")

    monkeypatch.setattr(execution_module, "_project", broken)
    # Alembic's fileConfig (run by the fixture) disables loggers created before it.
    monkeypatch.setattr(execution_module.LOG, "disabled", False)
    caplog.set_level("ERROR", logger="orderfit.execution")
    drain(postgres)
    op = s["read"](f"/operations/{job['operation_id']}")
    assert op["status"] == "failed" and op["result"]["error"]["code"] == "SETTLEMENT_RECONCILIATION_REQUIRED", op
    partial = run(s, s["read"](f"/bundles/{bundle['manifest']['id']}")["run_id"])
    assert partial["status"] == "partial" and partial["reconciliation_required"]
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM commitment_gate WHERE run_id=:r",
                   r=UUID(partial["id"]))[0]["n"] == 1  # gate retained by design
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM operation_log WHERE action='execution_settlement_failed' "
                   "AND payload->>'run_id'=:r", r=partial["id"])[0]["n"] == 1
    assert s["read"](f"/deals/{s['deal']['id']}")["status"] != "committed"
    logged = [r.getMessage() for r in caplog.records if r.name == "orderfit.execution"]
    assert any(job["operation_id"] in m and error.__name__ in m for m in logged), logged
    assert not any("private-payload-marker" in m for m in logged)


# ---- 4: only the SECURITY DEFINER writer inserts notifications --------------------------
def test_runtime_logins_cannot_insert_notifications(postgres, accounts):
    a = accounts[0]
    # Probe as the restricted runtime login, in the caller's own tenant, for the caller.
    with pytest.raises(DBAPIError) as exc:
        with postgres["database"].tenant(a.token, a.business_id, "manage_members") as (c, _):
            c.execute(text("INSERT INTO notification(business_id,user_id,severity,title,message) "
                           "VALUES(:b,:u,'critical','Forged','Forged notice')"),
                      dict(b=a.business_id, u=a.user_id))
    assert exc.value.orig.sqlstate == "42501"
    with psycopg.connect(postgres["migrator"]) as c:
        privileges = c.execute(
            "SELECT r, has_table_privilege(r,'notification','INSERT'),"
            " has_column_privilege(r,'notification','title','UPDATE'),"
            " has_column_privilege(r,'notification','read_at','UPDATE')"
            " FROM unnest(ARRAY['orderfit_app','orderfit_worker','p1_runtime','p1_worker']) r").fetchall()
        assert all(row[1:] == (False, False, True) for row in privileges), privileges
        assert c.execute("SELECT count(*) FROM pg_policies WHERE tablename='notification' AND cmd='INSERT' "
                         "AND 'public'=ANY(roles)").fetchone()[0] == 0


# ---- 6: password step-up is rate limited per account/session ----------------------------
def test_step_up_rate_limited_per_account(case, postgres, config):
    s = case
    bundle = test_p6_approval.prepare(s, "send_message", [reviewed(s)["identity"]["message_id"]])
    assert step_up(s, bundle)["grant_id"]  # the correct flow works
    limited = None
    for _ in range(20):
        r = post(s, "/api/v1/auth/step-up", dict(
            business_id=str(s["account"].business_id), bundle_id=bundle["manifest"]["id"],
            bundle_hash=bundle["bundle_hash"], purpose="send_message", password="Wrong password 000!"), root=True)
        if r.status_code == 429:
            limited = r
            break
        assert r.status_code == 401 and code(r) == "INVALID_CREDENTIALS", r.text
    assert limited is not None and code(limited) == "AUTH_RATE_LIMIT"
    assert "Wrong password" not in limited.text and limited.json()["error"]["retryable"] in (True, False)
    # Not global: another member of the same business (same client address) still steps up.
    risk, _ = member(postgres, config, s, "risk_officer")
    test_p6_approval.as_user(s, risk)
    assert step_up(s, bundle)["grant_id"]


# ---- 7: uploads authorize the tenant before parsing --------------------------------------
def test_upload_authorizes_before_parsing(postgres, accounts, config, monkeypatch):
    from orderfit.api.routes import documents as documents_route

    calls = []
    real_parse = documents_route.parse
    monkeypatch.setattr(documents_route, "parse", lambda data, mime: calls.append(mime) or real_parse(data, mime))
    app = create_app(config, postgres["database"])
    a, b = accounts
    with TestClient(app) as ca, TestClient(app) as cb:
        for client, account in ((ca, a), (cb, b)):
            client.cookies.set("orderfit_session", account.token)
            client.cookies.set("orderfit_csrf", account.csrf)
        sa = Session(ca, a, f"/api/v1/businesses/{a.business_id}")
        deal = make_deal(sa)
        meta = dict(kind="po", source_role="customer_order", **versions(sa, deal["id"]))
        r = cb.post(f"/api/v1/businesses/{a.business_id}/deals/{deal['id']}/documents",
                    data={"metadata": json.dumps(meta)}, files={"file": ("po.txt", PO_TEXT.encode(), "text/plain")},
                    headers={"X-CSRF-Token": b.csrf, "Origin": ORIGIN, "Idempotency-Key": str(uuid4())})
        assert r.status_code == 404 and calls == [], r.text
        # A missing deal in the caller's own business is also refused before parsing.
        r = ca.post(f"/api/v1/businesses/{a.business_id}/deals/{uuid4()}/documents",
                    data={"metadata": json.dumps(meta)}, files={"file": ("po.txt", PO_TEXT.encode(), "text/plain")},
                    headers={"X-CSRF-Token": a.csrf, "Origin": ORIGIN, "Idempotency-Key": str(uuid4())})
        assert r.status_code == 404 and calls == [], r.text
        uploaded = sa.write("POST", f"/deals/{deal['id']}/documents", None, data={"metadata": json.dumps(meta)},
                            files={"file": ("po.txt", PO_TEXT.encode(), "text/plain")}).json()
        assert uploaded["parse_status"] == "parsed" and calls == ["text/plain"]

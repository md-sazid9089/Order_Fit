"""Execution item retry, late cancellation and evaluate cancellation against PG17.

Real sessions with the restricted runtime/worker logins. Transient SQLSTATEs are raised by
PostgreSQL inside the item transaction (statement timeout, or RAISE with the SQLSTATE), so
the driver error and the rollback are genuine.
"""

from uuid import UUID

import psycopg
from fastapi.testclient import TestClient
from sqlalchemy import text

from orderfit.agent.nodes.compute import compute as real_compute
from orderfit.api.main import create_app
from orderfit.workflow import execution as execution_module
from orderfit.workflow.operations import Operations
from orderfit.workflow.worker import run_once
from tests.db import test_p6_approval
from tests.db.p3_helpers import manual_evaluation
from tests.db.test_p6_approval import ORIGIN, post
from tests.db.test_p6_execution import (
    COMPLETED,
    committable,
    db_rows,
    drain,
    effects_per_action,
    execute,
    run,
)

case = test_p6_approval.case  # shared evaluated-deal fixture


def raise_sqlstate(c, sqlstate):
    if sqlstate == "57014":
        c.execute(text("SELECT set_config('statement_timeout','10ms',true)"))
        c.execute(text("SELECT pg_sleep(1)"))
    c.execute(text(f"DO $$BEGIN RAISE EXCEPTION 'injected' USING ERRCODE='{sqlstate}'; END$$"))


def inject_effect_failures(monkeypatch, plan):
    """Fail the item transaction after its effect row is written. ``plan(item_key, n)`` names
    the SQLSTATE to raise on the n-th attempt of that item, or None to let it commit."""
    original = execution_module.append_audit
    attempts = {}

    def flaky(c, scope, action, **kwargs):
        if action == "sandbox_effect":
            key = kwargs["payload"]["item_key"]
            attempts[key] = attempts.get(key, 0) + 1
            sqlstate = plan(key, attempts[key])
            if sqlstate:
                raise_sqlstate(c, sqlstate)
        return original(c, scope, action, **kwargs)

    monkeypatch.setattr(execution_module, "append_audit", flaky)
    monkeypatch.setattr(execution_module, "ITEM_BACKOFF_SECONDS", (0, 0))
    return attempts


def gate_count(postgres, s):
    return db_rows(postgres, s, "SELECT count(*) AS n FROM commitment_gate")[0]["n"]


# ---- transient errors inside an item are retried under the same lease ----------------
def test_item_lock_timeout_and_deadlock_are_retried_without_duplicate_effects(case, postgres, monkeypatch):
    s = case
    bundle, approval = committable(s)  # commitment + outbox confirmation: two items
    first = []

    def plan(key, n):
        first.append(key) if not first else None
        if key == first[0]:
            return {1: "55P03", 2: "40P01"}.get(n)  # lock timeout, then deadlock, then commit
        return "57014" if n == 1 else None  # genuine statement timeout on the second item

    attempts = inject_effect_failures(monkeypatch, plan)
    job = execute(s, bundle, approval)
    drain(postgres)
    op = s["read"](f"/operations/{job['operation_id']}")
    assert op["status"] == "succeeded" and op["result"]["kind"] == "completed", op
    assert sorted(attempts.values()) == [2, 3]
    executed = run(s, op["result"]["resource_id"])
    assert executed["status"] == "succeeded" and not executed["reconciliation_required"]
    assert all(a["status"] in COMPLETED for a in executed["actions"])
    assert effects_per_action(postgres, s, executed["id"]) == [1, 1]  # rolled-back attempts left nothing
    assert s["read"](f"/deals/{s['deal']['id']}")["status"] == "committed"
    assert gate_count(postgres, s) == 0
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM operation_log WHERE action='execution_stopped' "
                   "AND payload->>'run_id'=:r", r=executed["id"])[0]["n"] == 0


def test_item_retries_exhausted_stop_the_run_partial_and_hold_the_gate(case, postgres, monkeypatch):
    s = case
    bundle, approval = committable(s)
    order = []

    def plan(key, n):
        if key not in order:
            order.append(key)
        return "55P03" if key == order[-1] and len(order) == 2 else None  # second item always blocked

    attempts = inject_effect_failures(monkeypatch, plan)
    job = execute(s, bundle, approval)
    drain(postgres)
    op = s["read"](f"/operations/{job['operation_id']}")
    assert op["status"] == "succeeded" and op["result"]["kind"] == "blocked", op
    assert op["result"]["findings"][0]["code"] == "TRANSIENT_RETRIES_EXHAUSTED"
    assert attempts[order[1]] == execution_module.ITEM_ATTEMPTS
    partial = run(s, s["read"](f"/bundles/{bundle['manifest']['id']}")["run_id"])
    assert partial["status"] == "partial" and partial["reconciliation_required"]
    assert sorted(effects_per_action(postgres, s, partial["id"])) == [0, 1]
    assert gate_count(postgres, s) == 1
    assert s["read"](f"/deals/{s['deal']['id']}")["status"] != "committed"


# ---- cancellation stops remaining effects; once all completed, settlement finishes -----
def cancel_after_item(monkeypatch, s, job, item_number):
    seen = []

    def hook(point):
        if point == "after_item_commit":
            seen.append(point)
            if len(seen) == item_number:
                op = s["read"](f"/operations/{job['operation_id']}")
                r = post(s, f"/operations/{job['operation_id']}/cancel",
                         dict(expected_operation_version=op["version"], reason="Owner cancelled the run."))
                assert r.status_code == 200, r.text
                assert r.json()["cancellation_requested"] is True

    monkeypatch.setattr(execution_module, "fault", hook)
    return seen


def test_cancel_after_last_item_settles_commits_and_releases_gate(case, postgres, monkeypatch):
    s = case
    bundle, approval = committable(s)
    before = s["read"](f"/deals/{s['deal']['id']}")
    job = execute(s, bundle, approval)
    seen = cancel_after_item(monkeypatch, s, job, 2)
    drain(postgres)
    assert len(seen) == 2
    op = s["read"](f"/operations/{job['operation_id']}")
    assert op["status"] == "succeeded" and op["result"]["kind"] == "completed", op
    assert op["cancellation_requested"] is True
    executed = run(s, op["result"]["resource_id"])
    assert executed["status"] == "succeeded" and not executed["reconciliation_required"]
    assert effects_per_action(postgres, s, executed["id"]) == [1, 1]
    after = s["read"](f"/deals/{s['deal']['id']}")
    assert after["status"] == "committed"
    assert after["financial_revision"] == before["financial_revision"] + 1
    assert gate_count(postgres, s) == 0
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM operation_log WHERE action='operation_finish' "
                   "AND payload->>'operation_id'=:o AND payload->>'cancellation_after_completion'='true'",
                   o=job["operation_id"])[0]["n"] == 1


def test_cancel_before_last_item_stops_remaining_effects_partial(case, postgres, monkeypatch):
    s = case
    bundle, approval = committable(s)
    job = execute(s, bundle, approval)
    seen = cancel_after_item(monkeypatch, s, job, 1)
    drain(postgres)
    assert len(seen) == 1  # the second effect never ran
    op = s["read"](f"/operations/{job['operation_id']}")
    assert op["status"] == "cancelled", op
    partial = run(s, s["read"](f"/bundles/{bundle['manifest']['id']}")["run_id"])
    assert partial["status"] == "partial" and partial["reconciliation_required"]
    assert sorted(effects_per_action(postgres, s, partial["id"])) == [0, 1]
    assert gate_count(postgres, s) == 1  # completed effects keep the gate until reconciliation
    assert s["read"](f"/deals/{s['deal']['id']}")["status"] != "committed"


def test_settlement_context_still_requires_the_lease(case, postgres):
    """The cancellation-tolerant context is not a lease bypass: wrong token, no context."""
    s = case
    bundle, approval = committable(s)
    job = execute(s, bundle, approval)
    claim = Operations(postgres["worker"]).claim("lease-probe")
    assert claim["id"] == UUID(job["operation_id"])
    with postgres["worker"].engine.begin() as c:
        rows = c.execute(text("SELECT count(*) FROM operation_settle_context(:id,gen_random_uuid())"),
                         {"id": claim["id"]}).scalar_one()
        held = c.execute(text("SELECT count(*) FROM operation_settle_context(:id,:t)"),
                         {"id": claim["id"], "t": claim["lease_token"]}).scalar_one()
    assert (rows, held) == (0, 1)
    with psycopg.connect(postgres["migrator"], autocommit=True) as admin:
        admin.execute("UPDATE operation SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=%s",
                      (claim["id"],))
    drain(postgres)  # recovery completes the same run normally
    assert s["read"](f"/operations/{job['operation_id']}")["status"] == "succeeded"


# ---- evaluate: a cancellation during compute publishes nothing and ends 'cancelled' ----
def test_cancel_during_evaluation_compute_publishes_nothing(postgres, accounts, config, monkeypatch):
    account = accounts[0]
    with TestClient(create_app(config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", account.token)
        client.cookies.set("orderfit_csrf", account.csrf)
        headers = {"Origin": ORIGIN, "X-CSRF-Token": account.csrf}
        deal, _, accepted = manual_evaluation(client, headers, account.business_id)

        def compute_then_cancel(snapshot, *args, **kwargs):
            computation = real_compute(snapshot)
            base = f"/api/v1/businesses/{account.business_id}/operations/{accepted['operation_id']}"
            op = client.get(base).json()
            r = client.post(base + "/cancel", json=dict(expected_operation_version=op["version"],
                                                         reason="Owner cancelled the evaluation."),
                             headers=headers | {"Idempotency-Key": "cancel-" + accepted["operation_id"]})
            assert r.status_code == 200, r.text
            return computation

        monkeypatch.setattr("orderfit.workflow.worker.bounded_compute", compute_then_cancel)
        assert run_once(Operations(postgres["worker"]), "cancel-race", {})
        op = client.get(f"/api/v1/businesses/{account.business_id}/operations/{accepted['operation_id']}").json()
        assert op["status"] == "cancelled" and op["result"] is None, op
        assert client.get(f"/api/v1/businesses/{account.business_id}/deals/{deal['id']}").json()["status"] \
            == "awaiting_confirm"
    with psycopg.connect(postgres["migrator"]) as admin:
        assert admin.execute("SELECT count(*) FROM evaluation WHERE deal_id=%s", (deal["id"],)).fetchone()[0] == 0

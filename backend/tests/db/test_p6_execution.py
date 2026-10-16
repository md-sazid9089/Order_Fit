"""P6-B sandbox execution, rounds, commitment gate/projection, recovery and compensation.

Real sessions, the restricted runtime/worker logins and PG17 guards. Only crash simulation
(expiring a killed worker's lease) uses the disposable migrator login.
"""

import threading
import time
from datetime import UTC, date, datetime, timedelta
from uuid import UUID, uuid4

import psycopg
import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from orderfit.workflow import execution as execution_module
from orderfit.workflow.operations import Operations
from orderfit.workflow.worker import DEFAULT_HANDLERS, run_once
from tests.db import test_p6_approval
from tests.db.p3_helpers import manual_evaluation
from tests.db.test_p6_approval import (
    as_user,
    code,
    decide,
    member,
    post,
    prepare,
    prepare_body,
    reviewed,
    step_up,
)

COMPLETED = {"sent", "posted", "accepted"}
case = test_p6_approval.case  # shared evaluated-deal fixture


class SimulatedCrash(BaseException):
    """Escapes the runner like a killed process: no finish, the lease stays held."""


def work(postgres, worker="p6b-worker"):
    return run_once(Operations(postgres["worker"]), worker, DEFAULT_HANDLERS)


def drain(postgres):
    while work(postgres):
        pass


def expire_leases(postgres):
    with psycopg.connect(postgres["migrator"], autocommit=True) as c:
        c.execute("UPDATE operation SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE status='running'")


def approved(s, kind, mids):
    bundle = prepare(s, kind, mids)
    return bundle, decide(s, bundle, step_up(s, bundle)["grant_id"])


def execute(s, bundle, approval, status=202, key=None):
    r = post(s, f"/bundles/{bundle['manifest']['id']}/execute", dict(
        **s["versions"](), approval_id=approval["id"], bundle_hash=bundle["bundle_hash"]), key)
    assert r.status_code == status, r.text
    return r.json()


def accept(s, ask, seconds=3600):
    return s["write"](f"/deals/{s['deal']['id']}/acceptances", dict(
        **s["versions"](), message_id=ask["identity"]["message_id"], preparation_hash=ask["preparation_hash"],
        reply_id=None, attestation="Buyer agreed in a recorded human conversation.",
        valid_until=(datetime.now(UTC) + timedelta(seconds=seconds)).isoformat()), 201)


def committable(s, confirmation=True):
    """Exact customer acceptance plus an approved commit bundle (optionally with an outbox note)."""
    ask = reviewed(s)
    mids = [reviewed(s)["identity"]["message_id"]] if confirmation else []
    accept(s, ask)
    return approved(s, "commit_plan", mids)


def run(s, run_id):
    return s["read"](f"/execution-runs/{run_id}")


def db_rows(postgres, s, sql, **params):
    with postgres["database"].tenant(s["account"].token, s["account"].business_id) as (c, _):
        return c.execute(text(sql), params).mappings().all()


def revision(s):
    return s["versions"]()["expected_financial_revision"]


def test_send_double_click_concurrent_workers_round_once_and_replay(case, postgres):
    s = case
    deal_id = s["deal"]["id"]
    mid = reviewed(s)["identity"]["message_id"]
    bundle, approval = approved(s, "send_message", [mid])
    before = s["read"](f"/deals/{deal_id}")
    key = str(uuid4())
    # Double-click: concurrent admissions with different keys reach one run/operation.
    results, errors = [], []
    request = _execute_request(s, bundle, approval)

    def click(k):
        from orderfit.services import execution

        try:
            with postgres["database"].tenant(s["account"].token, s["account"].business_id, "execute") as (c, scope):
                results.append(execution.admit(c, scope, UUID(bundle["manifest"]["id"]), request, k, bytes(32)))
        except Exception as exc:  # pragma: no cover - surfaced below
            errors.append(exc)

    threads = [threading.Thread(target=click, args=(str(uuid4()),)) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors and len({r.operation_id for r in results}) == 1
    # Same HTTP key replays the identical body; one run per bundle overall.
    first = execute(s, bundle, approval, key=key)
    assert execute(s, bundle, approval, key=key) == first
    assert first["operation_id"] == str(results[0].operation_id)
    # Concurrent workers: exactly one claims the queued job; each item has one effect.
    outcomes = []
    workers = [threading.Thread(target=lambda n=n: outcomes.append(work(postgres, f"w{n}"))) for n in range(3)]
    for t in workers:
        t.start()
    for t in workers:
        t.join()
    drain(postgres)
    op = s["read"](f"/operations/{first['operation_id']}")
    assert op["status"] == "succeeded" and op["result"]["kind"] == "completed", op
    executed = s["read"](op["result_url"].split(s["base"])[1])
    assert executed["status"] == "succeeded" and executed["sandbox"] is True
    assert [(a["kind"], a["status"], a["effect"]["effect_kind"]) for a in executed["actions"]] == [
        ("message", "sent", "outbox")]
    assert s["read"](f"/bundles/{bundle['manifest']['id']}")["run_id"] == executed["id"]
    rows = db_rows(postgres, s, "SELECT count(*) AS n FROM sandbox_effect e JOIN execution_action x ON x.id=e.action_id "
                   "WHERE x.run_id=:r", r=UUID(executed["id"]))
    assert rows[0]["n"] == 1
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM execution_run WHERE bundle_id=:b",
                   b=UUID(bundle["manifest"]["id"]))[0]["n"] == 1
    message = db_rows(postgres, s, "SELECT status,sent_at FROM negotiation_message WHERE id=:m", m=UUID(mid))[0]
    assert message["status"] == "sent" and message["sent_at"]
    after = s["read"](f"/deals/{deal_id}")
    # One completed round; a workflow-only increment does not change financial inputs.
    assert after["negotiation_round"] == before["negotiation_round"] + 1
    assert after["status"] == "awaiting_reply"
    assert (after["input_version"], after["financial_revision"]) == (
        before["input_version"], before["financial_revision"])
    # Replay after success (new key) returns the same finished operation; no second round.
    again = execute(s, bundle, approval)
    assert again["operation_id"] == first["operation_id"] and again["status"] == "succeeded"
    drain(postgres)
    assert s["read"](f"/deals/{deal_id}")["negotiation_round"] == after["negotiation_round"]
    page = s["read"](f"/deals/{deal_id}/actions")
    assert [a["id"] for a in page["items"]] == [a["id"] for a in executed["actions"]]
    # Reply ingestion records the inbound message but does not increment the round.
    s["finish"](s["write"](f"/deals/{deal_id}/replies", dict(
        **s["versions"](), ask_message_id=mid, party_id=s["deal"]["inputs"]["customer_id"],
        body="We accept the proposed terms."), 202))
    assert s["read"](f"/deals/{deal_id}")["negotiation_round"] == after["negotiation_round"]


def _execute_request(s, bundle, approval):
    from orderfit.contracts.workflow import ExecuteRequest

    return ExecuteRequest(**s["versions"](), approval_id=approval["id"], bundle_hash=bundle["bundle_hash"])


def test_commit_projects_baseline_once_gate_and_second_deal_stale(case, postgres):
    s = case
    deal_id = s["deal"]["id"]
    bundle, approval = committable(s)
    manifest = bundle["manifest"]
    commitment = next(i for i in manifest["items"] if i["kind"] == "commitment")
    # Independent expectation for the manual fixture: no deposit, no costs, no loan, so the
    # only incremental event is the full order value 30 days after the 2026-11-29 delivery.
    assert [(p["kind"], p["event_date"], p["amount_minor"], p["direction"], p["certainty"])
            for p in commitment["projections"]] == [
        ("order_final_receipt", str(date(2026, 11, 29) + timedelta(days=30)), "35000000", "in", "expected")]
    assert commitment["projections"][0]["attributed_item_key"] == "commitment:plan"
    revision_before = revision(s)
    accepted = execute(s, bundle, approval)
    # The gate is durable from admission: another commit in the business is refused.
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM commitment_gate")[0]["n"] == 1
    drain(postgres)
    op = s["read"](f"/operations/{accepted['operation_id']}")
    assert op["status"] == "succeeded", op
    executed = run(s, op["result"]["resource_id"])
    assert executed["status"] == "succeeded" and not executed["reconciliation_required"]
    assert {a["kind"]: a["status"] for a in executed["actions"]} == {
        "commitment": "posted", "message": "sent"}
    assert executed["settlement"]["projected_events"] == 1
    assert executed["settlement"]["revision_after"] == executed["settlement"]["revision_before"] + 1
    deal = s["read"](f"/deals/{deal_id}")
    assert deal["status"] == "committed"
    # Exactly one bump for the whole projection, not one per row.
    assert revision(s) == revision_before + 1
    projected = db_rows(postgres, s, """SELECT ce.kind,ce.amount_minor,ce.event_date,ce.certainty,ce.direction,
        cp.action_id,x.item_key FROM commitment_projection cp JOIN cash_event ce ON ce.id=cp.cash_event_id
        JOIN execution_action x ON x.id=cp.action_id WHERE cp.deal_id=:d""", d=UUID(deal_id))
    assert [(r["kind"], r["amount_minor"], r["certainty"], r["item_key"]) for r in projected] == [
        ("order_final_receipt", 35000000, "expected", "commitment:plan")]
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM commitment_gate")[0]["n"] == 0
    # Projected events are immutable outside compensation, even for the runtime role.
    with pytest.raises(DBAPIError) as exc:
        with postgres["database"].tenant(s["account"].token, s["account"].business_id, "manage_finance") as (c, _):
            c.execute(text("UPDATE cash_event SET voided_at=clock_timestamp() WHERE id IN "
                           "(SELECT cash_event_id FROM commitment_projection WHERE deal_id=:d)"), dict(d=UUID(deal_id)))
    assert exc.value.orig.sqlstate == "OF010"
    # The committed evaluation is now stale for every later bundle on the old baseline.
    r = post(s, f"/deals/{deal_id}/bundles", prepare_body(s, "commit_plan", []))
    assert r.status_code == 409


def test_second_deal_cannot_commit_from_old_baseline(postgres, accounts, config):
    from fastapi.testclient import TestClient

    from orderfit.api.main import create_app
    from tests.db.test_p6_approval import ORIGIN

    a = accounts[0]
    with TestClient(create_app(config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", a.token)
        client.cookies.set("orderfit_csrf", a.csrf)
        headers = {"Origin": ORIGIN, "X-CSRF-Token": a.csrf}
        base = f"/api/v1/businesses/{a.business_id}"
        first, _, _ = manual_evaluation(client, headers, a.business_id, ["buyer.test"], "Buyer one " + uuid4().hex[:6])
        drain(postgres)
        second, _, job = manual_evaluation(client, headers, a.business_id, ["buyer.test"], "Buyer two " + uuid4().hex[:6])
        drain(postgres)

        def state(deal):
            def read(path):
                r = client.get(base + path)
                assert r.status_code == 200, r.text
                return r.json()

            def write(path, data, status=200, method="POST", key=None):
                r = client.request(method, base + path, json=data,
                                   headers=headers | {"Idempotency-Key": key or str(uuid4())})
                assert r.status_code == status, r.text
                return r.json()

            def versions():
                row = read(f"/deals/{deal['id']}")
                return dict(expected_version=row["version"], expected_input_version=row["input_version"],
                            expected_financial_revision=row["financial_revision"])

            def finish(job):
                drain(postgres)
                done = read(f"/operations/{job['operation_id']}")
                assert done["status"] == "succeeded" and done["result"]["kind"] == "completed", done
                return client.get(done["result_url"]).json()

            return dict(client=client, account=a, base=base, read=read, write=write, versions=versions,
                        finish=finish, deal=read(f"/deals/{deal['id']}"), headers=dict(headers))

        one, two = state(first), state(second)
        # The second deal's baseline write made the first evaluation stale: refresh it.
        one["write"](f"/deals/{first['id']}/reopen-for-review", dict(**one["versions"](), reason="Refresh baseline."))
        review = one["read"](f"/deals/{first['id']}/review")
        confirmation = one["write"](f"/deals/{first['id']}/confirm", dict(
            **one["versions"](), snapshot_hash=review["snapshot_hash"], confirmed_field_ids=review["required_field_ids"],
            acknowledged_warning_codes=[f["code"] for f in review["findings"] if not f["blocking"]]))
        one["evaluation"] = one["finish"](one["write"](f"/deals/{first['id']}/evaluations", dict(
            **one["versions"](), snapshot_id=confirmation["snapshot_id"]), 202))
        two["evaluation"] = two["read"](client.get(base + f"/operations/{job['operation_id']}").json()["result_url"]
                                        .removeprefix(base))
        bundles = {}
        for name, s in (("one", one), ("two", two)):
            bundles[name] = committable(s, confirmation=False)
        first_job = execute(one, *bundles["one"])
        r = post(two, f"/bundles/{bundles['two'][0]['manifest']['id']}/execute", dict(
            **two["versions"](), approval_id=bundles["two"][1]["id"], bundle_hash=bundles["two"][0]["bundle_hash"]))
        assert r.status_code == 409 and code(r) == "COMMIT_GATE_HELD"
        drain(postgres)
        assert one["read"](f"/operations/{first_job['operation_id']}")["status"] == "succeeded"
        assert one["read"](f"/deals/{first['id']}")["status"] == "committed"
        # Gate released, but the old baseline is stale: approval/admission refuse it.
        r = post(two, f"/bundles/{bundles['two'][0]['manifest']['id']}/execute", dict(
            **two["versions"](), approval_id=bundles["two"][1]["id"], bundle_hash=bundles["two"][0]["bundle_hash"]))
        assert r.status_code == 409 and code(r) == "STALE_FINANCIAL_REVISION"
        # A refreshed review of deal two now includes deal one's projected receipt once,
        # attributed to its completed action, and not deal one's own unprojected rows.
        two["write"](f"/deals/{second['id']}/reopen-for-review", dict(**two["versions"](), reason="New baseline."))
        snapshot = two["read"](f"/deals/{second['id']}/review")["candidate_snapshot"]
        generated = [e for e in snapshot["baseline_events"] if e["kind"] == "order_final_receipt"]
        assert len(generated) == 1 and generated[0]["projection_action_id"]
        assert (generated[0]["amount_minor"], generated[0]["certainty"]) == ("35000000", "expected")


def effects_per_action(postgres, s, run_id):
    return [r["n"] for r in db_rows(
        postgres, s, "SELECT count(e.action_id) AS n FROM execution_action x LEFT JOIN sandbox_effect e "
        "ON e.action_id=x.id WHERE x.run_id=:r GROUP BY x.id,x.item_key ORDER BY x.item_key", r=UUID(run_id))]


@pytest.mark.parametrize(
    "kind,point",
    [
        ("commit_plan", "before_item_commit"),
        ("commit_plan", "after_item_commit"),
        ("commit_plan", "before_finalize_commit"),
        ("commit_plan", "after_finalize_commit"),
        ("send_message", "after_item_commit"),
        ("send_message", "before_finalize_commit"),
    ],
)
def test_crash_at_each_boundary_recovers_same_run_without_duplicate_effect(case, postgres, monkeypatch, kind, point):
    s = case
    deal_id = s["deal"]["id"]
    if kind == "commit_plan":
        bundle, approval = committable(s)  # commitment + outbox confirmation
    else:
        bundle, approval = approved(s, "send_message", [reviewed(s)["identity"]["message_id"]])
    before = s["read"](f"/deals/{deal_id}")
    crashed = []

    def crash(at):
        if at == point and not crashed:
            crashed.append(at)
            raise SimulatedCrash(at)

    monkeypatch.setattr(execution_module, "fault", crash)
    job = execute(s, bundle, approval)
    with pytest.raises(SimulatedCrash):
        work(postgres)
    if point != "after_finalize_commit":
        assert s["read"](f"/operations/{job['operation_id']}")["status"] == "running"
        if kind == "commit_plan":  # an interrupted job never releases the commitment gate
            assert db_rows(postgres, s, "SELECT count(*) AS n FROM commitment_gate")[0]["n"] == 1
        expire_leases(postgres)  # the killed worker's lease lapses; recovery resumes the same run
    drain(postgres)
    op = s["read"](f"/operations/{job['operation_id']}")
    assert op["status"] == "succeeded" and op["result"]["kind"] == "completed", op
    executed = run(s, op["result"]["resource_id"])
    assert executed["status"] == "succeeded"
    assert effects_per_action(postgres, s, executed["id"]) == [1] * len(bundle["manifest"]["items"])
    assert all(a["status"] in COMPLETED for a in executed["actions"])
    after = s["read"](f"/deals/{deal_id}")
    if kind == "commit_plan":
        assert after["status"] == "committed"
        assert after["financial_revision"] == before["financial_revision"] + 1
        assert db_rows(postgres, s, "SELECT count(*) AS n FROM commitment_projection WHERE deal_id=:d",
                       d=UUID(deal_id))[0]["n"] == 1
    else:
        assert after["negotiation_round"] == before["negotiation_round"] + 1
        assert after["financial_revision"] == before["financial_revision"]
    # The lost-response replay reaches the same finished run and adds nothing.
    assert execute(s, bundle, approval)["operation_id"] == job["operation_id"]
    drain(postgres)
    assert effects_per_action(postgres, s, executed["id"]) == [1] * len(bundle["manifest"]["items"])
    assert s["read"](f"/deals/{deal_id}")["negotiation_round"] == after["negotiation_round"]


def test_stale_fencing_token_cannot_publish_effects(case, postgres):
    s = case
    bundle, approval = approved(s, "send_message", [reviewed(s)["identity"]["message_id"]])
    job = execute(s, bundle, approval)
    operations = Operations(postgres["worker"])
    stale = operations.claim("slow-worker")
    assert stale["id"] == UUID(job["operation_id"])
    expire_leases(postgres)
    drain(postgres)  # a second worker recovers and completes the same run
    with pytest.raises(Exception) as exc:
        execution_module.run_execution(operations, stale, None)
    assert getattr(exc.value, "code", "") == "LEASE_OR_AUTHORIZATION_LOST"
    run_id = s["read"](f"/bundles/{bundle['manifest']['id']}")["run_id"]
    assert effects_per_action(postgres, s, run_id) == [1]


def test_hold_mid_run_partial_blocks_gate_and_resumes_same_run(case, postgres, monkeypatch):
    s = case
    deal_id = s["deal"]["id"]
    bundle, approval = committable(s)
    held = []

    def hold(at):
        if at == "after_item_commit" and not held:
            held.append(s["write"](f"/deals/{deal_id}/hold", dict(**s["versions"](), reason="Owner paused dispatch.")))

    monkeypatch.setattr(execution_module, "fault", hold)
    job = execute(s, bundle, approval)
    drain(postgres)
    op = s["read"](f"/operations/{job['operation_id']}")
    # A hold is a stop, not a financial verdict and not a technical failure.
    assert op["status"] == "succeeded" and op["result"]["kind"] == "blocked", op
    assert op["result"]["findings"][0]["code"] == "UNRESOLVED_BLOCKERS"
    run_id = s["read"](f"/bundles/{bundle['manifest']['id']}")["run_id"]
    partial = run(s, run_id)
    assert partial["status"] == "partial" and partial["reconciliation_required"]
    statuses = sorted((a["kind"], a["status"]) for a in partial["actions"])
    assert statuses == [("commitment", "posted"), ("message", "drafted")]
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM commitment_gate WHERE run_id=:r",
                   r=UUID(run_id))[0]["n"] == 1
    assert s["read"](f"/deals/{deal_id}")["status"] != "committed"
    r = post(s, f"/bundles/{bundle['manifest']['id']}/execute", dict(
        **s["versions"](), approval_id=approval["id"], bundle_hash=bundle["bundle_hash"]))
    assert r.status_code == 409 and code(r) == "UNRESOLVED_BLOCKERS"
    # The gate cannot be released by the runtime role while effects are unreconciled.
    with pytest.raises(DBAPIError) as exc:
        with postgres["database"].tenant(s["account"].token, s["account"].business_id, "execute") as (c, _):
            c.execute(text("DELETE FROM commitment_gate WHERE run_id=:r"), dict(r=UUID(run_id)))
    assert exc.value.orig.sqlstate == "OF007"
    flag = db_rows(postgres, s, "SELECT id FROM deal_flag WHERE deal_id=:d AND resolved_at IS NULL AND blocking",
                   d=UUID(deal_id))[0]["id"]
    s["write"](f"/deals/{deal_id}/flags/{flag}/resolve", dict(
        **s["versions"](), reason="Owner resumed dispatch.",
        evidence=dict(document_id=None, content_hash=None, candidate_id=None, confirmed_field_id=None,
                      source_role="other", page=None, quote=None, override_reason=None,
                      manual_attestation="Owner confirmed the pause is over.")))
    monkeypatch.setattr(execution_module, "fault", lambda at: None)
    resumed = execute(s, bundle, approval)
    assert resumed["operation_id"] != job["operation_id"]
    drain(postgres)
    done = run(s, run_id)
    assert done["id"] == run_id and done["status"] == "succeeded" and done["operation_id"] == resumed["operation_id"]
    assert effects_per_action(postgres, s, run_id) == [1, 1]
    assert s["read"](f"/deals/{deal_id}")["status"] == "committed"


def forged_admission(postgres, s, bundle, approval):
    """Direct runtime-role admission that bypasses the service: SQL must refuse it."""
    with postgres["database"].tenant(s["account"].token, s["account"].business_id, "execute") as (c, scope):
        run_id, op_id = uuid4(), uuid4()
        c.execute(text(
            "INSERT INTO operation(id,business_id,deal_id,actor_user_id,session_id,kind,request_hash,input_version,"
            "financial_revision,config_version,parameters) SELECT :op,business_id,id,:u,:s,'execute',sha256('x'),"
            "input_version,(SELECT financial_revision FROM business b WHERE b.id=deal.business_id),'operation.v1',"
            "jsonb_build_object('run_id',CAST(:r AS text)) FROM deal WHERE id=:d"),
            dict(op=op_id, u=scope.user_id, s=scope.session_id, r=str(run_id), d=UUID(s["deal"]["id"])))
        c.execute(text(
            "INSERT INTO execution_run(id,business_id,deal_id,bundle_id,approval_id,run_kind,status,operation_id,"
            "idempotency_key,fencing_token) VALUES(:r,:b,:d,:bundle,:a,:k,'queued',:op,:key,gen_random_uuid())"),
            dict(r=run_id, b=scope.business_id, d=UUID(s["deal"]["id"]), bundle=UUID(bundle["manifest"]["id"]),
                 a=UUID(approval["id"]), k=bundle["manifest"]["kind"], op=op_id, key=str(uuid4())))


def test_revoked_and_edited_authority_refused(case, postgres, config):
    s = case
    owner = s["account"]
    # Revoked approval: refused at admission.
    first, approval = approved(s, "send_message", [reviewed(s)["identity"]["message_id"]])
    s["write"](f"/approvals/{approval['id']}/revoke", dict(**s["versions"](), reason="Counterparty paused."))
    r = post(s, f"/bundles/{first['manifest']['id']}/execute", dict(
        **s["versions"](), approval_id=approval["id"], bundle_hash=first["bundle_hash"]))
    assert r.status_code == 409 and code(r) == "APPROVAL_REVOKED"
    # Message edited after approval: the API and SQL (forged admission) both refuse.
    message = reviewed(s)
    identity = message["identity"]
    edited, edited_approval = approved(s, "send_message", [identity["message_id"]])
    s["write"](f"/messages/{identity['message_id']}", dict(
        **s["versions"](), evaluation_id=identity["evaluation_id"], option_key=identity["option"]["option_key"],
        party_id=identity["party_id"], party_role="customer", recipient="other@buyer.test", channel="email",
        expected_preparation_hash=message["preparation_hash"], subject=identity["subject"],
        body=identity["body"]), method="PATCH")
    r = post(s, f"/bundles/{edited['manifest']['id']}/execute", dict(
        **s["versions"](), approval_id=edited_approval["id"], bundle_hash=edited["bundle_hash"]))
    assert r.status_code == 409 and code(r) == "SUPERSEDED_MESSAGE"
    with pytest.raises(DBAPIError) as exc:
        forged_admission(postgres, s, edited, edited_approval)
    assert exc.value.orig.sqlstate == "OF007"
    # Approval revoked after admission but before the worker: no effect, run failed.
    queued, queued_approval = approved(s, "send_message", [reviewed(s)["identity"]["message_id"]])
    job = execute(s, queued, queued_approval)
    s["write"](f"/approvals/{queued_approval['id']}/revoke", dict(**s["versions"](), reason="Stop now."))
    drain(postgres)
    op = s["read"](f"/operations/{job['operation_id']}")
    assert op["result"]["kind"] == "blocked" and op["result"]["findings"][0]["code"] == "REVOKED"
    stopped = run(s, s["read"](f"/bundles/{queued['manifest']['id']}")["run_id"])
    assert stopped["status"] == "failed" and effects_per_action(postgres, s, stopped["id"]) == [0]
    assert s["read"](f"/deals/{s['deal']['id']}")["negotiation_round"] == 0
    # Approver's membership revoked after approval: refused at admission.
    risk, _ = member(postgres, config, s, "risk_officer")
    mid = reviewed(s)["identity"]["message_id"]
    as_user(s, risk)
    by_risk, risk_approval = approved(s, "send_message", [mid])
    as_user(s, owner)
    with postgres["database"].tenant(owner.token, owner.business_id, "manage_members") as (c, _):
        c.execute(text("UPDATE membership SET revoked_at=clock_timestamp() WHERE user_id=:u AND business_id=:b"),
                  dict(u=risk.user_id, b=owner.business_id))
    r = post(s, f"/bundles/{by_risk['manifest']['id']}/execute", dict(
        **s["versions"](), approval_id=risk_approval["id"], bundle_hash=by_risk["bundle_hash"]))
    assert r.status_code == 409 and code(r) == "APPROVER_NOT_CURRENT"


def test_executor_revoked_mid_run_leaves_visible_partial_and_gate(case, postgres, config, monkeypatch):
    s = case
    owner = s["account"]
    risk, _ = member(postgres, config, s, "risk_officer")
    bundle, approval = committable(s)
    as_user(s, risk)  # a different current T3 executes the owner's approval
    job = execute(s, bundle, approval)
    as_user(s, owner)
    revoked = []

    def revoke(at):
        if at == "after_item_commit" and not revoked:
            revoked.append(at)
            with postgres["database"].tenant(owner.token, owner.business_id, "manage_members") as (c, _):
                c.execute(text("UPDATE membership SET revoked_at=clock_timestamp() WHERE user_id=:u AND business_id=:b"),
                          dict(u=risk.user_id, b=owner.business_id))

    monkeypatch.setattr(execution_module, "fault", revoke)
    drain(postgres)
    op = s["read"](f"/operations/{job['operation_id']}")
    assert op["status"] == "failed" and op["result"]["error"]["code"] == "AUTHORIZATION_REVOKED"
    partial = run(s, s["read"](f"/bundles/{bundle['manifest']['id']}")["run_id"])
    assert partial["status"] == "partial" and partial["reconciliation_required"]
    assert sorted(effects_per_action(postgres, s, partial["id"])) == [0, 1]
    assert s["read"](f"/deals/{s['deal']['id']}")["status"] != "committed"
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM commitment_gate")[0]["n"] == 1


def test_expired_commit_approval_refused(case, postgres):
    s = case
    ask = reviewed(s)
    accept(s, ask, seconds=4)  # the commit bundle (and its approval) expire with the acceptance
    bundle, approval = approved(s, "commit_plan", [])
    time.sleep(5)
    r = post(s, f"/bundles/{bundle['manifest']['id']}/execute", dict(
        **s["versions"](), approval_id=approval["id"], bundle_hash=bundle["bundle_hash"]))
    assert r.status_code == 409 and code(r) == "APPROVAL_EXPIRED"
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM execution_run")[0]["n"] == 0


def test_max_round_policy_enforced_before_admission(case, postgres):
    s = case
    bundles = [approved(s, "send_message", [reviewed(s)["identity"]["message_id"]]) for _ in range(4)]
    for bundle, approval in bundles[:3]:
        execute(s, bundle, approval)
        drain(postgres)
    deal = s["read"](f"/deals/{s['deal']['id']}")
    assert deal["negotiation_round"] == 3 and deal["status"] == "awaiting_reply"
    bundle, approval = bundles[3]
    r = post(s, f"/bundles/{bundle['manifest']['id']}/execute", dict(
        **s["versions"](), approval_id=approval["id"], bundle_hash=bundle["bundle_hash"]))
    assert r.status_code == 409 and code(r) == "NEGOTIATION_ROUND_LIMIT"


def test_compensation_records_inverse_effects_and_reconciles_projection(case, postgres, accounts):
    s = case
    deal_id = s["deal"]["id"]
    bundle, approval = committable(s, confirmation=False)
    execute(s, bundle, approval)
    drain(postgres)
    committed = run(s, s["read"](f"/bundles/{bundle['manifest']['id']}")["run_id"])
    action = committed["actions"][0]
    assert action["kind"] == "commitment" and action["status"] == "posted"
    before = revision(s)
    comp = s["write"](f"/deals/{deal_id}/compensation-bundles", dict(
        **s["versions"](), original_run_id=committed["id"], original_action_ids=[action["id"]],
        reason="Customer cancelled the committed order."), 201)
    manifest = comp["manifest"]
    assert manifest["kind"] == "compensate" and [i["kind"] for i in manifest["items"]] == ["cancellation"]
    assert manifest["items"][0]["original_payload_hash"] == action["effect"]["payload_hash"]
    step_up(s, comp, purpose="commit_plan", status=409)  # commit step-up cannot approve compensation
    comp_approval = decide(s, comp, step_up(s, comp)["grant_id"])
    assert comp_approval["action"] == "compensate" and not comp_approval["is_stale"]
    job = execute(s, comp, comp_approval)
    drain(postgres)
    op = s["read"](f"/operations/{job['operation_id']}")
    assert op["status"] == "succeeded", op
    reversed_run = run(s, op["result"]["resource_id"])
    assert reversed_run["run_kind"] == "compensate" and reversed_run["status"] == "succeeded"
    inverse = reversed_run["actions"][0]
    assert inverse["effect"]["effect_kind"] == "inverse"
    assert inverse["effect"]["original_action_id"] == action["id"]
    assert reversed_run["settlement"]["projected_events"] == 1
    assert revision(s) == before + 1  # one bump for the reconciled projection set
    rows = db_rows(postgres, s, """SELECT ce.voided_at IS NOT NULL AS voided,z.original_action_id,z.compensation_action_id
        FROM commitment_projection p JOIN cash_event ce ON ce.id=p.cash_event_id
        JOIN commitment_reconciliation z ON z.cash_event_id=ce.id WHERE p.deal_id=:d""", d=UUID(deal_id))
    assert [(r["voided"], str(r["original_action_id"]), str(r["compensation_action_id"])) for r in rows] == [
        (True, action["id"], inverse["id"])]
    # History is preserved: original action/effect unchanged, deal still committed.
    original = run(s, committed["id"])
    assert original["actions"][0] == action and original["status"] == "succeeded"
    assert s["read"](f"/deals/{deal_id}")["status"] == "committed"
    r = post(s, f"/deals/{deal_id}/compensation-bundles", dict(
        **s["versions"](), original_run_id=committed["id"], original_action_ids=[action["id"]],
        reason="Second reversal attempt."))
    assert r.status_code == 409 and code(r) == "ACTION_ALREADY_REVERSED"
    other = accounts[1]
    as_user(s, other)
    for path in (f"/api/v1/businesses/{other.business_id}/execution-runs/{committed['id']}",
                 f"/api/v1/businesses/{other.business_id}/deals/{deal_id}/actions",
                 s["base"] + f"/execution-runs/{committed['id']}"):
        assert s["client"].get(path).status_code == 404


def party_ask(s, option_key, party_id, role, recipient):
    message = s["finish"](s["write"](f"/deals/{s['deal']['id']}/drafts", dict(
        **s["versions"](), evaluation_id=s["evaluation"]["id"], option_key=option_key, party_id=party_id,
        party_role=role, recipient=recipient, channel="email"), 202))
    return s["write"](f"/messages/{message['identity']['message_id']}/review", dict(
        **s["versions"](), preparation_hash=message["preparation_hash"],
        attestation="I reviewed the exact content and recipient."))


def test_commit_with_supplier_surcharge_and_loan_projects_engine_events(case, postgres):
    from tests.contracts.examples import evidence, loan

    s = case
    deal_id = s["deal"]["id"]
    parties = {}
    for kind in ("supplier", "lender"):
        parties[kind] = s["write"]("/payees", dict(
            expected_financial_revision=revision(s),
            payee=dict(name="P6B " + kind + uuid4().hex[:6], kind=kind, category="other", terms_days=30,
                       terms_note=None, delay_tolerance_note=None, risk_rating=None,
                       known_domains=[kind + ".test"])), 200)
    # Record one verified supplier account through the P7 routes (keyed fingerprint plus
    # human-recorded evidence), as a finance manager would.
    supplier_accounts = f"/payees/{parties['supplier']['id']}/accounts"
    account = s["write"](supplier_accounts, dict(
        expected_financial_revision=revision(s), bank_name="Synthetic bank",
        account_number="SYN" + uuid4().hex[:8].upper() + "4321"), 201)
    s["write"](f"{supplier_accounts}/{account['id']}/verify", dict(
        expected_version=account["version"], expected_financial_revision=revision(s),
        evidence=evidence()))
    terms = loan()
    terms.pop("offer_id")
    terms.pop("version")
    terms.update(payee_id=parties["lender"]["id"], payee_version=parties["lender"]["version"],
                 min_minor="1000000", max_minor="2000000", step_minor="1000000", interest_bps=500,
                 fee_bps=100, fee_flat_minor="0", fee_at="draw", lead_days=0, term_days=90,
                 available_from="2026-10-15", valid_until="2027-02-01")
    offer = s["write"]("/financing-offers", dict(expected_financial_revision=revision(s), terms=terms), 200)
    original = s["read"]("/constraints")["items"][0]
    owner = {k: v for k, v in original["owner"].items() if k not in {"constraints_id", "version"}}
    policy = s["write"]("/constraints", dict(
        expected_financial_revision=revision(s), reserve_minor=original["reserve_minor"], owner=owner,
        strategy_space=dict(deposit_pcts=[0], deposit_lead_days=0,
                            extensions=[dict(days=0, surcharge_bps=0), dict(days=30, surcharge_bps=100)],
                            offer_ids=[offer["id"]], stages=1),
        scenarios=original["scenarios"], make_default=False), 200)
    current = s["read"](f"/deals/{deal_id}")
    cost = dict(event_id=None, cost_key="supplier-cost", event_date="2026-11-02", amount_minor="1000000",
                kind="supplier_payment", is_deferrable=True, incremental=True, nonincremental_reason=None,
                invoice_ref=None, payee_id=parties["supplier"]["id"],
                original_obligation_id="p6b-supplier-obligation", evidence=[evidence()])
    s["write"](f"/deals/{deal_id}", dict(**s["versions"](), inputs=current["inputs"] | {
        "constraints_id": policy["id"], "costs": [cost]}), method="PATCH")
    review = s["read"](f"/deals/{deal_id}/review")
    confirmation = s["write"](f"/deals/{deal_id}/confirm", dict(
        **s["versions"](), snapshot_hash=review["snapshot_hash"], confirmed_field_ids=review["required_field_ids"],
        acknowledged_warning_codes=[f["code"] for f in review["findings"] if not f["blocking"]]))
    s["evaluation"] = s["finish"](s["write"](f"/deals/{deal_id}/evaluations", dict(
        **s["versions"](), snapshot_id=confirmation["snapshot_id"]), 202))
    options = [o for o in s["evaluation"]["option_catalogue"]
               if o["hard_feasible"] and o["parameters"]["extension"] == dict(days=30, surcharge_bps=100)
               and o["parameters"]["offer_id"] == offer["id"] and o["parameters"]["draw_minor"] == "1000000"]
    assert len(options) == 1, [(o["option_key"], o["hard_feasible"], o["parameters"]["eligible_cost_keys"])
                               for o in s["evaluation"]["option_catalogue"]]
    option = options[0]
    cost_row = db_rows(postgres, s, "SELECT id FROM cash_event WHERE deal_id=:d AND voided_at IS NULL",
                       d=UUID(deal_id))[0]["id"]
    customer = s["deal"]["inputs"]["customer_id"]
    asks = [party_ask(s, option["option_key"], customer, "customer", "purchasing@buyer.test"),
            party_ask(s, option["option_key"], parties["supplier"]["id"], "supplier", "ap@supplier.test"),
            party_ask(s, option["option_key"], parties["lender"]["id"], "lender", "desk@lender.test")]
    for ask in asks:
        accept(s, ask)
    r = post(s, f"/deals/{deal_id}/bundles", dict(
        **s["versions"](), evaluation_id=s["evaluation"]["id"], option_key=option["option_key"],
        kind="commit_plan", message_ids=[], strategy=option["parameters"]))
    assert r.status_code == 201, r.text
    bundle = r.json()
    items = {i["kind"]: i for i in bundle["manifest"]["items"]}
    assert sorted(items) == ["commitment", "ledger_entry", "lender_acceptance"]
    # Independent expectations from the confirmed terms (not echoed from the implementation):
    # 1,000,000 + 100 bps surcharge, paid 30 days after 2026-11-02; 1,000,000 drawn on the
    # 2026-10-15 as-of date (lead 0); 100 bps fee at draw; 500 bps flat interest and
    # principal 90 days later; the full order value 30 days after the 2026-11-29 delivery.
    assert (items["ledger_entry"]["amount_minor"], items["ledger_entry"]["scheduled_date"]) == ("1010000", "2026-12-02")
    assert (items["lender_acceptance"]["amount_minor"], items["lender_acceptance"]["scheduled_date"]) == (
        "1000000", "2026-10-15")
    ledger_key, lender_key = items["ledger_entry"]["key"], items["lender_acceptance"]["key"]
    projections = sorted((p["kind"], p["event_date"], p["amount_minor"], p["direction"], p["attributed_item_key"])
                         for p in items["commitment"]["projections"])
    assert projections == sorted([
        ("order_final_receipt", "2026-12-29", "35000000", "in", "commitment:plan"),
        ("supplier_payment", "2026-12-02", "1010000", "out", ledger_key),
        ("loan_draw", "2026-10-15", "1000000", "in", lender_key),
        ("loan_fee", "2026-10-15", "10000", "out", lender_key),
        ("loan_interest", "2027-01-13", "50000", "out", lender_key),
        ("loan_repayment", "2027-01-13", "1000000", "out", lender_key),
    ])
    supplier = next(p for p in items["commitment"]["projections"] if p["kind"] == "supplier_payment")
    assert (supplier["original_obligation_id"], supplier["supersedes_event_id"]) == (
        "p6b-supplier-obligation", str(cost_row))
    approval = decide(s, bundle, step_up(s, bundle)["grant_id"])
    before = revision(s)
    execute(s, bundle, approval)
    drain(postgres)
    committed = run(s, s["read"](f"/bundles/{bundle['manifest']['id']}")["run_id"])
    assert committed["status"] == "succeeded", committed
    effects = {a["kind"]: a["effect"]["effect_kind"] for a in committed["actions"]}
    assert effects == {"commitment": "ledger", "ledger_entry": "ledger", "lender_acceptance": "lender_simulation"}
    assert committed["settlement"]["projected_events"] == 6 and revision(s) == before + 1
    rows = db_rows(postgres, s, """SELECT ce.kind,ce.amount_minor,ce.supersedes_id,ce.certainty,x.item_key
        FROM commitment_projection p JOIN cash_event ce ON ce.id=p.cash_event_id JOIN execution_action x ON x.id=p.action_id
        WHERE p.deal_id=:d ORDER BY ce.kind""", d=UUID(deal_id))
    assert {(r["kind"], r["amount_minor"], r["item_key"]) for r in rows} == {
        ("order_final_receipt", 35000000, "commitment:plan"), ("supplier_payment", 1010000, ledger_key),
        ("loan_draw", 1000000, lender_key), ("loan_fee", 10000, lender_key),
        ("loan_interest", 50000, lender_key), ("loan_repayment", 1000000, lender_key)}
    receipt = next(r for r in rows if r["kind"] == "order_final_receipt")
    assert receipt["certainty"] == "expected"  # an agreement to pay is not cash evidence
    assert next(r for r in rows if r["kind"] == "supplier_payment")["supersedes_id"] == cost_row
    # Reversing only the supplier ledger action reconciles only its projected payment.
    ledger_action = next(a for a in committed["actions"] if a["kind"] == "ledger_entry")
    comp = s["write"](f"/deals/{deal_id}/compensation-bundles", dict(
        **s["versions"](), original_run_id=committed["id"], original_action_ids=[ledger_action["id"]],
        reason="Supplier payment instruction withdrawn."), 201)
    execute(s, comp, decide(s, comp, step_up(s, comp)["grant_id"]))
    drain(postgres)
    live = db_rows(postgres, s, """SELECT ce.kind FROM commitment_projection p JOIN cash_event ce ON ce.id=p.cash_event_id
        WHERE p.deal_id=:d AND ce.voided_at IS NULL ORDER BY ce.kind""", d=UUID(deal_id))
    assert [r["kind"] for r in live] == ["loan_draw", "loan_fee", "loan_interest", "loan_repayment", "order_final_receipt"]
    assert revision(s) == before + 2

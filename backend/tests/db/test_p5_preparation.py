"""Real sessions, restricted runtime roles, durable jobs and P5 immutable evidence."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, text

from orderfit.api.main import create_app
from orderfit.store import preparation_repository as repo
from orderfit.workflow.operations import Operations
from orderfit.workflow.worker import DEFAULT_HANDLERS, run_once
from tests.db.p3_helpers import manual_evaluation


@pytest.fixture
def case(postgres, accounts, config):
    a = accounts[0]
    with TestClient(create_app(config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", a.token)
        client.cookies.set("orderfit_csrf", a.csrf)
        headers = {"Origin": "http://localhost:3000", "X-CSRF-Token": a.csrf}
        deal, confirmation, job = manual_evaluation(client, headers, a.business_id, ["buyer.test"])
        operations = Operations(postgres["worker"])
        assert run_once(operations, "p5-test", DEFAULT_HANDLERS)
        base = f"/api/v1/businesses/{a.business_id}"

        def read(path):
            r = client.get(base + path)
            assert r.status_code == 200, r.text
            return r.json()

        def write(path, data, status=200, method="POST", key=None):
            r = client.request(
                method,
                base + path,
                json=data,
                headers=headers | {"Idempotency-Key": key or str(uuid4())},
            )
            assert r.status_code == status, r.text
            return r.json()

        def versions():
            row = read(f"/deals/{deal['id']}")
            return dict(
                expected_version=row["version"],
                expected_input_version=row["input_version"],
                expected_financial_revision=row["financial_revision"],
            )

        def finish(job):
            assert run_once(operations, "p5-test", DEFAULT_HANDLERS)
            completed = read(f"/operations/{job['operation_id']}")
            assert completed["status"] == "succeeded", completed
            assert completed["result"]["kind"] == "completed", completed
            r = client.get(completed["result_url"])
            assert r.status_code == 200, r.text
            return r.json()

        evaluation = read(
            read(f"/operations/{job['operation_id']}")["result_url"].removeprefix(base)
        )
        yield dict(
            client=client,
            account=a,
            base=base,
            read=read,
            write=write,
            versions=versions,
            finish=finish,
            deal=deal,
            confirmation=confirmation,
            evaluation=evaluation,
            operations=operations,
            headers=headers,
        )


def draft(case):
    ev, deal = case["evaluation"], case["deal"]
    data = dict(
        **case["versions"](),
        evaluation_id=ev["id"],
        option_key=ev["recommended_option_key"],
        party_id=deal["inputs"]["customer_id"],
        party_role="customer",
        recipient="purchasing@buyer.test",
        channel="email",
    )
    return case["finish"](case["write"](f"/deals/{deal['id']}/drafts", data, 202))


def test_message_history_query_count_does_not_grow_per_revision(case, postgres, accounts):
    """History must not reload complete evaluations/snapshots for every message."""
    from statistics import median
    from time import perf_counter

    messages = [draft(case) for _ in range(8)]
    engine = postgres["database"].engine

    def measure(limit):
        counts, durations = [], []
        for _ in range(3):
            statements = []

            def counted(*args, statements=statements):
                statements.append(1)

            event.listen(engine, "before_cursor_execute", counted)
            try:
                started = perf_counter()
                page = case["read"](f"/deals/{case['deal']['id']}/messages?limit={limit}")
                durations.append((perf_counter() - started) * 1000)
                counts.append(len(statements))
            finally:
                event.remove(engine, "before_cursor_execute", counted)
        return page, median(counts), median(durations)

    _, one_count, one_ms = measure(1)
    page, eight_count, eight_ms = measure(8)
    print(
        f"message history: 1 row={one_count} queries/{one_ms:.1f}ms; "
        f"8 rows={eight_count} queries/{eight_ms:.1f}ms (median of 3)"
    )
    assert {m["identity"]["message_id"] for m in page["items"]} == {
        m["identity"]["message_id"] for m in messages
    }
    for item in page["items"]:
        assert item == case["read"](f"/messages/{item['identity']['message_id']}")
    assert eight_count <= one_count + 2
    first = case["read"](f"/deals/{case['deal']['id']}/messages?limit=3")
    second = case["read"](f"/deals/{case['deal']['id']}/messages?limit=3&offset=3")
    assert first["next_cursor"] == "3" and second["next_cursor"] == "6"
    assert not (
        {m["identity"]["message_id"] for m in first["items"]}
        & {m["identity"]["message_id"] for m in second["items"]}
    )
    assert case["read"](f"/deals/{case['deal']['id']}/messages?offset=80")["items"] == []
    other = accounts[1]
    case["client"].cookies.set("orderfit_session", other.token)
    try:
        assert (
            case["client"]
            .get(f"/api/v1/businesses/{other.business_id}/deals/{case['deal']['id']}/messages")
            .status_code
            == 404
        )
    finally:
        case["client"].cookies.set("orderfit_session", case["account"].token)


def test_fork_isolation_catalogue_apply_stale_and_idempotency(case, postgres, accounts):
    s = case
    before = s["read"](f"/deals/{s['deal']['id']}")
    with postgres["database"].tenant(s["account"].token, s["account"].business_id) as (c, _):
        approvals_before = c.execute(text("SELECT count(*) FROM approval")).scalar_one()
        snapshots_before = c.execute(text("SELECT count(*) FROM input_snapshot")).scalar_one()
    payload = dict(
        **s["versions"](),
        source_snapshot_id=s["confirmation"]["snapshot_id"],
        changes=[dict(kind="deposit_pct", value=30)],
    )
    key = str(uuid4())
    accepted = s["write"](f"/deals/{before['id']}/whatifs", payload, 202, key=key)
    assert accepted == s["write"](f"/deals/{before['id']}/whatifs", payload, 202, key=key)
    fork = s["finish"](accepted)
    assert not fork["canonical_changed"] and fork["series"]
    assert {o["parameters"]["deposit_pct"] for o in fork["outcome"]["option_catalogue"]} <= {0, 30}
    assert s["read"](f"/deals/{before['id']}") == before
    assert s["read"](f"/evaluations/{s['evaluation']['id']}") == s["evaluation"]
    with postgres["database"].tenant(s["account"].token, s["account"].business_id) as (c, _):
        assert c.execute(text("SELECT count(*) FROM approval")).scalar_one() == approvals_before
        assert (
            c.execute(text("SELECT count(*) FROM input_snapshot")).scalar_one() == snapshots_before
        )
    other = accounts[1]
    s["client"].cookies.set("orderfit_session", other.token)
    assert (
        s["client"].get(f"/api/v1/businesses/{other.business_id}/whatifs/{fork['id']}").status_code
        == 404
    )
    s["client"].cookies.set("orderfit_session", s["account"].token)
    # Reload from a fresh API/engine, not an in-memory object.
    assert s["read"](f"/deals/{before['id']}/preparation")["forks"][0]["id"] == fork["id"]
    applied = s["write"](f"/whatifs/{fork['id']}/apply", s["versions"]())
    assert (
        applied["status"] == "awaiting_confirm"
        and applied["input_version"] > before["input_version"]
    )
    assert s["read"](f"/evaluations/{s['evaluation']['id']}")["is_stale"]
    s["write"](f"/whatifs/{fork['id']}/apply", s["versions"](), 409)
    review = s["read"](f"/deals/{before['id']}/review")
    assert review["candidate_snapshot"]["strategy_space"]["deposit_pcts"] == [30]
    assert review["required_field_ids"] == []
    reset = s["write"](f"/deals/{before['id']}/preparation-settings/reset", s["versions"]())
    assert reset["candidate_snapshot"]["strategy_space"]["deposit_pcts"] == [0]
    assert reset["input_version"] > applied["input_version"]


def test_exact_draft_revisions_review_acceptance_and_guards(case):
    s = case
    message = draft(s)
    mid = message["identity"]["message_id"]
    assert not message["reviewed"] and not message["dispatch_eligible"]
    review = dict(
        **s["versions"](),
        preparation_hash=message["preparation_hash"],
        attestation="I reviewed the exact content and recipient.",
    )
    reviewed = s["write"](f"/messages/{mid}/review", review)
    assert reviewed["reviewed"]
    assert s["read"](f"/deals/{s['deal']['id']}/messages")["items"] == [reviewed]
    acceptance = s["write"](
        f"/deals/{s['deal']['id']}/acceptances",
        dict(
            **s["versions"](),
            message_id=mid,
            preparation_hash=message["preparation_hash"],
            reply_id=None,
            attestation="Buyer agreed in a recorded human conversation.",
            valid_until=(datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        ),
        201,
    )
    assert acceptance["attested_not_independently_verified"]
    identity = message["identity"]
    edit = dict(
        **s["versions"](),
        evaluation_id=identity["evaluation_id"],
        option_key=identity["option"]["option_key"],
        party_id=identity["party_id"],
        party_role="customer",
        recipient=identity["recipient"],
        channel="email",
        expected_preparation_hash=message["preparation_hash"],
        subject=identity["subject"],
        body=identity["body"],
    )
    for body in [
        identity["body"] + "\nWe guarantee thirty days of free credit.",
        identity["body"].replace("35000000", "35000001"),
        identity["body"].replace("Final payment:", "Guaranteed payment:"),
    ]:
        s["write"](f"/messages/{mid}", edit | {"body": body}, 422, "PATCH")
    revised = s["write"](
        f"/messages/{mid}",
        edit
        | {
            "recipient": "other@buyer.test",
            "body": identity["body"] + "\nThank you for considering these proposed terms.",
        },
        method="PATCH",
    )
    assert revised["preparation_hash"] != message["preparation_hash"] and not revised["reviewed"]
    assert s["read"](f"/messages/{mid}")["is_stale"]
    history = s["read"](f"/deals/{s['deal']['id']}/messages")["items"]
    assert len(history) == 2
    for item in history:
        assert item == s["read"](f"/messages/{item['identity']['message_id']}")
    assert s["read"](f"/deals/{s['deal']['id']}/acceptances")["items"][0]["is_stale"]
    s["write"](
        f"/messages/{mid}/review",
        dict(
            **s["versions"](),
            preparation_hash=message["preparation_hash"],
            attestation="Old content cannot retain authority.",
        ),
        409,
    )
    # P6-B mounts execution; an untyped request never reaches a sandbox effect.
    assert s["client"].post(s["base"] + "/bundles/" + str(uuid4()) + "/execute").status_code == 422


def test_reply_review_reassessment_and_durable_bank_blocker(case, postgres):
    s = case
    message = draft(s)
    mid = message["identity"]["message_id"]
    before = s["read"](f"/deals/{s['deal']['id']}")
    reply = s["finish"](
        s["write"](
            f"/deals/{before['id']}/replies",
            dict(
                **s["versions"](),
                ask_message_id=mid,
                party_id=message["identity"]["party_id"],
                body="We can offer a deposit of 30% and payment within 15 days.",
            ),
            202,
        )
    )
    assert len(reply["candidates"]) == 2
    assert s["read"](f"/deals/{before['id']}") == before
    review = s["write"](
        f"/deals/{before['id']}/replies/{reply['id']}/review",
        dict(
            **s["versions"](),
            candidate_ids=[x["id"] for x in reply["candidates"]],
            decision="apply",
            reason="Confirmed the quoted reply terms with the buyer.",
        ),
    )
    assert review["candidate_snapshot"]["order"]["payment_days"] == 15
    assert review["candidate_snapshot"]["strategy_space"]["deposit_pcts"] == [30]
    confirm = s["write"](
        f"/deals/{before['id']}/confirm",
        dict(
            **s["versions"](),
            snapshot_hash=review["snapshot_hash"],
            confirmed_field_ids=review["required_field_ids"],
            acknowledged_warning_codes=[x["code"] for x in review["findings"] if not x["blocking"]],
        ),
    )
    evaluated = s["finish"](
        s["write"](
            f"/deals/{before['id']}/evaluations",
            dict(**s["versions"](), snapshot_id=confirm["snapshot_id"]),
            202,
        )
    )
    assert evaluated["calculator_version"] == s["evaluation"]["calculator_version"]
    assert evaluated["snapshot_hash"] != s["evaluation"]["snapshot_hash"]
    # Even an old ask can receive a suspicious reply; the hold is durable at intake.
    queued = s["write"](
        f"/deals/{before['id']}/replies",
        dict(
            **s["versions"](),
            ask_message_id=mid,
            party_id=message["identity"]["party_id"],
            body="Use our changed bank account for the next payment.",
        ),
        202,
    )
    flagged = s["read"](f"/deals/{before['id']}")
    assert any(f["code"] == "P5-BANK-CHANGE" and f["blocking"] for f in flagged["findings"])
    bank_reply = s["finish"](queued)
    assert bank_reply["bank_change"]
    assert "P5-BANK-CHANGE" in s["read"](f"/messages/{mid}")["blockers"]
    with postgres["database"].tenant(s["account"].token, s["account"].business_id) as (c, _):
        flag_id = c.execute(
            text("SELECT id FROM deal_flag WHERE deal_id=:d AND code='P5-BANK-CHANGE'"),
            dict(d=UUID(before["id"])),
        ).scalar_one()
    evidence = review["candidate_snapshot"]["balance_evidence"][0]
    s["write"](
        f"/deals/{before['id']}/flags/{flag_id}/resolve",
        dict(**s["versions"](), evidence=evidence, reason="Try a generic override"),
        409,
    )


def test_concurrent_revision_and_recovery(case, postgres):
    s = case
    message = draft(s)
    identity = message["identity"]
    from orderfit.contracts.preparation import DraftRevisionRequest

    command = DraftRevisionRequest(
        **s["versions"](),
        evaluation_id=identity["evaluation_id"],
        option_key=identity["option"]["option_key"],
        party_id=identity["party_id"],
        party_role="customer",
        recipient=identity["recipient"],
        expected_preparation_hash=message["preparation_hash"],
        subject="Revised order terms for review",
        body=identity["body"],
    )

    def revise(_):
        from orderfit.api.errors import ApplicationError

        try:
            with postgres["database"].tenant(
                s["account"].token, s["account"].business_id, "prepare"
            ) as (c, scope):
                repo.save_draft(
                    c, scope, UUID(s["deal"]["id"]), command, UUID(identity["message_id"])
                )
            return "saved"
        except ApplicationError as exc:
            return exc.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(revise, range(2))) == ["STALE_PREPARATION", "saved"]
    # New app instance + same real cookie sees exact immutable revisions.
    from orderfit.store.db import Database

    db = Database(postgres["url"])
    fresh_app = create_app(s["client"].app.state.identity.config, db)
    with TestClient(fresh_app) as fresh:
        fresh.cookies.set("orderfit_session", s["account"].token)
        r = fresh.get(s["base"] + f"/deals/{s['deal']['id']}/preparation")
        assert r.status_code == 200, r.text
        assert len(r.json()["messages"]) == 2


def test_language_off_fallback_and_recording_failure(case):
    s = case
    payload = dict(
        **s["versions"](),
        source_snapshot_id=s["confirmation"]["snapshot_id"],
        instruction="deposit 30%",
    )
    fork = s["finish"](s["write"](f"/deals/{s['deal']['id']}/whatifs", payload, 202))
    assert fork["language_code"] == "AI_OFF" and fork["provenance"] == "template"
    assert fork["changes"] == [dict(kind="deposit_pct", value=30)]
    explanation = s["read"](
        f"/evaluations/{s['evaluation']['id']}/explanation?option_key={s['evaluation']['recommended_option_key']}"
    )
    assert "35000000" in explanation["sentences"][0]
    assert "finite delay scan" in " ".join(explanation["sentences"])


def test_stale_publication_cannot_publish_fork(case, monkeypatch):
    s = case
    from orderfit.workflow import worker

    real_compute = worker.bounded_compute

    def edit_during_compute(snapshot):
        result = real_compute(snapshot)
        current = s["read"](f"/deals/{s['deal']['id']}")
        s["write"](
            f"/deals/{current['id']}",
            dict(**s["versions"](), inputs=current["inputs"] | {"payment_days": 29}),
            method="PATCH",
        )
        return result

    monkeypatch.setattr(worker, "bounded_compute", edit_during_compute)
    job = s["write"](
        f"/deals/{s['deal']['id']}/whatifs",
        dict(
            **s["versions"](),
            source_snapshot_id=s["confirmation"]["snapshot_id"],
            changes=[dict(kind="deposit_pct", value=30)],
        ),
        202,
    )
    assert run_once(s["operations"], "p5-race", DEFAULT_HANDLERS)
    outcome = s["read"](f"/operations/{job['operation_id']}")
    assert outcome["result"]["kind"] == "blocked" and outcome["result"]["outcome"] == "stale"
    assert not s["read"](f"/deals/{s['deal']['id']}/preparation")["forks"]


def test_real_process_restart_recovers_same_fork_and_message(case, postgres, config):
    import subprocess
    import sys
    from concurrent.futures import ThreadPoolExecutor

    from tests.db.test_foundation import expire_lease
    from tests.db.test_p3_process_recovery import authenticate, running_api, runtime_environment

    s = case
    message = draft(s)
    api_env = runtime_environment(postgres, config)
    worker_env = runtime_environment(postgres, config, worker=True)
    key = str(uuid4())
    payload = dict(
        **s["versions"](),
        source_snapshot_id=s["confirmation"]["snapshot_id"],
        changes=[dict(kind="deposit_pct", value=30)],
    )
    with running_api(api_env) as (client, port):
        headers = authenticate(client, s["account"]) | {"Idempotency-Key": key}
        response = client.post(
            s["base"] + f"/deals/{s['deal']['id']}/whatifs", json=payload, headers=headers
        )
        assert response.status_code == 202, response.text
        accepted = response.json()
    child = subprocess.Popen(
        [
            sys.executable,
            "-c",
            """
import os,time
from orderfit.store.db import Database
from orderfit.workflow.operations import Operations
db=Database(os.environ['DATABASE_URL'])
claim=Operations(db).claim('p5-crash-recovery')
print(claim['id'],flush=True)
time.sleep(60)
""",
        ],
        env=worker_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            assert (
                pool.submit(child.stdout.readline).result(timeout=10).strip()
                == accepted["operation_id"]
            )
    finally:
        child.terminate()
        child.wait(timeout=5)
        child.stdout.close()
    expire_lease(postgres, UUID(accepted["operation_id"]))
    restarted = subprocess.run(
        [sys.executable, "-m", "orderfit.workflow.worker", "--once"],
        env=worker_env,
        capture_output=True,
        timeout=120,
    )
    assert restarted.returncode == 0
    with running_api(api_env, port) as (client, _):
        headers = authenticate(client, s["account"]) | {"Idempotency-Key": key}
        replay = client.post(
            s["base"] + f"/deals/{s['deal']['id']}/whatifs", json=payload, headers=headers
        )
        assert replay.status_code == 202 and replay.json() == accepted
        op = client.get(s["base"] + f"/operations/{accepted['operation_id']}").json()
        assert op["attempt"] == 2 and op["result"]["kind"] == "completed", op
        saved = client.get(s["base"] + f"/deals/{s['deal']['id']}/preparation").json()
        assert len(saved["forks"]) == 1 and len(saved["messages"]) == 1
        assert saved["messages"][0]["preparation_hash"] == message["preparation_hash"]
        assert "series" not in saved["forks"][0]
        assert client.get(op["result_url"]).json()["series"]


def test_preparation_cross_tenant_roles_and_sql_immutability(case, postgres, accounts):
    from sqlalchemy.exc import DBAPIError

    s = case
    message = draft(s)
    mid = message["identity"]["message_id"]
    reply = s["finish"](
        s["write"](
            f"/deals/{s['deal']['id']}/replies",
            dict(
                **s["versions"](),
                ask_message_id=mid,
                party_id=message["identity"]["party_id"],
                body="We accept the exact proposed terms.",
            ),
            202,
        )
    )
    other = accounts[1]
    s["client"].cookies.set("orderfit_session", other.token)
    for path in [
        f"/messages/{mid}",
        f"/replies/{reply['id']}",
        f"/deals/{s['deal']['id']}/preparation",
        f"/deals/{s['deal']['id']}/acceptances",
    ]:
        assert s["client"].get(f"/api/v1/businesses/{other.business_id}" + path).status_code == 404
    s["client"].cookies.set("orderfit_session", s["account"].token)
    for sql, expected in [
        ("UPDATE prepared_message SET payload='{}' WHERE id=:id", "42501"),
        ("UPDATE negotiation_message SET body='changed' WHERE id=:id", "OF010"),
    ]:
        with pytest.raises(DBAPIError) as exc:
            with postgres["database"].tenant(
                s["account"].token, s["account"].business_id, "prepare"
            ) as (c, _):
                c.execute(text(sql), dict(id=UUID(mid)))
        assert exc.value.orig.sqlstate == expected
    with postgres["database"].engine.begin() as c:
        for table in [
            "prepared_message",
            "preparation_review",
            "reply_candidate_set",
            "reply_review",
            "party_acceptance",
        ]:
            assert c.execute(text(f"SELECT count(*) FROM {table}")).scalar_one() == 0


def test_reply_cannot_attest_a_counteroffer_as_exact_acceptance(case):
    s = case
    message = draft(s)
    mid = message["identity"]["message_id"]
    s["write"](
        f"/messages/{mid}/review",
        dict(
            **s["versions"](),
            preparation_hash=message["preparation_hash"],
            attestation="I reviewed exact recipients and terms.",
        ),
    )
    reply = s["finish"](
        s["write"](
            f"/deals/{s['deal']['id']}/replies",
            dict(
                **s["versions"](),
                ask_message_id=mid,
                party_id=message["identity"]["party_id"],
                body="We accept the exact proposed terms, but payment within 15 days.",
            ),
            202,
        )
    )
    s["write"](
        f"/deals/{s['deal']['id']}/acceptances",
        dict(
            **s["versions"](),
            message_id=mid,
            preparation_hash=message["preparation_hash"],
            reply_id=reply["id"],
            attestation="Treat this counteroffer as an exact acceptance.",
            valid_until=(datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        ),
        409,
    )


@pytest.mark.parametrize("role", ["supplier", "lender"])
def test_supplier_lender_reply_reuses_confirmed_pipeline(case, role):
    from tests.contracts.examples import evidence, loan

    s = case
    parties = {}
    for kind in ("supplier", "lender"):
        parties[kind] = s["write"](
            "/payees",
            dict(
                expected_financial_revision=s["versions"]()["expected_financial_revision"],
                payee=dict(
                    name="P5 " + kind,
                    kind=kind,
                    category="other",
                    terms_days=30,
                    terms_note=None,
                    delay_tolerance_note=None,
                    risk_rating=None,
                    known_domains=[kind + ".test"],
                ),
            ),
            200,
        )
    terms = loan()
    terms.pop("offer_id")
    terms.pop("version")
    terms.update(
        payee_id=parties["lender"]["id"],
        payee_version=parties["lender"]["version"],
        min_minor="1000000",
        max_minor="2000000",
        step_minor="1000000",
        interest_bps=0,
        fee_bps=0,
        fee_flat_minor="0",
        available_from="2026-10-15",
        lead_days=0,
    )
    offer = s["write"](
        "/financing-offers",
        dict(
            expected_financial_revision=s["versions"]()["expected_financial_revision"], terms=terms
        ),
        200,
    )
    original = s["read"]("/constraints")["items"][0]
    owner = {
        key: value
        for key, value in original["owner"].items()
        if key not in {"constraints_id", "version"}
    }
    policy = s["write"](
        "/constraints",
        dict(
            expected_financial_revision=s["versions"]()["expected_financial_revision"],
            reserve_minor=original["reserve_minor"],
            owner=owner,
            strategy_space=dict(
                deposit_pcts=[0],
                deposit_lead_days=0,
                extensions=[dict(days=0, surcharge_bps=0), dict(days=30, surcharge_bps=0)],
                offer_ids=[offer["id"]],
                stages=1,
            ),
            scenarios=original["scenarios"],
            make_default=False,
        ),
        200,
    )
    current = s["read"](f"/deals/{s['deal']['id']}")
    inputs = current["inputs"] | {
        "constraints_id": policy["id"],
        "costs": [
            dict(
                event_id=None,
                cost_key="supplier-cost",
                event_date="2026-11-02",
                amount_minor="1000000",
                kind="supplier_payment",
                is_deferrable=True,
                incremental=True,
                nonincremental_reason=None,
                invoice_ref=None,
                payee_id=parties["supplier"]["id"],
                original_obligation_id="p5-supplier-obligation",
                evidence=[evidence()],
            )
        ],
    }
    s["write"](f"/deals/{current['id']}", dict(**s["versions"](), inputs=inputs), method="PATCH")
    review = s["read"](f"/deals/{current['id']}/review")
    confirmation = s["write"](
        f"/deals/{current['id']}/confirm",
        dict(
            **s["versions"](),
            snapshot_hash=review["snapshot_hash"],
            confirmed_field_ids=review["required_field_ids"],
            acknowledged_warning_codes=[f["code"] for f in review["findings"] if not f["blocking"]],
        ),
    )
    evaluated = s["finish"](
        s["write"](
            f"/deals/{current['id']}/evaluations",
            dict(**s["versions"](), snapshot_id=confirmation["snapshot_id"]),
            202,
        )
    )
    if role == "supplier":
        option = next(
            o
            for o in evaluated["option_catalogue"]
            if o["hard_feasible"]
            and o["parameters"]["extension"]["days"] == 30
            and o["parameters"]["offer_id"] is None
        )
    else:
        option = next(
            o
            for o in evaluated["option_catalogue"]
            if o["hard_feasible"]
            and o["parameters"]["offer_id"] == offer["id"]
            and o["parameters"]["extension"]["days"] == 0
        )
    message = s["finish"](
        s["write"](
            f"/deals/{current['id']}/drafts",
            dict(
                **s["versions"](),
                evaluation_id=evaluated["id"],
                option_key=option["option_key"],
                party_id=parties[role]["id"],
                party_role=role,
                recipient="contact@" + role + ".test",
            ),
            202,
        )
    )
    before = s["read"](f"/deals/{current['id']}")
    reply = s["finish"](
        s["write"](
            f"/deals/{current['id']}/replies",
            dict(
                **s["versions"](),
                ask_message_id=message["identity"]["message_id"],
                party_id=parties[role]["id"],
                body="We offer supplier extension of 30 days."
                if role == "supplier"
                else "We offer financing draw of 2000000 minor units.",
            ),
            202,
        )
    )
    assert s["read"](f"/deals/{current['id']}") == before
    assert len(reply["candidates"]) == 1
    reviewed = s["write"](
        f"/deals/{current['id']}/replies/{reply['id']}/review",
        dict(
            **s["versions"](),
            candidate_ids=[reply["candidates"][0]["id"]],
            decision="apply",
            reason="Human reviewed exact quoted counterparty proposal.",
        ),
    )
    space = reviewed["candidate_snapshot"]["strategy_space"]
    if role == "supplier":
        assert space["extensions"] == [dict(days=30, surcharge_bps=0)]
    else:
        assert space["financing_selection"]["amount_minor"] == "2000000"
        assert reviewed["candidate_snapshot"]["offers"][0]["min_minor"] == "1000000"
        assert reviewed["candidate_snapshot"]["offers"][0]["max_minor"] == "2000000"


def test_fork_apply_rechecks_current_membership(case, postgres, accounts):
    s = case
    fork = s["finish"](
        s["write"](
            f"/deals/{s['deal']['id']}/whatifs",
            dict(
                **s["versions"](),
                source_snapshot_id=s["confirmation"]["snapshot_id"],
                changes=[dict(kind="deposit_pct", value=30)],
            ),
            202,
        )
    )
    other = accounts[1]
    with postgres["database"].tenant(s["account"].token, s["account"].business_id) as (c, _):
        c.execute(
            text("INSERT INTO membership(user_id,business_id,role) VALUES(:u,:b,'viewer')"),
            dict(u=other.user_id, b=s["account"].business_id),
        )
    s["client"].cookies.set("orderfit_session", other.token)
    s["client"].cookies.set("orderfit_csrf", other.csrf)
    response = s["client"].post(
        s["base"] + f"/whatifs/{fork['id']}/apply",
        json=s["versions"](),
        headers={
            "Origin": "http://localhost:3000",
            "X-CSRF-Token": other.csrf,
            "Idempotency-Key": str(uuid4()),
        },
    )
    assert response.status_code == 403, response.text

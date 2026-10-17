"""Financial boundary regressions on isolated PG17 with restricted application logins."""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from orderfit.api.main import create_app
from orderfit.contracts.resources import ConstraintWrite, CustomerInput, CustomerWrite
from orderfit.store.repositories import ConstraintsRepository, CustomerRepository, DealRepository
from orderfit.workflow.operations import Operations
from orderfit.workflow.worker import DEFAULT_HANDLERS, run_once
from tests.db.test_p3_review_regressions import save, setup_deal
from tests.db.test_p6_approval import ORIGIN, decide, step_up


@pytest.fixture
def financial_case(postgres, accounts, config):
    account = accounts[0]
    deal, inputs = setup_deal(postgres, account)
    with postgres["database"].tenant(account.token, account.business_id, "manage_finance") as (c, scope):
        customer = CustomerRepository.list_customers(c, account.business_id).items[0]
        CustomerRepository.update_customer(c, scope, customer.id, CustomerWrite(
            expected_version=customer.version, expected_financial_revision=customer.financial_revision,
            customer=CustomerInput(name=customer.customer.name, known_domains=["buyer.test"], red_flags=[]),
        ))
        policy = ConstraintsRepository.list_constraints(c, account.business_id).items[0]
        policy = ConstraintsRepository.create_version(c, scope, ConstraintWrite(
            expected_financial_revision=policy.financial_revision,
            reserve_minor="0", owner=policy.owner,
            strategy_space=policy.strategy_space.model_copy(update={
                "deposit_pcts": [0, 100], "deposit_lead_days": 0,
            }),
            scenarios=policy.scenarios, make_default=True,
        ))
        deal = save(c, scope, deal, inputs.model_copy(update={"constraints_id": policy.id}))
    with TestClient(create_app(config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", account.token)
        client.cookies.set("orderfit_csrf", account.csrf)
        headers = {"Origin": ORIGIN, "X-CSRF-Token": account.csrf}
        base = f"/api/v1/businesses/{account.business_id}"

        def read(path):
            response = client.get(base + path)
            assert response.status_code == 200, response.text
            return response.json()

        def write(path, data, status=200, method="POST", key=None):
            response = client.request(method, base + path, json=data,
                headers=headers | {"Idempotency-Key": key or str(uuid4())})
            assert response.status_code == status, response.text
            return response.json()

        def versions():
            current = read(f"/deals/{deal.id}")
            return dict(expected_version=current["version"], expected_input_version=current["input_version"],
                expected_financial_revision=current["financial_revision"])

        def finish(job):
            assert run_once(Operations(postgres["worker"]), "financial-boundary", DEFAULT_HANDLERS)
            operation = read(f"/operations/{job['operation_id']}")
            assert operation["status"] == "succeeded" and operation["result"]["kind"] == "completed", operation
            return read(operation["result_url"].removeprefix(base))

        yield dict(account=account, deal=read(f"/deals/{deal.id}"), client=client,
            headers=headers, base=base, read=read, write=write, versions=versions, finish=finish)


def _evaluate(s):
    deal_id = s["deal"]["id"]
    review = s["read"](f"/deals/{deal_id}/review")
    assert review["candidate_snapshot"] is not None, review["findings"]
    confirmed = s["write"](f"/deals/{deal_id}/confirm", dict(
        **s["versions"](), snapshot_hash=review["snapshot_hash"],
        confirmed_field_ids=review["required_field_ids"],
        acknowledged_warning_codes=[f["code"] for f in review["findings"] if not f["blocking"]],
    ))
    return s["finish"](s["write"](f"/deals/{deal_id}/evaluations", dict(
        **s["versions"](), snapshot_id=confirmed["snapshot_id"]), 202))


def _rows(postgres, s, sql, **params):
    with postgres["database"].tenant(s["account"].token, s["account"].business_id) as (c, _):
        return c.execute(text(sql), params).mappings().all()


def test_full_deposit_publishes_and_settles_once_without_zero_projection(financial_case, postgres):
    s = financial_case
    deal_id = s["deal"]["id"]
    evaluation = _evaluate(s)
    option = next(o for o in evaluation["option_catalogue"] if o["option_key"] == "dep100")
    # Independent expected values: opening500,000 + immediate300,000 deposit;
    # no incremental costs or financing. The final residual is exactly zero.
    assert option["base_incremental_profit_minor"] == "300000"
    assert option["hard_feasible"]
    assert next(row for row in option["scenarios"] if row["scenario"] == "base")["lowest_balance_minor"] == "500000"
    projection = _rows(postgres, s,
        "SELECT events FROM evaluation_projection WHERE evaluation_id=:e AND option_key='dep100'",
        e=UUID(evaluation["id"]))[0]["events"]
    assert [(e["kind"], e["event_date"], e["amount_minor"]) for e in projection] == [
        ("order_deposit", "2026-11-02", "300000")]
    series = s["read"](f"/evaluations/{evaluation['id']}/series?scenario=base&option_key=dep100")
    assert series["points"][-1]["candidate_close_minor"] == "800000"

    # Selecting this computed option is human intent; it need not be the top-ranked option.
    draft = s["finish"](s["write"](f"/deals/{deal_id}/drafts", dict(
        **s["versions"](), evaluation_id=evaluation["id"], option_key="dep100",
        party_id=s["deal"]["inputs"]["customer_id"], party_role="customer",
        recipient="purchasing@buyer.test", channel="email"), 202))
    message_id = draft["identity"]["message_id"]
    assert not draft["blockers"], draft["blockers"]
    s["write"](f"/messages/{message_id}/review", dict(**s["versions"](),
        preparation_hash=draft["preparation_hash"], attestation="Reviewed the exact synthetic terms."))
    s["write"](f"/deals/{deal_id}/acceptances", dict(**s["versions"](), message_id=message_id,
        preparation_hash=draft["preparation_hash"], reply_id=None,
        attestation="Human recorded agreement to the exact synthetic terms.",
        valid_until=(datetime.now(UTC) + timedelta(hours=1)).isoformat()), 201)
    bundle = s["write"](f"/deals/{deal_id}/bundles", dict(**s["versions"](),
        evaluation_id=evaluation["id"], option_key="dep100", kind="commit_plan",
        message_ids=[], strategy=option["parameters"]), 201)
    approval = decide(s, bundle, step_up(s, bundle)["grant_id"])
    revision_before = s["versions"]()["expected_financial_revision"]
    command = dict(**s["versions"](), approval_id=approval["id"], bundle_hash=bundle["bundle_hash"])
    path = f"/bundles/{bundle['manifest']['id']}/execute"
    key = str(uuid4())
    admitted = s["write"](path, command, 202, key=key)
    assert s["write"](path, command, 202, key=key) == admitted
    executed = s["finish"](admitted)
    assert executed["status"] == "succeeded"
    assert executed["settlement"]["projected_events"] == 1
    assert s["versions"]()["expected_financial_revision"] == revision_before + 1
    # Lost-response replay after settlement keeps the same operation and effect.
    assert s["write"](path, command, 202, key=key) == admitted
    rows = _rows(postgres, s,
        "SELECT ce.kind,ce.amount_minor,ce.certainty FROM commitment_projection cp "
        "JOIN cash_event ce ON ce.id=cp.cash_event_id WHERE cp.deal_id=:d", d=UUID(deal_id))
    assert [(r["kind"], r["amount_minor"], r["certainty"]) for r in rows] == [
        ("order_deposit", 300000, "expected")]
    assert _rows(postgres, s, "SELECT count(*) AS n FROM sandbox_effect e "
        "JOIN execution_action a ON a.id=e.action_id WHERE a.run_id=:r", r=UUID(executed["id"]))[0]["n"] == 1
    assert _rows(postgres, s, "SELECT count(*) AS n FROM commitment_gate")[0]["n"] == 0


def test_service_aggregate_limit_remains_reviewable_and_publishes_nothing(financial_case, postgres):
    s = financial_case
    profile = s["read"]("/profile")
    baseline = s["read"]("/baseline")["balance"]
    baseline["opening_cash_minor"] = "9000000000000000"
    s["write"]("/baseline", dict(expected_version=profile["version"],
        expected_financial_revision=profile["financial_revision"], balance=baseline), method="PATCH")
    inputs = s["read"](f"/deals/{s['deal']['id']}")["inputs"]
    inputs.update(opening_cash_minor="9000000000000000", order_value_minor="9000000000000000")
    s["write"](f"/deals/{s['deal']['id']}", dict(**s["versions"](), inputs=inputs), method="PATCH")
    review = s["read"](f"/deals/{s['deal']['id']}/review")
    assert review["candidate_snapshot"] is None and review["snapshot_hash"] is None
    assert {f["code"] for f in review["findings"]} == {"INPUT-REVIEW-REQUIRED"}
    assert all(f["blocking"] for f in review["findings"])
    with postgres["database"].tenant(s["account"].token, s["account"].business_id) as (c, _):
        assert DealRepository.get_deal(c, s["account"].business_id, UUID(s["deal"]["id"])).status == s["deal"]["status"]
    for table in ("input_snapshot", "evaluation", "operation"):
        assert _rows(postgres, s, f"SELECT count(*) AS n FROM {table} WHERE deal_id=:d",
            d=UUID(s["deal"]["id"]))[0]["n"] == 0

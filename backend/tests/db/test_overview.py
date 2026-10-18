"""Real PG17/runtime-role, HTTP authorization and persisted projection regressions."""

from sqlalchemy import event, text

from orderfit.api.main import create_app
from orderfit.store.overview_repository import OverviewRepository
from orderfit.workflow.operations import Operations
from orderfit.workflow.worker import DEFAULT_HANDLERS, run_once
from tests.db import test_p6_approval
from tests.db.p3_helpers import manual_evaluation
from tests.db.test_p3_vertical_slice import auth_client
from tests.db.test_p4_documents import Session, make_deal
from tests.db.test_p6_execution import committable, drain, execute

case = test_p6_approval.case


def test_fresh_business_validation_and_cross_tenant(postgres, accounts, config):
    a, other = accounts
    with auth_client(create_app(config, postgres["database"]), a) as (client, _):
        base = f"/api/v1/businesses/{a.business_id}/overview"
        result = client.get(base)
        assert result.status_code == 200, result.text
        body = result.json()
        assert body["kpis"]["total_orders_tested"] == 0
        assert body["kpis"]["total_balance_minor"] == "0"
        assert body["recent_settlements"] == [] and body["currency_balances"] == []
        assert client.get(f"/api/v1/businesses/{other.business_id}/overview").status_code == 404
        assert client.get(base + "?timeframe=7d").status_code == 422
        assert client.get(base + "?currency=JPY").status_code == 422
        assert client.get(base + "?currency=USD").status_code == 422
        client.cookies.clear()
        assert client.get(base).status_code == 401


def test_baseline_pending_cashflow_single_query_and_no_mutation(postgres, accounts, config):
    a = accounts[0]
    with auth_client(create_app(config, postgres["database"]), a) as (client, _):
        s = Session(client, a, f"/api/v1/businesses/{a.business_id}")
        make_deal(s)
        profile = s.read("/profile")
        policy = s.read("/constraints?default_only=true")["items"][0]
        evidence = dict(
            document_id=None,
            content_hash=None,
            candidate_id=None,
            confirmed_field_id=None,
            source_role="baseline",
            page=None,
            quote=None,
            manual_attestation="Synthetic ledger",
            override_reason=None,
        )
        s.write(
            "POST",
            "/cash-events",
            dict(
                expected_financial_revision=profile["financial_revision"],
                event=dict(
                    deal_id=None,
                    event_date="2026-10-20",
                    amount_minor="500",
                    direction="out",
                    kind="rent",
                    certainty="confirmed",
                    description="Rent",
                    invoice_ref=None,
                    is_deferrable=False,
                    incremental=False,
                    customer_id=None,
                    payee_id=None,
                    evidence=evidence,
                ),
            ),
        )
        before = s.read("/profile")
        result = s.read("/overview")
        assert result == s.read("/overview")
        assert result["kpis"]["pending_reviews_count"] == 1
        assert result["kpis"]["protected_headroom_minor"] == str(
            50000000 - 500 - int(policy["reserve_minor"])
        )
        assert result["cashflow"]["total_outflow_minor"] == "500"
        assert s.read("/profile") == before
        statements = []

        def capture(conn, cursor, statement, parameters, context, executemany):
            statements.append(statement)

        with postgres["database"].tenant(a.token, a.business_id, "read") as (c, _):
            event.listen(c, "before_cursor_execute", capture)
            try:
                OverviewRepository.get_overview(c, a.business_id)
            finally:
                event.remove(c, "before_cursor_execute", capture)
        assert len(statements) == 1
        assert statements[0].startswith("WITH b AS")


def test_real_evaluation_is_counted_once_and_uses_snapshot_amount(postgres, accounts, config):
    a = accounts[0]
    with auth_client(create_app(config, postgres["database"]), a) as (client, headers):
        deal, _, accepted = manual_evaluation(client, headers, a.business_id)
        ops = Operations(postgres["worker"])
        assert run_once(ops, "overview-test", DEFAULT_HANDLERS)
        response = client.get(f"/api/v1/businesses/{a.business_id}/overview")
        assert response.status_code == 200, response.text
        result = response.json()
        assert result["kpis"]["total_orders_tested"] == 1
        assert result["kpis"]["volume_30d_minor"] == "35000000"
        assert result["verdict_distribution"]["feasible_as_is_count"] == 1
        assert result["recent_settlements"][0]["deal_id"] == deal["id"]
        assert result["recent_settlements"][0]["amount_minor"] == "35000000"
        # No uncommitted hypothetical order receipts belong in the business baseline.
        assert result["cashflow"]["total_inflow_minor"] == "0"
        with postgres["database"].tenant(a.token, a.business_id) as (c, _):
            assert (
                c.execute(
                    text("SELECT status FROM operation WHERE business_id=:b AND id=:id"),
                    {"b": a.business_id, "id": accepted["operation_id"]},
                ).scalar_one()
                == "succeeded"
            )


def test_committed_projection_included_once_and_isolated(case, postgres, accounts):
    s = case
    bundle, approval = committable(s)
    execute(s, bundle, approval)
    drain(postgres)
    result = s["read"]("/overview?timeframe=1y")
    assert result["cashflow"]["total_inflow_minor"] == "35000000"
    assert result["kpis"]["pending_reviews_count"] == 0
    other = accounts[1]
    with postgres["database"].tenant(other.token, other.business_id) as (c, _):
        view = OverviewRepository.get_overview(c, other.business_id, "1y")
        assert view.cashflow.total_inflow_minor == "0" and view.recent_settlements == []
        # Even a direct repository call cannot escape the verified tenant RLS context.
        import pytest

        from orderfit.api.errors import ApplicationError

        with pytest.raises(ApplicationError) as caught:
            OverviewRepository.get_overview(c, s["account"].business_id)
        assert caught.value.status == 404

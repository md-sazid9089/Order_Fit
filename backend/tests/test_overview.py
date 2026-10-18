"""Independent financial expectations and complete overview wire contracts."""

from datetime import UTC, date, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from orderfit.api.errors import ApplicationError
from orderfit.contracts.primitives import MAX_MONEY
from orderfit.contracts.resources import BusinessOverviewView
from orderfit.services.overview import build_overview


def facts(**changes):
    row = dict(
        id=uuid4(),
        currency="BDT",
        today=date(2026, 10, 18),
        reserve=100,
        baseline_settings=dict(
            opening_date="2026-10-18", opening_cash_minor="1000", coverage_through="2028-01-01"
        ),
        tested=0,
        pending=0,
        volume=0,
        previous_volume=0,
        distribution={},
        recent=[],
        events=[],
    )
    return row | changes


def event(day, amount, direction="out", delayed=False):
    return dict(event_date=day, amount=amount, direction=direction, delayed=delayed)


def test_complete_wire_contract_and_strict_money():
    view = build_overview(facts(), "30d", None)
    payload = view.model_dump(mode="json")
    assert BusinessOverviewView.model_validate_json(view.model_dump_json()) == view
    assert payload["as_of"] == "2026-10-18"
    assert payload["kpis"]["total_balance_minor"] == "1000"
    assert len(payload["delay_sensitivity"]) == 5
    payload["kpis"]["total_balance_minor"] = 1000
    with pytest.raises(ValidationError):
        BusinessOverviewView.model_validate(payload)


@pytest.mark.parametrize("currency", ["BDT", "USD", "EUR", "GBP"])
def test_only_recorded_currency_allocation(currency):
    view = build_overview(facts(currency=currency), "30d", currency)
    assert [(b.code, b.amount_minor) for b in view.currency_balances] == [(currency, "1000")]
    assert sum(b.pct_allocation for b in view.currency_balances) == 100
    with pytest.raises(ApplicationError) as caught:
        build_overview(facts(currency=currency), "30d", "USD" if currency != "USD" else "BDT")
    assert caught.value.code == "OVERVIEW_CURRENCY_UNSUPPORTED"


@pytest.mark.parametrize("reserve,status", [(100, "safe"), (400, "warning"), (401, "breach")])
def test_delay_troughs_and_reserve_thresholds(reserve, status):
    view = build_overview(
        facts(
            reserve=reserve,
            events=[
                event("2026-10-19", 600),
                event("2026-10-20", 1000, "in", True),
                event("2026-11-01", 500),
            ],
        ),
        "30d",
        None,
    )
    assert view.delay_sensitivity[0].projected_trough_minor == "400"
    assert view.delay_sensitivity[0].status == status
    assert [s.projected_trough_minor for s in view.delay_sensitivity[1:]] == ["-100"] * 4
    assert all(s.status == "breach" for s in view.delay_sensitivity[1:])
    assert view.kpis.protected_headroom_minor == str(400 - reserve)


def test_same_day_outflows_precede_receipts_and_shifted_receipts_not_clipped():
    view = build_overview(
        facts(events=[event("2026-10-19", 1200), event("2026-10-19", 2000, "in", True)]),
        "30d",
        None,
    )
    assert all(s.projected_trough_minor == "-200" for s in view.delay_sensitivity)
    assert view.cashflow.total_net_minor == "800"


def test_zero_state_negative_balance_and_missing_history():
    empty = build_overview(facts(baseline_settings={}), "1y", None)
    assert empty.kpis.total_balance_minor == "0"
    assert empty.kpis.protected_headroom_minor == "0"
    assert empty.kpis.protected_headroom_status == "warning"
    assert empty.currency_balances == []
    assert "BASELINE_NOT_CONFIGURED" in empty.data_warnings
    negative = facts()
    negative["baseline_settings"]["opening_cash_minor"] = "-20"
    view = build_overview(negative, "30d", None)
    assert view.kpis.total_balance_minor == "-20" and view.currency_balances == []


def test_buckets_are_dense_and_totals_use_integer_money():
    events = [event("2026-10-18", 51, "in"), event("2026-11-16", 17), event("2026-11-17", 999)]
    view = build_overview(facts(events=events), "30d", None)
    assert len(view.cashflow.timeline) == 5
    assert view.cashflow.total_inflow_minor == "51"
    assert view.cashflow.total_outflow_minor == "17"
    assert view.cashflow.total_net_minor == "34"
    assert sum(int(p.net_minor) for p in view.cashflow.timeline) == 34
    assert len(build_overview(facts(), "1y", None).cashflow.timeline) == 13


def test_volume_growth_classification_and_recent_evaluation():
    recent = dict(
        id=str(uuid4()),
        deal_id=str(uuid4()),
        customer_name="Buyer",
        public_ref="OF-1",
        po_number=None,
        amount="200",
        terms=dict(payment_days=30, payment_basis="delivery"),
        category="deposit",
        created_at=datetime(2026, 10, 18, tzinfo=UTC).isoformat(),
    )
    view = build_overview(
        facts(
            volume=200,
            previous_volume=100,
            tested=5,
            distribution=dict(safe=1, deposit=1, financing=2, declined=1),
            recent=[recent],
        ),
        "30d",
        None,
    )
    assert view.kpis.volume_30d_change_pct == 100
    assert view.verdict_distribution.feasible_as_is_pct == 25
    assert view.verdict_distribution.financing_needed_pct == 50
    assert view.verdict_distribution.split_milestones_count == 0
    assert view.recent_settlements[0].amount_minor == "200"
    assert view.recent_settlements[0].terms == "30 days from delivery"
    recent["category"] = "unclassified"
    review = build_overview(facts(distribution={"unclassified": 1}, recent=[recent]), "30d", None)
    assert review.recent_settlements[0].status == "review"
    assert review.recent_settlements[0].status_label == "Review revised terms"
    assert "RECENT_STATUS_REQUIRES_REVIEW" in review.data_warnings


def test_aggregate_overflow_and_complete_horizon_rejected():
    with pytest.raises(ApplicationError) as caught:
        build_overview(facts(events=[event("2026-10-19", MAX_MONEY)]), "30d", None)
    assert caught.value.code == "OVERVIEW_MONEY_BOUND"
    with pytest.raises(ApplicationError) as caught:
        build_overview(facts(events=[event("2028-10-19", 1)]), "30d", None)
    assert caught.value.code == "OVERVIEW_HORIZON_UNSUPPORTED"


def test_stale_coverage_and_past_events_never_claim_safe():
    row = facts(events=[event("2026-10-17", 100)])
    row["baseline_settings"]["coverage_through"] = "2026-10-20"
    view = build_overview(row, "30d", None)
    assert "BASELINE_COVERAGE_INCOMPLETE" in view.data_warnings
    assert "PAST_EVENTS_REQUIRE_RECONCILIATION" in view.data_warnings
    assert all(s.status == "warning" for s in view.delay_sensitivity)

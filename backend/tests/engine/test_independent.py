"""Independent expected values for financial rules, recovery and numerical bounds."""

import random
from datetime import date, timedelta
from decimal import Decimal

import pytest
from pydantic import ValidationError

from orderfit.engine import analyse
from orderfit.engine.events import cost_events, receipt_schedule
from orderfit.engine.financing import financing_events
from orderfit.engine.horizon import horizon_end
from orderfit.engine.models import CashEvent, EngineInput, Strategy
from orderfit.engine.money import apply_bps, from_minor, split_exact, to_minor
from orderfit.engine.stress import apply_scenario
from orderfit.engine.timeline import scenario_metrics, sweep
from orderfit.engine.tolerance import delay_scan

from .reference_adapter import fixture_input, load

START = date(2026, 11, 2)


def small(**changes):
    raw = {
        "as_of": START,
        "currency": "USD",
        "opening_balance": 100,
        "reserve": 0,
        "baseline_events": [],
        "order": {
            "revenue": 100,
            "anchor_dates": {
                "order": START,
                "invoice": START,
                "delivery": START + timedelta(days=2),
            },
            "terms": {"anchor": "delivery", "days": 0},
            "costs": [
                {
                    "id": "cost",
                    "date": START + timedelta(days=1),
                    "amount": 20,
                    "kind": "supplier_payment",
                    "incremental": True,
                    "deferrable": True,
                }
            ],
        },
        "owner": {
            "priorities": ["profit", "independence_any", "simplicity"],
            "min_order_profit": 0,
            "max_financing_cost": None,
            "target_scenario": "base",
            "close_call_bps": 200,
        },
        "financing_offers": [],
        "strategy_space": {
            "deposit_pcts": [0],
            "deposit_lead_days": 0,
            "extensions": [{"days": 0, "surcharge_bps": 0}],
            "offer_ids": [],
        },
        "scenarios": {"downside": {}, "severe": {}},
        "scan_days": 2,
    }
    raw.update(changes)
    return EngineInput.model_validate(raw)


def case(value):
    raw = value.model_dump(mode="json", exclude_none=True)
    raw["owner"].setdefault("max_financing_cost", None)
    return raw


def loan(**changes):
    value = {
        "offer_id": "loan",
        "name": "Synthetic",
        "shape": "term_loan",
        "interest_bps": 1000,
        "fee_bps": 100,
        "fee_flat": 3,
        "fee_at": "repayment",
        "lead_days": 0,
        "min": 10,
        "max": 100,
        "step": 10,
        "term_days": 10,
    }
    value.update(changes)
    return value


@pytest.mark.parametrize("currency", ["USD", "BDT", "EUR", "GBP"])
def test_exact_minor_units(currency):
    for value in ("0", "-1.23", "90000000000000.00"):
        assert from_minor(to_minor(Decimal(value), currency), currency) == Decimal(value)
    with pytest.raises(ValueError):
        to_minor(Decimal("1.001"), currency)
    with pytest.raises(ValueError):
        to_minor(0.5, currency)
    assert apply_bps(1, 5000) == 1
    assert apply_bps(1, 4999) == 0
    assert split_exact(10, 3) == [3, 3, 4]


def test_sweep_against_independent_prefix_and_outflow_first():
    rng = random.Random(37)
    events = [
        CashEvent(
            str(i),
            START + timedelta(days=rng.randrange(10)),
            rng.randrange(1, 50),
            rng.choice(["in", "out"]),
            "other",
        )
        for i in range(50)
    ]
    series = sweep(100, events, START, START + timedelta(days=10))
    for day, (trough, close) in series.items():
        prior = 100 + sum(
            (1 if e.direction == "in" else -1) * e.amount for e in events if e.date < day
        )
        assert trough == prior - sum(
            e.amount for e in events if e.date == day and e.direction == "out"
        )
        assert close == trough + sum(
            e.amount for e in events if e.date == day and e.direction == "in"
        )
    same = [
        CashEvent("out", START, 110, "out", "other"),
        CashEvent("in", START, 110, "in", "other"),
    ]
    assert sweep(100, same, START, START)[START] == (-10, 100)


def test_baseline_floor_is_daily_not_global_lowest():
    raw = case(small(opening_balance=100, reserve=100))
    raw["baseline_events"] = [
        {"id": "old", "date": START.isoformat(), "amount": 80, "direction": "out", "kind": "rent"},
        {
            "id": "recovery",
            "date": (START + timedelta(days=1)).isoformat(),
            "amount": 80,
            "direction": "in",
            "kind": "other",
        },
    ]
    raw["order"]["costs"][0].update(date=(START + timedelta(days=2)).isoformat(), amount=30)
    raw["order"]["anchor_dates"]["delivery"] = (START + timedelta(days=3)).isoformat()
    metric = scenario_metrics(raw, Strategy(), {}, {}, "base")
    assert metric["lowest_balance"] == 20  # global minimum alone would miss day 2
    assert metric["max_funding_gap"] == 30 and not metric["feasible"]


def test_deposit_rounding_and_extension_only_eligible_costs():
    raw = case(small())
    raw["order"]["revenue"] = 101
    raw["order"]["deposit_discount_bps_per_10pct"] = 100
    receipts, net, discount = receipt_schedule(raw, Strategy(deposit_pct=30))
    assert (net, discount) == (98, 3)
    assert [r[3] for r in receipts] == [29, 69]
    costs, surcharge, excluded = cost_events(raw, Strategy(ext_days=3, ext_surcharge_bps=500))
    assert costs[0].date == START + timedelta(days=4) and costs[0].amount == 21
    raw["order"]["costs"][0]["deferrable"] = False
    assert cost_events(raw, Strategy(ext_days=3))[0][0].date == START + timedelta(days=1)
    raw["order"]["costs"][0]["incremental"] = False
    assert cost_events(raw, Strategy())[0] == []
    assert analyse(EngineInput.model_validate(raw)).catalogue[1].net_profit == 101


def test_term_fee_timing_and_flat_interest_once():
    raw = case(
        small(
            financing_offers=[loan()],
            strategy_space={
                "deposit_pcts": [0],
                "deposit_lead_days": 0,
                "extensions": [{"days": 0, "surcharge_bps": 0}],
                "offer_ids": ["loan"],
            },
        )
    )
    strategy = Strategy(offer_id="loan", loan_minor=100)
    events, total, _ = financing_events(raw, strategy, [])
    assert total == 14  # interest 10 + percent fee 1 + flat fee 3
    assert sum(e.amount for e in events if e.direction == "out") == 114
    assert {e.date for e in events if e.direction == "out"} == {START + timedelta(days=10)}
    raw["financing_offers"][0]["fee_at"] = "draw"
    events, _, _ = financing_events(raw, strategy, [])
    assert next(e for e in events if e.kind == "loan_fee").date == START


def test_certainty_haircut_and_cost_overrun_scope():
    events = [
        CashEvent("confirmed", START, 100, "in", "ar_collection"),
        CashEvent("ar", START, 100, "in", "ar_collection", "expected"),
        CashEvent("receipt", START, 100, "in", "order_final_receipt", "expected", "order"),
        CashEvent("cost", START, 100, "out", "supplier_payment", "confirmed", "order"),
        CashEvent("rent", START, 100, "out", "rent"),
    ]
    shifted = apply_scenario(
        events,
        {
            "order_receipt_delay_days": 2,
            "ar_delay_days": 3,
            "order_receipt_haircut_bps": 2500,
            "cost_overrun_bps": 1000,
        },
    )
    assert shifted[0] == events[0]
    assert shifted[1].date == START + timedelta(days=3)
    assert (shifted[2].date, shifted[2].amount) == (START + timedelta(days=2), 75)
    assert shifted[3].amount == 110 and shifted[4].amount == 100


def test_late_funding_and_large_scan_are_inside_horizon():
    raw = case(small())
    raw["financing_offers"] = [
        loan(available_from=(START + timedelta(days=700)).isoformat(), term_days=100)
    ]
    raw["strategy_space"]["offer_ids"] = ["loan"]
    assert horizon_end(raw) >= START + timedelta(days=800)
    raw["financing_offers"] = []
    raw["strategy_space"]["offer_ids"] = []
    raw["scan_days"] = 540
    assert horizon_end(raw) >= START + timedelta(days=542)
    raw["strategy_space"]["deposit_pcts"] = [0, 50]
    raw["strategy_space"]["deposit_lead_days"] = 365
    assert horizon_end(raw) >= START + timedelta(days=905)


def test_baseline_after_540_days_is_not_clipped():
    raw = case(small(opening_balance=20))
    raw["baseline_events"] = [
        {
            "id": "late",
            "date": (START + timedelta(days=700)).isoformat(),
            "amount": 50,
            "direction": "out",
            "kind": "rent",
        }
    ]
    raw["order"]["revenue"] = 10
    result = analyse(EngineInput.model_validate(raw))
    as_is = next(c for c in result.catalogue if c.strategy.id == "accept_as_is")
    assert as_is.scenarios["base"].lowest_balance == -40
    assert as_is.scenarios["base"].max_funding_gap == 10
    assert result.horizon_end >= START + timedelta(days=700)


def test_linear_scan_does_not_call_full_scan_nonpayment_proof():
    raw = case(small(opening_balance=0))
    raw["order"]["costs"][0].update(date=(START + timedelta(days=5)).isoformat(), amount=50)
    result = analyse(EngineInput.model_validate(raw))
    assert result.diagnostics["delay_scan_top"]["status"] == "capped_scan"
    assert result.diagnostics["delay_scan_top"]["scanned_to"] == 2
    scan = delay_scan(raw, Strategy(), 10, {})
    assert scan["first_failing_delay_days"] == 3 and scan["tolerance_days"] == 2


def test_min_profit_is_strict_and_target_is_soft():
    raw = case(small())
    raw["owner"]["min_order_profit"] = 80
    assert analyse(EngineInput.model_validate(raw)).decision == "decline_or_renegotiate"
    raw["owner"]["min_order_profit"] = 79
    assert analyse(EngineInput.model_validate(raw)).decision == "accept_as_is"
    raw["opening_balance"] = 10
    raw["order"]["costs"][0].update(amount=10, date=(START + timedelta(days=3)).isoformat())
    raw["baseline_events"] = [
        {
            "id": "rent",
            "date": (START + timedelta(days=4)).isoformat(),
            "amount": 10,
            "direction": "out",
            "kind": "rent",
        }
    ]
    raw["owner"]["min_order_profit"] = 0
    raw["owner"]["target_scenario"] = "severe"
    raw["scenarios"]["severe"]["order_receipt_delay_days"] = 5
    result = analyse(EngineInput.model_validate(raw))
    assert result.decision == "accept_as_is" and any(
        e["code"] == "E-FRAGILE-BEST" for e in result.diagnostics["escalations"]
    )


def test_bound_rejection_and_stable_hashes_without_input_mutation():
    value = small()
    before = value.model_dump(mode="json")
    a, b = analyse(value), analyse(value)
    assert a == b and value.model_dump(mode="json") == before
    assert analyse(value.model_copy(update={"max_work_units": 1})).decision == "analysis_limit"
    raw = case(value)
    raw["baseline_events"] = [
        {
            "id": "out",
            "date": (START + timedelta(days=1096)).isoformat(),
            "amount": 1,
            "direction": "out",
            "kind": "rent",
        }
    ]
    result = analyse(EngineInput.model_validate(raw))
    assert result.decision == "analysis_limit" and result.catalogue == []
    raw = case(value)
    raw["order"]["costs"][0]["amount"] = True
    with pytest.raises(ValidationError):
        EngineInput.model_validate(raw)
    raw = case(value)
    raw["owner"]["min_delay_tolerance_days"] = 1
    with pytest.raises(ValidationError):
        EngineInput.model_validate(raw)
    raw = case(value)
    raw["strategy_space"]["stages"] = [2]
    with pytest.raises(ValidationError):
        EngineInput.model_validate(raw)


def test_prior_loan_fees_in_baseline_do_not_consume_new_financing_cap():
    raw = case(small())
    raw["baseline_events"] = [
        {
            "id": "oldfee",
            "date": START.isoformat(),
            "amount": 5,
            "direction": "out",
            "kind": "loan_fee",
        }
    ]
    raw["owner"]["max_financing_cost"] = 0
    result = analyse(EngineInput.model_validate(raw))
    assert result.decision == "accept_as_is"
    candidate = next(c for c in result.catalogue if c.strategy.id == "accept_as_is")
    assert candidate.net_profit == 80 and candidate.scenarios["base"].financing_cost == 0


def test_missing_anchor_and_past_receipt_never_default_or_drop():
    raw = case(small())
    raw["order"]["terms"]["anchor"] = "unknown"
    assert analyse(EngineInput.model_validate(raw)).decision == "needs_input"
    raw = case(small())
    raw["order"]["anchor_dates"]["delivery"] = "2025-01-01"
    assert analyse(EngineInput.model_validate(raw)).decision == "blocked_data_conflict"


def test_funding_grid_and_repayment_feasibility():
    raw = case(small(opening_balance=0))
    raw["order"]["costs"][0]["amount"] = 26
    raw["financing_offers"] = [loan(min=11, max=51, step=10, fee_flat=0, fee_bps=0, interest_bps=0)]
    raw["strategy_space"]["offer_ids"] = ["loan"]
    result = analyse(EngineInput.model_validate(raw))
    funded = [c for c in result.catalogue if c.strategy.offer_id]
    assert {c.strategy.loan_minor for c in funded} == {31}
    assert funded[0].financing_cost == 0 and funded[0].net_profit == 74
    raw["financing_offers"][0]["valid_until"] = START.isoformat()
    raw["financing_offers"][0]["lead_days"] = 1
    assert analyse(EngineInput.model_validate(raw)).decision == "decline_or_renegotiate"


def test_exact_of02_of15_anchors_and_full_catalogue():
    result = analyse(fixture_input(load("OF-02")))
    deposit = next(c for c in result.catalogue if c.strategy.id == "dep40")
    assert deposit.net_profit == 132800000
    assert deposit.scenarios["base"].headroom == 22120000
    assert deposit.scenarios["downside"].headroom == 7120000
    financed = next(c for c in result.catalogue if c.strategy.id == "fin:BANK_WC@130000000")
    assert financed.net_profit == 134800000
    assert len(result.catalogue) > len(result.diagnostics["ranked_top"])
    assert all(len(c.series) == 3 and len(c.scenarios) == 3 for c in result.catalogue)
    assert analyse(fixture_input(load("OF-15"))).tolerance.observed_safe_days == 16


def test_resource_dimensions_and_output_admission():
    raw = case(small())
    raw["strategy_space"]["deposit_pcts"] = list(range(101))
    raw["strategy_space"]["extensions"] = [{"days": i, "surcharge_bps": 0} for i in range(101)]
    assert (
        analyse(EngineInput.model_validate(raw)).diagnostics["reason"] == "ANALYSIS_STRATEGY_LIMIT"
    )
    raw = case(small())
    raw["strategy_space"]["deposit_pcts"] = list(range(101))
    raw["strategy_space"]["extensions"] = [{"days": i, "surcharge_bps": 0} for i in range(10)]
    raw["baseline_events"] = [
        {
            "id": "late",
            "date": (START + timedelta(days=600)).isoformat(),
            "amount": 1,
            "direction": "out",
            "kind": "rent",
        }
    ]
    assert analyse(EngineInput.model_validate(raw)).diagnostics["reason"] == "ANALYSIS_OUTPUT_LIMIT"
    raw = case(small())
    raw["financing_offers"] = [loan(max=201, min=1, step=1)]
    with pytest.raises(ValidationError):
        EngineInput.model_validate(raw)
    raw = case(small())
    raw["financing_offers"] = [loan(shape="receivable_advance")]
    with pytest.raises(ValidationError):
        EngineInput.model_validate(raw)
    with pytest.raises(ValueError):
        Strategy(stages=2)
    with pytest.raises(ValueError):
        apply_bps(True, 100)


def test_ranking_priorities_tie_breaks_and_absolute_cap():
    from orderfit.engine.evaluation import evaluate
    from orderfit.engine.rank import hard_ok, priority_key

    raw = case(
        small(
            financing_offers=[loan()],
            strategy_space={
                "deposit_pcts": [0],
                "deposit_lead_days": 0,
                "extensions": [{"days": 0, "surcharge_bps": 0}],
                "offer_ids": ["loan"],
            },
        )
    )
    one = evaluate(raw, Strategy(offer_id="loan", loan_minor=10), {})
    two = evaluate(raw, Strategy(offer_id="loan", loan_minor=20), {})
    raw["owner"]["priorities"] = ["independence_any", "simplicity"]
    assert priority_key(one, raw, True) < priority_key(two, raw, True)
    raw["owner"]["max_financing_cost"] = one["financing_cost"] - 1
    assert "financing_cost_cap" in hard_ok(one, raw)[1]
    for priority in [
        "profit",
        "robustness",
        "independence_any",
        "independence_customer",
        "simplicity",
        "low_financing_cost",
    ]:
        raw["owner"]["priorities"] = [priority]
        assert priority_key(one, raw, True) < priority_key(one, raw, False)


def test_linear_scan_stops_at_first_nonmonotone_failure(monkeypatch):
    import orderfit.engine.tolerance as tolerance

    checked = []

    def outcome(_case, _strategy, scenario, *args):
        delay = scenario["order_receipt_delay_days"]
        checked.append(delay)
        return {"feasible": delay != 2}  # later delays recover: binary search is invalid

    monkeypatch.setattr(tolerance, "scenario_metrics", outcome)
    result = tolerance.delay_scan({}, Strategy(), 5, {})
    assert result["first_failing_delay_days"] == 2 and checked == [0, 1, 2]


def test_money_is_independent_of_decimal_context():
    from decimal import localcontext

    with localcontext() as context:
        context.prec = 2
        assert to_minor(Decimal("123456.78"), "USD") == 12345678
        assert str(from_minor(12345678, "USD")) == "123456.78"
        with pytest.raises(ValueError):
            to_minor(Decimal("1e-99999999"), "USD")


def test_as_offered_always_available_with_nonzero_deposit_grid():
    raw = case(small())
    raw["strategy_space"]["deposit_pcts"] = [10]
    result = analyse(EngineInput.model_validate(raw))
    assert "accept_as_is" in {c.strategy.id for c in result.catalogue}


def test_late_repayment_changes_cash_result_instead_of_being_clipped():
    raw = case(small(opening_balance=0))
    raw["order"]["revenue"] = 10
    raw["strategy_space"]["offer_ids"] = ["loan"]
    raw["financing_offers"] = [
        loan(
            available_from=(START + timedelta(days=700)).isoformat(),
            term_days=100,
            fee_flat=100,
            fee_bps=0,
            interest_bps=0,
        )
    ]
    metric = scenario_metrics(raw, Strategy(offer_id="loan", loan_minor=100), {}, {}, "base")
    assert metric["lowest_balance"] == -110
    assert metric["lowest_date"] == (START + timedelta(days=800)).isoformat()
    assert not metric["feasible"]


def test_breach_intervals_separate_inherited_from_new_shortfalls():
    raw = case(small(opening_balance=10))
    raw["baseline_events"] = [
        {
            "id": "rent",
            "date": (START + timedelta(days=1)).isoformat(),
            "amount": 20,
            "direction": "out",
            "kind": "rent",
        },
        {
            "id": "ar",
            "date": (START + timedelta(days=3)).isoformat(),
            "amount": 20,
            "direction": "in",
            "kind": "ar_collection",
        },
    ]
    result = analyse(EngineInput.model_validate(raw))
    candidate = next(c for c in result.catalogue if c.strategy.id == "accept_as_is")
    metrics = candidate.scenarios["base"]
    assert [(b.days, b.max_gap) for b in metrics.inherited_baseline_breaches] == [(3, 10)]
    assert [(b.days, b.max_gap) for b in metrics.order_caused_breaches] == [(2, 20)]
    assert metrics.order_caused_breaches[0].start == START + timedelta(days=1)


def test_runtime_work_exhaustion_never_publishes_partial_catalogue(monkeypatch):
    import importlib

    entry = importlib.import_module("orderfit.engine.analyse")
    admit = entry.admit

    def exhausted_after_admission(raw):
        admit(raw)
        raw["_budget"].maximum = 1

    monkeypatch.setattr(entry, "admit", exhausted_after_admission)
    result = analyse(small())
    assert result.decision == "analysis_limit"
    assert not result.catalogue and result.recommended is None


def test_unknown_event_class_and_invalid_sensitivity_are_rejected():
    raw = case(small())
    raw["baseline_events"] = [
        {
            "id": "invalid",
            "date": START.isoformat(),
            "amount": 1,
            "direction": "in",
            "kind": "ar_typo",
        }
    ]
    with pytest.raises(ValidationError):
        EngineInput.model_validate(raw)
    raw = case(small())
    raw["sensitivity"] = [{"path": "strategy_space.deposit_lead_days", "values": [366]}]
    with pytest.raises(ValidationError):
        EngineInput.model_validate(raw)
    raw["sensitivity"] = [{"path": "order.deposit_discount_bps_per_10pct", "values": [1000]}]
    assert EngineInput.model_validate(raw).sensitivity[0].values == [1000]


def test_every_catalogue_option_has_actual_full_cap_tolerance():
    raw = case(small(opening_balance=0))
    raw["strategy_space"]["deposit_pcts"] = [0, 50]
    raw["order"]["costs"][0].update(date=(START + timedelta(days=5)).isoformat(), amount=50)
    raw["scan_days"] = 10
    result = analyse(EngineInput.model_validate(raw))
    options = {c.strategy.id: c for c in result.catalogue}
    assert options["accept_as_is"].tolerance.observed_safe_days == 2
    assert options["accept_as_is"].tolerance.first_failure_days == 3
    assert options["dep50"].tolerance.observed_safe_days == 4
    assert options["dep50"].tolerance.first_failure_days == 5
    assert options["decline"].tolerance.status == "capped_scan"
    assert all(c.tolerance.scan_cap_days == 10 for c in result.catalogue)
    assert result.tolerance == options[result.recommended].tolerance


def test_per_option_scan_exhaustion_discards_entire_analysis(monkeypatch):
    import importlib

    entry = importlib.import_module("orderfit.engine.analyse")
    original_scan = entry.delay_scan
    calls = 0

    def scan(raw, *args):
        nonlocal calls
        calls += 1
        if calls == 2:  # recommended scan completed; catalogue scan now exceeds budget
            raw["_budget"].consume(raw["_budget"].maximum)
        return original_scan(raw, *args)

    monkeypatch.setattr(entry, "delay_scan", scan)
    result = analyse(small())
    assert calls == 2
    assert result.decision == "analysis_limit"
    assert result.recommended is None and result.catalogue == []


def test_delay_ranking_reuses_only_one_baseline_per_delay(monkeypatch):
    import orderfit.engine.timeline as timeline
    from orderfit.engine.tolerance import ranking_by_delay

    original = timeline.sweep
    sweeps = 0

    def counted(*args):
        nonlocal sweeps
        sweeps += 1
        return original(*args)

    monkeypatch.setattr(timeline, "sweep", counted)
    shortlist = [Strategy(), Strategy(deposit_pct=50)]
    ranking_by_delay(case(small()), shortlist, 2)
    # Three scenario evaluations per strategy + three shared baselines, then
    # three delays with two candidates and one shared baseline each.
    assert sweeps == (2 * 3 + 3) + 3 * (2 + 1)

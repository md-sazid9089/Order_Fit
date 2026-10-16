"""Edge cases through the public engine: X-01, X-02, B-01, B-02 and M-10.

X-04 (single rounding rule) is covered in test_money.py and non-monotone delay in
test_independent.py. Golden-level coverage of the same
rows lives in test_reference.py (OF-02, OF-12, OF-13); these cases state the expected values
independently.
"""

from datetime import timedelta

from orderfit.engine import analyse
from orderfit.engine.models import EngineInput, Strategy
from orderfit.engine.tolerance import delay_scan

from .test_independent import START, case, small


def as_is_base(model):
    result = analyse(model)
    return next(c for c in result.catalogue if c.strategy.id == "accept_as_is").scenarios["base"]


def test_x01_safe_with_no_payment_is_only_safe_within_the_scanned_range():
    scan = delay_scan(case(small(opening_balance=100)), Strategy(), 10, {})
    assert scan["first_failing_delay_days"] is None
    assert scan["survives_full_scan"] is True and scan["scanned_to"] == 10  # a finite scan only


def test_x02_fails_even_when_the_customer_pays_on_time():
    base = as_is_base(small(opening_balance=0))
    assert base.feasible is False and base.lowest_balance == -20
    assert str(base.first_shortfall_date) == str(START + timedelta(days=1))


def test_b02_balance_exactly_on_reserve_passes_with_zero_margin():
    base = as_is_base(small(opening_balance=100, reserve=80))
    assert base.feasible is True and base.lowest_balance == 80 and base.headroom == 0


def test_b01_inherited_breach_is_not_charged_to_the_order():
    result = analyse(small(opening_balance=40, reserve=50))
    decline = result.diagnostics["baseline"]
    assert decline["base"]["order_caused_violation_days"] == 0
    assert decline["base"]["headroom"] == -10  # pre-existing breach, reported separately
    assert as_is_base(small(opening_balance=40, reserve=50)).order_caused_violation_days == 2


def test_m10_same_day_outflow_is_applied_before_inflow():
    raw = case(small(opening_balance=0))
    raw["order"]["costs"][0].update(date=(START + timedelta(days=2)).isoformat(), amount=50)
    base = as_is_base(EngineInput.model_validate(raw))
    assert base.lowest_balance == -50 and base.feasible is False


def test_missing_anchor_none_is_needs_input_not_a_raw_exception():
    raw = case(small())
    raw["order"]["terms"] = {"anchor": None, "days": 0}
    result = analyse(EngineInput.model_validate(raw))
    assert result.decision == "needs_input"
    assert result.diagnostics["escalations"][0]["code"] == "E-MISSING-ANCHOR"


def test_unconfirmed_baseline_order_receipt_near_ceiling_is_a_typed_limit():
    raw = case(small())
    raw["scenarios"] = {"downside": {"order_receipt_delay_days": 30}, "severe": {}}
    raw["baseline_events"] = [
        {"id": "late", "date": (START + timedelta(days=1090)).isoformat(), "amount": 5,
         "direction": "in", "kind": "order_final_receipt", "certainty": "expected"}
    ]
    result = analyse(EngineInput.model_validate(raw))  # must not raise ValueError
    assert result.decision == "analysis_limit"

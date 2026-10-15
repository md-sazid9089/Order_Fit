"""Linear first-failure scans, never infinity or monotonic binary search."""

from __future__ import annotations

from orderfit.engine.constants import BASE_SC
from orderfit.engine.evaluation import evaluate
from orderfit.engine.models import Strategy
from orderfit.engine.rank import priority_key
from orderfit.engine.timeline import scenario_metrics


def delay_scan(case: dict, st: Strategy, max_delay: int, cache: dict):
    """Linear scan d=0..max_delay of customer-receipt delay. Never binary search (not monotone)."""
    first_fail, tolerance = None, None
    for dd in range(0, max_delay + 1):
        sc = {"order_receipt_delay_days": dd, "ar_delay_days": 0, "order_receipt_haircut_bps": 0}
        m = scenario_metrics(case, st, sc, {}, f"scan{dd}")
        if m is None or not m["feasible"]:
            first_fail = dd
            break
    tolerance = -1 if first_fail == 0 else (first_fail - 1 if first_fail is not None else max_delay)
    return {
        "first_failing_delay_days": first_fail,
        "tolerance_days": tolerance,
        "survives_full_scan": first_fail is None,
        "scanned_to": max_delay,
    }


def ranking_by_delay(case: dict, shortlist: list[Strategy], max_delay: int):
    """Best strategy of the (dominance-pruned, base-feasible) shortlist if the customer pays d days late,
    scanned linearly d=0..max_delay. Reports every change of the top choice, and the first delay at which
    no shortlisted strategy satisfies the hard constraint."""
    base_keys = {}
    base_cache = {}
    for st in shortlist:
        base_keys[st.id] = priority_key(evaluate(case, st, base_cache), case, True)
    seq, last, first_none = [], object(), None
    for dd in range(0, max_delay + 1):
        sc = {"order_receipt_delay_days": dd, "ar_delay_days": 0, "order_receipt_haircut_bps": 0}
        best = None
        # The counterfactual depends on the scenario, not the strategy. Retain
        # only this delay's baseline so memory stays bounded by one horizon.
        baseline_cache = {}
        for st in shortlist:
            m = scenario_metrics(case, st, sc, baseline_cache, f"flip{dd}")
            if m is not None and m["feasible"] and (best is None or base_keys[st.id] < best[0]):
                best = (base_keys[st.id], st.id)
        top = best[1] if best else None
        if top != last:
            seq.append({"from_delay_days": dd, "top": top})
            last = top
        if top is None and first_none is None:
            first_none = dd
    return {
        "changes": seq,
        "first_delay_with_no_feasible_shortlisted_strategy": first_none,
        "scanned_to": max_delay,
    }


def minimum_deposit_pct(case: dict) -> int | None:
    """Smallest customer deposit (1% grid) that satisfies the hard constraint in the base scenario
    with no other lever. Explanatory: 'what would have to change'."""
    for pct in range(0, 101):
        st = Strategy("plan", deposit_pct=pct)
        m = scenario_metrics(case, st, BASE_SC, {}, "base")
        if m and m["feasible"]:
            return pct
    return None

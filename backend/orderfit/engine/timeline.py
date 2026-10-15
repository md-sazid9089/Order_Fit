"""Daily troughs, baseline-relative floors and complete dated series."""

from __future__ import annotations

from datetime import date, timedelta

from orderfit.engine.events import build_events, meta_fin_cost, parse_events
from orderfit.engine.horizon import horizon_end
from orderfit.engine.models import CashEvent as Ev
from orderfit.engine.models import Strategy
from orderfit.engine.stress import apply_scenario
from orderfit.engine.utilities import d

OUT, IN = "out", "in"


def sweep(opening: int, events: list[Ev], start: date, end: date):
    """Event-sorted sweep. Returns {date: (trough, close)} for EVERY calendar day start..end."""
    by_date: dict[date, list[Ev]] = {}
    for e in events:
        by_date.setdefault(e.date, []).append(e)
    bal = opening
    series = {}
    day = start
    while day <= end:
        evs = by_date.get(day, [])
        outs = sum(e.amount for e in evs if e.direction == OUT)
        ins = sum(e.amount for e in evs if e.direction == IN)
        trough = bal - outs
        bal = trough + ins
        series[day] = (trough, bal)
        day += timedelta(days=1)
    return series


def scenario_metrics(
    case: dict,
    st: Strategy,
    sc: dict,
    base_series_cache: dict,
    scname: str,
    check_bruteforce: bool = False,
):
    if st.deposit_pct and not case["order"]["anchor_dates"].get("order"):
        return None
    owner = case["owner"]
    cap = owner.get("max_deposit_concession_bps")
    concession = (
        case["order"].get("deposit_discount_bps", 0)
        + case["order"].get("deposit_discount_bps_per_10pct", 0) * st.deposit_pct // 10
        if st.deposit_pct
        else 0
    )
    if concession > 10000 or (cap is not None and concession > cap):
        return None
    if (
        owner.get("max_supplier_extension_days") is not None
        and st.ext_days > owner["max_supplier_extension_days"]
    ):
        return None
    events, meta = build_events(case, st, sc)
    if events is None:
        return None
    as_of = d(case["as_of"])
    end = horizon_end(case)
    opening, reserve = case["opening_balance"], case["reserve"]
    case["_budget"].consume((end - as_of).days + 1 + len(events)) if "_budget" in case else None
    if any(e.date < as_of or e.date > end for e in events):
        raise ValueError("event outside complete horizon")
    series = sweep(opening, events, as_of, end)
    if check_bruteforce:
        bf = bruteforce_series(opening, events, as_of, end)
        assert series == bf, f"sweep != bruteforce for {st.id} / {scname}"
    # counterfactual baseline under the same scenario
    key = scname
    if key not in base_series_cache:
        be = apply_scenario(parse_events(case["baseline_events"], "baseline", case["currency"]), sc)
        base_series_cache[key] = sweep(opening, be, as_of, end)
    bseries = base_series_cache[key]
    lowest, lowest_day = min(
        ((tr, dy) for dy, (tr, _) in series.items()), key=lambda x: (x[0], x[1])
    )
    first_short = next((dy for dy, (tr, _) in series.items() if tr < reserve), None)
    viol, max_gap, abs_gap = [], 0, 0
    for dy, (tr, _) in series.items():
        req = min(reserve, bseries[dy][0])
        if tr < req:
            viol.append(dy)
            max_gap = max(max_gap, req - tr)
        abs_gap = max(abs_gap, reserve - tr)
    return {
        "scenario": scname,
        "lowest_balance": lowest,
        "headroom": lowest - reserve,
        "lowest_date": lowest_day.isoformat(),
        "first_shortfall_date": first_short.isoformat() if first_short else None,
        "order_caused_violation_days": len(viol),
        "first_violation_date": viol[0].isoformat() if viol else None,
        "max_funding_gap": max_gap,
        "absolute_gap_vs_reserve": max(abs_gap, 0),
        "feasible": not viol,
        "final_balance": series[end][1],
        "financing_cost": meta_fin_cost(events, meta),
        "_series": series,
        "_events": events,
        "_meta": meta,
    }


def bruteforce_series(opening: int, events: list[Ev], start: date, end: date):
    """Second, deliberately different implementation: process events one by one, outflows first,
    tracking the running minimum after each single event. Used to cross-check `sweep`."""
    ordered = sorted(events, key=lambda e: (e.date, 0 if e.direction == OUT else 1, e.id))
    bal = opening
    i = 0
    series = {}
    day = start
    while day <= end:
        low = bal
        while i < len(ordered) and ordered[i].date == day:
            e = ordered[i]
            bal += e.amount if e.direction == IN else -e.amount
            low = min(low, bal)
            i += 1
        series[day] = (low, bal)
        day += timedelta(days=1)
    return series

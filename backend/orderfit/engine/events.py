"""Dated incremental cash construction, ported from ref-0.1.0."""

from __future__ import annotations

from datetime import date, timedelta

from orderfit.engine.financing import financing_events
from orderfit.engine.models import CashEvent as Ev
from orderfit.engine.models import Strategy
from orderfit.engine.money import apply_bps, split_exact
from orderfit.engine.stress import apply_scenario
from orderfit.engine.utilities import d
from orderfit.engine.validation import Unsupported

OUT, IN = "out", "in"


def parse_events(rows: list[dict], scope: str, default_ccy: str) -> list[Ev]:
    evs = []
    for r in rows:
        if r.get("ccy", default_ccy) != default_ccy:
            raise Unsupported(
                "E-UNSUPPORTED-MULTICCY",
                f"event {r['id']} is in {r['ccy']} but case currency is {default_ccy}; no FX rate supplied",
            )
        if r["amount"] <= 0:
            raise Unsupported("E-INVALID-AMOUNT", f"event {r['id']} has non-positive amount")
        evs.append(
            Ev(
                r["id"],
                d(r["date"]),
                r["amount"],
                r["direction"],
                r["kind"],
                r.get("certainty", "confirmed"),
                scope,
            )
        )
    return evs


def anchor_date(o: dict, name: str) -> date:
    return d(o["anchor_dates"][name])


def receipt_schedule(case: dict, st: Strategy):
    """Returns list of (id, kind, date, amount) for customer receipts under the strategy, and net revenue."""
    o = case["order"]
    sp = case["strategy_space"]
    revenue = o["revenue"]
    # concession the customer asks for a deposit: a flat part plus a part that grows with the size of the deposit
    disc_bps = (
        (
            o.get("deposit_discount_bps", 0)
            + (o.get("deposit_discount_bps_per_10pct", 0) * st.deposit_pct) // 10
        )
        if st.deposit_pct > 0
        else 0
    )
    discount = apply_bps(revenue, disc_bps)
    net_rev = revenue - discount
    deposit = apply_bps(net_rev, st.deposit_pct * 100)
    remaining = net_rev - deposit
    shift = timedelta(days=st.defer_days)
    out = []
    if deposit > 0:
        out.append(
            (
                "order_deposit",
                "order_deposit",
                anchor_date(o, "order") + timedelta(days=sp.get("deposit_lead_days", 7)) + shift,
                deposit,
            )
        )
    term = o["terms"]
    anchor = anchor_date(o, term["anchor"])
    parts = split_exact(remaining, st.stages)
    gap = sp.get("stage_gap_days", 14)
    for k, amt in enumerate(parts):
        stage_anchor = anchor + timedelta(days=k * gap)
        rdate = stage_anchor + timedelta(days=term["days"]) + shift
        kind = "order_final_receipt" if st.stages == 1 else "order_stage_receipt"
        out.append((f"order_receipt_{k + 1}", kind, rdate, amt))
    return out, net_rev, discount


def cost_events(case: dict, st: Strategy):
    o = case["order"]
    shift = timedelta(days=st.defer_days)
    evs, surcharge_total, excluded = [], 0, []
    for c in o["costs"]:
        if not c.get("incremental", True):
            excluded.append(c["id"])
            continue
        amt = c["amount"]
        dt = d(c["date"]) + shift
        if st.ext_days and c.get("deferrable"):
            dt += timedelta(days=st.ext_days)
            sur = apply_bps(amt, st.ext_surcharge_bps)
            amt += sur
            surcharge_total += sur
        evs.append(Ev(c["id"], dt, amt, OUT, c["kind"], c.get("certainty", "confirmed"), "order"))
    return evs, surcharge_total, excluded


def build_events(case: dict, st: Strategy, sc: dict):
    ccy = case["currency"]
    base = parse_events(case["baseline_events"], "baseline", ccy)
    order_evs: list[Ev] = []
    meta = {
        "revenue_net": 0,
        "discount": 0,
        "surcharge": 0,
        "financing_cost": 0,
        "excluded_costs": [],
    }
    if st.kind != "decline":
        rec, net_rev, discount = receipt_schedule(case, st)
        for rid, kind, rdate, amt in rec:
            cert = "expected" if kind != "order_deposit" else "expected"
            order_evs.append(Ev(rid, rdate, amt, IN, kind, cert, "order"))
        costs, sur, excl = cost_events(case, st)
        order_evs += costs
        fin, fcost, offer = financing_events(case, st, order_evs)
        if fin is None:
            return None, None
        meta.update(
            revenue_net=net_rev,
            discount=discount,
            surcharge=sur,
            financing_cost=fcost,
            excluded_costs=excl,
        )
        all_events = base + order_evs
        shifted = apply_scenario(all_events, sc)
        return shifted + fin, meta
    return apply_scenario(base, sc), meta


def meta_fin_cost(events, meta):
    """Financing cost under the scenario that produced `events` (fee and interest events)."""
    return sum(
        e.amount
        for e in events
        if e.scope == "financing" and e.kind in ("loan_fee", "loan_interest")
    )

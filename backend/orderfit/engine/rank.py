"""Lexicographic policy ranking; hard feasibility is separate from targets."""

from __future__ import annotations

from datetime import timedelta

from orderfit.engine.events import anchor_date
from orderfit.engine.models import Strategy
from orderfit.engine.utilities import d


def key_metric(res: dict, p: str):
    """Lower is better for every priority key."""
    st = res["strategy"]
    return {
        "profit": -res["net_profit"],
        "robustness": -res["resilience"],
        "independence_any": len(st.dependencies),
        "independence_customer": int("customer" in st.dependencies),
        "simplicity": st.n_levers,
        "low_financing_cost": res["financing_cost"],
    }[p]


def priority_key(res: dict, case: dict, meets: bool):
    st = res["strategy"]
    parts = [0 if meets else 1]
    for p in case["owner"].get("priorities", ["profit", "independence_any", "simplicity"]):
        if p == "profit":
            parts.append(-res["net_profit"])
        elif p == "robustness":
            parts.append(-res["resilience"])
        elif p == "independence_any":
            parts.append(len(st.dependencies))
        elif p == "independence_customer":
            parts.append(int("customer" in st.dependencies))
        elif p == "simplicity":
            parts.append(st.n_levers)
        elif p == "low_financing_cost":
            parts.append(res["financing_cost"])
        else:
            raise ValueError(f"unknown priority {p}")
    # final deterministic tie-breaks: less borrowing wins (X-03), then the smaller ask, then the id
    parts += [st.loan_minor, st.deposit_pct, st.ext_days, st.stages, st.defer_days, st.id]
    return tuple(parts)


def lever_items(st: Strategy) -> frozenset:
    items = set()
    if st.deposit_pct:
        items.add(("deposit", st.deposit_pct))
    if st.ext_days:
        items.add(("ext", st.ext_days))
    if st.stages > 1:
        items.add(("stages", st.stages))
    if st.offer_id:
        items.add(("fin", st.offer_id, st.loan_minor))
    if st.defer_days:
        items.add(("defer", st.defer_days))
    return frozenset(items)


def prune_dominated(rows: list) -> tuple[list, int]:
    """Drop a strategy if a strict sub-plan (same shared lever values, fewer levers) is at least as profitable, at least
    as resilient and has at least as much cash on its lowest day in every scenario: the extra lever only adds a dependency."""
    keep = []
    for r, why in rows:
        a = lever_items(r["strategy"])
        dominated = any(
            lever_items(o["strategy"]) < a
            and o["net_profit"] >= r["net_profit"]
            and o["resilience"] >= r["resilience"]
            and all(
                o["scen"][k]["lowest_balance"] >= r["scen"][k]["lowest_balance"]
                for k in ("base", "downside", "severe")
            )
            for o, _ in rows
            if o is not r
        )
        if not dominated:
            keep.append((r, why))
    return keep, len(rows) - len(keep)


def hard_ok(res: dict, case: dict) -> tuple[bool, list[str]]:
    why = []
    owner = case["owner"]
    if not res["scen"]["base"]["feasible"]:
        why.append("reserve")
    cap = owner.get("max_financing_cost")
    if cap is not None and max(m["financing_cost"] for m in res["scen"].values()) > cap:
        why.append("financing_cost_cap")
    if res["strategy"].kind != "decline" and res["net_profit"] <= owner.get("min_order_profit", 0):
        why.append("min_order_profit")
    o = case["order"]
    if res["strategy"].defer_days:
        if o.get("required_delivery_by") and anchor_date(o, "delivery") + timedelta(
            days=res["strategy"].defer_days
        ) > d(o["required_delivery_by"]):
            why.append("delivery_deadline")
        if o.get("quote_valid_until") and d(case["as_of"]) + timedelta(
            days=res["strategy"].defer_days
        ) > d(o["quote_valid_until"]):
            why.append("quote_expired")
    return (not why), why


def summarize(res: dict, exponent: int):
    st = res["strategy"]
    row = {
        "strategy_id": st.id,
        "dependencies": list(st.dependencies),
        "net_order_profit": res["net_profit"],
        "financing_cost": res["financing_cost"],
        "concession": res["concession"] + res["surcharge"],
        "resilience": res["resilience"],
    }
    for name, m in res["scen"].items():
        row[name] = {k: v for k, v in m.items() if not k.startswith("_")}
    return row

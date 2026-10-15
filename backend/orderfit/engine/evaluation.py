"""Evaluate one canonical strategy in three deterministic scenarios."""

from __future__ import annotations

from orderfit.engine.constants import BASE_SC
from orderfit.engine.models import Strategy
from orderfit.engine.timeline import scenario_metrics


def evaluate(case: dict, st: Strategy, cache: dict, check_bruteforce: bool = False):
    scs = {"base": BASE_SC, **case["scenarios"]}
    res = {}
    meta = None
    for name, sc in scs.items():
        m = scenario_metrics(case, st, sc, cache, name, check_bruteforce)
        if m is None:
            return None
        res[name] = m
        if name == "base":
            meta = m["_meta"]
    o = case["order"]
    cost_total = sum(c["amount"] for c in o["costs"] if c.get("incremental", True))
    revenue_net = meta["revenue_net"] if st.kind != "decline" else 0
    profit_before_fin = (
        (revenue_net - cost_total - meta["surcharge"]) if st.kind != "decline" else 0
    )
    net_profit = profit_before_fin - meta["financing_cost"]
    # resilience level: 0 = fails the base scenario; 1 = base only; 2 = base + downside; 3 = base + downside + severe.
    level = 0
    if res["base"]["feasible"]:
        level = 1
        if res["downside"]["feasible"]:
            level = 2
            if res["severe"]["feasible"]:
                level = 3
    return {
        "strategy": st,
        "scen": res,
        "net_profit": net_profit,
        "profit_before_financing": profit_before_fin,
        "financing_cost": meta["financing_cost"],
        "concession": meta["discount"],
        "surcharge": meta["surcharge"],
        "revenue_net": revenue_net,
        "resilience": level,
        "excluded_costs": meta["excluded_costs"],
    }


def target_level(case: dict) -> int:
    return {"base": 1, "downside": 2, "severe": 3}[case["owner"].get("target_scenario", "downside")]

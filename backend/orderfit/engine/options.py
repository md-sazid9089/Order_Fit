"""Bounded deposit/extension and scenario-sized loan catalogue."""

from __future__ import annotations

from dataclasses import replace

from orderfit.engine.constants import BASE_SC
from orderfit.engine.models import Strategy
from orderfit.engine.timeline import scenario_metrics


def enumerate_strategies(case: dict, cache: dict):
    sp = case["strategy_space"]
    exts = sp.get("extensions", [{"days": 0, "surcharge_bps": 0}])
    out = [Strategy(kind="decline")]
    offers = [None] + [
        x for x in case["financing_offers"] if x["offer_id"] in sp.get("offer_ids", [])
    ]
    for defer in sp.get("defer_days", [0]):
        for dep in sp.get("deposit_pcts", [0]):
            for ex in exts:
                for stg in sp.get("stages", [1]):
                    for off in offers:
                        base = Strategy(
                            "plan", dep, ex["days"], ex.get("surcharge_bps", 0), stg, defer
                        )
                        if off is None:
                            out.append(base)
                            continue
                        sized = {}
                        base_metrics = {}
                        P = off["min"]
                        grid = []
                        while P <= off["max"]:
                            grid.append(P)
                            P += off["step"]
                        for sized_for in ("base", "downside", "severe"):
                            tsc = BASE_SC if sized_for == "base" else case["scenarios"][sized_for]
                            for P in grid:
                                cand = replace(
                                    base,
                                    offer_id=off["offer_id"],
                                    loan_minor=P,
                                    sized_for=sized_for,
                                )
                                if P not in base_metrics:
                                    base_metrics[P] = scenario_metrics(
                                        case, cand, BASE_SC, cache_for(cache, cand, "base"), "base"
                                    )
                                mb = base_metrics[P]
                                if mb is None or not mb["feasible"]:
                                    continue  # a hard-feasible plan must hold in the base scenario
                                mt = (
                                    mb
                                    if sized_for == "base"
                                    else scenario_metrics(
                                        case,
                                        cand,
                                        tsc,
                                        cache_for(cache, cand, sized_for),
                                        sized_for,
                                    )
                                )
                                if mt is not None and mt["feasible"]:
                                    sized[sized_for] = cand
                                    break
                        if "base" in sized:
                            out.append(sized["base"])
                            for k in ("downside", "severe"):
                                if k in sized and all(
                                    sized[k].loan_minor != o_.loan_minor for o_ in (sized["base"],)
                                ):
                                    out.append(sized[k])
    # Always compute the as-offered counterfactual, even if a custom lever grid
    # omits zero. Its inclusion cannot bypass any hard feasibility/policy check.
    if not any(s.id == "accept_as_is" for s in out):
        out.append(Strategy())
    # de-duplicate by id keeping first
    seen, uniq = set(), []
    for s in out:
        if s.id not in seen:
            seen.add(s.id)
            uniq.append(s)
    return uniq


def cache_for(cache: dict, st: Strategy, tag: str):
    return cache.setdefault(("sizing", tag), {})

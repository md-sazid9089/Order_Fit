"""Pure financial entry point. Only the compute node calls analyse in application code."""

from __future__ import annotations

import hashlib
import json

from orderfit.engine.constants import BASE_SC
from orderfit.engine.diagnostics import (
    alerts_for,
    assumption_sensitivity,
    coverage_and_duplicate_warnings,
    voi,
)
from orderfit.engine.evaluation import evaluate, target_level
from orderfit.engine.models import (
    BreachInterval,
    Candidate,
    EngineInput,
    Result,
    ScenarioMetrics,
    SeriesPoint,
    Strategy,
    Tolerance,
)
from orderfit.engine.money import apply_bps
from orderfit.engine.options import enumerate_strategies
from orderfit.engine.rank import (
    hard_ok,
    key_metric,
    lever_items,
    priority_key,
    prune_dominated,
    summarize,
)
from orderfit.engine.timeline import scenario_metrics
from orderfit.engine.tolerance import delay_scan, minimum_deposit_pct, ranking_by_delay
from orderfit.engine.validation import (
    AnalysisLimit,
    Budget,
    NeedsInput,
    Unsupported,
    admit,
    validate_case,
)

ENGINE_VERSION = "engine-0.2.1"


def calculate(case: dict, check_bruteforce: bool = True) -> dict:
    exp = case.get("exponent", 2)
    out = {}
    try:
        flags, blocks = validate_case(case)
    except NeedsInput as e:
        v = voi(case) if case.get("uncertain_inputs") else []
        out.update(
            decision="needs_input",
            escalations=[{"code": e.code, "message": e.message}],
            flags=[],
            recommended=None,
        )
        out["voi"] = v
        return out
    except Unsupported as e:
        out.update(
            decision="unsupported_escalate",
            escalations=[{"code": e.code, "message": e.message}],
            flags=[],
            recommended=None,
        )
        return out
    flags = flags + coverage_and_duplicate_warnings(case)
    out["flags"] = flags
    if blocks:
        out.update(decision="blocked_data_conflict", escalations=blocks, recommended=None)
        return out
    try:
        admit(case)
        cache: dict = {}
        strategies = enumerate_strategies(case, cache)
        results = []
        ecache: dict = {}
        for st in strategies:
            r = evaluate(case, st, ecache, check_bruteforce)
            if r is not None:
                results.append(r)
    except Unsupported as e:
        out.update(
            decision="unsupported_escalate",
            escalations=[{"code": e.code, "message": e.message}],
            recommended=None,
        )
        return out
    need = target_level(case)
    baseline_res = next(r for r in results if r["strategy"].kind == "decline")
    escalations = []
    if baseline_res["scen"]["base"]["absolute_gap_vs_reserve"] > 0:
        escalations.append(
            {
                "code": "E-PRE-EXISTING-BREACH",
                "message": f"baseline (without the order) already breaches the reserve from {baseline_res['scen']['base']['first_shortfall_date']}; flagged separately from order impact",
            }
        )
    feasible, rejected = [], []
    for r in results:
        if r["strategy"].kind == "decline":
            continue
        ok, why = hard_ok(r, case)
        (feasible if ok else rejected).append((r, why))
    feasible, n_dominated = prune_dominated(feasible)
    ranked = sorted(feasible, key=lambda x: priority_key(x[0], case, x[0]["resilience"] >= need))
    accept_res = next(
        (r for r, _ in feasible + rejected if r["strategy"].id == "accept_as_is"), None
    )
    out["baseline"] = summarize(baseline_res, exp)
    out["accept_as_is"] = summarize(accept_res, exp) if accept_res else None
    used = {r["strategy"].offer_id for r in results if r["strategy"].offer_id}
    out["offers_without_feasible_amount"] = [
        x["offer_id"]
        for x in case["financing_offers"]
        if x["offer_id"] in case["strategy_space"].get("offer_ids", [])
        and x["offer_id"] not in used
    ]
    out["counts"] = {
        "enumerated": len(results),
        "hard_feasible_after_dominance_pruning": len(feasible),
        "dominated_pruned": n_dominated,
        "rejected": len(rejected),
    }
    out["hard_rejection_reasons"] = {}
    for _r, why in rejected:
        for w in why:
            out["hard_rejection_reasons"][w] = out["hard_rejection_reasons"].get(w, 0) + 1
    out["ranked_top"] = [
        summarize(r, exp) | {"meets_target_resilience": r["resilience"] >= need}
        for r, _ in ranked[:6]
    ]
    if ranked:
        best_profit = max(r["net_profit"] for r, _ in ranked)
        out["profit_given_up_for_resilience"] = best_profit - ranked[0][0]["net_profit"]
        out["best_profit_strategy"] = max(
            (r for r, _ in ranked), key=lambda r: (r["net_profit"], r["strategy"].id)
        )["strategy"].id
    if not ranked:
        out["decision"] = "decline_or_renegotiate"
        out["recommended"] = "decline"
        mind = minimum_deposit_pct(case)
        accept_gap = accept_res["scen"]["base"]["max_funding_gap"] if accept_res else None
        cash_ok_only_profit = [
            r
            for r, why in rejected
            if why == ["min_order_profit"]
            or (
                why
                and set(why) <= {"min_order_profit", "financing_cost_cap"}
                and "min_order_profit" in why
            )
        ]
        if cash_ok_only_profit:
            best_cash = max(cash_ok_only_profit, key=lambda r: r["net_profit"])
            escalations.append(
                {
                    "code": "E-UNPROFITABLE-AFTER-COSTS",
                    "message": "cash-feasible strategies exist but none clears the owner's minimum order profit",
                    "best_cash_feasible": best_cash["strategy"].id,
                    "its_net_profit": best_cash["net_profit"],
                    "owner_min_order_profit": case["owner"].get("min_order_profit", 0),
                }
            )
        else:
            escalations.append(
                {
                    "code": "E-NO-FEASIBLE",
                    "message": "no enumerated strategy satisfies the hard constraints",
                    "max_funding_gap_accept_as_is": accept_gap,
                    "min_deposit_pct_alone": mind,
                }
            )
            full = scenario_metrics(case, Strategy("plan", deposit_pct=100), BASE_SC, {}, "base")
            out["minimum_change"] = {
                "max_funding_gap_accept_as_is": accept_gap,
                "min_deposit_pct_with_no_other_lever": mind,
                "first_violation_date_even_with_100pct_deposit": full["first_violation_date"]
                if full
                else None,
            }
    else:
        top, _ = ranked[0]
        out["recommended"] = top["strategy"].id
        nofin = next((r for r, _ in ranked if not r["strategy"].offer_id), None)
        out["best_without_financing"] = nofin["strategy"].id if nofin else None
        out["decision"] = (
            "accept_as_is" if top["strategy"].id == "accept_as_is" else "accept_with_changes"
        )
        if top["resilience"] < need:
            robust_pct = None
            for pct in range(0, 101):
                r_ = evaluate(case, Strategy("plan", deposit_pct=pct), {}, False)
                if r_ is not None and r_["resilience"] >= need and hard_ok(r_, case)[0]:
                    robust_pct = pct
                    break
            escalations.append(
                {
                    "code": "E-FRAGILE-BEST",
                    "message": f"best strategy {top['strategy'].id} passes {top['resilience'] - 1} of the target {need - 1} stress scenarios; owner review required",
                    "customer_deposit_pct_that_would_make_a_deposit_only_plan_robust": robust_pct,
                }
            )
        a = ranked[0][0]
        margin = max(
            1, apply_bps(abs(a["net_profit"]) or 1, case["owner"].get("close_call_bps", 200))
        )
        keys = set(
            case["owner"].get("priorities", ["profit", "independence_any", "simplicity"])
        ) | {"robustness"}
        keys.discard("profit")
        for b, _ in ranked[1:]:
            if not (0 < a["net_profit"] - b["net_profit"] <= margin):
                continue
            if (
                a["strategy"].dependencies == b["strategy"].dependencies
                or b["resilience"] < need
                or a["resilience"] < need
            ):
                continue
            if lever_items(a["strategy"]) < lever_items(b["strategy"]):
                continue  # the runner-up is the top plan plus extra levers (an add-on), not an alternative
            better = sorted(k for k in keys if key_metric(b, k) < key_metric(a, k))
            if better:
                escalations.append(
                    {
                        "code": "E-CLOSE-CALL",
                        "message": f"{a['strategy'].id} and {b['strategy'].id} are within {case['owner'].get('close_call_bps', 200)} bps on profit with different dependencies; the runner-up is better on: {', '.join(better)}",
                        "top": a["strategy"].id,
                        "runner_up": b["strategy"].id,
                        "runner_up_better_on": better,
                    }
                )
                break
        shortlist = [r["strategy"] for r, _ in ranked[:40]]
        out["delay_scan_top"] = delay_scan(case, top["strategy"], case.get("scan_days", 90), {})
        out["best_plan_by_receipt_delay"] = ranking_by_delay(
            case, shortlist, case.get("scan_days", 90)
        )
        if case.get("uncertain_inputs"):
            out["voi"] = voi(case)
            if any(v["flips_decision"] for v in out["voi"]):
                escalations.append(
                    {
                        "code": "E-ASK-INPUT",
                        "message": "an unresolved input would change the recommended strategy; ask the owner before presenting a recommendation",
                    }
                )
                out["decision"] = "needs_input"
    out["escalations"] = escalations
    out["escalate"] = bool(escalations)
    alerts = {
        "baseline": [],
        "accept_as_is": alerts_for(case, accept_res) if accept_res else [],
        "recommended": [],
    }
    if baseline_res["scen"]["base"]["absolute_gap_vs_reserve"] > 0:
        alerts["baseline"].append(
            {
                "rule": "A6",
                "message": "pre-existing breach",
                "first_shortfall_date": baseline_res["scen"]["base"]["first_shortfall_date"],
            }
        )
    rec_row = next((r for r, _ in ranked if r["strategy"].id == out.get("recommended")), None)
    if rec_row:
        alerts["recommended"] = alerts_for(case, rec_row)
    out["alerts"] = alerts
    out["profit_summary"] = {
        "order_revenue": case["order"]["revenue"],
        "incremental_cost": sum(
            c["amount"] for c in case["order"]["costs"] if c.get("incremental", True)
        ),
        "order_profit_before_financing": case["order"]["revenue"]
        - sum(c["amount"] for c in case["order"]["costs"] if c.get("incremental", True)),
        "excluded_non_incremental_costs": [
            c["id"] for c in case["order"]["costs"] if not c.get("incremental", True)
        ],
    }
    out["_catalogue"] = results
    out["_rank_ids"] = [r["strategy"].id for r, _ in ranked]
    if case.get("sensitivity"):
        out["assumption_sensitivity"] = assumption_sensitivity(case, out.get("recommended"))
    return out


def breach_intervals(points, gap):
    """Group consecutive daily breaches without losing the worst intraday gap."""
    intervals = []
    current = None
    for point in points:
        amount = gap(point)
        if amount > 0:
            if current is None:
                current = {"start": point.date, "end": point.date, "days": 1, "max_gap": amount}
            else:
                current["end"] = point.date
                current["days"] += 1
                current["max_gap"] = max(current["max_gap"], amount)
        elif current is not None:
            intervals.append(BreachInterval(**current))
            current = None
    if current is not None:
        intervals.append(BreachInterval(**current))
    return intervals


def analyse(engine_input: EngineInput) -> Result:
    """Analyze a validated financial value; never returns partial search as a plan."""
    # Revalidate even model_copy/model_construct values at this public boundary.
    engine_input = EngineInput.model_validate(engine_input.model_dump(mode="python"))
    payload = engine_input.model_dump(mode="json", exclude_none=True)
    digest = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    ).hexdigest()
    budget = Budget(engine_input.max_work_units)
    payload["_budget"] = budget
    try:
        raw = calculate(payload, check_bruteforce=False)
        originals = raw.pop("_catalogue", [])
        ranks = {key: index + 1 for index, key in enumerate(raw.pop("_rank_ids", []))}
        catalogue = []
        for row in originals:
            ok, why = hard_ok(row, payload)
            scan = (
                raw["delay_scan_top"]
                if row["strategy"].id == raw.get("recommended") and "delay_scan_top" in raw
                else delay_scan(payload, row["strategy"], engine_input.scan_days, {})
            )
            first_failure = scan["first_failing_delay_days"]
            tolerance = Tolerance(
                status="capped_scan"
                if first_failure is None
                else ("fails_on_time" if first_failure == 0 else "first_failure"),
                observed_safe_days=scan["tolerance_days"],
                first_failure_days=first_failure,
                scan_cap_days=engine_input.scan_days,
            )
            scenarios = {}
            series = {}
            for name, metric in row["scen"].items():
                baseline = next(r for r in originals if r["strategy"].kind == "decline")["scen"][
                    name
                ]["_series"]
                series[name] = [
                    SeriesPoint(
                        date=day,
                        baseline_trough=baseline[day][0],
                        baseline_close=baseline[day][1],
                        candidate_trough=tr,
                        candidate_close=close,
                        reserve=engine_input.reserve,
                        effective_floor=min(engine_input.reserve, baseline[day][0]),
                    )
                    for day, (tr, close) in metric["_series"].items()
                ]
                scenarios[name] = ScenarioMetrics(
                    **{k: v for k, v in metric.items() if not k.startswith("_")},
                    inherited_baseline_breaches=breach_intervals(
                        series[name], lambda p: p.reserve - p.baseline_trough
                    ),
                    order_caused_breaches=breach_intervals(
                        series[name], lambda p: p.effective_floor - p.candidate_trough
                    ),
                )
            catalogue.append(
                Candidate(
                    strategy=row["strategy"],
                    net_profit=row["net_profit"],
                    profit_before_financing=row["profit_before_financing"],
                    financing_cost=row["financing_cost"],
                    concession=row["concession"],
                    surcharge=row["surcharge"],
                    revenue_net=row["revenue_net"],
                    resilience=row["resilience"],
                    excluded_costs=row["excluded_costs"],
                    scenarios=scenarios,
                    series=series,
                    hard_feasible=ok,
                    hard_failures=why,
                    rank=ranks.get(row["strategy"].id),
                    eligible_cost_keys=[
                        c["id"]
                        for c in payload["order"]["costs"]
                        if c["incremental"] and c["deferrable"] and row["strategy"].ext_days
                    ],
                    events={name: metric["_events"] for name, metric in row["scen"].items()},
                    tolerance=tolerance,
                )
            )
        if "delay_scan_top" in raw:
            scan = raw["delay_scan_top"]
            scan["status"] = (
                "capped_scan"
                if scan["first_failing_delay_days"] is None
                else ("fails_on_time" if scan["first_failing_delay_days"] == 0 else "first_failure")
            )
        return Result(
            calculator_version=ENGINE_VERSION,
            input_hash=digest,
            horizon_end=payload.get("_horizon"),
            decision=raw["decision"],
            recommended=raw.get("recommended"),
            catalogue=catalogue,
            diagnostics=raw,
            work_units=budget.used,
            tolerance=Tolerance(
                status=raw["delay_scan_top"]["status"],
                observed_safe_days=raw["delay_scan_top"]["tolerance_days"],
                first_failure_days=raw["delay_scan_top"]["first_failing_delay_days"],
                scan_cap_days=engine_input.scan_days,
            )
            if "delay_scan_top" in raw
            else None,
        )
    except AnalysisLimit as exc:
        return Result(
            calculator_version=ENGINE_VERSION,
            input_hash=digest,
            horizon_end=None,
            decision="analysis_limit",
            recommended=None,
            catalogue=[],
            diagnostics={"reason": str(exc)},
            work_units=budget.used,
        )

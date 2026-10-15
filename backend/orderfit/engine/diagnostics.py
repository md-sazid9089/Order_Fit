"""Deterministic alerts, sensitivity and bounded value-of-information reruns."""

from __future__ import annotations

import json
from datetime import timedelta

from orderfit.engine.events import anchor_date
from orderfit.engine.utilities import d, deep_copy, set_path


def coverage_and_duplicate_warnings(case: dict) -> list[dict]:
    """Warnings only (never blocking): baseline data ends before the last possible order event; a possible duplicate without invoice_ref."""
    flags = []
    o = case["order"]
    try:
        last_base = max(d(e["date"]) for e in case["baseline_events"])
        max_delay = max(
            [0] + [s.get("order_receipt_delay_days", 0) for s in case["scenarios"].values()]
        )
        needed = anchor_date(o, o["terms"]["anchor"]) + timedelta(
            days=o["terms"]["days"] + max_delay
        )
        if last_base < needed:
            flags.append(
                {
                    "code": "W-BASELINE-COVERAGE",
                    "message": f"baseline events end on {last_base}; the order's last possible receipt is {needed}: obligations after the data ends are not modelled",
                }
            )
    except (KeyError, ValueError):
        pass
    for c in o["costs"]:
        if not c.get("incremental", True) or c.get("invoice_ref"):
            continue
        for e in case["baseline_events"]:
            if (
                e["amount"] == c["amount"]
                and e["direction"] == "out"
                and abs((d(e["date"]) - d(c["date"])).days) <= 3
            ):
                flags.append(
                    {
                        "code": "W-POSSIBLE-DUPLICATE",
                        "message": f"order cost {c['id']} has the same amount as baseline event {e['id']} within 3 days: counted once only if it is the same obligation",
                    }
                )
    return flags


def alerts_for(case: dict, res: dict) -> list[dict]:
    """A1 reserve breach and A2 payment before receipt for one strategy in the base scenario (A5 is a workflow alert)."""
    m = res["scen"]["base"]
    series, reserve, alerts = m["_series"], case["reserve"], []
    if m["first_shortfall_date"]:
        day = d(m["first_shortfall_date"])
        alerts.append(
            {
                "rule": "A1",
                "date": day.isoformat(),
                "balance_that_day": series[day][0],
                "gap_to_reserve": reserve - series[day][0],
            }
        )
    if m["first_violation_date"]:
        v = d(m["first_violation_date"])
        funding = None
        for dy in sorted({e.date for e in m["_events"] if e.direction == "in" and e.date > v}):
            if series[dy][1] >= reserve:
                funding = dy
                break
        alerts.append(
            {
                "rule": "A2",
                "first_violation_date": v.isoformat(),
                "next_inflow_that_restores_the_reserve": funding.isoformat() if funding else None,
                "days_exposed": (funding - v).days if funding else None,
            }
        )
    return alerts


def assumption_sensitivity(case: dict, base_rec) -> dict:
    """Re-run the analysis with each assumed parameter at stated values and report where the recommendation changes."""
    from orderfit.engine.analyse import calculate as analyse

    runs = []
    for spec in case["sensitivity"]:
        for v in spec["values"]:
            c2 = deep_copy(case)
            c2["sensitivity"] = []
            c2["scan_days"] = 0
            set_path(c2, spec["path"], v)
            r = analyse(c2, check_bruteforce=False)
            runs.append(
                {
                    "path": spec["path"],
                    "value": v,
                    "decision": r["decision"],
                    "recommended": r.get("recommended"),
                    "escalations": [e["code"] for e in r.get("escalations", [])],
                }
            )
    return {
        "baseline_recommended": base_rec,
        "runs": runs,
        "recommendation_changes_at": [x for x in runs if x["recommended"] != base_rec],
    }


def voi(case: dict) -> list[dict]:
    """Value of information: would resolving an uncertain input change the recommendation?"""
    from orderfit.engine.analyse import calculate as analyse

    res = []
    for u in case.get("uncertain_inputs", []):
        tops = {}
        for alt in u["alternatives"]:
            c2 = deep_copy(case)
            c2["uncertain_inputs"] = []
            for path, val in alt["patch"].items():
                set_path(c2, path, val)
            r = analyse(c2, check_bruteforce=False)
            tops[alt["label"]] = {
                "decision": r["decision"],
                "recommended": r.get("recommended"),
                "accept_as_is_feasible": (r.get("accept_as_is") or {})
                .get("base", {})
                .get("feasible"),
            }
        distinct = {json.dumps(v, sort_keys=True) for v in tops.values()}
        res.append({"input": u["id"], "alternatives": tops, "flips_decision": len(distinct) > 1})
    return res

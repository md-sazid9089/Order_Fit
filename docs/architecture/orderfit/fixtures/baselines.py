"""Reference baselines B0, B1 and B4 on the core fixtures (stdlib only). Run after reference_engine.py: python baselines.py
These describe the FIXTURES, which the team wrote; they are not evidence about real owners.

B0 profit-only         accept as offered if the order's profit is positive, otherwise decline.
B1 fixed rule          accept as offered if the as-is lowest balance keeps the reserve, otherwise decline.
B4 greedy ladder       accept as offered if feasible; otherwise the smallest feasible deposit alone, then a supplier extension
                       alone, then the smallest loan alone, then decline. (Added after the independent review showed that a
                       five-line rule often matches the engine; the point is to say where it does and where it does not.)
"""
from __future__ import annotations

import glob
import json
from pathlib import Path

import reference_engine as R

HERE = Path(__file__).parent


def greedy_ladder(case: dict) -> R.Strategy:
    sp = case["strategy_space"]
    cands = [R.Strategy("plan")]
    cands += [R.Strategy("plan", deposit_pct=p) for p in sorted(sp.get("deposit_pcts", [])) if p > 0]
    cands += [R.Strategy("plan", ext_days=x["days"], ext_surcharge_bps=x.get("surcharge_bps", 0)) for x in sp.get("extensions", []) if x["days"] > 0]
    for st in cands:
        m = R.scenario_metrics(case, st, R.BASE_SC, {}, "base")
        if m and m["feasible"]:
            return st
    for off in case["financing_offers"]:
        if off["offer_id"] not in sp.get("offer_ids", []):
            continue
        P = off["min"]
        while P <= off["max"]:
            st = R.Strategy("plan", offer_id=off["offer_id"], loan_minor=P)
            m = R.scenario_metrics(case, st, R.BASE_SC, {}, "base")
            if m and m["feasible"]:
                return st
            P += off["step"]
    return R.Strategy(kind="decline")


def describe(case: dict, st: R.Strategy) -> dict:
    r = R.evaluate(case, st, {}, False)
    ok, why = R.hard_ok(r, case) if st.kind != "decline" else (True, [])
    return {"id": st.id, "base_feasible": r["scen"]["base"]["feasible"], "level": r["resilience"], "meets_target": r["resilience"] >= R.target_level(case),
            "net_profit": r["net_profit"], "hard_ok": ok}


def main():
    rows = []
    for p in sorted(glob.glob(str(HERE / "cases" / "OF-*.json"))):
        case = json.loads(Path(p).read_text(encoding="utf-8"))
        exp = json.loads((HERE / "expected" / f"{case['case_id']}.json").read_text(encoding="utf-8"))
        if exp["decision"] not in ("accept_as_is", "accept_with_changes", "decline_or_renegotiate"):
            continue
        case = dict(case, sensitivity=[])
        asis = R.Strategy("plan")
        a = R.evaluate(case, asis, {}, False)
        b0 = asis if a["net_profit"] > 0 else R.Strategy(kind="decline")
        b1 = asis if a["scen"]["base"]["feasible"] else R.Strategy(kind="decline")
        b4 = greedy_ladder(case)
        eng_id = exp["recommended"]
        eng = describe(case, next(s for s in R.enumerate_strategies(case, {}) if s.id == eng_id)) if eng_id else None
        rows.append({"case": case["case_id"], "engine": eng, "B0": describe(case, b0), "B1": describe(case, b1), "B4": describe(case, b4)})
    lines = ["# Reference baselines on the core fixtures (generated)", "",
             "Written by `baselines.py`. These describe the fixtures, which the team wrote; they are not evidence about real owners.", "",
             "| Case | Engine | B0 profit-only | B1 fixed rule | B4 greedy ladder |", "|---|---|---|---|---|"]

    def cell(d):
        return f"`{d['id']}` (L{d['level']}, {'feasible' if d['base_feasible'] else 'BREACHES reserve'}, {'meets target' if d['meets_target'] else 'below target'})"
    n = len(rows)
    for r in rows:
        lines.append(f"| {r['case']} | {cell(r['engine']) if r['engine'] else '-'} | {cell(r['B0'])} | {cell(r['B1'])} | {cell(r['B4'])} |")
    stats = {}
    for k in ("B0", "B1", "B4"):
        stats[k] = {
            "breaches_reserve_in_base": sum(1 for r in rows if not r[k]["base_feasible"]),
            "below_target_resilience": sum(1 for r in rows if r[k]["base_feasible"] and not r[k]["meets_target"] and r["engine"] and r["engine"]["meets_target"]),
            "same_plan_as_engine": sum(1 for r in rows if r["engine"] and r[k]["id"] == r["engine"]["id"]),
            "forgoes_profit_vs_engine": sum(1 for r in rows if r["engine"] and r["engine"]["id"] != "decline" and r[k]["id"] == "decline"),
            "violates_a_hard_constraint": sum(1 for r in rows if not r[k]["hard_ok"]),
        }
    lines += ["", f"Analysable core fixtures: {n} (the others are blocked, ask, or unsupported by design).", ""]
    lines.append("| Baseline | breaches the reserve in the base case | breaks any hard constraint (reserve, minimum profit, cost cap) | feasible but below the owner's target while the engine's plan meets it | same plan as the engine | declines where the engine finds a feasible plan |")
    lines.append("|---|---:|---:|---:|---:|---:|")
    for k, v in stats.items():
        lines.append(f"| {k} | {v['breaches_reserve_in_base']} | {v['violates_a_hard_constraint']} | {v['below_target_resilience']} | {v['same_plan_as_engine']} | {v['forgoes_profit_vs_engine']} |")
    (HERE / "baselines.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()

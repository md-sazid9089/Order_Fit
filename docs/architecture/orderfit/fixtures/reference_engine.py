"""OrderFit reference calculation (design-sprint artefact, NOT application code).

Python standard library only. Purpose: (1) fix the financial semantics in executable form,
(2) produce every number that appears in the worked example and in the fixture catalogue,
(3) act as the independent oracle the production engine must match.

Conventions (see 04-decision-engine-and-data-contracts.md):
- Money = int minor units, one currency per case, one rounding rule (round half up on bps).
- Dates = calendar dates; terms are calendar days from a named anchor event.
- Same-day events: outflows are applied before inflows.
- Hard constraint is checked on EVERY calendar day of the horizon, relative to the
  counterfactual baseline: balance(t) >= min(reserve, baseline_balance(t)).
- No probabilities. Scenarios are user-specified shifts; certainty classes are treated differently.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import sys
import unicodedata
from dataclasses import dataclass, replace
from datetime import date, timedelta
from pathlib import Path

CALC_VERSION = "ref-0.1.0"
BPS = 10_000
OUT, IN = "out", "in"

# kinds whose date moves under a receipt-delay scenario
SHIFTED_BY_ORDER_DELAY = {"order_final_receipt", "order_stage_receipt"}
SHIFTED_BY_AR_DELAY = {"ar_collection"}
HAIRCUT_KINDS = {"order_final_receipt", "order_stage_receipt"}
COST_KINDS = {"supplier_payment", "labour", "freight", "subcontract"}


class Unsupported(Exception):
    """Input is outside the supported semantics: escalate, never guess."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class NeedsInput(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# ----------------------------------------------------------------------------- money

def apply_bps(amount: int, bps: int) -> int:
    """amount * bps / 10_000 rounded half up. The single rounding rule."""
    if amount < 0 or bps < 0:
        raise ValueError("apply_bps takes non-negative inputs")
    return (amount * bps + BPS // 2) // BPS


def split_exact(total: int, parts: int) -> list[int]:
    """Split into `parts` integer pieces that sum exactly to total (remainder on the last)."""
    base = total // parts
    out = [base] * parts
    out[-1] = total - base * (parts - 1)
    return out


def fmt(minor: int, exponent: int = 2) -> str:
    sign = "-" if minor < 0 else ""
    minor = abs(minor)
    whole, frac = divmod(minor, 10**exponent)
    return f"{sign}{whole:,}.{frac:0{exponent}d}" if exponent else f"{sign}{whole:,}"


def d(s: str) -> date:
    return date.fromisoformat(s)


# ----------------------------------------------------------------------------- events

@dataclass(frozen=True)
class Ev:
    id: str
    date: date
    amount: int
    direction: str
    kind: str
    certainty: str = "confirmed"  # confirmed | expected | assumed
    scope: str = "baseline"  # baseline | order | financing

    def moved(self, days: int) -> Ev:
        return replace(self, date=self.date + timedelta(days=days))


def parse_events(rows: list[dict], scope: str, default_ccy: str) -> list[Ev]:
    evs = []
    for r in rows:
        if r.get("ccy", default_ccy) != default_ccy:
            raise Unsupported("E-UNSUPPORTED-MULTICCY", f"event {r['id']} is in {r['ccy']} but case currency is {default_ccy}; no FX rate supplied")
        if r["amount"] <= 0:
            raise Unsupported("E-INVALID-AMOUNT", f"event {r['id']} has non-positive amount")
        evs.append(Ev(r["id"], d(r["date"]), r["amount"], r["direction"], r["kind"], r.get("certainty", "confirmed"), scope))
    return evs


# ----------------------------------------------------------------------------- timeline

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


# ----------------------------------------------------------------------------- case helpers

def get_path(obj, path: str):
    for part in path.split("."):
        obj = obj[part]
    return obj


def set_path(obj, path: str, value):
    parts = path.split(".")
    for part in parts[:-1]:
        obj = obj[part]
    obj[parts[-1]] = value


def deep_copy(x):
    return json.loads(json.dumps(x))


@dataclass(frozen=True)
class Strategy:
    kind: str = "plan"  # plan | decline
    deposit_pct: int = 0
    ext_days: int = 0
    ext_surcharge_bps: int = 0
    stages: int = 1
    defer_days: int = 0
    offer_id: str | None = None
    loan_minor: int = 0
    sized_for: str | None = None  # base | downside | None

    @property
    def id(self) -> str:
        if self.kind == "decline":
            return "decline"
        parts = []
        if self.defer_days:
            parts.append(f"defer{self.defer_days}")
        if self.deposit_pct:
            parts.append(f"dep{self.deposit_pct}")
        if self.ext_days:
            parts.append(f"ext{self.ext_days}" + (f"s{self.ext_surcharge_bps}" if self.ext_surcharge_bps else ""))
        if self.stages > 1:
            parts.append(f"stg{self.stages}")
        if self.offer_id:
            parts.append(f"fin:{self.offer_id}@{self.loan_minor}")
        return "+".join(parts) if parts else "accept_as_is"

    @property
    def dependencies(self) -> tuple[str, ...]:
        deps = []
        if self.deposit_pct or self.stages > 1:
            deps.append("customer")
        if self.ext_days:
            deps.append("supplier")
        if self.offer_id:
            deps.append("lender")
        return tuple(deps)

    @property
    def n_levers(self) -> int:
        return sum(bool(x) for x in (self.deposit_pct, self.ext_days, self.stages > 1, self.offer_id, self.defer_days))


# ----------------------------------------------------------------------------- validation

INJECTION_PATTERNS = [
    r"ignore\s+(?:(?:all|any|the|previous|prior)\s+)?[^.]{0,40}(rule|instruction|reserve|constraint)",
    r"disregard[^.]{0,40}(rule|instruction|reserve|constraint)",
    r"(you are|act as) (now )?(an? )?(system|admin|assistant|agent)",
    r"approve (this|the) (order|plan|payment) (immediately|without)",
    r"reveal[^.]{0,30}(prompt|secret|key|password)",
    r"(transfer|wire|send) (the )?(funds|money|payment)[^.]{0,40}(account|iban)",
    r"system prompt",
]


def injection_scan(text: str) -> list[str]:
    """Deliberately simple flagger. It is a signal for the owner, never the defence:
    the defence is that document text can only populate typed, owner-confirmed fields."""
    hits = []
    low = text.lower()
    for p in INJECTION_PATTERNS:
        m = re.search(p, low)
        if m:
            hits.append(m.group(0)[:80])
    return hits


def validate_case(case: dict) -> tuple[list[dict], list[dict]]:
    """Returns (flags, blocking_errors). Pure rules, no AI."""
    flags: list[dict] = []
    blocks: list[dict] = []
    o = case["order"]
    # PO vs quote total
    if "po_total" in o and "quote_total" in o and o["po_total"] != o["quote_total"]:
        blocks.append({"code": "E-DATA-CONFLICT", "message": f"PO total {o['po_total']} != quote total {o['quote_total']}"})
    if "line_items" in o:
        s = sum(q * p for q, p in o["line_items"])
        if s != o["revenue"]:
            blocks.append({"code": "E-DATA-CONFLICT", "message": f"line items sum {s} != order revenue {o['revenue']}"})
        if any(q <= 0 for q, _ in o["line_items"]):
            blocks.append({"code": "E-INVALID-QUANTITY", "message": "non-positive quantity on a line item"})
    # duplicate obligation: an order cost that re-states an AP invoice already in baseline
    base_refs = {e.get("invoice_ref") for e in case["baseline_events"] if e.get("invoice_ref")}
    for c in o["costs"]:
        if c.get("invoice_ref") and c["invoice_ref"] in base_refs:
            blocks.append({"code": "E-DUPLICATE-OBLIGATION", "message": f"cost {c['id']} duplicates baseline invoice {c['invoice_ref']} (counted once only)"})
    for c in o["costs"]:
        if c.get("ccy", case["currency"]) != case["currency"]:
            raise Unsupported("E-UNSUPPORTED-MULTICCY", f"cost {c['id']} is in {c['ccy']} but case currency is {case['currency']}; no FX rate supplied")
    # terms
    t = o["terms"]
    if t.get("convention", "calendar") != "calendar":
        raise Unsupported("E-UNSUPPORTED-CONVENTION", f"business-day convention {t['convention']} is not supported in MVP")
    if t.get("anchor") in (None, "unknown"):
        raise NeedsInput("E-MISSING-ANCHOR", "payment-term anchor event is unknown; ask the owner")
    if o["anchor_dates"].get(t["anchor"]) is None:
        raise NeedsInput("E-MISSING-ANCHOR-DATE", f"no date for anchor '{t['anchor']}'")
    if "tax_lines" in o:
        raise Unsupported("E-UNSUPPORTED-TAX", "tax lines present; tax treatment is out of scope")
    # dates in the past
    as_of = d(case["as_of"])
    for e in case["baseline_events"] + o["costs"]:
        if d(e["date"]) < as_of:
            blocks.append({"code": "E-DATE-IN-PAST", "message": f"event {e['id']} dated before as_of"})
    # injection text
    for name, text in case.get("documents", {}).items():
        hits = injection_scan(text)
        if hits:
            flags.append({"code": "F-INJECTION", "message": f"document '{name}' contains instruction-like text", "evidence": hits, "effect": "none: document text cannot change typed fields or constraints"})
    return flags, blocks


# ----------------------------------------------------------------------------- order and financing events

def anchor_date(o: dict, name: str) -> date:
    return d(o["anchor_dates"][name])


def receipt_schedule(case: dict, st: Strategy):
    """Returns list of (id, kind, date, amount) for customer receipts under the strategy, and net revenue."""
    o = case["order"]
    sp = case["strategy_space"]
    revenue = o["revenue"]
    # concession the customer asks for a deposit: a flat part plus a part that grows with the size of the deposit
    disc_bps = (o.get("deposit_discount_bps", 0) + (o.get("deposit_discount_bps_per_10pct", 0) * st.deposit_pct) // 10) if st.deposit_pct > 0 else 0
    discount = apply_bps(revenue, disc_bps)
    net_rev = revenue - discount
    deposit = apply_bps(net_rev, st.deposit_pct * 100)
    remaining = net_rev - deposit
    shift = timedelta(days=st.defer_days)
    out = []
    if deposit > 0:
        out.append(("order_deposit", "order_deposit", anchor_date(o, "order") + timedelta(days=sp.get("deposit_lead_days", 7)) + shift, deposit))
    term = o["terms"]
    anchor = anchor_date(o, term["anchor"])
    parts = split_exact(remaining, st.stages)
    gap = sp.get("stage_gap_days", 14)
    for k, amt in enumerate(parts):
        stage_anchor = anchor + timedelta(days=k * gap)
        rdate = stage_anchor + timedelta(days=term["days"]) + shift
        kind = "order_final_receipt" if st.stages == 1 else "order_stage_receipt"
        out.append((f"order_receipt_{k+1}", kind, rdate, amt))
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


def financing_events(case: dict, st: Strategy, receipt_evs: list[Ev]):
    """Proceeds, fee, interest, repayment as separate dated events. Terms only from the supplied offer."""
    if not st.offer_id:
        return [], 0, None
    offer = next(x for x in case["financing_offers"] if x["offer_id"] == st.offer_id)
    as_of = d(case["as_of"])
    P = st.loan_minor
    evs = []
    if offer["shape"] == "term_loan":
        draw = max(as_of + timedelta(days=offer.get("lead_days", 0)), d(offer["available_from"]) if offer.get("available_from") else as_of)
        if offer.get("valid_until") and draw > d(offer["valid_until"]):
            return None, 0, None  # the offer expires before it could be drawn: ineligible
        repay = draw + timedelta(days=offer["term_days"])
        fee = apply_bps(P, offer.get("fee_bps", 0)) + offer.get("fee_flat", 0)
        interest = apply_bps(P, offer.get("interest_bps", 0))
    elif offer["shape"] == "receivable_advance":
        o = case["order"]
        draw = max(as_of + timedelta(days=offer.get("lead_days", 0)), anchor_date(o, offer.get("available_from_anchor", "invoice")))
        draw += timedelta(days=st.defer_days) if offer.get("available_from_anchor") else timedelta(0)
        order_receipts = [e for e in receipt_evs if e.kind in ("order_final_receipt", "order_stage_receipt")]
        if not order_receipts:
            return [], 0, None
        repay = max(e.date for e in order_receipts)  # repaid when the last customer payment lands
        days_out = max((repay - draw).days, 0)
        fee = apply_bps(P, offer.get("fee_bps", 0)) + offer.get("fee_flat", 0) + apply_bps(P, offer.get("per30_bps", 0)) * math.ceil(days_out / 30)
        interest = 0
    else:
        raise Unsupported("E-UNSUPPORTED-FINANCING", f"unknown financing shape {offer['shape']}")
    if repay <= draw:
        return None, 0, None  # invalid timing
    evs.append(Ev("loan_draw", draw, P, IN, "loan_draw", "confirmed", "financing"))
    fee_date = draw if offer.get("fee_at") == "draw" else repay
    if fee > 0:
        evs.append(Ev("loan_fee", fee_date, fee, OUT, "loan_fee", "confirmed", "financing"))
    if interest > 0:
        evs.append(Ev("loan_interest", repay, interest, OUT, "loan_interest", "confirmed", "financing"))
    evs.append(Ev("loan_repayment", repay, P, OUT, "loan_repayment", "confirmed", "financing"))
    return evs, fee + interest, offer


# ----------------------------------------------------------------------------- scenarios

def apply_scenario(events: list[Ev], sc: dict) -> list[Ev]:
    """Scenario = user-specified shifts. Non-confirmed customer receipts (and, by default, the deposit, which follows
    the customer's delay) and non-confirmed existing collections move; order costs may overrun. Confirmed events never move."""
    out = []
    follows = sc.get("deposit_follows_customer_delay", True)
    overrun = sc.get("cost_overrun_bps", 0)
    for e in events:
        if e.kind in SHIFTED_BY_ORDER_DELAY and e.certainty != "confirmed":
            e = e.moved(sc.get("order_receipt_delay_days", 0))
            hc = sc.get("order_receipt_haircut_bps", 0)
            if hc and e.kind in HAIRCUT_KINDS:
                e = replace(e, amount=e.amount - apply_bps(e.amount, hc))
        elif e.kind == "order_deposit" and follows and e.certainty != "confirmed":
            e = e.moved(sc.get("order_receipt_delay_days", 0))
        elif e.kind in SHIFTED_BY_AR_DELAY and e.certainty != "confirmed":
            e = e.moved(sc.get("ar_delay_days", 0))
        if overrun and e.scope == "order" and e.direction == OUT and e.kind in COST_KINDS:
            e = replace(e, amount=e.amount + apply_bps(e.amount, overrun))
        out.append(e)
    return out


BASE_SC = {"order_receipt_delay_days": 0, "ar_delay_days": 0, "order_receipt_haircut_bps": 0, "cost_overrun_bps": 0}


def horizon_end(case: dict) -> date:
    """Auto horizon: latest possible event under any scenario/strategy + 30 days buffer."""
    as_of = d(case["as_of"])
    o = case["order"]
    sp = case["strategy_space"]
    latest = max([d(e["date"]) for e in case["baseline_events"]] + [d(c["date"]) for c in o["costs"]] + [anchor_date(o, o["terms"]["anchor"])])
    max_shift = max([0] + [s.get("order_receipt_delay_days", 0) for s in case["scenarios"].values()] + [s.get("ar_delay_days", 0) for s in case["scenarios"].values()])
    max_ext = max([x["days"] for x in sp.get("extensions", [{"days": 0}])])
    max_defer = max(sp.get("defer_days", [0]))
    max_stage = (max(sp.get("stages", [1])) - 1) * sp.get("stage_gap_days", 14)
    fin = max([x.get("term_days", 0) + x.get("lead_days", 0) for x in case["financing_offers"]] + [0])
    end = latest + timedelta(days=o["terms"]["days"] + max_shift + max_ext + max_defer + max_stage + 30)
    return max(end, as_of + timedelta(days=case.get("horizon_days", 0)), as_of + timedelta(days=fin + 30))


# ----------------------------------------------------------------------------- evaluation

def build_events(case: dict, st: Strategy, sc: dict):
    ccy = case["currency"]
    base = parse_events(case["baseline_events"], "baseline", ccy)
    order_evs: list[Ev] = []
    meta = {"revenue_net": 0, "discount": 0, "surcharge": 0, "financing_cost": 0, "excluded_costs": []}
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
        meta.update(revenue_net=net_rev, discount=discount, surcharge=sur, financing_cost=fcost, excluded_costs=excl)
        # receivable advance repays when the *shifted* customer payment lands: rebuild under scenario
        all_events = base + order_evs
        shifted = apply_scenario(all_events, sc)
        if offer and offer["shape"] == "receivable_advance":
            fin2, fcost2, _ = financing_events(case, st, [e for e in shifted if e.scope == "order"])
            if fin2 is None:
                return None, None
            meta["financing_cost"] = fcost2
            fin = fin2
        return shifted + fin, meta
    return apply_scenario(base, sc), meta


def meta_fin_cost(events, meta):
    """Financing cost under the scenario that produced `events` (fee and interest events)."""
    return sum(e.amount for e in events if e.kind in ("loan_fee", "loan_interest"))


def scenario_metrics(case: dict, st: Strategy, sc: dict, base_series_cache: dict, scname: str, check_bruteforce: bool = False):
    events, meta = build_events(case, st, sc)
    if events is None:
        return None
    as_of = d(case["as_of"])
    end = horizon_end(case)
    opening, reserve = case["opening_balance"], case["reserve"]
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
    lowest, lowest_day = min(((tr, dy) for dy, (tr, _) in series.items()), key=lambda x: (x[0], x[1]))
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
    profit_before_fin = (revenue_net - cost_total - meta["surcharge"]) if st.kind != "decline" else 0
    net_profit = profit_before_fin - meta["financing_cost"]
    # resilience level: 0 = fails the base scenario; 1 = base only; 2 = base + downside; 3 = base + downside + severe.
    level = 0
    if res["base"]["feasible"]:
        level = 1
        if res["downside"]["feasible"]:
            level = 2
            if res["severe"]["feasible"]:
                level = 3
    return {"strategy": st, "scen": res, "net_profit": net_profit, "profit_before_financing": profit_before_fin,
            "financing_cost": meta["financing_cost"], "concession": meta["discount"], "surcharge": meta["surcharge"],
            "revenue_net": revenue_net, "resilience": level, "excluded_costs": meta["excluded_costs"]}


def target_level(case: dict) -> int:
    return {"base": 1, "downside": 2, "severe": 3}[case["owner"].get("target_scenario", "downside")]


# ----------------------------------------------------------------------------- strategies

def enumerate_strategies(case: dict, cache: dict):
    sp = case["strategy_space"]
    exts = sp.get("extensions", [{"days": 0, "surcharge_bps": 0}])
    out = [Strategy(kind="decline")]
    offers = [None] + [x for x in case["financing_offers"] if x["offer_id"] in sp.get("offer_ids", [])]
    for defer in sp.get("defer_days", [0]):
        for dep in sp.get("deposit_pcts", [0]):
            for ex in exts:
                for stg in sp.get("stages", [1]):
                    for off in offers:
                        base = Strategy("plan", dep, ex["days"], ex.get("surcharge_bps", 0), stg, defer)
                        if off is None:
                            out.append(base)
                            continue
                        sized = {}
                        P = off["min"]
                        grid = []
                        while P <= off["max"]:
                            grid.append(P)
                            P += off["step"]
                        for sized_for in ("base", "downside", "severe"):
                            tsc = BASE_SC if sized_for == "base" else case["scenarios"][sized_for]
                            for P in grid:
                                cand = replace(base, offer_id=off["offer_id"], loan_minor=P, sized_for=sized_for)
                                mb = scenario_metrics(case, cand, BASE_SC, cache_for(cache, cand, "base"), "base")
                                if mb is None or not mb["feasible"]:
                                    continue  # a hard-feasible plan must hold in the base scenario
                                mt = mb if sized_for == "base" else scenario_metrics(case, cand, tsc, cache_for(cache, cand, sized_for), sized_for)
                                if mt is not None and mt["feasible"]:
                                    sized[sized_for] = cand
                                    break
                        if "base" in sized:
                            out.append(sized["base"])
                            for k in ("downside", "severe"):
                                if k in sized and all(sized[k].loan_minor != o_.loan_minor for o_ in (sized["base"],)):
                                    out.append(sized[k])
    # de-duplicate by id keeping first
    seen, uniq = set(), []
    for s in out:
        if s.id not in seen:
            seen.add(s.id)
            uniq.append(s)
    return uniq


def cache_for(cache: dict, st: Strategy, tag: str):
    return cache.setdefault(("sizing", tag), {})


def key_metric(res: dict, p: str):
    """Lower is better for every priority key."""
    st = res["strategy"]
    return {"profit": -res["net_profit"], "robustness": -res["resilience"], "independence_any": len(st.dependencies),
            "independence_customer": int("customer" in st.dependencies), "simplicity": st.n_levers,
            "low_financing_cost": res["financing_cost"]}[p]


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
            lever_items(o["strategy"]) < a and o["net_profit"] >= r["net_profit"] and o["resilience"] >= r["resilience"]
            and all(o["scen"][k]["lowest_balance"] >= r["scen"][k]["lowest_balance"] for k in ("base", "downside", "severe"))
            for o, _ in rows if o is not r
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
        if o.get("required_delivery_by") and anchor_date(o, "delivery") + timedelta(days=res["strategy"].defer_days) > d(o["required_delivery_by"]):
            why.append("delivery_deadline")
        if o.get("quote_valid_until") and d(case["as_of"]) + timedelta(days=res["strategy"].defer_days) > d(o["quote_valid_until"]):
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


# ----------------------------------------------------------------------------- analysis

def delay_scan(case: dict, st: Strategy, max_delay: int, cache: dict):
    """Linear scan d=0..max_delay of customer-receipt delay. Never binary search (not monotone)."""
    first_fail, tolerance = None, None
    for dd in range(0, max_delay + 1):
        sc = {"order_receipt_delay_days": dd, "ar_delay_days": 0, "order_receipt_haircut_bps": 0}
        m = scenario_metrics(case, st, sc, {}, f"scan{dd}")
        if m is not None and not m["feasible"]:
            first_fail = dd
            break
    tolerance = -1 if first_fail == 0 else (first_fail - 1 if first_fail is not None else max_delay)
    return {"first_failing_delay_days": first_fail, "tolerance_days": tolerance, "survives_full_scan": first_fail is None, "scanned_to": max_delay}


def ranking_by_delay(case: dict, shortlist: list[Strategy], max_delay: int):
    """Best strategy of the (dominance-pruned, base-feasible) shortlist if the customer pays d days late,
    scanned linearly d=0..max_delay. Reports every change of the top choice, and the first delay at which
    no shortlisted strategy satisfies the hard constraint."""
    base_keys = {}
    for st in shortlist:
        base_keys[st.id] = priority_key(evaluate(case, st, {}), case, True)
    seq, last, first_none = [], object(), None
    for dd in range(0, max_delay + 1):
        sc = {"order_receipt_delay_days": dd, "ar_delay_days": 0, "order_receipt_haircut_bps": 0}
        best = None
        for st in shortlist:
            m = scenario_metrics(case, st, sc, {}, f"flip{dd}")
            if m is not None and m["feasible"] and (best is None or base_keys[st.id] < best[0]):
                best = (base_keys[st.id], st.id)
        top = best[1] if best else None
        if top != last:
            seq.append({"from_delay_days": dd, "top": top})
            last = top
        if top is None and first_none is None:
            first_none = dd
    return {"changes": seq, "first_delay_with_no_feasible_shortlisted_strategy": first_none, "scanned_to": max_delay}


def minimum_deposit_pct(case: dict) -> int | None:
    """Smallest customer deposit (1% grid) that satisfies the hard constraint in the base scenario
    with no other lever. Explanatory: 'what would have to change'."""
    for pct in range(0, 101):
        st = Strategy("plan", deposit_pct=pct)
        m = scenario_metrics(case, st, BASE_SC, {}, "base")
        if m and m["feasible"]:
            return pct
    return None


def analyse(case: dict, check_bruteforce: bool = True) -> dict:
    exp = case.get("exponent", 2)
    out = {"case_id": case["case_id"], "calc_version": CALC_VERSION, "input_hash": input_hash(case)}
    try:
        flags, blocks = validate_case(case)
    except NeedsInput as e:
        v = voi(case) if case.get("uncertain_inputs") else []
        if e.code == "E-MISSING-ANCHOR" and v and not any(x["flips_decision"] for x in v):
            # value of information says every reading gives the same recommendation: proceed on the most conservative reading
            alts = case["uncertain_inputs"][0]["alternatives"]

            def receipt_date(alt):
                c3 = deep_copy(case)
                for path, val in alt["patch"].items():
                    set_path(c3, path, val)
                o3 = c3["order"]
                return anchor_date(o3, o3["terms"]["anchor"]) + timedelta(days=o3["terms"]["days"])
            alt = max(alts, key=receipt_date)
            c2 = deep_copy(case)
            c2["uncertain_inputs"] = []
            for path, val in alt["patch"].items():
                set_path(c2, path, val)
            out2 = analyse(c2, check_bruteforce)
            out2["case_id"] = case["case_id"]
            out2["input_hash"] = out["input_hash"]
            out2["assumed_inputs"] = [{"input": case["uncertain_inputs"][0]["id"], "assumed": alt["label"], "reason": "every reading gives the same recommendation; the latest-payment (most conservative) reading is shown"}]
            out2["flags"] = out2.get("flags", []) + [{"code": "A-ASSUMED-INPUT", "message": f"payment anchor assumed: {alt['label']}"}]
            out2["voi"] = v
            return out2
        out.update(decision="needs_input", escalations=[{"code": e.code, "message": e.message}], flags=[], recommended=None)
        out["voi"] = v
        return out
    except Unsupported as e:
        out.update(decision="unsupported_escalate", escalations=[{"code": e.code, "message": e.message}], flags=[], recommended=None)
        return out
    flags = flags + coverage_and_duplicate_warnings(case)
    out["flags"] = flags
    if blocks:
        out.update(decision="blocked_data_conflict", escalations=blocks, recommended=None)
        return out
    try:
        cache: dict = {}
        strategies = enumerate_strategies(case, cache)
        results = []
        ecache: dict = {}
        for st in strategies:
            r = evaluate(case, st, ecache, check_bruteforce)
            if r is not None:
                results.append(r)
    except Unsupported as e:
        out.update(decision="unsupported_escalate", escalations=[{"code": e.code, "message": e.message}], recommended=None)
        return out
    need = target_level(case)
    baseline_res = next(r for r in results if r["strategy"].kind == "decline")
    base_pre = not baseline_res["scen"]["base"]["feasible"] or baseline_res["scen"]["base"]["absolute_gap_vs_reserve"] > 0
    escalations = []
    if baseline_res["scen"]["base"]["absolute_gap_vs_reserve"] > 0:
        escalations.append({"code": "E-PRE-EXISTING-BREACH", "message": f"baseline (without the order) already breaches the reserve from {baseline_res['scen']['base']['first_shortfall_date']}; flagged separately from order impact"})
    feasible, rejected = [], []
    for r in results:
        if r["strategy"].kind == "decline":
            continue
        ok, why = hard_ok(r, case)
        (feasible if ok else rejected).append((r, why))
    feasible, n_dominated = prune_dominated(feasible)
    ranked = sorted(feasible, key=lambda x: priority_key(x[0], case, x[0]["resilience"] >= need))
    accept_res = next((r for r, _ in feasible + rejected if r["strategy"].id == "accept_as_is"), None)
    out["baseline"] = summarize(baseline_res, exp)
    out["accept_as_is"] = summarize(accept_res, exp) if accept_res else None
    used = {r["strategy"].offer_id for r in results if r["strategy"].offer_id}
    out["offers_without_feasible_amount"] = [x["offer_id"] for x in case["financing_offers"]
                                             if x["offer_id"] in case["strategy_space"].get("offer_ids", []) and x["offer_id"] not in used]
    out["counts"] = {"enumerated": len(results), "hard_feasible_after_dominance_pruning": len(feasible), "dominated_pruned": n_dominated, "rejected": len(rejected)}
    out["hard_rejection_reasons"] = {}
    for r, why in rejected:
        for w in why:
            out["hard_rejection_reasons"][w] = out["hard_rejection_reasons"].get(w, 0) + 1
    out["ranked_top"] = [summarize(r, exp) | {"meets_target_resilience": r["resilience"] >= need} for r, _ in ranked[:6]]
    if ranked:
        best_profit = max(r["net_profit"] for r, _ in ranked)
        out["profit_given_up_for_resilience"] = best_profit - ranked[0][0]["net_profit"]
        out["best_profit_strategy"] = max((r for r, _ in ranked), key=lambda r: (r["net_profit"], r["strategy"].id))["strategy"].id
    if not ranked:
        out["decision"] = "decline_or_renegotiate"
        out["recommended"] = "decline"
        mind = minimum_deposit_pct(case)
        accept_gap = accept_res["scen"]["base"]["max_funding_gap"] if accept_res else None
        cash_ok_only_profit = [r for r, why in rejected if why == ["min_order_profit"] or (why and set(why) <= {"min_order_profit", "financing_cost_cap"} and "min_order_profit" in why)]
        if cash_ok_only_profit:
            best_cash = max(cash_ok_only_profit, key=lambda r: r["net_profit"])
            escalations.append({"code": "E-UNPROFITABLE-AFTER-COSTS", "message": "cash-feasible strategies exist but none clears the owner's minimum order profit",
                                "best_cash_feasible": best_cash["strategy"].id, "its_net_profit": best_cash["net_profit"],
                                "owner_min_order_profit": case["owner"].get("min_order_profit", 0)})
        else:
            escalations.append({"code": "E-NO-FEASIBLE", "message": "no enumerated strategy satisfies the hard constraints",
                                "max_funding_gap_accept_as_is": accept_gap, "min_deposit_pct_alone": mind})
            full = scenario_metrics(case, Strategy("plan", deposit_pct=100), BASE_SC, {}, "base")
            out["minimum_change"] = {"max_funding_gap_accept_as_is": accept_gap, "min_deposit_pct_with_no_other_lever": mind,
                                     "first_violation_date_even_with_100pct_deposit": full["first_violation_date"] if full else None}
    else:
        top, _ = ranked[0]
        out["recommended"] = top["strategy"].id
        nofin = next((r for r, _ in ranked if not r["strategy"].offer_id), None)
        out["best_without_financing"] = nofin["strategy"].id if nofin else None
        out["decision"] = "accept_as_is" if top["strategy"].id == "accept_as_is" else "accept_with_changes"
        if top["resilience"] < need:
            robust_pct = None
            for pct in range(0, 101):
                r_ = evaluate(case, Strategy("plan", deposit_pct=pct), {}, False)
                if r_ is not None and r_["resilience"] >= need and hard_ok(r_, case)[0]:
                    robust_pct = pct
                    break
            escalations.append({"code": "E-FRAGILE-BEST", "message": f"best strategy {top['strategy'].id} passes {top['resilience']-1} of the target {need-1} stress scenarios; owner review required",
                                "customer_deposit_pct_that_would_make_a_deposit_only_plan_robust": robust_pct})
        a = ranked[0][0]
        margin = max(1, apply_bps(abs(a["net_profit"]) or 1, case["owner"].get("close_call_bps", 200)))
        keys = set(case["owner"].get("priorities", ["profit", "independence_any", "simplicity"])) | {"robustness"}
        keys.discard("profit")
        for b, _ in ranked[1:]:
            if not (0 < a["net_profit"] - b["net_profit"] <= margin):
                continue
            if a["strategy"].dependencies == b["strategy"].dependencies or b["resilience"] < need or a["resilience"] < need:
                continue
            if lever_items(a["strategy"]) < lever_items(b["strategy"]):
                continue  # the runner-up is the top plan plus extra levers (an add-on), not an alternative
            better = sorted(k for k in keys if key_metric(b, k) < key_metric(a, k))
            if better:
                escalations.append({"code": "E-CLOSE-CALL", "message": f"{a['strategy'].id} and {b['strategy'].id} are within {case['owner'].get('close_call_bps', 200)} bps on profit with different dependencies; the runner-up is better on: {', '.join(better)}",
                                    "top": a["strategy"].id, "runner_up": b["strategy"].id, "runner_up_better_on": better})
                break
        shortlist = [r["strategy"] for r, _ in ranked[:40]]
        out["delay_scan_top"] = delay_scan(case, top["strategy"], case.get("scan_days", 90), {})
        out["best_plan_by_receipt_delay"] = ranking_by_delay(case, shortlist, case.get("scan_days", 90))
        if case.get("uncertain_inputs"):
            out["voi"] = voi(case)
            if any(v["flips_decision"] for v in out["voi"]):
                escalations.append({"code": "E-ASK-INPUT", "message": "an unresolved input would change the recommended strategy; ask the owner before presenting a recommendation"})
                out["decision"] = "needs_input"
    named = []
    for spec in case.get("named_strategies", []):
        st = Strategy(spec.get("kind", "plan"), spec.get("deposit_pct", 0), spec.get("ext_days", 0), spec.get("ext_surcharge_bps", 0), spec.get("stages", 1),
                      spec.get("defer_days", 0), spec.get("offer_id"), spec.get("loan_minor", 0))
        r = evaluate(case, st, {}, False)
        if r is None:
            named.append({"label": spec["label"], "invalid": True})
            continue
        row = summarize(r, exp)
        ok, why = hard_ok(r, case)
        row.update(label=spec["label"], passes_hard_constraints=ok, hard_failures=why)
        row["delay_scan"] = delay_scan(case, st, spec.get("scan_days", case.get("scan_days", 90)), {})
        named.append(row)
    if named:
        out["named"] = named
    out["escalations"] = escalations
    out["escalate"] = bool(escalations)
    alerts = {"baseline": [], "accept_as_is": alerts_for(case, accept_res) if accept_res else [], "recommended": []}
    if baseline_res["scen"]["base"]["absolute_gap_vs_reserve"] > 0:
        alerts["baseline"].append({"rule": "A6", "message": "pre-existing breach", "first_shortfall_date": baseline_res["scen"]["base"]["first_shortfall_date"]})
    rec_row = next((r for r, _ in ranked if r["strategy"].id == out.get("recommended")), None)
    if rec_row:
        alerts["recommended"] = alerts_for(case, rec_row)
    out["alerts"] = alerts
    out["profit_summary"] = {"order_revenue": case["order"]["revenue"],
                             "incremental_cost": sum(c["amount"] for c in case["order"]["costs"] if c.get("incremental", True)),
                             "order_profit_before_financing": case["order"]["revenue"] - sum(c["amount"] for c in case["order"]["costs"] if c.get("incremental", True)),
                             "excluded_non_incremental_costs": [c["id"] for c in case["order"]["costs"] if not c.get("incremental", True)]}
    if case.get("sensitivity"):
        out["assumption_sensitivity"] = assumption_sensitivity(case, out.get("recommended"))
    return out


def input_hash(case: dict) -> str:
    """sha256 of the canonical engine input: the case without labels, intent, document text or named strategies."""
    body = {k: v for k, v in case.items() if k not in ("intent", "documents", "title", "named_strategies", "sensitivity")}
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()


def coverage_and_duplicate_warnings(case: dict) -> list[dict]:
    """Warnings only (never blocking): baseline data ends before the last possible order event; a possible duplicate without invoice_ref."""
    flags = []
    o = case["order"]
    try:
        last_base = max(d(e["date"]) for e in case["baseline_events"])
        max_delay = max([0] + [s.get("order_receipt_delay_days", 0) for s in case["scenarios"].values()])
        needed = anchor_date(o, o["terms"]["anchor"]) + timedelta(days=o["terms"]["days"] + max_delay)
        if last_base < needed:
            flags.append({"code": "W-BASELINE-COVERAGE", "message": f"baseline events end on {last_base}; the order's last possible receipt is {needed}: obligations after the data ends are not modelled"})
    except (KeyError, ValueError):
        pass
    for c in o["costs"]:
        if not c.get("incremental", True) or c.get("invoice_ref"):
            continue
        for e in case["baseline_events"]:
            if e["amount"] == c["amount"] and e["direction"] == "out" and abs((d(e["date"]) - d(c["date"])).days) <= 3:
                flags.append({"code": "W-POSSIBLE-DUPLICATE", "message": f"order cost {c['id']} has the same amount as baseline event {e['id']} within 3 days: counted once only if it is the same obligation"})
    return flags


def alerts_for(case: dict, res: dict) -> list[dict]:
    """A1 reserve breach and A2 payment before receipt for one strategy in the base scenario (A5 is a workflow alert)."""
    m = res["scen"]["base"]
    series, reserve, alerts = m["_series"], case["reserve"], []
    if m["first_shortfall_date"]:
        day = d(m["first_shortfall_date"])
        alerts.append({"rule": "A1", "date": day.isoformat(), "balance_that_day": series[day][0], "gap_to_reserve": reserve - series[day][0]})
    if m["first_violation_date"]:
        v = d(m["first_violation_date"])
        funding = None
        for dy in sorted({e.date for e in m["_events"] if e.direction == IN and e.date > v}):
            if series[dy][1] >= reserve:
                funding = dy
                break
        alerts.append({"rule": "A2", "first_violation_date": v.isoformat(), "next_inflow_that_restores_the_reserve": funding.isoformat() if funding else None,
                       "days_exposed": (funding - v).days if funding else None})
    return alerts


def assumption_sensitivity(case: dict, base_rec) -> dict:
    """Re-run the analysis with each assumed parameter at stated values and report where the recommendation changes."""
    runs = []
    for spec in case["sensitivity"]:
        for v in spec["values"]:
            c2 = deep_copy(case)
            c2["sensitivity"] = []
            c2["scan_days"] = 0
            set_path(c2, spec["path"], v)
            r = analyse(c2, check_bruteforce=False)
            runs.append({"path": spec["path"], "value": v, "decision": r["decision"], "recommended": r.get("recommended"),
                         "escalations": [e["code"] for e in r.get("escalations", [])]})
    return {"baseline_recommended": base_rec, "runs": runs,
            "recommendation_changes_at": [x for x in runs if x["recommended"] != base_rec]}


def voi(case: dict) -> list[dict]:
    """Value of information: would resolving an uncertain input change the recommendation?"""
    res = []
    for u in case.get("uncertain_inputs", []):
        tops = {}
        for alt in u["alternatives"]:
            c2 = deep_copy(case)
            c2["uncertain_inputs"] = []
            for path, val in alt["patch"].items():
                set_path(c2, path, val)
            r = analyse(c2, check_bruteforce=False)
            tops[alt["label"]] = {"decision": r["decision"], "recommended": r.get("recommended"),
                                  "accept_as_is_feasible": (r.get("accept_as_is") or {}).get("base", {}).get("feasible")}
        distinct = {json.dumps(v, sort_keys=True) for v in tops.values()}
        res.append({"input": u["id"], "alternatives": tops, "flips_decision": len(distinct) > 1})
    return res


# ----------------------------------------------------------------------------- explanation slots (verifier prototype)

NUMBER_WORDS = {
    "en": ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
           "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "million", "lakh", "crore", "half", "quarter", "double", "triple"],
    "bn": ["এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়", "দশ", "বিশ", "ত্রিশ", "চল্লিশ", "পঞ্চাশ", "শত", "হাজার", "লাখ", "কোটি"],
    "hi": ["एक", "दो", "तीन", "चार", "पांच", "छह", "सात", "आठ", "नौ", "दस", "बीस", "तीस", "चालीस", "पचास", "सौ", "हज़ार", "लाख", "करोड़"],
}
_SLOT = re.compile(r"\{\{([a-z_]+(?::[A-Za-z0-9_.@:+-]+)?)\}\}")


def slot_values(ev: dict, exponent: int = 2) -> dict[str, str]:
    """Slots the model may reference. Each renders as a labelled phrase, so a value cannot be attached to the wrong claim."""
    slots: dict[str, str] = {}
    for row in ev.get("ranked_top", []):
        sid = row["strategy_id"]
        slots[f"plan:{sid}"] = f"plan {sid}"
        slots[f"profit:{sid}"] = f"net order profit of plan {sid}: {fmt(row['net_order_profit'], exponent)}"
        slots[f"lowest_base:{sid}"] = f"lowest balance of plan {sid} (base): {fmt(row['base']['lowest_balance'], exponent)} on {row['base']['lowest_date']}"
        slots[f"headroom:{sid}"] = f"headroom of plan {sid} above the reserve (base): {fmt(row['base']['headroom'], exponent)}"
    a = ev.get("accept_as_is")
    if a:
        slots["asis_lowest"] = f"lowest balance if accepted as offered: {fmt(a['base']['lowest_balance'], exponent)} on {a['base']['lowest_date']}"
        if a["base"]["first_shortfall_date"]:
            slots["asis_first_shortfall"] = f"first day below the reserve if accepted as offered: {a['base']['first_shortfall_date']}"
    return slots


def render_slots(text: str, slots: dict[str, str]) -> tuple[str, list[str]]:
    """The model writes text with named slots only. Code resolves the slots. Any digit in any script, any number word
    (English, Bengali, Hindi), any URL or e-mail marker, and any unknown slot make the text unusable (template fallback)."""
    problems = []
    if any(unicodedata.category(ch) == "Nd" for ch in re.sub(_SLOT, "", text)):
        problems.append("digit")
    if re.search(r"https?://|www\.|@", text):
        problems.append("url_or_address")
    low = re.sub(_SLOT, "", text).lower()
    for lang, words in NUMBER_WORDS.items():
        for w in words:
            if re.search(r"(?<!\w)" + re.escape(w) + r"(?!\w)", low):
                problems.append(f"number_word:{lang}:{w}")
    for name in _SLOT.findall(text):
        if name not in slots:
            problems.append(f"unknown_slot:{name}")
    rendered = _SLOT.sub(lambda m: slots.get(m.group(1), "[?]"), text)
    return rendered, problems


# ----------------------------------------------------------------------------- CLI

def strip_private(x):
    if isinstance(x, dict):
        return {k: strip_private(v) for k, v in x.items() if not k.startswith("_")}
    if isinstance(x, list):
        return [strip_private(v) for v in x]
    return x


def lookup(out, path: str):
    cur = out
    for part in path.split("."):
        if isinstance(cur, list):
            cur = cur[int(part)]
        elif isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return None
    return cur


def main(argv: list[str]) -> int:
    here = Path(__file__).parent
    check = "--check" in argv
    fast = "--fast" in argv  # skip the brute-force cross-check and the sensitivity runs (iteration only; never for evidence)
    cases = sorted((here / "cases").glob("*.json"))
    (here / "expected").mkdir(exist_ok=True)
    loaded = {}
    outs = {}
    for p in cases:
        case = json.loads(p.read_text(encoding="utf-8"))
        loaded[case["case_id"]] = case
        if fast:
            case = dict(case, sensitivity=[])
        outs[case["case_id"]] = strip_private(analyse(case, check_bruteforce=not fast))
    bad = 0
    summary = []
    for cid, case in loaded.items():
        out = outs[cid]
        mism = []
        for k, v in case.get("intent", {}).items():
            if k == "escalation_codes":
                actual, v = sorted(e["code"] for e in out.get("escalations", [])), sorted(v)
            elif k == "flag_codes":
                actual, v = sorted(f["code"] for f in out.get("flags", [])), sorted(v)
            elif k == "equals_case":
                other = outs[v]
                actual = all(out.get(f) == other.get(f) for f in ("decision", "recommended", "ranked_top", "baseline", "accept_as_is"))
                v = True
            elif k == "recommended_deps":
                top = (out.get("ranked_top") or [{}])[0]
                actual = sorted(top.get("dependencies", []))
                v = sorted(v)
            elif "." in k:
                actual = lookup(out, k)
            else:
                actual = out.get(k)
            if actual != v:
                mism.append((k, v, actual))
        text = json.dumps(out, indent=2, sort_keys=True, ensure_ascii=False) + chr(10)
        target = here / ("expected_fast" if fast else "expected") / f"{cid}.json"
        if fast:
            target.parent.mkdir(exist_ok=True)
            target.write_text(text, encoding="utf-8")
        elif check:
            if not target.exists() or target.read_text(encoding="utf-8") != text:
                print(f"STALE expected file: {target.name}")
                bad += 1
        else:
            target.write_text(text, encoding="utf-8")
        if mism:
            bad += 1
            for k, v, a in mism:
                print(f"  {cid} intent {k}: expected {v!r} got {a!r}")
        summary.append((cid, "OK " if not mism else "INTENT-MISMATCH", out.get("decision"), out.get("recommended"), [e["code"] for e in out.get("escalations", [])]))
    for row in summary:
        print(" | ".join(str(x) for x in row))
    print(f"cases={len(cases)} problems={bad} calc_version={CALC_VERSION}" + (" (FAST: not evidence)" if fast else ""))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

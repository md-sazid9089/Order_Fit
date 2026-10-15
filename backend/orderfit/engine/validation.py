"""Semantic rejection and deterministic work admission; no guessed financial values."""

from dataclasses import dataclass

from orderfit.engine.horizon import AnalysisLimit, horizon_end
from orderfit.engine.utilities import d


class Unsupported(Exception):
    def __init__(self, code, message):
        self.code, self.message = code, message


class NeedsInput(Unsupported):
    pass


@dataclass
class Budget:
    maximum: int
    used: int = 0

    def consume(self, units):
        self.used += units
        if self.used > self.maximum:
            raise AnalysisLimit("ANALYSIS_WORK_LIMIT")


def validate_case(case):
    flags = []
    blocks = list(case.get("review_issues", []))
    o = case["order"]
    for e in case["baseline_events"] + o["costs"]:
        if e.get("ccy", case["currency"]) != case["currency"]:
            raise Unsupported(
                "E-UNSUPPORTED-MULTICCY",
                "An event uses another currency; no FX conversion is supported.",
            )
        if d(e["date"]) < d(case["as_of"]):
            blocks.append(
                {"code": "E-DATE-IN-PAST", "message": f"event {e['id']} dated before as_of"}
            )
    refs = {e.get("invoice_ref") for e in case["baseline_events"] if e.get("invoice_ref")}
    for c in o["costs"]:
        if c["incremental"] and c.get("invoice_ref") in refs:
            blocks.append(
                {
                    "code": "E-DUPLICATE-OBLIGATION",
                    "message": f"cost {c['id']} duplicates baseline invoice {c['invoice_ref']} (counted once only)",
                }
            )
    keys = [e["id"] for e in case["baseline_events"] + o["costs"]]
    if len(set(keys)) != len(keys):
        blocks.append({"code": "E-DUPLICATE-OBLIGATION", "message": "Duplicate event identity."})
    anchor = o["terms"]["anchor"]
    if anchor in (None, "unknown"):
        raise NeedsInput("E-MISSING-ANCHOR", "payment-term anchor event is unknown; ask the owner")
    if not o["anchor_dates"].get(anchor):
        raise NeedsInput("E-MISSING-ANCHOR-DATE", f"no date for anchor '{anchor}'")
    if any(case["strategy_space"]["deposit_pcts"]) and not o["anchor_dates"].get("order"):
        raise NeedsInput("E-MISSING-ANCHOR-DATE", "no date for anchor 'order'")
    from datetime import timedelta

    if d(o["anchor_dates"][anchor]) + timedelta(days=o["terms"]["days"]) < d(case["as_of"]):
        blocks.append(
            {"code": "E-DATE-IN-PAST", "message": "Receipt precedes reconciled opening balance."}
        )
    if any(case["strategy_space"]["deposit_pcts"]) and d(o["anchor_dates"]["order"]) + timedelta(
        days=case["strategy_space"]["deposit_lead_days"]
    ) < d(case["as_of"]):
        blocks.append(
            {"code": "E-DATE-IN-PAST", "message": "Deposit precedes reconciled opening balance."}
        )
    return flags, blocks


def admit(case):
    end = horizon_end(case)
    case["_horizon"] = end
    space = case["strategy_space"]
    order = case["order"]
    owner = case["owner"]
    points = sum(
        (o["max"] - o["min"]) // o["step"] + 1
        for o in case["financing_offers"]
        if o["offer_id"] in space["offer_ids"]
    )
    dimensions = len(space["deposit_pcts"]) * len(space["extensions"])
    if dimensions * (1 + points) > 10000:
        raise AnalysisLimit("ANALYSIS_STRATEGY_LIMIT")
    for pct in space["deposit_pcts"]:
        concession = (
            order.get("deposit_discount_bps", 0)
            + order.get("deposit_discount_bps_per_10pct", 0) * pct // 10
            if pct
            else 0
        )
        if concession > 10000 or (
            owner.get("max_deposit_concession_bps") is not None
            and concession > owner["max_deposit_concession_bps"]
        ):
            raise Unsupported("E-POLICY-GRID", "Deposit grid exceeds the pinned concession policy.")
    if (
        owner.get("max_supplier_extension_days") is not None
        and max(e["days"] for e in space["extensions"]) > owner["max_supplier_extension_days"]
    ):
        raise Unsupported("E-POLICY-GRID", "Extension grid exceeds the pinned policy.")
    total = abs(case["opening_balance"]) + case["reserve"] + order["revenue"] * 2
    total += sum(e["amount"] * 4 for e in case["baseline_events"] + order["costs"])
    total += sum(o["max"] * 4 + o["fee_flat"] for o in case["financing_offers"])
    if total > 9223372036854775807:
        raise AnalysisLimit("ANALYSIS_AGGREGATE_LIMIT")
    candidates = 1 + dimensions * (1 + 3 * len(space["offer_ids"]))
    if 0 not in space["deposit_pcts"] or not any(e["days"] == 0 for e in space["extensions"]):
        candidates += 1  # the always-present as-offered comparator
    days = (end - d(case["as_of"])).days + 1
    if candidates * days * 3 > 500000:
        raise AnalysisLimit("ANALYSIS_OUTPUT_LIMIT")
    variants = (
        1
        + sum(len(s["values"]) for s in case.get("sensitivity", []))
        + sum(len(u["alternatives"]) for u in case.get("uncertain_inputs", []))
    )
    evaluations = (
        dimensions * points * 6
        + candidates * 3
        + min(candidates, 40) * (case.get("scan_days", 0) + 1)
        + (case.get("scan_days", 0) + 1)
        + candidates * (case.get("scan_days", 0) + 1)
        + 303
    )
    estimated = evaluations * (days + len(case["baseline_events"]) + len(order["costs"])) * variants
    if estimated > case.get("max_work_units", 100000000):
        raise AnalysisLimit("ANALYSIS_WORK_LIMIT")

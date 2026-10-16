"""Complete horizon admission. No event or required scan may be clipped."""

from datetime import date, timedelta

from orderfit.engine.stress import SHIFTED_BY_ORDER_DELAY
from orderfit.engine.utilities import d


class AnalysisLimit(Exception):
    pass


def horizon_end(case):
    if "_horizon" in case:
        return case["_horizon"]
    start = d(case["as_of"])
    order = case["order"]
    space = case["strategy_space"]
    anchor = order["anchor_dates"].get(order["terms"]["anchor"])
    if anchor is None:
        raise ValueError("missing anchor")
    scenarios = case["scenarios"].values()
    delay = max(
        case.get("scan_days", 0), *[s.get("order_receipt_delay_days", 0) for s in scenarios]
    )
    ar = max(s.get("ar_delay_days", 0) for s in scenarios)
    extension = max(e["days"] for e in space["extensions"])
    ends = [start, d(anchor) + timedelta(days=order["terms"]["days"] + delay)]
    def baseline_shift(e):
        # Mirror stress.apply_scenario: unconfirmed baseline events of an order class
        # move with the order-receipt delay, so the horizon must cover that shift.
        if e.get("certainty", "confirmed") == "confirmed":
            return 0
        if e["kind"] == "ar_collection":
            return ar
        if e["kind"] in SHIFTED_BY_ORDER_DELAY or e["kind"] == "order_deposit":
            return delay
        return 0

    ends += [d(e["date"]) + timedelta(days=baseline_shift(e)) for e in case["baseline_events"]]
    ends += [
        d(e["date"]) + timedelta(days=extension if e["deferrable"] else 0) for e in order["costs"]
    ]
    if order["anchor_dates"].get("order"):
        ends.append(
            d(order["anchor_dates"]["order"]) + timedelta(days=space["deposit_lead_days"] + delay)
        )
    for offer in case["financing_offers"]:
        if offer["offer_id"] not in space["offer_ids"]:
            continue
        draw = max(
            start + timedelta(days=offer["lead_days"]), d(offer.get("available_from", start))
        )
        if offer.get("valid_until") and draw > d(offer["valid_until"]):
            continue
        ends.append(draw + timedelta(days=offer["term_days"]))
    required = max(ends)
    ceiling = min(date(2100, 12, 31), start + timedelta(days=1095))
    if required > ceiling:
        raise AnalysisLimit("ANALYSIS_HORIZON_LIMIT")
    # Retain the reference's inert display buffer when possible, but never let
    # its padding exclude actual late funding, long scans or deposits.
    latest = max(
        [start, d(anchor)] + [d(e["date"]) for e in case["baseline_events"] + order["costs"]]
    )
    shift = max(delay, ar)
    legacy = latest + timedelta(days=order["terms"]["days"] + shift + extension + 30)
    fin = max([o["term_days"] + o["lead_days"] + 30 for o in case["financing_offers"]] + [0])
    return max(required, min(ceiling, max(legacy, start + timedelta(days=fin))))

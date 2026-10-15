"""Explicit receipt/AR shifts and eligible order-cost overruns."""

from __future__ import annotations

from dataclasses import replace

from orderfit.engine.models import CashEvent as Ev
from orderfit.engine.money import apply_bps

OUT = "out"
SHIFTED_BY_ORDER_DELAY = {"order_final_receipt", "order_stage_receipt"}
SHIFTED_BY_AR_DELAY = {"ar_collection"}
HAIRCUT_KINDS = SHIFTED_BY_ORDER_DELAY
COST_KINDS = {"supplier_payment", "labour", "freight", "subcontract"}


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

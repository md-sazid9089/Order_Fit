"""Fixed-term loan dates, fees and flat term interest."""

from __future__ import annotations

from datetime import timedelta

from orderfit.engine.models import CashEvent as Ev
from orderfit.engine.models import Strategy
from orderfit.engine.money import apply_bps
from orderfit.engine.utilities import d
from orderfit.engine.validation import Unsupported

OUT, IN = "out", "in"


def financing_events(case: dict, st: Strategy, receipt_evs: list[Ev]):
    """Proceeds, fee, interest, repayment as separate dated events. Terms only from the supplied offer."""
    if not st.offer_id:
        return [], 0, None
    offer = next(x for x in case["financing_offers"] if x["offer_id"] == st.offer_id)
    if offer["shape"] != "term_loan":
        raise Unsupported("E-UNSUPPORTED-FINANCING", "Only fixed-term loans are supported.")
    if (
        not offer["min"] <= st.loan_minor <= offer["max"]
        or (st.loan_minor - offer["min"]) % offer["step"]
    ):
        raise Unsupported("E-INVALID-DRAW", "Draw is outside the verified offer grid.")
    as_of = d(case["as_of"])
    P = st.loan_minor
    evs = []
    if offer["shape"] == "term_loan":
        draw = max(
            as_of + timedelta(days=offer.get("lead_days", 0)),
            d(offer["available_from"]) if offer.get("available_from") else as_of,
        )
        if offer.get("valid_until") and draw > d(offer["valid_until"]):
            return None, 0, None  # the offer expires before it could be drawn: ineligible
        repay = draw + timedelta(days=offer["term_days"])
        fee = apply_bps(P, offer.get("fee_bps", 0)) + offer.get("fee_flat", 0)
        interest = apply_bps(P, offer.get("interest_bps", 0))
    if repay <= draw:
        return None, 0, None  # invalid timing
    evs.append(Ev("loan_draw", draw, P, IN, "loan_draw", "confirmed", "financing"))
    fee_date = draw if offer.get("fee_at") == "draw" else repay
    if fee > 0:
        evs.append(Ev("loan_fee", fee_date, fee, OUT, "loan_fee", "confirmed", "financing"))
    if interest > 0:
        evs.append(
            Ev("loan_interest", repay, interest, OUT, "loan_interest", "confirmed", "financing")
        )
    evs.append(Ev("loan_repayment", repay, P, OUT, "loan_repayment", "confirmed", "financing"))
    return evs, fee + interest, offer

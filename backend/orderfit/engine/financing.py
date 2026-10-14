"""Loan sizing against the catalogue.

The loan is sized so the option meets the TARGET tolerance, not just the
on-time case: the smallest catalogue-valid amount (min, max, step) for which
the stressed timeline, including interest, fees and repayment, never breaches
the reserve. Sizing for d=0 only produces loans that fail their own stress test.

Starting point (on-time): reserve - lowest balance while outstanding
(Rina: 5,000 - (-4,000) = 9,000), then step up until the target is met.
"""

from orderfit.engine.models import CashEvent, FinancingOffer


def size_loan(
    cash_today_minor: int,
    reserve_minor: int,
    events: tuple[CashEvent, ...],
    offer: FinancingOffer,
    target_tolerance_days: int,
) -> int | None:
    """Return the loan amount in minor units, or None if no valid amount meets the target."""
    raise NotImplementedError

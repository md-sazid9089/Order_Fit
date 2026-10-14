"""Delay tolerance by linear scan.

Scan d = 0, 1, ..., MAX_DELAY_DAYS and stop at the FIRST failing delay.
Tolerance = last delay before the first failure. Never binary search: cash
timelines are not monotone in delay (a later inflow can make d=26 pass after
d=21 failed).
"""

from orderfit.engine.models import CashEvent


def delay_tolerance(
    cash_today_minor: int, reserve_minor: int, events: tuple[CashEvent, ...]
) -> tuple[int, bool]:
    """Return (tolerance_days, survives_full_scan). FAILS_ON_TIME if d=0 fails."""
    raise NotImplementedError


def survives_non_payment(
    cash_today_minor: int, reserve_minor: int, events: tuple[CashEvent, ...]
) -> bool:
    raise NotImplementedError

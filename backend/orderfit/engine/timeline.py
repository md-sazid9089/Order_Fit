"""Daily balance over the horizon.

Rule: within a day, outflows are applied before inflows (conservative).
"""

from collections.abc import Iterable

from orderfit.engine.models import CashEvent, Timeline


def build_timeline(
    cash_today_minor: int, reserve_minor: int, events: Iterable[CashEvent]
) -> Timeline:
    """Running sum of events; record the lowest balance, first breach and breach intervals."""
    raise NotImplementedError

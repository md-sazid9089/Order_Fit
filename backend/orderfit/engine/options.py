"""Option generation: every non-empty combination of up to 5 levers (max 31).

Each lever is a pure transformation of the event list. Combining levers applies
them in a fixed order so results never depend on iteration order.
"""

from collections.abc import Iterator

from orderfit.engine.models import CashEvent, FinancingOffer, Lever


def combinations(levers: tuple[Lever, ...]) -> Iterator[tuple[Lever, ...]]:
    """Yield every non-empty lever subset in a deterministic order."""
    raise NotImplementedError


def apply_levers(
    events: tuple[CashEvent, ...],
    levers: tuple[Lever, ...],
    catalogue: tuple[FinancingOffer, ...],
    loan_minor: int = 0,
) -> tuple[CashEvent, ...]:
    """Return a new event list with the levers applied. Never mutates the input."""
    raise NotImplementedError


def option_cost_minor(
    events_before: tuple[CashEvent, ...], events_after: tuple[CashEvent, ...]
) -> int:
    """Cost of an option: interest + fees + discounts given + penalties incurred."""
    raise NotImplementedError

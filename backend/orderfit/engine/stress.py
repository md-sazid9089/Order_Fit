"""Stress scenarios applied to the order receipt.

Delay shifts the receipt by d days. Partial, cancellation and discount scale or
remove it. Each scenario returns a new event list; the timeline does the rest.
"""

from orderfit.engine.models import CashEvent, StressScenario


def stressed_events(
    events: tuple[CashEvent, ...],
    scenario: StressScenario,
    delay_days: int = 0,
    fraction_bps: int = 10_000,
) -> tuple[CashEvent, ...]:
    raise NotImplementedError

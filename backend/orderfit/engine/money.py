"""Money as integer minor units.

Inside the engine every amount is an ``int`` count of the currency's smallest
unit. ``Decimal`` exists only at the boundary (API input and display). Floats
never touch money.

Minor-unit exponents differ by currency (USD 2, JPY 0, KWD 3), so conversion
always goes through ``CURRENCY_EXPONENT``.
"""

from decimal import Decimal

CURRENCY_EXPONENT: dict[str, int] = {
    "BDT": 2,
    "USD": 2,
    "EUR": 2,
    "GBP": 2,
    "INR": 2,
    "CNY": 2,
    "JPY": 0,
    "KWD": 3,
}


def to_minor(amount: Decimal, currency: str) -> int:
    """Convert a Decimal amount to minor units; reject sub-minor precision."""
    raise NotImplementedError


def from_minor(amount_minor: int, currency: str) -> Decimal:
    """Convert minor units back to a Decimal for display."""
    raise NotImplementedError


def apply_bps(amount_minor: int, bps: int) -> int:
    """amount × bps / 10,000, rounded half-up to a whole minor unit.

    The single rounding rule for interest, fees and penalties (edge case X-04).
    """
    raise NotImplementedError

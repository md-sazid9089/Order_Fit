"""Integer minor-unit arithmetic; half-up basis points and exact residuals."""

from __future__ import annotations

from decimal import Decimal

BPS = 10000


def apply_bps(amount: int, bps: int) -> int:
    """amount * bps / 10_000 rounded half up. The single rounding rule."""
    if type(amount) is not int or type(bps) is not int or amount < 0 or bps < 0:
        raise ValueError("apply_bps takes non-negative inputs")
    return (amount * bps + BPS // 2) // BPS


def split_exact(total: int, parts: int) -> list[int]:
    """Split into `parts` integer pieces that sum exactly to total (remainder on the last)."""
    if type(total) is not int or total < 0 or type(parts) is not int or parts < 1:
        raise ValueError("nonnegative integer total and positive integer parts required")
    base = total // parts
    out = [base] * parts
    out[-1] = total - base * (parts - 1)
    return out


def fmt(minor: int, exponent: int = 2) -> str:
    sign = "-" if minor < 0 else ""
    minor = abs(minor)
    whole, frac = divmod(minor, 10**exponent)
    return f"{sign}{whole:,}.{frac:0{exponent}d}" if exponent else f"{sign}{whole:,}"


CURRENCY_EXPONENT = {key: 2 for key in ("BDT", "USD", "EUR", "GBP")}


def to_minor(amount: Decimal, currency: str) -> int:
    if (
        currency not in CURRENCY_EXPONENT
        or not isinstance(amount, Decimal)
        or not amount.is_finite()
    ):
        raise ValueError("supported currency and finite Decimal required")
    if amount.copy_abs() > Decimal("90000000000000"):
        raise ValueError("money bound")
    sign, digits, exponent = amount.as_tuple()
    if exponent < -2:
        cut = max(0, len(digits) + exponent + 2)
        if any(digits[cut:]):
            raise ValueError("fractional minor unit")
        digits = digits[:cut]
        exponent = -2
    coefficient = int("".join(map(str, digits)) or "0")
    scaled = coefficient * 10 ** (exponent + 2) if coefficient else 0
    return -scaled if sign else scaled


def from_minor(amount_minor: int, currency: str) -> Decimal:
    if (
        type(amount_minor) is not int
        or abs(amount_minor) > 9_000_000_000_000_000
        or currency not in CURRENCY_EXPONENT
    ):
        raise ValueError("supported integer money required")
    return Decimal((int(amount_minor < 0), tuple(map(int, str(abs(amount_minor)))), -2))

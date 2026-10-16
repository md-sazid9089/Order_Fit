"""Minor-unit conversion per currency exponent; bps rounding rule."""

from decimal import Decimal

import pytest

from orderfit.engine.money import apply_bps, fmt, from_minor, split_exact, to_minor


@pytest.mark.parametrize(
    "amount,bps,expected",
    [(1, 5000, 1), (1, 4999, 0), (3, 1666, 0), (3, 1667, 1), (35_000_000, 1500, 5_250_000), (0, 9999, 0)],
)
def test_apply_bps_rounds_half_up_once(amount, bps, expected):
    assert apply_bps(amount, bps) == expected


@pytest.mark.parametrize("bad", [(-1, 10), (10, -1), (1.5, 10), (10, True), (True, 10)])
def test_apply_bps_rejects_negative_and_non_integer(bad):
    with pytest.raises(ValueError):
        apply_bps(*bad)


@pytest.mark.parametrize("total,parts", [(100, 3), (7, 7), (0, 4), (1, 5)])
def test_split_exact_sums_with_remainder_on_last(total, parts):
    pieces = split_exact(total, parts)
    assert sum(pieces) == total and len(pieces) == parts
    assert all(p == pieces[0] for p in pieces[:-1])


def test_decimal_round_trip_and_fractional_minor_rejection():
    assert to_minor(Decimal("350000.00"), "BDT") == 35_000_000
    assert to_minor(Decimal("1.230"), "USD") == 123
    assert from_minor(123, "USD") == Decimal("1.23")
    for bad in (Decimal("1.001"), Decimal("NaN"), 1.5):
        with pytest.raises(ValueError):
            to_minor(bad, "USD")
    with pytest.raises(ValueError):
        to_minor(Decimal("1"), "JPY")


def test_formatting_is_exact():
    assert fmt(-1234567) == "-12,345.67"
    assert fmt(5, 2) == "0.05"

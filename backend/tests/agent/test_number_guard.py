"""Number guard: canonical figures only, no spelled-out or identifier-derived bypass."""

import pytest

from orderfit.agent.guards import numbers

LINES = [
    "Order revenue: 35000000 BDT minor units.",
    "Final payment: 30 calendar days after delivery.",
    "Proposed deposit: 20% of net revenue; flat 150 bps per ten percentage points.",
]


def test_exact_figures_pass_and_alien_figures_fail():
    allowed = numbers.allowed_values(LINES, [])
    assert numbers.check("Final payment: 30 calendar days after delivery.", allowed) == []
    assert numbers.check("Final payment: 45 calendar days after delivery.", allowed) == ["45"]


def test_grouping_and_trailing_zeros_are_canonical_not_prefix_matches():
    allowed = numbers.allowed_values({"revenue_minor": 35000000, "days": 30}, [])
    assert numbers.check("35,000,000", allowed) == []
    assert numbers.check("30.00", allowed) == []
    assert numbers.check("3,500,000", allowed) == ["3,500,000"]
    # A comma that is not a thousands separator is never read as a thousands separator.
    assert numbers.check("1,2", numbers.allowed_values({"x": 12}, [])) == ["1,2"]


@pytest.mark.parametrize(
    "word",
    ["thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
     "sixty", "seventy", "eighty", "ninety"],
)
def test_all_written_numbers_are_blocked(word):
    assert numbers.check(f"Payment in {word} days", numbers.allowed_values(LINES, [])) == [word]
    assert numbers.check(f"Payment in {word.upper()} days", set()) == [word.upper()]


def test_written_number_allowed_only_when_in_result_text():
    allowed = numbers.allowed_values(LINES, [])
    assert numbers.check("per ten percentage points", allowed) == []
    assert numbers.check("per twenty percentage points", allowed) == ["twenty"]


def test_digits_glued_to_letters_are_still_checked():
    assert numbers.check("net30", set()) == ["30"]


def test_identifiers_and_keys_do_not_whitelist_their_digits():
    result = {"evaluation_id": "9f3a-1234-5678", "hash": "deadbeef0099", "amount_minor": 500}
    allowed = numbers.allowed_values(result, [])
    assert numbers.check("500", allowed) == []
    assert numbers.check("1234", allowed) == ["1234"]
    assert numbers.check("0099", allowed) == ["0099"]
    # dictionary keys with digits are not figures either
    assert numbers.check("90", numbers.allowed_values({"p90": 1}, [])) == ["90"]

"""Closed-grammar terms guard: only known lines, and every required line exactly once."""

from orderfit.agent.guards import terms

REQUIRED = ["Final payment: 30 calendar days after delivery.", "Supplier extension: 0 calendar days."]
COURTESY = ["Hello,", "Kind regards,"]


def body(*lines):
    return "\n".join(lines)


def test_exact_grammar_passes():
    text = body("Hello,", *REQUIRED, "Kind regards,")
    assert terms.check(text, REQUIRED + COURTESY, REQUIRED) == []


def test_unknown_line_is_rejected():
    text = body("Hello,", *REQUIRED, "Final payment: 90 calendar days after delivery.")
    assert terms.check(text, REQUIRED + COURTESY, REQUIRED) == [
        "Final payment: 90 calendar days after delivery."
    ]


def test_missing_or_duplicated_required_line_is_rejected():
    allowed = REQUIRED + COURTESY
    assert terms.check(body("Hello,", REQUIRED[0]), allowed, REQUIRED) == [REQUIRED[1]]
    assert terms.check(body(*REQUIRED, REQUIRED[0]), allowed, REQUIRED) == [REQUIRED[0]]

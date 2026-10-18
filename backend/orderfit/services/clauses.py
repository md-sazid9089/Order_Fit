"""C3 clause interpreter, pure parts: hypotheses, isolated forks and the question template.

A reading is a typed hypothesis about an ambiguous payment clause. It is evaluated on an
isolated copy of the confirmed snapshot through ``agent/nodes/compute.py`` and is never
written back. The owner is asked a question only when readings change the decision.
"""

import re
import unicodedata

from pydantic import ValidationError

from orderfit.agent.nodes.compute import ForkOutcome
from orderfit.contracts.advisory import ClauseAssessment, ClauseReading, ReadingOutcome
from orderfit.contracts.financial import ConfirmedInputV1

BASES = ("order", "invoice", "delivery")
_DAYS = re.compile(
    r"(?<![\w.])(?:net|within|in|payable\s+in|due\s+in)?\s*(\d{1,3})\s*(?:calendar\s+)?days?\b", re.I
)
_BASIS_WORDS = re.compile(r"\b(?:invoice|invoicing|delivery|delivered|order|ordering|po)\b", re.I)
_NET = re.compile(r"(?<![\w])net\s*(\d{1,3})(?!\d)", re.I)
MAX_READINGS = 4


def label(basis: str, days: int) -> str:
    return f"{days} calendar days after {basis}"


def reading(basis: str, days: int, quote: str) -> ClauseReading:
    return ClauseReading(payment_basis=basis, payment_days=days, quote=quote, label=label(basis, days))


def _fold(value: str) -> str:
    kept = "".join(ch for ch in unicodedata.normalize("NFKC", value) if unicodedata.category(ch) != "Cf")
    return re.sub(r"\s+", " ", kept).strip().casefold()


def grounded(quote: str, clause_text: str) -> bool:
    folded = _fold(quote)
    return bool(folded) and folded in _fold(clause_text)


def deterministic_readings(clause_text: str) -> list[ClauseReading]:
    """Template baseline: days stated, start event missing => one reading per supported basis.

    A clause that names a start event ("30 days after invoice") is not ambiguous here and
    yields no hypotheses; richer or non-English ambiguity needs the model path.
    """
    match = _NET.search(clause_text) or _DAYS.search(clause_text)
    if match is None or _BASIS_WORDS.search(clause_text):
        return []
    days = int(match.group(1))
    if days > 365:
        return []
    quote = match.group(0).strip()
    return [reading(basis, days, quote) for basis in BASES]


def fork_with_reading(snapshot: ConfirmedInputV1, hypothesis: ClauseReading) -> ConfirmedInputV1:
    """An isolated snapshot copy; the confirmed input and its hash are untouched."""
    data = snapshot.model_dump(mode="json")
    data["order"]["payment_basis"] = hypothesis.payment_basis
    data["order"]["payment_days"] = hypothesis.payment_days
    return ConfirmedInputV1.model_validate(data)


def forks_for(snapshot: ConfirmedInputV1, readings: list[ClauseReading]):
    """(reading, fork-or-None) pairs; an invalid fork is kept so it is reported, not hidden."""
    pairs = []
    for hypothesis in readings:
        try:
            pairs.append((hypothesis, fork_with_reading(snapshot, hypothesis)))
        except (ValidationError, ValueError, KeyError):
            pairs.append((hypothesis, None))
    return pairs


def _outcome(hypothesis, outcome: ForkOutcome | None) -> ReadingOutcome:
    if outcome is None:
        return ReadingOutcome(reading=hypothesis, evaluable=False, decision=None,
                              recommended_option_key=None, recommended_profit_minor=None, code="invalid_fork")
    return ReadingOutcome(
        reading=hypothesis, evaluable=outcome.evaluable, decision=outcome.decision,
        recommended_option_key=outcome.recommended_key,
        recommended_profit_minor=None if outcome.profit_minor is None else str(outcome.profit_minor),
        code=None if outcome.evaluable else outcome.decision,
    )


def decision_changes(outcomes: list[ReadingOutcome]) -> bool:
    """Value of information: ask only if evaluable readings disagree on what to do."""
    seen = {(o.decision, o.recommended_option_key) for o in outcomes if o.evaluable}
    return len(seen) > 1


def question(clause_text_quote: str, outcomes: list[ReadingOutcome]) -> str:
    lines = [
        f"The clause “{clause_text_quote}” can be read more than one way, and the recommendation "
        "differs between readings:"
    ]
    for o in outcomes:
        if o.reading is None or not o.evaluable:
            continue
        lines.append(f"- {o.reading.label}: {o.decision.replace('_', ' ')}"
                     + (f", recommended option {o.recommended_option_key}" if o.recommended_option_key else ""))
    lines.append("Confirm which reading is correct in the order review before relying on this evaluation.")
    return "\n".join(lines)


def assemble(*, id, deal_id, evaluation_id, clause_text, baseline: ForkOutcome, pairs, outcomes,
             provenance, code=None, model=None, response_id=None, input_hash=None) -> ClauseAssessment:
    """Combine engine outcomes into the stored hypothesis-only assessment."""
    confirmed = _outcome(None, baseline).model_copy(update={"reading": None})
    rows = [_outcome(hypothesis, outcome) for (hypothesis, _fork), outcome in zip(pairs, outcomes, strict=True)]
    changes = decision_changes([confirmed, *rows])
    quote = rows[0].reading.quote if rows and rows[0].reading else clause_text[:200]
    return ClauseAssessment(
        id=id, deal_id=deal_id, evaluation_id=evaluation_id, clause_text=clause_text,
        confirmed=confirmed, readings=rows, decision_changes=changes,
        question=question(quote, [confirmed, *rows]) if changes else None,
        provenance=provenance, code=code, model=model, response_id=response_id, input_hash=input_hash,
    )

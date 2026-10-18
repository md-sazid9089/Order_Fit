"""AI advisory contracts (C3 clause hypotheses, C5 slot explanations).

Everything here is proposal-only evidence. Nothing changes a confirmed input, a
figure or an approval: ``canonical_changed`` and ``hypotheses_only`` are literal.
"""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from .primitives import DTO, ExpectedVersions, HashHex, MoneyMinor, Text, UTCInstant

Provenance = Literal["template", "recorded", "live"]
Basis = Literal["order", "invoice", "delivery"]
Days = Annotated[int, Field(strict=True, ge=0, le=365)]


class AdvisoryExplainRequest(ExpectedVersions):
    """Ask for a model-worded explanation of one stored option (slots resolved by facts)."""

    task: Literal["explanation"] = "explanation"
    evaluation_id: UUID
    option_key: str = Field(min_length=1, max_length=80)


class ClauseRequest(ExpectedVersions):
    """Ask whether an ambiguous payment clause could change the recommendation."""

    task: Literal["clause"] = "clause"
    evaluation_id: UUID
    clause_text: str = Field(min_length=3, max_length=2000, pattern=r"\S")


class ClauseReading(DTO):
    """A typed hypothesis. The label is generated from the typed fields, never by a model."""

    payment_basis: Basis
    payment_days: Days
    quote: str = Field(min_length=1, max_length=1000)
    label: Text


class ReadingOutcome(DTO):
    """Engine result of one isolated fork (or the as-confirmed baseline)."""

    reading: ClauseReading | None  # None for the as-confirmed baseline
    evaluable: bool
    decision: Text | None
    recommended_option_key: str | None
    recommended_profit_minor: MoneyMinor | None
    code: Text | None = None


class ClauseAssessment(DTO):
    id: UUID
    deal_id: UUID
    evaluation_id: UUID
    clause_text: str
    confirmed: ReadingOutcome
    readings: list[ReadingOutcome] = Field(max_length=4)
    # True only when evaluable readings disagree on the decision or the recommended option.
    decision_changes: bool
    # A deterministic template, present only when decision_changes.
    question: str | None = Field(default=None, max_length=2000)
    provenance: Provenance
    code: str | None = None
    model: str | None = None
    response_id: str | None = None
    input_hash: HashHex | None = None
    created_at: UTCInstant | None = None
    is_stale: bool = False
    hypotheses_only: Literal[True] = True
    canonical_changed: Literal[False] = False


class ClauseProposal(DTO):
    """Validated model (or template) readings, before any engine fork is evaluated."""

    readings: list[ClauseReading] = Field(default_factory=list, max_length=4)
    provenance: Provenance
    code: str | None = None
    model: str | None = None
    response_id: str | None = None


class ExplanationProposal(DTO):
    """Placeholder sentences that passed the number and terms guards (unresolved)."""

    sentences: list[str] = Field(default_factory=list, max_length=6)
    provenance: Provenance
    code: str | None = None
    model: str | None = None
    response_id: str | None = None

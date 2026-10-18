"""P5 preparation only. Hashes identify content; none authorizes an outgoing effect."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, model_validator

from .advisory import ClauseAssessment
from .financial import ConfirmedInputV1
from .primitives import DTO, ExpectedVersions, HashHex, MoneyMinor, Text, UTCInstant, Version
from .workflow import (
    BlockedResult,
    EvaluationResultV1,
    Operation,
    OptionResult,
    Series,
    WhatIfChange,
)


class ForkRequest(ExpectedVersions):
    schema_version: Literal["whatif.v1"] = "whatif.v1"
    source_snapshot_id: UUID
    changes: list[WhatIfChange] = Field(default_factory=list, max_length=10)
    instruction: str | None = Field(default=None, min_length=1, max_length=4000)

    @model_validator(mode="after")
    def unambiguous(self):
        if bool(self.changes) == bool(self.instruction):
            raise ValueError("provide typed changes or a language proposal, exclusively")
        if len({c.kind for c in self.changes}) != len(self.changes):
            raise ValueError("duplicate change kind")
        return self


class ForkView(DTO):
    id: UUID
    deal_id: UUID
    request: ForkRequest
    changes: list[WhatIfChange]
    fork_snapshot: ConfirmedInputV1 | None
    outcome: EvaluationResultV1 | BlockedResult
    source_evaluation_id: UUID
    source_result: EvaluationResultV1
    series: list[Series]
    provenance: Literal["typed", "template", "recorded", "live"]
    language_code: str | None
    language_model: str | None = None
    language_response_id: str | None = None
    language_input_hash: HashHex | None = None
    language_prompt_version: Literal["whatif.v1"] = "whatif.v1"
    # A short model-proposed question when the request was unclear; never a change.
    clarification: str | None = Field(default=None, max_length=300)
    is_stale: bool
    canonical_changed: Literal[False] = False


class DraftPreparationRequest(ExpectedVersions):
    evaluation_id: UUID
    option_key: str = Field(min_length=1, max_length=80)
    party_id: UUID
    party_role: Literal["customer", "supplier", "lender"]
    recipient: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    channel: Literal["email"] = "email"


class DraftRevisionRequest(DraftPreparationRequest):
    expected_preparation_hash: HashHex
    subject: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1, max_length=10000)


class PreparationIdentity(DTO):
    schema_version: Literal["preparation.v1"] = "preparation.v1"
    message_id: UUID
    business_id: UUID
    deal_id: UUID
    evaluation_id: UUID
    snapshot_id: UUID
    snapshot_hash: HashHex
    input_version: Version
    financial_revision: Version
    option: OptionResult
    party_id: UUID
    party_role: Literal["customer", "supplier", "lender"]
    party_version: Version
    recipient: str
    channel: Literal["email"]
    subject: str
    body: str
    terms_hash: HashHex
    previous_message_id: UUID | None
    revision: Version
    created_by: UUID
    created_at: UTCInstant
    expires_at: UTCInstant
    sandbox: Literal[True] = True


class PreparationReview(ExpectedVersions):
    preparation_hash: HashHex
    attestation: str = Field(min_length=10, max_length=2000, pattern=r"\S")


class PreparedMessage(DTO):
    identity: PreparationIdentity
    preparation_hash: HashHex
    provenance: Literal["template", "manual"]
    reviewed: bool
    is_stale: bool
    blockers: list[Text]
    dispatch_eligible: Literal[False] = False
    edit_sentences: list[str]


class ReplyIntake(ExpectedVersions):
    ask_message_id: UUID
    party_id: UUID
    body: str = Field(min_length=1, max_length=10000)


class ReplyTerm(DTO):
    id: UUID
    field: Literal[
        "payment_days",
        "order_value_minor",
        "deposit_pct",
        "supplier_extension_days",
        "financing_draw_minor",
        "acceptance",
    ]
    value: str = Field(min_length=1, max_length=100)
    quote: str = Field(min_length=1, max_length=2000)


Stance = Literal["accept", "reject", "partial", "unclear"]
Quote = Annotated[str, Field(min_length=1, max_length=1000)]
Provenance = Literal["template", "recorded", "live"]


class ReplyReading(DTO):
    """Validated, proposal-only reading of a reply. The stance is advisory evidence."""

    terms: list[ReplyTerm] = Field(default_factory=list, max_length=20)
    conditions: list[Quote] = Field(default_factory=list, max_length=20)
    unsupported_clauses: list[Quote] = Field(default_factory=list, max_length=20)
    stance: Stance | None = None
    provenance: Provenance
    code: str | None = None
    model: str | None = None
    response_id: str | None = None


class ReplyView(DTO):
    id: UUID
    deal_id: UUID
    ask_message_id: UUID
    party_id: UUID
    body: str
    candidates: list[ReplyTerm]
    bank_change: bool
    injection_flagged: bool
    provenance: Literal["template", "recorded", "live"]
    language_code: str | None
    language_supported: bool = False
    language_model: str | None = None
    language_response_id: str | None = None
    language_input_hash: HashHex | None = None
    language_script: str | None = None
    # Verbatim reply quotes. A model may add review attention here; it can never clear a hold.
    conditions: list[Quote] = Field(default_factory=list, max_length=20)
    unsupported_clauses: list[Quote] = Field(default_factory=list, max_length=20)
    model_stance: Stance | None = None
    baseline_stance: Stance = "unclear"
    stance_disagreement: bool = False
    reviewed: bool


class ReplyDecision(ExpectedVersions):
    candidate_ids: list[UUID] = Field(max_length=20)
    decision: Literal["apply", "reject"]
    reason: str = Field(min_length=10, max_length=2000, pattern=r"\S")


class RecordAcceptance(ExpectedVersions):
    message_id: UUID
    preparation_hash: HashHex
    reply_id: UUID | None
    attestation: str = Field(min_length=10, max_length=2000, pattern=r"\S")
    valid_until: UTCInstant
    supersedes_id: UUID | None = None


class AcceptanceEvidence(DTO):
    id: UUID
    deal_id: UUID
    message_id: UUID
    party_id: UUID
    party_role: Literal["customer", "supplier", "lender"]
    terms_hash: HashHex
    preparation_hash: HashHex
    reply_id: UUID | None
    attestation: str
    recorded_by: UUID
    recorded_at: UTCInstant
    valid_until: UTCInstant
    supersedes_id: UUID | None
    is_stale: bool
    attested_not_independently_verified: Literal[True] = True


class Explanation(DTO):
    evaluation_id: UUID
    option_key: str
    sentences: list[str]
    fact_ids: list[str]
    provenance: Literal["template", "recorded", "live"] = "template"
    model: str | None = None
    response_id: str | None = None
    is_stale: bool


class ComparisonOption(DTO):
    base_incremental_profit_minor: MoneyMinor


class ComparisonResult(DTO):
    decision: Literal["accept_as_is", "accept_with_changes", "decline_or_renegotiate"]
    recommended_option_key: str | None
    as_is: ComparisonOption


class ForkSummary(DTO):
    id: UUID
    deal_id: UUID
    changes: list[WhatIfChange]
    outcome: ComparisonResult | BlockedResult
    source_result: ComparisonResult
    provenance: Literal["typed", "template", "recorded", "live"]
    language_code: str | None
    clarification: str | None = Field(default=None, max_length=300)
    is_stale: bool


class PreparationState(DTO):
    deal_id: UUID
    forks: list[ForkSummary]
    messages: list[PreparedMessage]
    replies: list[ReplyView]
    acceptances: list[AcceptanceEvidence]
    clause_assessments: list[ClauseAssessment] = Field(default_factory=list, max_length=20)
    operations: list[Operation]
    # This is a bounded page. Older immutable evidence remains addressable by ID.
    has_more: bool


class OptionCatalogue(DTO):
    evaluation_id: UUID
    options: list[OptionResult]
    is_stale: bool


class ExplainRequest(DTO):
    option_key: str = Field(min_length=1, max_length=80)


class ModelIntent(DTO):
    """Supported changes, or no change (optionally with one clarifying question) - never both."""

    changes: list[WhatIfChange] = Field(default_factory=list, max_length=10)
    clarification: str | None = Field(default=None, min_length=1, max_length=300)

    @model_validator(mode="after")
    def one_outcome(self):
        if self.changes and self.clarification:
            raise ValueError("a clarification replaces changes; never both")
        return self


class IntentResult(DTO):
    changes: list[WhatIfChange] = Field(max_length=10)
    provenance: Literal["template", "recorded", "live"]
    code: str | None
    model: str | None = None
    response_id: str | None = None
    clarification: str | None = Field(default=None, max_length=300)

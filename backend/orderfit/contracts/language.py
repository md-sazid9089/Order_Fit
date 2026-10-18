"""Bounded proposal-only language contracts; no provider invocation."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from .primitives import DTO, HashHex, SourceRole, Text, UTCInstant
from .resources import CashEventInput, DraftInputs
from .workflow import Finding, WhatIfChange


class SourceExcerpt(DTO):
    document_id: UUID
    content_hash: HashHex
    source_role: SourceRole
    page: Annotated[int, Field(strict=True, ge=1, le=50)]
    text: str = Field(max_length=100000)


class LanguageRequest(DTO):
    task: Literal["extract", "reply", "whatif", "explain", "draft"]
    input_schema_version: Text
    input_hash: HashHex
    prompt_version: Text
    sources: list[SourceExcerpt] = Field(max_length=20)
    allowed_fact_ids: list[Text] = Field(max_length=100)
    user_instruction: str | None = Field(max_length=4000)


class Candidate(DTO):
    field: Literal[
        "order_value_minor",
        "opening_cash_minor",
        "payment_days",
        "payment_basis",
        "order_date",
        "invoice_date",
        "delivery_date",
        "costs",
        "financing_offer",
        "acceptance",
        "bank_account_change",
    ]
    normalized_value: str | None = Field(max_length=4000)
    status: Literal["extracted", "ambiguous", "missing", "conflicting"]
    source: SourceExcerpt
    exact_quote: str = Field(max_length=4000)
    # Optional reviewer aid for a non-English quote; never evidence and never used for grounding.
    gloss_en: str | None = Field(default=None, max_length=300)
    # normalized_value remains a candidate; canonical submission uses typed DTOs.


class FactSentence(DTO):
    template: str = Field(max_length=2000)
    fact_ids: list[Text] = Field(max_length=20)


class Proposal(DTO):
    candidates: list[Candidate] = Field(max_length=2000)
    changes: list[WhatIfChange] = Field(max_length=10)
    sentences: list[FactSentence] = Field(max_length=50)
    findings: list[Finding] = Field(max_length=100)


class ParsedLanguage(DTO):
    kind: Literal["parsed"]
    proposal: Proposal
    model: Text
    response_id: Text
    input_hash: HashHex
    prompt_version: Text
    schema_version: Text
    recorded_at: UTCInstant
    input_tokens: Annotated[int, Field(strict=True, ge=0)] | None
    output_tokens: Annotated[int, Field(strict=True, ge=0)] | None
    guard_findings: list[Finding]


class UnavailableLanguage(DTO):
    kind: Literal["refused", "incomplete", "invalid_output", "unavailable"]
    code: Literal[
        "AI_OFF",
        "RECORDING_NOT_FOUND",
        "REFUSAL",
        "INCOMPLETE",
        "INVALID_OUTPUT",
        "TIMEOUT",
        "RATE_LIMIT",
        "QUOTA",
        "PROVIDER_UNAVAILABLE",
    ]
    retryable: bool = Field(strict=True)


class LanguageResult(DTO):
    result: Annotated[ParsedLanguage | UnavailableLanguage, Field(discriminator="kind")]


class TypedJSONImportV1(DTO):
    schema_version: Literal["manual-import.v1"]
    order: DraftInputs | None
    baseline_events: list[CashEventInput] = Field(max_length=2000)
    # Import is a preview proposal. No confirmation or execution authority.

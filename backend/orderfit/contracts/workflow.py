"""Versioned result, review, action and operation contracts; no execution behavior."""

from datetime import timedelta
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StrictBool, model_validator

from .financial import ConfirmedInputV1, Evidence, Extension, SourceRevision
from .primitives import (
    DTO,
    BigId,
    BizDate,
    Bps,
    CashKind,
    Days,
    ExpectedVersions,
    HashHex,
    MoneyMinor,
    NonnegativeMoney,
    PositiveMoney,
    Scenario,
    Text,
    UTCInstant,
    Version,
)


class CreateDeal(DTO):
    public_ref: str = Field(min_length=1, max_length=64, pattern=r"\S")
    start_date: BizDate
    constraints_id: UUID
    customer_id: UUID | None = None


class ConfirmInputs(ExpectedVersions):
    snapshot_hash: HashHex
    confirmed_field_ids: list[BigId] = Field(max_length=2000)
    acknowledged_warning_codes: list[Text] = Field(max_length=100)


class EvaluateRequest(ExpectedVersions):
    snapshot_id: UUID


class Finding(DTO):
    code: Text
    field: str | None
    message: Text
    blocking: StrictBool
    resolution: Literal[
        "correct_input",
        "provide_evidence",
        "acknowledge_coverage",
        "verify_recipient",
        "refresh",
        "unsupported",
    ]
    # Persisted deal_flag identity when this finding projects an unresolved stored flag: the
    # `flag_id` path parameter of flag_resolve. Null for findings computed from inputs, which are
    # cleared by correcting the input, never by flag_resolve.
    flag_id: BigId | None = None
    related_event_ids: list[BigId] = Field(default_factory=list, max_length=200)


class Review(DTO):
    deal_id: UUID
    version: Version
    input_version: Version
    financial_revision: Version
    candidate_snapshot: ConfirmedInputV1 | None
    snapshot_hash: HashHex | None
    findings: list[Finding]
    required_field_ids: list[BigId]


class SnapshotConfirmed(DTO):
    snapshot_id: UUID
    snapshot_hash: HashHex
    approval_id: UUID
    version: Version
    input_version: Version
    financial_revision: Version
    confirmed_at: UTCInstant


class Strategy(DTO):
    kind: Literal["accept", "decline"]
    deposit_pct: Annotated[int, Field(strict=True, ge=0, le=100)]
    extension: Extension
    eligible_cost_keys: list[Text]
    offer_id: UUID | None
    draw_minor: NonnegativeMoney

    @model_validator(mode="after")
    def loan_pair(self):
        if (self.offer_id is None) != (int(self.draw_minor) == 0):
            raise ValueError("loan identity and positive draw must occur together")
        if self.kind == "decline" and (self.deposit_pct or self.extension.days or self.offer_id):
            raise ValueError("decline has no financial levers")
        return self


class Breach(DTO):
    start_date: BizDate
    end_date: BizDate
    worst_headroom_minor: MoneyMinor


class ScenarioSummary(DTO):
    scenario: Scenario
    lowest_balance_minor: MoneyMinor
    lowest_headroom_minor: MoneyMinor
    first_breach_date: BizDate | None
    breaches: list[Breach]
    inherited_baseline_breaches: list[Breach]
    hard_feasible: StrictBool
    meets_target: StrictBool


class Tolerance(DTO):
    status: Literal["fails_on_time", "first_failure", "capped_scan", "proved_nonpayment_survival"]
    observed_safe_days: Annotated[int, Field(strict=True, ge=-1, le=540)] | None
    first_failure_days: Annotated[int, Field(strict=True, ge=0, le=541)] | None
    scan_cap_days: Annotated[int, Field(strict=True, ge=1, le=540)]
    proof_hash: HashHex | None = None

    @model_validator(mode="after")
    def meaningful_null(self):
        if (self.status == "proved_nonpayment_survival") != (self.proof_hash is not None):
            raise ValueError("nonpayment survival requires separate proof evidence")
        if self.status == "fails_on_time" and (
            self.observed_safe_days,
            self.first_failure_days,
        ) != (-1, 0):
            raise ValueError("on-time failure requires -1/0")
        if self.status == "capped_scan" and (
            self.observed_safe_days != self.scan_cap_days or self.first_failure_days is not None
        ):
            raise ValueError("capped scan is not unlimited survival")
        if self.status == "first_failure" and (
            self.observed_safe_days is None
            or self.first_failure_days is None
            or self.first_failure_days != self.observed_safe_days + 1
        ):
            raise ValueError("first failure must follow last safe day")
        if self.status == "proved_nonpayment_survival" and (
            self.observed_safe_days is not None or self.first_failure_days is not None
        ):
            raise ValueError("nonpayment proof is separate from a finite scan")
        return self


class OptionResult(DTO):
    option_key: str = Field(min_length=1, max_length=80)
    rank: Version | None
    parameters: Strategy
    base_incremental_profit_minor: MoneyMinor
    financing_cost_minor: NonnegativeMoney
    borrowed_minor: NonnegativeMoney
    profit_given_up_minor: MoneyMinor
    scenarios: list[ScenarioSummary] = Field(min_length=3, max_length=3)
    tolerance: Tolerance
    hard_feasible: StrictBool
    meets_target: StrictBool

    @model_validator(mode="after")
    def scenario_set(self):
        if {s.scenario for s in self.scenarios} != {"base", "downside", "severe"}:
            raise ValueError("each scenario required once")
        return self


class SensitivityResult(DTO):
    field: Text
    tested_value: Annotated[int, Field(strict=True)]
    decision: Literal[
        "accept_as_is",
        "accept_with_changes",
        "decline_or_renegotiate",
        "needs_input",
        "unsupported_escalate",
        "blocked_data_conflict",
    ]
    recommended_option_key: str | None
    profit_minor: MoneyMinor | None


class EvaluationResultV1(DTO):
    schema_version: Literal["evaluation.v1"]
    id: UUID
    business_id: UUID
    deal_id: UUID
    snapshot_id: UUID
    input_version: Version
    financial_revision: Version
    snapshot_hash: HashHex
    reference_input_hash: HashHex
    calculator_version: Text
    start_date: BizDate
    evaluated_at: UTCInstant
    decision: Literal["accept_as_is", "accept_with_changes", "decline_or_renegotiate"]
    reason_codes: list[Text]
    baseline: list[ScenarioSummary] = Field(min_length=3, max_length=3)
    as_is: OptionResult
    ranked_candidates: list[OptionResult]
    option_catalogue: list[OptionResult] = Field(default_factory=list)
    recommended_option_key: str | None
    summary_scope: Literal["recommended_base", "as_is_base"]
    assumptions: list[Text]
    coverage_through: BizDate
    coverage_gaps: list[Finding]
    voi_questions: list[Text]
    sensitivity: list[SensitivityResult]
    alerts: list[Finding]
    is_stale: StrictBool
    stale_reasons: list[Text]
    allowed_actions: list[Text]

    @model_validator(mode="after")
    def recommendation(self):
        if {s.scenario for s in self.baseline} != {"base", "downside", "severe"}:
            raise ValueError("baseline requires each scenario once")
        keys = [o.option_key for o in self.ranked_candidates]
        if len(keys) != len(set(keys)):
            raise ValueError("duplicate options")
        if self.decision == "decline_or_renegotiate":
            if self.recommended_option_key is not None or self.summary_scope != "as_is_base":
                raise ValueError("decline has no recommended SQL option")
        elif self.recommended_option_key not in keys or self.summary_scope != "recommended_base":
            raise ValueError("recommendation must reference computed option")
        return self


class SeriesPoint(DTO):
    date: BizDate
    baseline_trough_minor: MoneyMinor
    baseline_close_minor: MoneyMinor
    candidate_trough_minor: MoneyMinor
    candidate_close_minor: MoneyMinor
    reserve_minor: NonnegativeMoney
    effective_floor_minor: MoneyMinor


class Series(DTO):
    evaluation_id: UUID | None
    option_key: str
    scenario: Scenario
    currency: Literal["BDT", "USD", "EUR", "GBP"]
    exponent: Literal[2]
    points: list[SeriesPoint] = Field(max_length=1096)


class ErrorDetail(DTO):
    field: str | None = None
    reason: str | None = None
    expected_version: Version | None = None
    current_version: Version | None = None
    expected_input_version: Version | None = None
    current_input_version: Version | None = None
    matching_event_ids: list[BigId] = Field(default_factory=list, max_length=200)
    source_row: int | None = None
    matching_source_rows: list[int] = Field(default_factory=list, max_length=200)


class SafeError(DTO):
    code: Text
    message: Text
    request_id: UUID
    details: ErrorDetail
    retryable: StrictBool


class ErrorEnvelope(DTO):
    error: SafeError


class CompletedResult(DTO):
    kind: Literal["completed"]
    resource_id: UUID
    resource_url: str


class BlockedResult(DTO):
    kind: Literal["blocked"]
    outcome: Literal[
        "needs_input", "unsupported_escalate", "blocked_data_conflict", "stale", "analysis_limit"
    ]
    findings: list[Finding] = Field(min_length=1)


class FailedResult(DTO):
    kind: Literal["failed"]
    error: SafeError


OperationResult = Annotated[
    CompletedResult | BlockedResult | FailedResult, Field(discriminator="kind")
]


class OperationAccepted(DTO):
    operation_id: UUID
    deal_id: UUID | None
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"]
    input_version: Version | None
    financial_revision: Version
    poll_url: str
    result_url: str | None

    @model_validator(mode="after")
    def scope_version(self):
        if (self.deal_id is None) != (self.input_version is None):
            raise ValueError("deal input version exists exactly for a deal-scoped operation")
        return self


class Operation(OperationAccepted):
    version: Version
    kind: Literal[
        "extract", "evaluate", "explain", "draft", "whatif", "reply", "execute", "csv_preview", "advisory"
    ]
    subphase: Text
    queued_at: UTCInstant
    started_at: UTCInstant | None
    finished_at: UTCInstant | None
    attempt: Annotated[int, Field(strict=True, ge=0, le=3)]
    cancellation_requested: StrictBool
    result: OperationResult | None


class CancelOperation(DTO):
    expected_operation_version: Version
    reason: Text


class DelayChange(DTO):
    kind: Literal["customer_delay_days", "ar_delay_days"]
    value: Days


class DepositChange(DTO):
    kind: Literal["deposit_pct"]
    value: Annotated[int, Field(strict=True, ge=0, le=100)]


class ExtensionChange(DTO):
    kind: Literal["supplier_extension"]
    eligible_cost_keys: list[Text] = Field(min_length=1, max_length=2000)
    days: Days


class FinancingChange(DTO):
    kind: Literal["financing"]
    offer_id: UUID
    amount_minor: PositiveMoney


class OverrunChange(DTO):
    kind: Literal["cost_overrun_bps"]
    value: Bps


WhatIfChange = Annotated[
    DelayChange | DepositChange | ExtensionChange | FinancingChange | OverrunChange,
    Field(discriminator="kind"),
]


class WhatIfRequest(DTO):
    schema_version: Literal["whatif.v1"]
    source_snapshot_id: UUID
    expected_input_version: Version
    expected_financial_revision: Version
    changes: list[WhatIfChange] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def no_ambiguous_patch(self):
        if len({c.kind for c in self.changes}) != len(self.changes):
            raise ValueError("duplicate change kind")
        return self


class WhatIfResult(DTO):
    id: UUID
    request: WhatIfRequest
    outcome: EvaluationResultV1 | BlockedResult
    canonical_changed: Literal[False]


class MessageItem(DTO):
    kind: Literal["message"]
    key: Text
    message_id: UUID
    party_id: UUID
    party_version: Version
    recipient: Text
    channel: Literal["email", "whatsapp", "sms", "portal", "other"]
    subject: str | None = Field(max_length=500)
    body: str = Field(min_length=1, max_length=100000)
    terms_hash: HashHex


class LedgerItem(DTO):
    kind: Literal["ledger_entry"]
    key: Text
    payee_id: UUID
    payee_version: Version
    account_id: UUID
    account_version: Version
    amount_minor: PositiveMoney
    scheduled_date: BizDate
    direction: Literal["in", "out"]
    original_obligation_id: Text


class LenderItem(DTO):
    kind: Literal["lender_acceptance"]
    key: Text
    offer_id: UUID
    offer_version: Version
    payee_id: UUID
    amount_minor: PositiveMoney
    scheduled_date: BizDate
    terms_hash: HashHex


class CancellationItem(DTO):
    kind: Literal["cancellation"]
    key: Text
    original_action_id: UUID
    original_payload_hash: HashHex
    reason: Text


class DatedEvent(DTO):
    """One engine-dated incremental cash event of an evaluated option (base scenario).

    Produced only by agent/nodes/compute.py from the engine result and stored immutably with
    the evaluation; commit manifests copy these amounts/dates and never re-derive them.
    """

    event_key: Text
    scope: Literal["order", "financing"]
    source_id: Text
    kind: CashKind
    event_date: BizDate
    amount_minor: PositiveMoney
    direction: Literal["in", "out"]
    certainty: Literal["confirmed", "expected", "assumed"]


class ProjectedEvent(DatedEvent):
    """A dated event the completed commitment projects into the business baseline."""

    original_obligation_id: Text
    supersedes_event_id: BigId | None
    payee_id: UUID | None
    customer_id: UUID | None
    attributed_item_key: Text


class CommitmentItem(DTO):
    kind: Literal["commitment"]
    key: Text
    evaluation_id: UUID
    option_key: str = Field(min_length=1, max_length=80)
    projections: list[ProjectedEvent] = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def unique_projection(self):
        keys = [p.event_key for p in self.projections]
        obligations = [p.original_obligation_id for p in self.projections]
        if len(set(keys)) != len(keys) or len(set(obligations)) != len(obligations):
            raise ValueError("duplicate projected event or obligation")
        if keys != sorted(keys):
            raise ValueError("projections must be in canonical event-key order")
        return self


BundleItem = Annotated[
    MessageItem | LedgerItem | LenderItem | CancellationItem | CommitmentItem,
    Field(discriminator="kind"),
]


class AcceptanceRequirement(DTO):
    party_id: UUID
    party_role: Literal["customer", "supplier", "lender"]
    terms_hash: HashHex
    acceptance_id: UUID | None


class ActionBundleV1(DTO):
    schema_version: Literal["action-bundle.v1"]
    id: UUID
    business_id: UUID
    deal_id: UUID
    evaluation_id: UUID
    option_key: str
    snapshot_id: UUID
    snapshot_hash: HashHex
    input_version: Version
    financial_revision: Version
    source_revisions: list[SourceRevision]
    calculator_version: Text
    kind: Literal["send_message", "commit_plan", "compensate"]
    strategy: Strategy
    required_acceptances: list[AcceptanceRequirement]
    items: list[BundleItem] = Field(min_length=1, max_length=2000)
    created_by: UUID
    created_at: UTCInstant
    expires_at: UTCInstant
    sandbox: Literal[True]

    @model_validator(mode="after")
    def exact_manifest(self):
        if len({i.key for i in self.items}) != len(self.items):
            raise ValueError("duplicate item key")
        allowed = {
            "send_message": {"message"},
            "commit_plan": {"message", "ledger_entry", "lender_acceptance", "commitment"},
            "compensate": {"cancellation"},
        }
        if any(i.kind not in allowed[self.kind] for i in self.items):
            raise ValueError("approval kind cannot authorize item")
        commitments = [i for i in self.items if i.kind == "commitment"]
        if len(commitments) > 1:
            raise ValueError("one commitment item per bundle")
        keys = {i.key for i in self.items}
        for item in commitments:
            if item.evaluation_id != self.evaluation_id or item.option_key != self.option_key:
                raise ValueError("commitment must project the bundle's evaluated option")
            if any(p.attributed_item_key not in keys for p in item.projections):
                raise ValueError("projection attributed to an item outside the manifest")
        # Canonical order is part of the hashed bytes: items by key, acceptances by party.
        if [i.key for i in self.items] != sorted(i.key for i in self.items):
            raise ValueError("items must be in canonical key order")
        parties = [(a.party_role, str(a.party_id)) for a in self.required_acceptances]
        if parties != sorted(set(parties)):
            raise ValueError("required acceptances must be unique and in canonical order")
        if self.kind == "commit_plan" and (
            not self.required_acceptances
            or any(a.acceptance_id is None for a in self.required_acceptances)
        ):
            raise ValueError("commit requires recorded exact-term acceptances")
        if self.kind == "send_message" and self.required_acceptances:
            raise ValueError("send approval does not bind party acceptances")
        if self.expires_at <= self.created_at:
            raise ValueError("bundle already expired")
        if self.expires_at - self.created_at > timedelta(hours=24):
            raise ValueError("bundle expiry exceeds 24 hours")
        return self


class BundleView(DTO):
    manifest: ActionBundleV1
    bundle_hash: HashHex
    allowed_actions: list[Text]
    # Server-derived usability; a client hash or local flag is never authority.
    is_stale: StrictBool = False
    stale_reasons: list[Text] = Field(default_factory=list)
    approval_id: UUID | None = None
    # The bundle's single admitted execution run, once executed.
    run_id: UUID | None = None


class ApprovalRequest(ExpectedVersions):
    bundle_id: UUID
    bundle_hash: HashHex
    decision: Literal["approved", "rejected"]
    step_up_grant_id: UUID | None

    @model_validator(mode="after")
    def grant_required(self):
        if self.decision == "approved" and self.step_up_grant_id is None:
            raise ValueError("outgoing approval requires step-up")
        return self


class ApprovalView(DTO):
    id: UUID
    bundle_id: UUID
    bundle_hash: HashHex
    action: Literal["send_message", "commit_plan", "compensate"]
    decision: Literal["approved", "rejected"]
    approver_id: UUID
    created_at: UTCInstant
    expires_at: UTCInstant
    revoked_at: UTCInstant | None
    is_stale: StrictBool
    stale_reasons: list[Text] = Field(default_factory=list)


class ExecuteRequest(ExpectedVersions):
    approval_id: UUID
    bundle_hash: HashHex


class EffectView(DTO):
    """Locally simulated sandbox effect; no external delivery or payment occurred."""

    effect_kind: Literal["outbox", "ledger", "lender_simulation", "inverse"]
    payload_hash: HashHex
    original_action_id: UUID | None
    created_at: UTCInstant
    sandbox: Literal[True]


class ActionView(DTO):
    id: UUID
    run_id: UUID | None = None
    item_key: Text
    kind: Literal["ledger_entry", "message", "lender_acceptance", "cancellation", "commitment"]
    status: Literal[
        "drafted", "scheduled", "sent", "posted", "accepted", "cancelled", "voided", "failed"
    ]
    executed_at: UTCInstant | None
    failure: SafeError | None
    effect: EffectView | None = None


class SettlementView(DTO):
    settlement_kind: Literal["commit", "compensate"]
    projected_events: Annotated[int, Field(strict=True, ge=0, le=2000)]
    revision_before: Version
    revision_after: Version
    settled_at: UTCInstant


class ExecutionRun(DTO):
    id: UUID
    deal_id: UUID
    bundle_id: UUID
    approval_id: UUID
    operation_id: UUID
    run_kind: Literal["send_message", "commit_plan", "compensate"]
    status: Literal["queued", "running", "succeeded", "partial", "failed", "cancelled"]
    actions: list[ActionView]
    reconciliation_required: StrictBool
    created_at: UTCInstant
    started_at: UTCInstant | None
    finished_at: UTCInstant | None
    settlement: SettlementView | None
    sandbox: Literal[True]


class PartyAcceptance(DTO):
    party_id: UUID
    party_role: Literal["customer", "supplier", "lender"]
    terms_hash: HashHex
    evidence: Evidence
    valid_until: UTCInstant
    supersedes_id: UUID | None


class AcceptanceRequest(ExpectedVersions):
    acceptance: PartyAcceptance

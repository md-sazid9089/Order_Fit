"""Target HTTP resources. Partial financial drafts are distinct from confirmed snapshots."""

from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import (
    AfterValidator,
    Field,
    JsonValue,
    SecretStr,
    StrictBool,
    field_validator,
    model_validator,
)

from .financial import (
    CostInput,
    Evidence,
    OwnerPolicy,
    OwnerSettings,
    Scenarios,
    StrategySpace,
    TermLoan,
    TermLoanTerms,
)
from .primitives import (
    DTO,
    BigId,
    BizDate,
    CashKind,
    Currency,
    Days,
    DealState,
    ExpectedVersions,
    HashHex,
    MoneyMinor,
    NonnegativeMoney,
    PositiveMoney,
    RevisionWrite,
    Role,
    SourceRole,
    Text,
    UTCInstant,
    Version,
)
from .workflow import Finding, Strategy, WhatIfChange


def valid_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError, IsADirectoryError) as exc:
        raise ValueError("unknown IANA timezone") from exc
    return value


Timezone = Annotated[str, Field(max_length=64), AfterValidator(valid_timezone)]
Email = Annotated[str, Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")]


class SignIn(DTO):
    email: Email
    password: SecretStr = Field(min_length=1, max_length=1024)


class SignUp(SignIn):
    password: SecretStr = Field(min_length=12, max_length=1024)
    full_name: Text
    business_name: Text
    currency: Currency
    timezone: Timezone


class PasskeyPassword(DTO):
    password: SecretStr = Field(min_length=1, max_length=1024)


class PasskeyResponse(DTO):
    challenge_id: UUID
    credential: dict[str, JsonValue]

    @field_validator("credential")
    @classmethod
    def bounded_credential(cls, value):
        import json
        if len(json.dumps(value).encode()) > 32768:
            raise ValueError("credential exceeds limit")
        return value


class PasskeyOptions(DTO):
    challenge_id: UUID
    public_key: dict[str, JsonValue]


class Preferences(DTO):
    timezone: Timezone
    language: Literal["en", "bn"]
    in_app_notifications: StrictBool


class UserProfile(DTO):
    full_name: Text
    preferences: Preferences


class ProfileWrite(DTO):
    expected_version: Version
    profile: UserProfile


class Member(DTO):
    user_id: UUID
    email: Email
    full_name: Text
    role: Role
    version: Version
    revoked_at: UTCInstant | None


class MembershipView(DTO):
    business_id: UUID
    business_name: Text
    role: Role


class SessionView(DTO):
    user_id: UUID
    email: Email
    profile: UserProfile
    profile_version: Version
    memberships: list[MembershipView]
    csrf_token: str
    expires_at: UTCInstant
    mfa_supported: bool
    mfa_enabled: bool = False
    email_verified: Literal[False]
    is_platform_admin: bool = False


class CSRFChallenge(DTO):
    csrf_token: str = Field(min_length=32, max_length=512)
    expires_at: UTCInstant


class PasswordChange(DTO):
    current_password: SecretStr = Field(min_length=1, max_length=1024)
    new_password: SecretStr = Field(min_length=12, max_length=1024)


class StepUp(DTO):
    business_id: UUID
    bundle_id: UUID
    bundle_hash: HashHex
    purpose: Literal["send_message", "commit_plan", "compensate"]
    password: SecretStr = Field(min_length=1, max_length=1024)


class StepUpView(DTO):
    grant_id: UUID
    expires_at: UTCInstant
    bundle_hash: HashHex


class InvitationCreate(DTO):
    email: Email
    role: Role
    expected_financial_revision: Version


class InvitationView(DTO):
    id: UUID
    email: Email
    role: Role
    version: Version
    expires_at: UTCInstant
    accepted_at: UTCInstant | None
    revoked_at: UTCInstant | None
    # One-time in-app link carrying the token in the URL fragment; returned only by the
    # original create response (never stored, never replayed).
    invitation_url: str | None


class InvitationAccept(DTO):
    token: SecretStr = Field(min_length=32, max_length=512)


class MembershipWrite(RevisionWrite):
    role: Role


class BusinessProfile(DTO):
    name: Text
    timezone: Timezone
    address: str | None = Field(max_length=1000)
    phone: str | None = Field(max_length=64)
    trade_registration: str | None = Field(max_length=100)
    tax_id: str | None = Field(max_length=100)


class BusinessProfileWrite(RevisionWrite):
    profile: BusinessProfile


class BusinessView(DTO):
    id: UUID
    version: Version
    financial_revision: Version
    currency: Currency
    exponent: Literal[2]
    profile: BusinessProfile


class Capability(DTO):
    name: Text
    status: Literal["implemented", "planned", "disabled", "unavailable"]
    reason: Text | None
    phase: Literal["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]


class Capabilities(DTO):
    contract_version: Literal["api.v1"]
    sandbox_only: Literal[True]
    llm_mode: Literal["off", "recorded", "live"]
    capabilities: list[Capability]


class ConstraintWrite(DTO):
    expected_financial_revision: Version
    reserve_minor: NonnegativeMoney
    owner: OwnerPolicy
    strategy_space: StrategySpace
    scenarios: Scenarios
    make_default: StrictBool

    @model_validator(mode="after")
    def selection_is_deal_scoped(self):
        if self.strategy_space.financing_selection is not None:
            raise ValueError("use a reviewed deal fork for a financing selection")
        return self


class ConstraintsView(DTO):
    id: UUID
    version: Version
    financial_revision: Version
    reserve_minor: NonnegativeMoney
    owner: OwnerSettings
    strategy_space: StrategySpace
    scenarios: Scenarios
    is_default: StrictBool


class CashEventInput(DTO):
    deal_id: UUID | None
    event_date: BizDate
    amount_minor: PositiveMoney
    direction: Literal["in", "out"]
    kind: CashKind
    certainty: Literal["confirmed", "expected", "assumed"]
    description: str | None = Field(max_length=500)
    invoice_ref: str | None = Field(max_length=100)
    is_deferrable: StrictBool
    incremental: StrictBool
    customer_id: UUID | None
    payee_id: UUID | None
    evidence: Evidence

    @model_validator(mode="after")
    def manual_event(self):
        if self.kind.startswith("order_") or self.kind in {
            "loan_draw",
            "loan_fee",
            "loan_interest",
            "loan_repayment",
        }:
            raise ValueError("generated strategy events cannot be manually posted")
        if self.incremental and self.deal_id is None:
            raise ValueError("incremental event requires deal")
        return self


class BaselineBalance(DTO):
    opening_date: BizDate
    opening_cash_minor: MoneyMinor
    coverage_through: BizDate
    evidence: Evidence

    @model_validator(mode="after")
    def coverage(self):
        if self.coverage_through < self.opening_date:
            raise ValueError("coverage precedes opening balance")
        return self


class BaselineWrite(RevisionWrite):
    balance: BaselineBalance


class BaselineView(DTO):
    version: Version
    financial_revision: Version
    balance: BaselineBalance


class CashEventCreate(DTO):
    expected_financial_revision: Version
    event: CashEventInput


class CashEventWrite(RevisionWrite):
    event: CashEventInput


class CashEventView(DTO):
    id: BigId
    version: Version
    financial_revision: Version
    event: CashEventInput
    voided_at: UTCInstant | None


class CustomerInput(DTO):
    name: Text
    known_domains: list[str] = Field(max_length=50)
    red_flags: list[Text] = Field(max_length=50)


class CustomerCreate(DTO):
    expected_financial_revision: Version
    customer: CustomerInput


class CustomerWrite(RevisionWrite):
    customer: CustomerInput


class CustomerView(DTO):
    id: UUID
    version: Version
    financial_revision: Version
    customer: CustomerInput
    archived_at: UTCInstant | None


class InvoiceInput(DTO):
    invoice_ref: str = Field(min_length=1, max_length=100)
    invoice_date: BizDate
    due_date: BizDate
    amount_minor: PositiveMoney
    paid_minor: NonnegativeMoney
    paid_date: BizDate | None

    @model_validator(mode="after")
    def coherent(self):
        if self.due_date < self.invoice_date or int(self.paid_minor) > int(self.amount_minor):
            raise ValueError("invalid invoice dates/paid amount")
        if (int(self.paid_minor) == 0) != (self.paid_date is None):
            raise ValueError("paid date required exactly when paid amount positive")
        return self


class InvoiceImport(DTO):
    expected_financial_revision: Version
    invoices: list[InvoiceInput] = Field(min_length=1, max_length=2000)


class InvoiceView(DTO):
    id: UUID
    customer_id: UUID
    invoice: InvoiceInput


class CustomerHistory(DTO):
    as_of: BizDate
    customer_id: UUID
    paid_count: Annotated[int, Field(strict=True, ge=0)]
    open_overdue_minor: NonnegativeMoney
    context_only: Literal[True]


class PayeeInput(DTO):
    name: Text
    kind: Literal["supplier", "customer", "lender"]
    category: Literal[
        "raw_material", "packaging", "freight_customs", "subcontract", "labour", "finance", "other"
    ]
    terms_days: Days | None
    terms_note: Text | None
    delay_tolerance_note: Text | None
    risk_rating: Literal["low", "medium", "high"] | None
    known_domains: list[str] = Field(max_length=50)


class PayeeCreate(DTO):
    expected_financial_revision: Version
    payee: PayeeInput


class PayeeWrite(RevisionWrite):
    payee: PayeeInput


class PayeeView(DTO):
    id: UUID
    version: Version
    financial_revision: Version
    payee: PayeeInput
    archived_at: UTCInstant | None


class AccountCreate(DTO):
    expected_financial_revision: Version
    bank_name: Text
    account_number: SecretStr = Field(min_length=4, max_length=128)


class AccountView(DTO):
    id: UUID
    payee_id: UUID
    version: Version
    last4: str = Field(pattern=r"^[0-9A-Za-z]{4}$")
    bank_name: Text
    status: Literal["pending", "verified", "revoked"]
    verified_by: UUID | None
    verified_at: UTCInstant | None
    verification_source: Literal["owner_attestation"] | None


class AccountVerification(RevisionWrite):
    evidence: Evidence


class OfferCreate(DTO):
    expected_financial_revision: Version
    terms: TermLoanTerms


class OfferWrite(RevisionWrite):
    terms: TermLoanTerms


class OfferView(DTO):
    id: UUID
    version: Version
    name: Text
    kind: Literal["term_loan", "revolving_overdraft", "receivable_factoring", "po_financing"]
    status: Literal["active", "pre_approved", "closed"]
    terms: TermLoan | None
    supported: StrictBool
    unavailable_reason: Text | None
    financial_revision: Version
    archived_at: UTCInstant | None

    @model_validator(mode="after")
    def supported_terms(self):
        if self.supported:
            if self.kind != "term_loan" or self.status == "closed" or self.terms is None:
                raise ValueError("supported offer requires active complete term loan")
            if (self.terms.offer_id, self.terms.version) != (self.id, self.version):
                raise ValueError("offer identity/version mismatch")
        elif self.unavailable_reason is None:
            raise ValueError("unavailable offer needs reason")
        return self


class DraftInputs(DTO):
    opening_cash_minor: MoneyMinor | None
    reserve_minor: NonnegativeMoney | None
    order_value_minor: PositiveMoney | None
    order_date: BizDate | None
    invoice_date: BizDate | None
    delivery_date: BizDate | None
    payment_basis: Literal["invoice", "delivery", "order"] | None
    payment_days: Days | None
    customer_id: UUID | None
    constraints_id: UUID
    costs: list[CostInput] = Field(max_length=2000)


class DealWrite(ExpectedVersions):
    inputs: DraftInputs


class DealView(DTO):
    id: UUID
    public_ref: str = Field(min_length=1, max_length=64)
    status: DealState
    version: Version
    input_version: Version
    financial_revision: Version
    currency: Currency
    exponent: Literal[2]
    start_date: BizDate
    opening_cash_minor: MoneyMinor | None
    order_value_minor: PositiveMoney | None
    inputs: DraftInputs
    live_evaluation_id: UUID | None
    # Completed outbound negotiation rounds (workflow state, not a financial input).
    negotiation_round: Annotated[int, Field(strict=True, ge=0, le=3)] = 0
    is_stale: StrictBool
    findings: list[Finding]
    allowed_actions: list[Text]


class DocumentUpload(DTO):
    """Multipart: metadata is JSON; file is binary (not a filename or URL)."""

    kind: Literal[
        "po", "quote", "cash", "bills", "financing", "constraints", "reply", "csv", "other"
    ]
    source_role: SourceRole
    expected_version: Version
    expected_input_version: Version
    expected_financial_revision: Version

    @model_validator(mode="after")
    def source_meaning(self):
        roles = {
            "po": {"customer_order"},
            "quote": {"customer_sales_quote", "supplier_cost_quote"},
            "cash": {"baseline"},
            "bills": {"baseline", "supplier_cost_quote"},
            "financing": {"financing"},
            "constraints": {"owner_constraints"},
            "reply": {"reply"},
            "csv": {"baseline"},
            "other": {"other"},
        }
        if self.source_role not in roles[self.kind]:
            raise ValueError("document kind/source role mismatch")
        return self


class DocumentView(DTO):
    id: UUID
    deal_id: UUID
    kind: str
    source_role: SourceRole
    content_hash: HashHex
    original_filename: str = Field(max_length=255)
    mime_type: Literal["application/pdf", "text/plain", "text/csv", "application/json"]
    size_bytes: Annotated[int, Field(strict=True, ge=1, le=26214400)]
    uploaded_at: UTCInstant
    parse_status: Literal["pending", "parsed", "failed", "ocr_required"]
    untrusted: Literal[True]
    download_url: str


class FieldResolution(ExpectedVersions):
    field_id: BigId
    selected_candidate_id: UUID | None
    resolution: Literal["confirmed", "overridden", "rejected"]
    evidence: Evidence


class BankVerificationResolution(DTO):
    """Clears a P5-BANK-CHANGE hold only with the exact reply and a verified account."""

    reply_id: UUID
    account_id: UUID
    written_evidence: str = Field(min_length=12, max_length=2000, pattern=r"\S")


class FlagResolution(ExpectedVersions):
    evidence: Evidence
    reason: Text
    # Required exactly for a P5-BANK-CHANGE hold (T3 only); rejected for other flags.
    bank_verification: BankVerificationResolution | None = None


class CSVPreviewRequest(DTO):
    document_id: UUID
    currency: Currency
    expected_financial_revision: Version
    as_of: BizDate


class CSVPreview(DTO):
    id: UUID
    preview_hash: HashHex
    financial_revision: Version
    events: list[CashEventInput] = Field(max_length=2000)
    errors: list[Finding]
    duplicate_keys: list[Text]
    canonical_changed: Literal[False]


class CSVConfirm(DTO):
    preview_id: UUID
    preview_hash: HashHex
    expected_financial_revision: Version


class DraftRequest(ExpectedVersions):
    evaluation_id: UUID
    option_key: str
    party_ids: list[UUID] = Field(min_length=1, max_length=20)
    language: Literal["en", "bn"]


class DraftEdit(ExpectedVersions):
    subject: str | None = Field(max_length=500)
    body: str = Field(min_length=1, max_length=100000)
    party_id: UUID
    channel: Literal["email", "whatsapp", "sms", "portal", "other"]


class MessageView(DTO):
    id: UUID
    deal_id: UUID
    version: Version
    direction: Literal["inbound", "outbound"]
    status: Literal["draft", "approved", "sent", "received", "discarded"]
    party_id: UUID
    subject: str | None
    body: str
    body_hash: HashHex
    bundle_id: UUID | None
    created_at: UTCInstant
    provenance: Literal["manual", "template", "recorded", "live"]


class ReplyRequest(ExpectedVersions):
    ask_message_id: UUID
    document_id: UUID
    party_id: UUID


class ReplyReview(ExpectedVersions):
    candidate_id: UUID
    evidence: Evidence
    changes: list[WhatIfChange]


class PrepareBundle(ExpectedVersions):
    evaluation_id: UUID
    option_key: str = Field(min_length=1, max_length=80)
    kind: Literal["send_message", "commit_plan"]
    # Exact frozen P5 messages; commit may also carry confirmation messages (outbox).
    message_ids: list[UUID] = Field(max_length=20)
    # Echo of the evaluated option's parameters; the server rejects any difference.
    strategy: Strategy

    @model_validator(mode="after")
    def unique_messages(self):
        if len(set(self.message_ids)) != len(self.message_ids):
            raise ValueError("duplicate message")
        if self.kind == "send_message" and not self.message_ids:
            raise ValueError("send bundle requires at least one prepared message")
        return self


class CompensationRequest(ExpectedVersions):
    original_run_id: UUID
    original_action_ids: list[UUID] = Field(min_length=1, max_length=2000)
    reason: Text


class AcceptanceView(DTO):
    id: UUID
    party_id: UUID
    terms_hash: HashHex
    recorded_by: UUID
    recorded_at: UTCInstant
    valid_until: UTCInstant
    attested_not_independently_verified: Literal[True]


class Notification(DTO):
    id: BigId
    user_id: UUID
    deal_id: UUID | None
    severity: Literal["info", "warning", "critical"]
    title: Text
    message: Text
    action_url: str | None
    created_at: UTCInstant
    read_at: UTCInstant | None


class NotificationsRead(DTO):
    """Marks the caller's own unread notifications with id <= through_id as read."""

    through_id: BigId


class AuditRow(DTO):
    id: BigId
    sequence: BigId
    canonical_text: str
    previous_hash: HashHex | None
    row_hash: HashHex


class AuditExport(DTO):
    schema_version: Literal["audit-export.v1"]
    canonicalization: Literal["postgres-jsonb-array-text.v1"]
    business_id: UUID
    exported_at: UTCInstant
    from_sequence: BigId | None
    to_sequence: BigId | None
    predecessor_hash: HashHex | None
    head_sequence: BigId | None
    head_hash: HashHex | None
    rows: list[AuditRow]
    external_anchor: None
    limitations: list[Text]


class ExportView(DTO):
    id: UUID
    schema_version: Literal["decision-export.v1", "cash-csv.v1"]
    content_hash: HashHex
    download_url: str
    expires_at: UTCInstant


class Health(DTO):
    status: Literal["ok"]


class Readiness(DTO):
    status: Literal["ready", "unavailable"]
    database: StrictBool
    schema_current: StrictBool
    storage: StrictBool
    worker: StrictBool
    backlog_seconds: Annotated[int, Field(strict=True, ge=0)] | None = None


class ExtractionCandidateView(DTO):
    id: UUID
    field: str
    value: str | None
    status: Literal["extracted", "ambiguous", "missing", "conflicting"]
    source_page: Annotated[int, Field(strict=True, ge=1, le=50)] | None
    source_quote: str | None = Field(max_length=2000)
    confidence: Annotated[float, Field(ge=0, le=1)]
    source_role: SourceRole | None
    flags: list[str]
    # Provenance of the proposal: the extraction run's mode/model, the detected language and
    # script of the source page, and an optional reviewer-only English gloss (never evidence).
    provenance: Literal["recorded", "live"] | None = None
    model: str | None = Field(default=None, max_length=128)
    page_language: str | None = Field(default=None, max_length=16)
    page_script: str | None = Field(default=None, max_length=16)
    gloss_en: str | None = Field(default=None, max_length=300)


class ExtractedFieldView(DTO):
    field_id: BigId
    document_id: UUID
    field: str
    value: str | None
    status: Literal[
        "extracted", "ambiguous", "missing", "conflicting", "confirmed", "overridden", "rejected"
    ]
    candidate_id: UUID | None
    candidates: list[ExtractionCandidateView]
    version: Version

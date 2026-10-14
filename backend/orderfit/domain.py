"""Domain contracts shared by agent/, api/ and store/.

The engine does not import this module. ``agent/nodes/compute.py`` translates a
confirmed Deal into ``engine.models.EngineInput`` — the one crossing point.

Every record carries ``business_id``: all store queries are scoped by it, and
document de-duplication is per business, never global.
"""

from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from orderfit.engine.constants import MAX_PAYMENT_DAYS


class SourceRef(BaseModel):
    document_hash: str
    quote: str  # the exact text the figure came from
    confidence: float = Field(ge=0, le=1)


class PaymentBasis(StrEnum):
    INVOICE = "invoice"
    DELIVERY = "delivery"


class OrderTerms(BaseModel):
    """What extraction produces and the owner confirms."""

    order_value_minor: int = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)
    delivery_date: date
    payment_days: int = Field(ge=0, le=MAX_PAYMENT_DAYS)
    payment_basis: PaymentBasis | None  # None = ambiguous: confirm step must ask (D-01)
    cancellation_clause: str | None = None
    late_penalty_bps_per_day: int | None = Field(default=None, ge=0)
    sources: dict[str, SourceRef] = {}  # one per extracted field


class SupplierQuote(BaseModel):
    total_minor: int = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)
    due_date: date
    deposit_minor: int = Field(ge=0, default=0)
    bank_account_ref: str | None = None  # masked; compared against known accounts
    sender_domain: str | None = None
    sources: dict[str, SourceRef] = {}


class TrustLevel(StrEnum):
    NEW = "new"
    RELIABLE = "reliable"
    WEAKENING = "weakening"
    DOWNTURN = "downturn"


class Business(BaseModel):
    business_id: str
    name: str
    currency: str = Field(min_length=3, max_length=3)
    cash_today_minor: int
    reserve_minor: int = Field(ge=0)
    known_bank_accounts: list[str] = []  # baseline for the fraud guard (F-01)
    known_domains: list[str] = []  # baseline for domain-mismatch checks (F-02)


class Customer(BaseModel):
    customer_id: str
    business_id: str
    name: str
    trust_level: TrustLevel
    avg_days_late: int = 0
    red_flags: list[str] = []
    known_domains: list[str] = []


class FlagKind(StrEnum):
    AMBIGUITY = "ambiguity"
    INJECTION = "injection"
    FRAUD = "fraud"
    VALIDATION = "validation"
    OVERRIDE = "override"


class Flag(BaseModel):
    kind: FlagKind
    code: str  # catalogue id, e.g. D-01, F-01
    message: str
    field: str | None = None
    blocking: bool = False  # blocking flags stop the workflow until the owner resolves them


class DealStatus(StrEnum):
    INGESTING = "ingesting"
    AWAITING_CONFIRM = "awaiting_confirm"
    COMPUTING = "computing"
    AWAITING_APPROVAL = "awaiting_approval"
    AWAITING_REPLY = "awaiting_reply"
    CLOSED = "closed"
    FAILED = "failed"


class Deal(BaseModel):
    deal_id: str
    business_id: str
    customer_id: str
    status: DealStatus
    order: OrderTerms | None = None
    quote: SupplierQuote | None = None
    negotiation_round: int = Field(ge=0, le=3, default=0)
    created_at: datetime


class Decision(StrEnum):
    APPROVED = "approved"
    EDITED = "edited"
    REJECTED = "rejected"


class Approval(BaseModel):
    deal_id: str
    business_id: str
    action_id: str  # idempotency key of the pending action
    approver: str
    decision: Decision
    edited_text: str | None = None
    at: datetime


class Actor(StrEnum):
    OWNER = "owner"
    AGENT = "agent"
    ENGINE = "engine"
    SYSTEM = "system"


class AuditEntry(BaseModel):
    business_id: str
    deal_id: str | None
    actor: Actor
    event: str  # ai_call, engine_run, guard_block, override, approval, send, ...
    details: dict
    at: datetime

"""Complete confirmed inputs. Semantic validation is independent of storage or HTTP."""

from datetime import date, timedelta
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StrictBool, model_validator

from .primitives import (
    BIGINT_MAX,
    DTO,
    BigId,
    BizDate,
    Bps,
    CashKind,
    Currency,
    Days,
    HashHex,
    MoneyMinor,
    NonnegativeMoney,
    PositiveMoney,
    Scenario,
    SourceRole,
    Text,
    Version,
)


class Evidence(DTO):
    document_id: UUID | None
    content_hash: HashHex | None
    candidate_id: UUID | None
    confirmed_field_id: BigId | None
    source_role: SourceRole
    page: Annotated[int, Field(strict=True, ge=1, le=50)] | None
    quote: Annotated[str, Field(max_length=100000)] | None
    manual_attestation: Text | None
    override_reason: Text | None

    @model_validator(mode="after")
    def grounded(self):
        if self.document_id is None:
            if self.manual_attestation is None or any(
                v is not None for v in (self.content_hash, self.page, self.quote, self.candidate_id)
            ):
                raise ValueError(
                    "manual evidence requires attestation and no invented document citation"
                )
        elif self.content_hash is None or not self.quote:
            raise ValueError("document evidence needs actual hash and quote")
        return self


class BaselineEvent(DTO):
    event_id: BigId
    event_date: BizDate
    amount_minor: PositiveMoney
    direction: Literal["in", "out"]
    kind: CashKind
    certainty: Literal["confirmed", "expected", "assumed"]
    invoice_ref: str | None = Field(max_length=100)
    original_obligation_id: str
    projection_action_id: UUID | None
    evidence: list[Evidence] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def not_generated(self):
        if (
            self.kind
            in {
                "order_deposit",
                "order_receipt",
                "order_final_receipt",
                "order_stage_receipt",
                "loan_draw",
                "loan_fee",
                "loan_interest",
                "loan_repayment",
            }
            and self.projection_action_id is None
        ):
            raise ValueError("generated events require completed commitment attribution")
        return self


class CostInput(DTO):
    event_id: BigId | None
    cost_key: Text
    event_date: BizDate
    amount_minor: PositiveMoney
    kind: Literal["supplier_payment", "labour", "freight", "subcontract", "existing_inventory"]
    is_deferrable: StrictBool
    incremental: StrictBool
    nonincremental_reason: Text | None
    invoice_ref: str | None = Field(max_length=100)
    payee_id: UUID | None
    original_obligation_id: str
    evidence: list[Evidence] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def explained(self):
        if not self.incremental and self.nonincremental_reason is None:
            raise ValueError("nonincremental costs require explanation")
        if self.kind == "existing_inventory" and self.incremental:
            raise ValueError("existing inventory is not a new cash purchase")
        return self


class OrderInput(DTO):
    customer_id: UUID
    customer_version: Version
    po_number: Text
    order_value_minor: PositiveMoney
    order_date: BizDate | None
    invoice_date: BizDate | None
    delivery_date: BizDate
    payment_basis: Literal["invoice", "delivery", "order"]
    payment_days: Days
    convention: Literal["calendar"]
    deposit_discount_bps: Bps
    deposit_discount_bps_per_10pct: Bps
    cancellation_clause: Text | None
    late_penalty_bps_per_day: None
    costs: list[CostInput] = Field(max_length=2000)

    @model_validator(mode="after")
    def anchor_present(self):
        if getattr(self, f"{self.payment_basis}_date") is None:
            raise ValueError("payment anchor missing")
        return self


class TermLoanTerms(DTO):
    name: Text
    kind: Literal["term_loan"]
    interest_method: Literal["flat_term"]
    interest_bps: Bps
    fee_bps: Bps
    fee_flat_minor: NonnegativeMoney
    fee_at: Literal["draw", "repayment"]
    lead_days: Days
    min_minor: PositiveMoney
    max_minor: PositiveMoney
    step_minor: PositiveMoney
    term_days: Annotated[int, Field(strict=True, ge=1, le=540)]
    available_from: BizDate
    valid_until: BizDate
    status: Literal["active", "pre_approved"]
    payee_id: UUID
    payee_version: Version
    account_id: UUID | None
    account_version: Version | None
    evidence: list[Evidence] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def coherent(self):
        if int(self.min_minor) > int(self.max_minor):
            raise ValueError("minimum exceeds maximum")
        if (int(self.max_minor) - int(self.min_minor)) // int(self.step_minor) + 1 > 200:
            raise ValueError("offer grid exceeds 200 points")
        if self.valid_until < self.available_from:
            raise ValueError("invalid availability window")
        if (self.account_id is None) != (self.account_version is None):
            raise ValueError("account identity/version must occur together")
        return self


class TermLoan(TermLoanTerms):
    offer_id: UUID
    version: Version


Priority = Literal[
    "profit",
    "robustness",
    "independence_any",
    "independence_customer",
    "simplicity",
    "low_financing_cost",
]


class OwnerPolicy(DTO):
    priorities: list[Priority] = Field(min_length=1, max_length=6)
    min_order_profit_minor: NonnegativeMoney
    max_financing_cost_minor: NonnegativeMoney | None
    target_scenario: Scenario
    close_call_bps: Bps
    max_deposit_concession_bps: Bps | None
    max_supplier_extension_days: Days | None
    max_negotiation_rounds: Annotated[int, Field(strict=True, ge=1, le=3)]
    # SQL defaults are informational until explicitly migrated; activation is rejected.
    min_delay_tolerance_days: None = None
    max_customer_concentration_bps: None = None
    max_financing_cost_bps: None = None

    @model_validator(mode="after")
    def unique_priorities(self):
        if len(set(self.priorities)) != len(self.priorities):
            raise ValueError("duplicate priorities")
        return self


class OwnerSettings(OwnerPolicy):
    constraints_id: UUID
    version: Version


class Extension(DTO):
    days: Days
    surcharge_bps: Bps


class StrategySpace(DTO):
    deposit_pcts: list[Annotated[int, Field(strict=True, ge=0, le=100)]] = Field(
        min_length=1, max_length=101
    )
    deposit_lead_days: Days
    extensions: list[Extension] = Field(min_length=1, max_length=366)
    offer_ids: list[UUID] = Field(max_length=20)
    stages: Literal[1] = 1

    @model_validator(mode="after")
    def unique_grid(self):
        for values in (self.deposit_pcts, [e.days for e in self.extensions], self.offer_ids):
            if len(values) != len(set(values)):
                raise ValueError("duplicate strategy dimension")
        return self


class Stress(DTO):
    order_receipt_delay_days: Days
    ar_delay_days: Days
    cost_overrun_bps: Bps
    deposit_follows_delay: StrictBool
    order_receipt_haircut_bps: Bps


class Scenarios(DTO):
    downside: Stress
    severe: Stress

    @model_validator(mode="after")
    def ordered(self):
        if self.downside.order_receipt_delay_days > self.severe.order_receipt_delay_days:
            raise ValueError("severe delay precedes downside")
        return self


class SensitivityRequest(DTO):
    field: Literal[
        "deposit_discount_bps_per_10pct",
        "downside_order_delay_days",
        "downside_ar_delay_days",
        "severe_cost_overrun_bps",
        "deposit_lead_days",
    ]
    values: list[Annotated[int, Field(strict=True, ge=0, le=10000)]] = Field(
        min_length=1, max_length=20
    )

    @model_validator(mode="after")
    def field_bounds(self):
        limit = (
            10000
            if self.field in {"deposit_discount_bps_per_10pct", "severe_cost_overrun_bps"}
            else 365
        )
        if any(v > limit for v in self.values):
            raise ValueError("sensitivity value outside field bounds")
        return self


class AnalysisConfig(DTO):
    scan_days: Annotated[int, Field(strict=True, ge=1, le=540)]
    max_horizon_days: Literal[1095]
    max_work_units: Annotated[int, Field(strict=True, ge=1, le=100_000_000)]
    sensitivity: list[SensitivityRequest] = Field(max_length=10)
    uncertainty_questions: list[Text] = Field(max_length=20)


class SourceRevision(DTO):
    resource_kind: Literal[
        "document",
        "candidate",
        "cash_event",
        "offer",
        "payee",
        "account",
        "customer",
        "constraints",
    ]
    resource_id: str = Field(min_length=1, max_length=100)
    revision: Version
    content_hash: HashHex

    @model_validator(mode="after")
    def resource_identity(self):
        if self.resource_kind == "cash_event":
            if (
                not self.resource_id.isascii()
                or not self.resource_id.isdigit()
                or not 0 < int(self.resource_id) <= BIGINT_MAX
                or self.resource_id.startswith("0")
            ):
                raise ValueError("cash event source requires canonical BIGINT identity")
        else:
            try:
                if str(UUID(self.resource_id)) != self.resource_id:
                    raise ValueError("noncanonical UUID")
            except ValueError as exc:
                raise ValueError("source requires UUID identity") from exc
        return self


class ConfirmedInputV1(DTO):
    schema_version: Literal["confirmed-input.v1"]
    business_id: UUID
    deal_id: UUID
    input_version: Version
    financial_revision: Version
    source_revisions: list[SourceRevision] = Field(max_length=5000)
    start_date: BizDate
    currency: Currency
    exponent: Literal[2]
    opening_cash_minor: MoneyMinor
    reserve_minor: NonnegativeMoney
    baseline_revision: Version
    coverage_through: BizDate
    balance_evidence: list[Evidence] = Field(min_length=1, max_length=20)
    baseline_events: list[BaselineEvent] = Field(max_length=2000)
    order: OrderInput
    offers: list[TermLoan] = Field(max_length=20)
    owner: OwnerSettings
    strategy_space: StrategySpace
    scenarios: Scenarios
    analysis: AnalysisConfig
    assumptions: list[Text] = Field(max_length=100)
    conflict_resolutions: list[Evidence] = Field(max_length=2000)
    coverage_acknowledgement: Text | None

    @model_validator(mode="after")
    def complete(self):
        events = self.baseline_events + self.order.costs
        if len(events) > 2000:
            raise ValueError("event limit")
        if any(e.event_date < self.start_date for e in events):
            raise ValueError("past events require opening balance reconciliation")
        if self.order.delivery_date < self.start_date or self.coverage_through < self.start_date:
            raise ValueError("delivery/coverage precedes as-of")
        obligations = [e.original_obligation_id for e in self.baseline_events] + [
            e.original_obligation_id for e in self.order.costs if e.incremental
        ]
        keys = [e.event_id for e in self.baseline_events] + [e.cost_key for e in self.order.costs]
        if len(set(obligations)) != len(obligations) or len(set(keys)) != len(keys):
            raise ValueError("duplicate obligation or event key")
        offers = {o.offer_id: o for o in self.offers}
        if (
            len(offers) != len(self.offers)
            or not set(self.strategy_space.offer_ids) <= offers.keys()
        ):
            raise ValueError("duplicate or unknown offer")
        if any(o.valid_until < self.start_date for o in self.offers):
            raise ValueError("expired offer")
        if any(p > 0 for p in self.strategy_space.deposit_pcts) and self.order.order_date is None:
            raise ValueError("deposit requires explicit order date")
        for pct in self.strategy_space.deposit_pcts:
            if pct:
                concession_bps = (
                    self.order.deposit_discount_bps
                    + self.order.deposit_discount_bps_per_10pct * pct // 10
                )
                cap = self.owner.max_deposit_concession_bps
                if concession_bps > 10000 or (cap is not None and concession_bps > cap):
                    raise ValueError("deposit concession exceeds supported policy")
        ext_limit = self.owner.max_supplier_extension_days
        if ext_limit is not None and any(
            e.days > ext_limit for e in self.strategy_space.extensions
        ):
            raise ValueError("extension exceeds pinned policy")
        points = 1 + sum(
            (int(o.max_minor) - int(o.min_minor)) // int(o.step_minor) + 1
            for o in self.offers
            if o.offer_id in self.strategy_space.offer_ids
        )
        combinations = (
            len(self.strategy_space.deposit_pcts) * len(self.strategy_space.extensions) * points
        )
        if combinations > 10000:
            raise ValueError("strategy limit")
        work = combinations * (self.analysis.scan_days + 3) * max(1, len(events))
        work *= 1 + sum(len(s.values) for s in self.analysis.sensitivity)
        if work > self.analysis.max_work_units:
            raise ValueError("analysis work limit")
        # Conservative bound includes all cash, extension+stress costs, revenue, principal,
        # interest and fees across the full grid. Python integers cannot overflow.
        total = (
            abs(int(self.opening_cash_minor))
            + int(self.reserve_minor)
            + int(self.order.order_value_minor) * 2
        )
        total += sum(int(e.amount_minor) * 4 for e in events)
        total += sum(int(o.max_minor) * 4 + int(o.fee_flat_minor) for o in self.offers)
        if total > BIGINT_MAX:
            raise ValueError("expanded aggregate exceeds BIGINT")
        # Bound the complete possible horizon, including scan and late funding.
        delay = max(
            self.scenarios.downside.order_receipt_delay_days,
            self.scenarios.severe.order_receipt_delay_days,
            self.analysis.scan_days,
        )
        ar_delay = max(self.scenarios.downside.ar_delay_days, self.scenarios.severe.ar_delay_days)
        ext = max(e.days for e in self.strategy_space.extensions)
        sensitivity = {s.field: max(s.values) for s in self.analysis.sensitivity}
        delay = max(delay, sensitivity.get("downside_order_delay_days", 0))
        ar_delay = max(ar_delay, sensitivity.get("downside_ar_delay_days", 0))
        ends = [
            self.order.delivery_date,
            getattr(self.order, f"{self.order.payment_basis}_date")
            + timedelta(days=self.order.payment_days + delay),
        ]
        ends += [
            e.event_date
            + timedelta(
                days=ar_delay if e.kind == "ar_collection" and e.certainty != "confirmed" else 0
            )
            for e in self.baseline_events
        ]
        ends += [
            e.event_date + timedelta(days=ext if e.is_deferrable else 0) for e in self.order.costs
        ]
        if any(self.strategy_space.deposit_pcts):
            deposit_date = self.order.order_date + timedelta(
                days=max(
                    self.strategy_space.deposit_lead_days, sensitivity.get("deposit_lead_days", 0)
                )
            )
            if deposit_date < self.start_date:
                raise ValueError("past deposit requires reconciliation")
            ends.append(deposit_date + timedelta(days=delay))
        for offer in self.offers:
            draw = max(self.start_date + timedelta(days=offer.lead_days), offer.available_from)
            if draw > offer.valid_until:
                raise ValueError("offer expires before funding")
            ends.append(draw + timedelta(days=offer.term_days))
        horizon = max(ends)
        if (
            horizon > date(2100, 12, 31)
            or (horizon - self.start_date).days > self.analysis.max_horizon_days
        ):
            raise ValueError("analysis horizon exceeds supported bounds")
        if horizon > self.coverage_through and self.coverage_acknowledgement is None:
            raise ValueError("coverage gap requires explicit acknowledgement")
        days = (horizon - self.start_date).days + 1
        daily_work = combinations * (self.analysis.scan_days + 3) * max(1, len(events), days)
        daily_work *= 1 + sum(len(s.values) for s in self.analysis.sensitivity)
        if daily_work > self.analysis.max_work_units:
            raise ValueError("analysis daily sweep work limit")
        return self

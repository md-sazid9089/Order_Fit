"""Strict financial-only contracts; no HTTP, storage, source text or implicit time."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, timedelta
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, JsonValue, model_validator


def business_date(value):
    if isinstance(value, str) and len(value) == 10:
        value = date.fromisoformat(value)
    if type(value) is not date or not date(2000, 1, 1) <= value <= date(2100, 12, 31):
        raise ValueError("ISO business date within 2000..2100 required")
    return value


Date = Annotated[date, BeforeValidator(business_date)]
Money = Annotated[int, Field(ge=-9_000_000_000_000_000, le=9_000_000_000_000_000)]
Positive = Annotated[Money, Field(gt=0)]
Nonnegative = Annotated[Money, Field(ge=0)]
Days = Annotated[int, Field(ge=0, le=365)]
Bps = Annotated[int, Field(ge=0, le=10000)]
ScenarioName = Literal["base", "downside", "severe"]
Priority = Literal[
    "profit",
    "robustness",
    "independence_any",
    "independence_customer",
    "simplicity",
    "low_financing_cost",
]


class Frozen(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)


class EventInput(Frozen):
    id: str
    date: Date
    amount: Positive
    direction: Literal["in", "out"]
    kind: Literal[
        "payroll",
        "rent",
        "tax",
        "ap_payment",
        "ar_collection",
        "loan_installment",
        "supplier_payment",
        "labour",
        "freight",
        "subcontract",
        "existing_inventory",
        "order_deposit",
        "order_receipt",
        "order_final_receipt",
        "order_stage_receipt",
        "loan_draw",
        "loan_fee",
        "loan_interest",
        "loan_repayment",
        "other",
    ]
    certainty: Literal["confirmed", "expected", "assumed"] = "confirmed"
    ccy: Literal["BDT", "USD", "EUR", "GBP"] | None = None
    invoice_ref: str | None = None


class Cost(Frozen):
    id: str
    date: Date
    amount: Positive
    kind: Literal["supplier_payment", "labour", "freight", "subcontract", "existing_inventory"]
    incremental: bool
    deferrable: bool
    ccy: Literal["BDT", "USD", "EUR", "GBP"] | None = None
    invoice_ref: str | None = None


class Terms(Frozen):
    anchor: Literal["order", "invoice", "delivery", "unknown"] | None
    days: Days
    convention: Literal["calendar"] = "calendar"


class Order(Frozen):
    revenue: Positive
    anchor_dates: dict[Literal["order", "invoice", "delivery"], Date | None]
    terms: Terms
    costs: list[Cost] = Field(max_length=2000)
    deposit_discount_bps: Bps = 0
    deposit_discount_bps_per_10pct: Bps = 0


class FinancingOffer(Frozen):
    offer_id: str
    name: str
    shape: Literal["term_loan"]
    interest_bps: Bps
    fee_bps: Bps
    fee_flat: Nonnegative
    fee_at: Literal["draw", "repayment"]
    lead_days: Days
    min: Positive
    max: Positive
    step: Positive
    term_days: Annotated[int, Field(ge=1, le=540)]
    available_from: Date | None = None
    valid_until: Date | None = None

    @model_validator(mode="after")
    def grid(self):
        if self.min > self.max or (self.max - self.min) // self.step + 1 > 200:
            raise ValueError("invalid or excessive draw grid")
        return self


class Owner(Frozen):
    priorities: list[Priority] = Field(min_length=1, max_length=6)
    min_order_profit: Nonnegative
    max_financing_cost: Nonnegative | None
    target_scenario: ScenarioName
    close_call_bps: Bps
    max_deposit_concession_bps: Bps | None = None
    max_supplier_extension_days: Days | None = None
    min_delay_tolerance_days: None = None
    max_customer_concentration_bps: None = None
    max_financing_cost_bps: None = None


class Extension(Frozen):
    days: Days
    surcharge_bps: Bps


class Space(Frozen):
    deposit_pcts: list[Annotated[int, Field(ge=0, le=100)]] = Field(min_length=1, max_length=101)
    deposit_lead_days: Days
    extensions: list[Extension] = Field(min_length=1, max_length=366)
    offer_ids: list[str] = Field(max_length=20)
    stages: list[Literal[1]] = [1]


class Stress(Frozen):
    order_receipt_delay_days: Days = 0
    ar_delay_days: Days = 0
    cost_overrun_bps: Bps = 0
    deposit_follows_customer_delay: bool = True
    order_receipt_haircut_bps: Bps = 0


SENSITIVITY_PATHS = Literal[
    "order.deposit_discount_bps_per_10pct",
    "scenarios.downside.order_receipt_delay_days",
    "scenarios.downside.ar_delay_days",
    "scenarios.severe.cost_overrun_bps",
    "strategy_space.deposit_lead_days",
]


class Sensitivity(Frozen):
    path: SENSITIVITY_PATHS
    values: list[Annotated[int, Field(ge=0, le=10000)]] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def field_bounds(self):
        basis_points = {
            "order.deposit_discount_bps_per_10pct",
            "scenarios.severe.cost_overrun_bps",
        }
        if self.path not in basis_points and any(value > 365 for value in self.values):
            raise ValueError("sensitivity day value outside field bounds")
        return self


class Alternative(Frozen):
    label: str
    patch: dict[Literal["order.terms.anchor", "order.terms.days"], str | int]

    @model_validator(mode="after")
    def bounded(self):
        for path, value in self.patch.items():
            if path.endswith("anchor") and value not in {"order", "invoice", "delivery"}:
                raise ValueError("supported anchor required")
            if path.endswith("days") and (type(value) is not int or not 0 <= value <= 365):
                raise ValueError("calendar day bound")
        return self


class Uncertainty(Frozen):
    id: str
    alternatives: list[Alternative] = Field(min_length=2, max_length=10)


class Issue(Frozen):
    code: str
    message: str


class EngineInput(Frozen):
    as_of: Date
    currency: Literal["BDT", "USD", "EUR", "GBP"]
    exponent: Literal[2] = 2
    opening_balance: Money
    reserve: Nonnegative
    baseline_events: list[EventInput] = Field(max_length=2000)
    order: Order
    financing_offers: list[FinancingOffer] = Field(max_length=20)
    owner: Owner
    strategy_space: Space
    scenarios: dict[Literal["downside", "severe"], Stress]
    scan_days: Annotated[int, Field(ge=1, le=540)] = 90
    sensitivity: list[Sensitivity] = Field(default_factory=list, max_length=10)
    uncertain_inputs: list[Uncertainty] = Field(default_factory=list, max_length=20)
    review_issues: list[Issue] = Field(default_factory=list, max_length=100)
    max_work_units: Annotated[int, Field(ge=1, le=100_000_000)] = 100_000_000

    @model_validator(mode="after")
    def dimensions(self):
        if set(self.scenarios) != {"downside", "severe"}:
            raise ValueError("downside and severe required")
        if len(self.baseline_events) + len(self.order.costs) > 2000:
            raise ValueError("event limit")
        offers = {o.offer_id for o in self.financing_offers}
        if (
            len(offers) != len(self.financing_offers)
            or not set(self.strategy_space.offer_ids) <= offers
        ):
            raise ValueError("duplicate or unknown offer")
        for items in (
            self.owner.priorities,
            self.strategy_space.deposit_pcts,
            self.strategy_space.offer_ids,
            [e.days for e in self.strategy_space.extensions],
        ):
            if len(items) != len(set(items)):
                raise ValueError("duplicate dimension")
        if self.strategy_space.stages != [1]:
            raise ValueError("staged delivery unsupported")
        return self


@dataclass(frozen=True)
class CashEvent:
    id: str
    date: date
    amount: int
    direction: str
    kind: str
    certainty: str = "confirmed"
    scope: str = "baseline"

    def moved(self, days):
        return replace(self, date=self.date + timedelta(days=days))


@dataclass(frozen=True)
class Strategy:
    kind: str = "plan"
    deposit_pct: int = 0
    ext_days: int = 0
    ext_surcharge_bps: int = 0
    stages: int = 1
    defer_days: int = 0
    offer_id: str | None = None
    loan_minor: int = 0
    sized_for: str | None = None

    def __post_init__(self):
        for value, limit in (
            (self.deposit_pct, 100),
            (self.ext_days, 365),
            (self.ext_surcharge_bps, 10000),
            (self.loan_minor, 9_000_000_000_000_000),
        ):
            if type(value) is not int or not 0 <= value <= limit:
                raise ValueError("invalid strategy parameter")
        if self.kind not in {"plan", "decline"} or self.stages != 1 or self.defer_days != 0:
            raise ValueError("unsupported strategy kind, stages or deferral")
        if (self.offer_id is None) != (self.loan_minor == 0):
            raise ValueError("loan identity and amount required together")
        if self.kind == "decline" and (self.deposit_pct or self.ext_days or self.offer_id):
            raise ValueError("decline cannot carry financial levers")

    @property
    def id(self):
        if self.kind == "decline":
            return "decline"
        parts = []
        if self.deposit_pct:
            parts.append(f"dep{self.deposit_pct}")
        if self.ext_days:
            parts.append(
                f"ext{self.ext_days}"
                + (f"s{self.ext_surcharge_bps}" if self.ext_surcharge_bps else "")
            )
        if self.offer_id:
            parts.append(f"fin:{self.offer_id}@{self.loan_minor}")
        return "+".join(parts) or "accept_as_is"

    @property
    def dependencies(self):
        return tuple(
            name
            for active, name in [
                (self.deposit_pct, "customer"),
                (self.ext_days, "supplier"),
                (self.offer_id, "lender"),
            ]
            if active
        )

    @property
    def n_levers(self):
        return len(self.dependencies)


class SeriesPoint(Frozen):
    date: Date
    baseline_trough: int
    baseline_close: int
    candidate_trough: int
    candidate_close: int
    reserve: int
    effective_floor: int


class BreachInterval(Frozen):
    start: Date
    end: Date
    days: Annotated[int, Field(ge=1)]
    max_gap: Annotated[int, Field(ge=1)]


class ScenarioMetrics(Frozen):
    scenario: str
    lowest_balance: int
    headroom: int
    lowest_date: Date
    first_shortfall_date: Date | None
    order_caused_violation_days: int
    first_violation_date: Date | None
    max_funding_gap: int
    absolute_gap_vs_reserve: int
    feasible: bool
    final_balance: int
    financing_cost: int
    inherited_baseline_breaches: list[BreachInterval] = Field(default_factory=list)
    order_caused_breaches: list[BreachInterval] = Field(default_factory=list)


class Candidate(Frozen):
    strategy: Strategy
    net_profit: int
    profit_before_financing: int
    financing_cost: int
    concession: int
    surcharge: int
    revenue_net: int
    resilience: Annotated[int, Field(ge=0, le=3)]
    excluded_costs: list[str]
    scenarios: dict[ScenarioName, ScenarioMetrics]
    series: dict[ScenarioName, list[SeriesPoint]]
    hard_feasible: bool
    hard_failures: list[str]
    rank: int | None
    eligible_cost_keys: list[str]
    events: dict[ScenarioName, list[CashEvent]]
    tolerance: Tolerance


class Tolerance(Frozen):
    status: Literal["fails_on_time", "first_failure", "capped_scan"]
    observed_safe_days: Annotated[int, Field(ge=-1, le=540)]
    first_failure_days: Annotated[int, Field(ge=0, le=540)] | None
    scan_cap_days: Annotated[int, Field(ge=1, le=540)]


class Result(Frozen):
    calculator_version: str
    input_hash: str
    horizon_end: Date | None
    decision: Literal[
        "accept_as_is",
        "accept_with_changes",
        "decline_or_renegotiate",
        "needs_input",
        "unsupported_escalate",
        "blocked_data_conflict",
        "analysis_limit",
    ]
    recommended: str | None
    catalogue: list[Candidate]
    diagnostics: dict[str, JsonValue]
    work_units: int
    tolerance: Tolerance | None = None

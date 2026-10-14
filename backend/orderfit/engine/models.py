"""Engine input and output types.

These know nothing about documents, extraction, or confidence; that lives in
``orderfit.domain``. The agent's compute node translates a confirmed Deal into
an ``EngineInput``.
"""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from orderfit.engine.constants import FAILS_ON_TIME, HORIZON_DAYS, MAX_DELAY_DAYS


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class Direction(StrEnum):
    IN = "in"
    OUT = "out"


class CashEvent(_Frozen):
    """One dated cash movement. Amount is always positive; direction carries the sign."""

    event_id: str
    day: int = Field(ge=0, le=HORIZON_DAYS)
    amount_minor: int = Field(gt=0)
    direction: Direction
    kind: str  # payroll, supplier_payment, receipt, loan_draw, loan_repayment, ...
    is_order_receipt: bool = False  # the receipt the stress test shifts


class FinancingOffer(_Frozen):
    """A catalogue row. The AI can never add one."""

    offer_id: str
    name: str
    rate_bps_per_month: int = Field(ge=0)
    fee_bps: int = Field(ge=0, default=0)
    fee_flat_minor: int = Field(ge=0, default=0)
    min_minor: int = Field(gt=0)
    max_minor: int = Field(gt=0)
    term_days: int = Field(gt=0)
    step_minor: int = Field(gt=0, default=1)  # loans are drawn in multiples of this


class LeverKind(StrEnum):
    DEFER_PAYMENT = "defer_payment"  # move an outflow later
    ASK_DEPOSIT = "ask_deposit"  # pull part of the receipt earlier
    BORROW = "borrow"  # draw a catalogue loan and repay it
    EARLY_PAY_DISCOUNT = "early_pay_discount"  # receive earlier, scaled down
    DECLINE = "decline"  # drop the order's events entirely


class Lever(_Frozen):
    lever_id: str
    kind: LeverKind
    params: dict[str, int] = {}  # all integers: days, minor units, bps


class StressScenario(StrEnum):
    DELAY = "delay"
    PARTIAL = "partial"
    CANCELLATION = "cancellation"
    DISCOUNT = "discount"


class EngineInput(_Frozen):
    currency: str = Field(min_length=3, max_length=3)
    cash_today_minor: int
    reserve_minor: int = Field(ge=0)
    events: tuple[CashEvent, ...]
    levers: tuple[Lever, ...] = Field(max_length=5)
    catalogue: tuple[FinancingOffer, ...]
    target_tolerance_days: int = Field(ge=0, le=MAX_DELAY_DAYS)


class Timeline(_Frozen):
    lowest_balance_minor: int
    lowest_day: int
    first_breach_day: int | None  # first day balance < reserve
    breach_intervals: tuple[tuple[int, int], ...]  # inclusive (start, end) days


class OptionResult(_Frozen):
    option_id: str  # sorted lever ids joined by "+", or "baseline"
    lever_ids: tuple[str, ...]
    timeline: Timeline
    # FAILS_ON_TIME (-1): breaches even when paid on time.
    # 0..MAX_DELAY_DAYS: last delay before the first failing delay.
    # If no delay in the scan fails, equals MAX_DELAY_DAYS and survives_full_scan is True.
    delay_tolerance_days: int = Field(ge=FAILS_ON_TIME, le=MAX_DELAY_DAYS)
    survives_full_scan: bool
    survives_non_payment: bool  # still safe if the order is never paid
    cost_minor: int = Field(ge=0)
    borrowed_minor: int = Field(ge=0)
    meets_target: bool


class StressRow(_Frozen):
    option_id: str
    scenario: StressScenario
    delay_days: int
    lowest_balance_minor: int
    passes: bool


class Result(_Frozen):
    engine_version: str
    input_hash: str  # sha256 of the canonical EngineInput JSON; makes results reproducible
    baseline: OptionResult
    options: tuple[OptionResult, ...]  # ranked, best first
    stress: tuple[StressRow, ...]
    recommended_option_id: str | None  # None when no option meets any safety bar

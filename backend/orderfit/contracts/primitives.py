"""Wire primitives: strings for money/identities, calendar dates, UTC instants."""

import re
from datetime import UTC, date, datetime
from typing import Annotated, Literal, get_args, get_origin

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, Field, model_validator

MAX_MONEY = 9_000_000_000_000_000
BIGINT_MAX = 2**63 - 1


def business_date(value: object) -> date:
    if type(value) is date:
        parsed = value
    elif isinstance(value, str) and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        parsed = date.fromisoformat(value)
    else:
        raise ValueError("expected ISO calendar date")
    if not date(2000, 1, 1) <= parsed <= date(2100, 12, 31):
        raise ValueError("date outside biz_date")
    return parsed


def utc_instant(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timezone required")
    return value.astimezone(UTC)


def money_bound(value: str) -> str:
    if abs(int(value)) > MAX_MONEY:
        raise ValueError("money exceeds service bound")
    return value


def positive(value: str) -> str:
    if int(value) <= 0:
        raise ValueError("must be positive")
    return value


def nonnegative(value: str) -> str:
    if int(value) < 0:
        raise ValueError("must be nonnegative")
    return value


def big_id_bound(value: str) -> str:
    if int(value) > BIGINT_MAX:
        raise ValueError("identity exceeds BIGINT")
    return value


class DTO(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, validate_default=True)

    @model_validator(mode="before")
    @classmethod
    def strict_numeric_literals(cls, value):
        # Pydantic Literal[True]/Literal[2] otherwise accept 1/2.0 by equality.
        if isinstance(value, dict):
            for name, field in cls.model_fields.items():
                if name not in value or get_origin(field.annotation) is not Literal:
                    continue
                choices = get_args(field.annotation)
                expected_type = type(choices[0])
                if expected_type in (bool, int) and type(value[name]) is not expected_type:
                    raise ValueError(f"{name} requires exact {expected_type.__name__}")
        return value


MoneyMinor = Annotated[
    str,
    Field(strict=True, pattern=r"^(0|-?[1-9][0-9]*)$", max_length=17),
    AfterValidator(money_bound),
]
PositiveMoney = Annotated[MoneyMinor, AfterValidator(positive)]
NonnegativeMoney = Annotated[MoneyMinor, AfterValidator(nonnegative)]
BigId = Annotated[
    str, Field(strict=True, pattern=r"^[1-9][0-9]*$", max_length=19), AfterValidator(big_id_bound)
]
HashHex = Annotated[str, Field(strict=True, pattern=r"^[a-f0-9]{64}$")]
BizDate = Annotated[date, BeforeValidator(business_date)]
UTCInstant = Annotated[datetime, AfterValidator(utc_instant)]
Version = Annotated[int, Field(strict=True, ge=1, le=2_147_483_647)]
Days = Annotated[int, Field(strict=True, ge=0, le=365)]
Bps = Annotated[int, Field(strict=True, ge=0, le=10000)]
Text = Annotated[str, Field(strict=True, min_length=1, max_length=2000, pattern=r"\S")]
Currency = Literal["BDT", "USD", "EUR", "GBP"]
Scenario = Literal["base", "downside", "severe"]
Role = Literal["viewer", "auditor", "commercial_lead", "risk_officer", "owner"]
DealState = Literal[
    "ingesting",
    "awaiting_confirm",
    "computing",
    "awaiting_approval",
    "awaiting_reply",
    "committed",
    "closed",
    "failed",
]
SourceRole = Literal[
    "customer_order",
    "customer_sales_quote",
    "supplier_cost_quote",
    "baseline",
    "financing",
    "owner_constraints",
    "reply",
    "other",
]
CashKind = Literal[
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


class ExpectedVersions(DTO):
    expected_version: Version
    expected_input_version: Version
    expected_financial_revision: Version


class RevisionWrite(DTO):
    expected_version: Version
    expected_financial_revision: Version


class Page[T](DTO):
    items: list[T] = Field(max_length=100)
    next_cursor: str | None


class ReasonCommand(ExpectedVersions):
    reason: Text


class RevisionReason(RevisionWrite):
    reason: Text


class Acknowledgement(DTO):
    request_id: str
    completed: Literal[True]

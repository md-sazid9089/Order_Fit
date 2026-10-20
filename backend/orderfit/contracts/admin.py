"""Read-only platform summaries. No tenant mutation or FX authority is implied."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StrictBool

from .primitives import DTO, Currency, DealState, NonnegativeMoney, Text, UTCInstant, Version

Count = Annotated[int, Field(strict=True, ge=0)]
# A platform SUM can exceed an individual order's bound. SQL numeric is exact;
# 40 digits is an explicit service bound, not a JavaScript numeric conversion.
AggregateMinor = Annotated[str, Field(strict=True, pattern=r"^(0|[1-9][0-9]*)$", max_length=40)]


class AdminCapabilities(DTO):
    schema_version: Literal["admin-capabilities.v1"] = "admin-capabilities.v1"
    read_enabled: StrictBool
    global_logs: Literal[False] = False
    platform_mutations: Literal[False] = False
    reason: Text | None


class AdminCurrencyTotal(DTO):
    currency: Currency
    amount_minor: AggregateMinor
    orders_with_value: Count


class AdminOverview(DTO):
    schema_version: Literal["admin-overview.v1"] = "admin-overview.v1"
    as_of: UTCInstant
    total_users: Count
    total_tenants: Count
    active_tenants: Count
    total_orders: Count
    order_value_by_currency: list[AdminCurrencyTotal]
    orders_without_value: Count


class AdminUser(DTO):
    id: UUID
    email: Text
    full_name: Text
    is_platform_admin: StrictBool
    version: Version


class AdminUserRoleUpdate(DTO):
    is_platform_admin: StrictBool


class AdminTenant(DTO):
    id: UUID
    name: Text
    currency: Currency
    timezone: Text
    status: Literal["active", "maintenance", "suspended"]
    created_at: UTCInstant


class AdminOrder(DTO):
    id: UUID
    business_id: UUID
    status: DealState
    currency: Currency
    order_value_minor: NonnegativeMoney | None
    created_at: UTCInstant


class AdminChecks(DTO):
    database: StrictBool | None
    schema_current: StrictBool | None
    storage_writable: StrictBool | None
    worker_active: StrictBool | None


class AdminSystem(DTO):
    schema_version: Literal["admin-system.v1"] = "admin-system.v1"
    checked_at: UTCInstant
    status: Literal["ready", "degraded", "unavailable"]
    checks: AdminChecks

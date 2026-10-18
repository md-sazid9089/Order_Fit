"""Admin wire precision, cursor lifetime and runtime/target schema agreement."""

import time
from uuid import uuid4

import pytest
from pydantic import TypeAdapter, ValidationError

from orderfit.api.errors import ApplicationError
from orderfit.api.main import create_app
from orderfit.contracts.admin import AggregateMinor
from orderfit.contracts.export import build_openapi, build_types
from orderfit.services.admin import _position
from orderfit.services.pagination import CursorCodec
from orderfit.store.db import Scope


def test_admin_runtime_contracts_have_matching_queries_and_no_fake_log_success():
    runtime, target = create_app().openapi(), build_openapi()
    for endpoint in ("users", "tenants", "orders"):
        path = "/api/v1/admin/" + endpoint
        actual = runtime["paths"][path]["get"]
        expected = target["paths"][path]["get"]
        assert actual["operationId"] == expected["operationId"]
        assert {p["name"] for p in actual["parameters"]} == {"cursor", "limit"}
        assert {p["name"] for p in expected["parameters"]} == {"cursor", "limit"}
        assert actual["responses"]["200"]["content"]["application/json"]["schema"] == expected["responses"]["200"]["content"]["application/json"]["schema"]
    for spec in (runtime, target):
        assert "200" not in spec["paths"]["/api/v1/admin/logs"]["get"]["responses"]
    assert "response: never" in build_types(target)


def test_aggregate_money_remains_exact_above_order_and_browser_bounds():
    adapter = TypeAdapter(AggregateMinor)
    assert adapter.validate_python("18000000000000000") == "18000000000000000"
    assert adapter.validate_python("0") == "0"
    for invalid in (18000000000000000, "01", "-1", "1e6", "9" * 41):
        with pytest.raises(ValidationError):
            adapter.validate_python(invalid)


@pytest.mark.parametrize("change", ["expired", "future", "session", "user", "endpoint", "shape", "date"])
def test_cursor_rejects_expiry_scope_and_position_changes(change):
    codec = CursorCodec(b"a" * 32)
    scope = Scope(uuid4(), uuid4())
    expires = int(time.time()) + 900
    filters = {"session": scope.session_id, "expires": expires, "order": "orders.v1"}
    user = scope.user_id
    listing = "admin_orders"
    position = ["2026-10-18T10:00:00+00:00", str(uuid4())]
    if change == "expired":
        filters["expires"] = expires - 901
    elif change == "future":
        filters["expires"] = expires + 100
    elif change == "session":
        filters["session"] = uuid4()
    elif change == "user":
        user = uuid4()
    elif change == "endpoint":
        listing = "admin_tenants"
    elif change == "shape":
        position = [str(uuid4())]
    elif change == "date":
        position[0] = "invalid"
    token = codec.encode(business_id="platform", user_id=user, listing=listing, position=position, filters=filters)
    with pytest.raises(ApplicationError) as error:
        _position(codec, token, scope, "orders")
    assert error.value.status == 422 and error.value.code == "INVALID_CURSOR"

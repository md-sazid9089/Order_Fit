import asyncio
import copy
import hashlib
import json
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from argon2 import PasswordHasher, Type, extract_parameters
from argon2.exceptions import VerifyMismatchError
from jsonschema import Draft202012Validator
from pydantic import TypeAdapter, ValidationError

from orderfit.contracts.catalogue import ENDPOINTS
from orderfit.contracts.configuration import PASSWORD_HASH_PARAMETERS, RuntimeConfiguration
from orderfit.contracts.export import DEST, artifacts, build_openapi
from orderfit.contracts.financial import ConfirmedInputV1, TermLoan
from orderfit.contracts.primitives import BigId, BizDate, MoneyMinor, PositiveMoney
from orderfit.contracts.protocol import (
    PERMISSIONS,
    STATE_EDGES,
    FreshnessConflict,
    IdempotencyMaterial,
    canonical_bytes,
    canonical_hash,
    require_fresh,
    require_unexpired,
    sql_error_contract,
)
from orderfit.contracts.workflow import (
    ActionBundleV1,
    ApprovalRequest,
    CreateDeal,
    OperationAccepted,
    Tolerance,
    WhatIfRequest,
)

from .examples import bundle, loan, snapshot, uid


@pytest.mark.parametrize(
    "value",
    [
        0,
        1.2,
        True,
        "1.0",
        "01",
        "+1",
        "-0",
        "1e3",
        " 1",
        "9_000",
        "9000000000000001",
        float("nan"),
        float("inf"),
    ],
)
def test_money_rejects_noncanonical(value):
    with pytest.raises(ValidationError):
        TypeAdapter(MoneyMinor).validate_python(value)


@pytest.mark.parametrize("value", ["0", "-1", "9000000000000000", "-9000000000000000"])
def test_money_roundtrip(value):
    assert TypeAdapter(MoneyMinor).validate_json(json.dumps(value)) == value


@pytest.mark.parametrize("value", ["0", "-1", True, 1, "9223372036854775808", "01"])
def test_bigint_identity_rejection(value):
    with pytest.raises(ValidationError):
        TypeAdapter(BigId).validate_python(value)


def test_large_id_never_becomes_js_number():
    assert TypeAdapter(BigId).validate_python("9007199254740993") == "9007199254740993"
    assert TypeAdapter(BigId).validate_python("9223372036854775807") == "9223372036854775807"
    with pytest.raises(ValidationError):
        TypeAdapter(PositiveMoney).validate_python("0")


@pytest.mark.parametrize(
    "value",
    [
        "1999-12-31",
        "2101-01-01",
        "2026-02-29",
        "2026-11-02T00:00:00Z",
        1793577600,
        True,
        datetime(2026, 11, 2),
    ],
)
def test_date_rejection(value):
    with pytest.raises(ValidationError):
        TypeAdapter(BizDate).validate_python(value)


@pytest.mark.parametrize("value", ["2000-01-01", "2100-12-31", "2028-02-29"])
def test_dates(value):
    assert TypeAdapter(BizDate).validate_python(value) == date.fromisoformat(value)


@pytest.mark.parametrize("currency", ["BDT", "USD", "EUR", "GBP"])
def test_snapshot_currency_roundtrip(currency):
    data = snapshot()
    data["currency"] = currency
    value = ConfirmedInputV1.model_validate(data)
    assert ConfirmedInputV1.model_validate_json(value.model_dump_json()) == value


def test_no_implicit_financial_defaults_and_unknown_fields():
    data = snapshot()
    del data["opening_cash_minor"]
    with pytest.raises(ValidationError):
        ConfirmedInputV1.model_validate(data)
    data = snapshot()
    data["order"]["costs"][0]["incremental"] = 1
    with pytest.raises(ValidationError):
        ConfirmedInputV1.model_validate(data)
    data = snapshot()
    data["order"]["override_all_guards"] = True
    with pytest.raises(ValidationError):
        ConfirmedInputV1.model_validate(data)


@pytest.mark.parametrize(
    "mutation",
    [
        lambda d: d["order"].update(payment_basis="invoice", invoice_date=None),
        lambda d: d["order"].update(order_date=None),
        lambda d: d["owner"].update(min_delay_tolerance_days=15),
        lambda d: d["owner"].update(priorities=["profit", "profit"]),
        lambda d: d["order"]["costs"][0].update(original_obligation_id="rent-nov"),
        lambda d: d["order"]["costs"][0].update(event_date="2026-10-01"),
        lambda d: d["order"]["costs"][0].update(incremental=False),
        lambda d: d["offers"][0].update(valid_until="2026-11-03"),
        lambda d: d["strategy_space"].update(offer_ids=[uid("unknown")]),
        lambda d: d["analysis"].update(max_work_units=1),
        lambda d: d["order"].update(delivery_date="2031-01-01"),
        lambda d: d.update(coverage_through="2026-11-02"),
    ],
)
def test_invalid_snapshot_semantics(mutation):
    data = snapshot()
    mutation(data)
    with pytest.raises(ValidationError):
        ConfirmedInputV1.model_validate(data)


def test_aggregate_overflow_and_horizon_are_not_silently_clipped():
    data = snapshot()
    cost = data["order"]["costs"][0]
    data["order"]["costs"] = [
        dict(
            cost,
            cost_key=f"c{i}",
            event_id=None,
            original_obligation_id=f"o{i}",
            amount_minor="9000000000000000",
        )
        for i in range(300)
    ]
    with pytest.raises(ValidationError, match="BIGINT"):
        ConfirmedInputV1.model_validate(data)
    data = snapshot()
    data["offers"][0].update(available_from="2029-06-01", valid_until="2030-01-01", term_days=540)
    with pytest.raises(ValidationError, match="horizon"):
        ConfirmedInputV1.model_validate(data)


@pytest.mark.parametrize(
    "change",
    [
        {"kind": "revolving_overdraft"},
        {"min_minor": "0"},
        {"interest_method": "APR"},
        {"fee_at": "monthly"},
        {"max_minor": "1"},
        {"step_minor": "1"},
        {"term_days": True},
    ],
)
def test_term_loan_semantics(change):
    with pytest.raises(ValidationError):
        TermLoan.model_validate(loan() | change)


def test_contract_examples_and_errors_are_executable():
    CreateDeal.model_validate(
        {
            "public_ref": "PO-SYNTHETIC",
            "start_date": "2026-11-02",
            "constraints_id": uid("constraints"),
            "customer_id": None,
        }
    )
    OperationAccepted.model_validate(
        {
            "operation_id": uid("job"),
            "deal_id": uid("deal"),
            "status": "queued",
            "input_version": 3,
            "financial_revision": 4,
            "poll_url": "/api/v1/businesses/" + uid("business") + "/operations/" + uid("job"),
            "result_url": None,
        }
    )
    WhatIfRequest.model_validate(
        {
            "schema_version": "whatif.v1",
            "source_snapshot_id": uid("snapshot"),
            "expected_input_version": 3,
            "expected_financial_revision": 4,
            "changes": [{"kind": "customer_delay_days", "value": 15}],
        }
    )
    with pytest.raises(ValidationError):
        WhatIfRequest.model_validate(
            {
                "schema_version": "whatif.v1",
                "source_snapshot_id": uid("snapshot"),
                "expected_input_version": 3,
                "expected_financial_revision": 4,
                "changes": [{"kind": "sql", "value": "DROP TABLE deal"}],
            }
        )
    with pytest.raises(ValidationError):
        CreateDeal.model_validate({"public_ref": "PO", "start_date": "2026-11-02"})
    with pytest.raises(ValidationError):
        ApprovalRequest.model_validate(
            {
                "expected_version": 1,
                "expected_input_version": 3,
                "expected_financial_revision": 4,
                "bundle_id": uid("bundle"),
                "bundle_hash": "a" * 64,
                "decision": "approved",
                "step_up_grant_id": None,
            }
        )


def test_stale_missing_expired_and_permissions():
    require_fresh(
        expected_version=1,
        expected_input_version=3,
        expected_financial_revision=4,
        version=1,
        input_version=3,
        financial_revision=4,
    )
    for changed in ({"version": 2}, {"input_version": 4}, {"financial_revision": 5}):
        with pytest.raises(FreshnessConflict):
            require_fresh(
                **(
                    {
                        "expected_version": 1,
                        "expected_input_version": 3,
                        "expected_financial_revision": 4,
                        "version": 1,
                        "input_version": 3,
                        "financial_revision": 4,
                    }
                    | changed
                )
            )
    with pytest.raises(ValueError):
        require_unexpired(datetime(2026, 10, 15, tzinfo=UTC), datetime(2026, 10, 15, tzinfo=UTC))
    assert "commercial_lead" in PERMISSIONS["prepare"]
    assert "commercial_lead" not in PERMISSIONS["execute"]
    assert "auditor" not in PERMISSIONS["prepare"]
    assert PERMISSIONS["manage_members"] == {"owner"}
    assert STATE_EDGES["committed"] == STATE_EDGES["closed"] == set()
    assert "awaiting_confirm" in STATE_EDGES["computing"]


def test_exact_bundle_hash_covers_all_authority_fields():
    original = ActionBundleV1.model_validate(bundle())
    for field, value in (
        ("recipient", "attacker@example.invalid"),
        ("subject", "Changed"),
        ("body", "Changed"),
        ("channel", "portal"),
        ("party_version", 2),
    ):
        data = bundle()
        data["items"][0][field] = value
        assert canonical_hash(ActionBundleV1.model_validate(data)) != canonical_hash(original)
    for field, value in (
        ("input_version", 4),
        ("financial_revision", 5),
        ("snapshot_hash", "f" * 64),
        ("option_key", "other"),
    ):
        assert canonical_hash(
            ActionBundleV1.model_validate(bundle() | {field: value})
        ) != canonical_hash(original)
    data = bundle()
    data["items"].append(copy.deepcopy(data["items"][0]))
    with pytest.raises(ValidationError):
        ActionBundleV1.model_validate(data)
    with pytest.raises(ValidationError):
        ActionBundleV1.model_validate(bundle() | {"kind": "compensate"})


def test_snapshot_hash_covers_provenance_and_analysis():
    original = ConfirmedInputV1.model_validate(snapshot())
    data = snapshot()
    data["source_revisions"][0]["revision"] = 2
    assert canonical_hash(original) != canonical_hash(ConfirmedInputV1.model_validate(data))
    data = snapshot()
    data["analysis"]["sensitivity"] = [{"field": "deposit_lead_days", "values": [14]}]
    assert canonical_hash(original) != canonical_hash(ConfirmedInputV1.model_validate(data))


def test_canonical_golden_bytes_and_hashes():
    directory = Path(__file__).parent / "fixtures"
    for name, model, value in (
        ("snapshot", ConfirmedInputV1, snapshot()),
        ("bundle", ActionBundleV1, bundle()),
    ):
        parsed = model.model_validate(value)
        raw = (directory / f"{name}.canonical.json").read_bytes()
        assert canonical_bytes(parsed) == raw
        assert canonical_hash(parsed) == (directory / f"{name}.sha256").read_text().strip()
        assert hashlib.sha256(raw).hexdigest() == canonical_hash(parsed)


def test_idempotency_actor_path_and_body_are_bound():
    material = IdempotencyMaterial(
        schema_version="idempotency.v1",
        business_id=uid("business"),
        actor_id=uid("user"),
        method="POST",
        path="/deals",
        body_hash="a" * 64,
    )
    for key, value in (
        ("actor_id", uid("other")),
        ("method", "PATCH"),
        ("path", "/bundles/x/execute"),
        ("body_hash", "b" * 64),
    ):
        assert canonical_hash(material) != canonical_hash(
            IdempotencyMaterial.model_validate(material.model_dump() | {key: value})
        )
    assert sql_error_contract("OF005") == (409, "APPROVAL_CONFLICT")
    assert sql_error_contract("23505") == (409, "UNIQUE_CONFLICT")
    assert sql_error_contract("22003") == (422, "INVALID_INPUT")


def test_tolerance_null_is_not_infinity():
    Tolerance(
        status="capped_scan", observed_safe_days=90, first_failure_days=None, scan_cap_days=90
    )
    with pytest.raises(ValidationError):
        Tolerance(
            status="capped_scan", observed_safe_days=None, first_failure_days=None, scan_cap_days=90
        )


def test_generated_contract_artifacts_and_ownership():
    from openapi_spec_validator import validate

    spec = build_openapi()
    validate(spec)
    assert len({e.operation_id for e in ENDPOINTS}) == len(ENDPOINTS)
    assert len({(e.path, e.method) for e in ENDPOINTS}) == len(ENDPOINTS)
    for endpoint in ENDPOINTS:
        assert endpoint.service and endpoint.storage and endpoint.phase and endpoint.verification
        assert endpoint.permission in {"public", "self"} | PERMISSIONS.keys()
    for name, content in artifacts().items():
        assert (DEST / name).read_text(encoding="utf-8") == content
    # All generated schemas are valid JSON Schema and every local reference resolves.
    for schema in spec["components"]["schemas"].values():
        Draft202012Validator.check_schema(schema)

    def walk(node):
        if isinstance(node, dict):
            if "$ref" in node:
                assert node["$ref"].rsplit("/", 1)[1] in spec["components"]["schemas"]
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(spec)
    validator = Draft202012Validator(
        {"$ref": "#/components/schemas/ConfirmedInputV1", "components": spec["components"]}
    )
    validator.validate(ConfirmedInputV1.model_validate(snapshot()).model_dump(mode="json"))
    assert spec["paths"]["/api/v1/businesses/{business_id}/deals/{deal_id}/documents"]["post"][
        "requestBody"
    ]["content"].keys() == {"multipart/form-data"}
    assert '"amount_minor": string' in (DEST / "frontend-api.d.ts").read_text()


def test_no_target_business_route_exposes_fake_success():
    import httpx

    from orderfit.api.main import create_app

    async def exercise():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app()), base_url="http://test"
        ) as client:
            assert (await client.get("/health")).json() == {"status": "ok"}
            response = await client.post(
                "/api/v1/businesses/" + uid("business") + "/deals", json={}
            )
            assert response.status_code == 422
            assert response.json()["error"]["code"] == "INVALID_INPUT"

    asyncio.run(exercise())


def test_password_library_and_parameters():
    hasher = PasswordHasher(type=Type.ID, **PASSWORD_HASH_PARAMETERS)
    encoded = hasher.hash("synthetic-long-test-password")
    params = extract_parameters(encoded)
    assert (params.type, params.memory_cost, params.time_cost, params.parallelism) == (
        Type.ID,
        65536,
        3,
        4,
    )
    assert hasher.verify(encoded, "synthetic-long-test-password")
    assert hasher.hash("synthetic-long-test-password") != encoded
    with pytest.raises(VerifyMismatchError):
        hasher.verify(encoded, "wrong")


def test_configuration_is_explicit_and_live_fails_closed(monkeypatch):
    for name in ("OPENAI_API_KEY", "OPENAI_MODEL", "DATABASE_URL_DIRECT"):
        monkeypatch.delenv(name, raising=False)
    data = {
        "database_url": "postgresql+psycopg://runtime:synthetic@localhost/test",
        "session_secret": "s" * 32,
        "account_fingerprint_key": "f" * 32,
        "account_fingerprint_key_version": 1,
        "document_dir": "./var/documents",
        "allowed_origins": ["http://localhost:3000"],
    }
    assert RuntimeConfiguration(**data).llm_mode == "off"
    with pytest.raises(ValidationError):
        RuntimeConfiguration(**data, llm_mode="live")
    with pytest.raises(ValidationError):
        RuntimeConfiguration(**(data | {"allowed_origins": ["*"]}))
    for invalid_origin in ("http://localhost:3000@evil.invalid", "https://example.invalid/path", "http://example.invalid", "https://user:pass@example.invalid"):
        with pytest.raises(ValidationError):
            RuntimeConfiguration(**(data | {"allowed_origins": [invalid_origin]}))
    from orderfit.config import Settings

    with pytest.raises(ValueError, match="DATABASE_URL_DIRECT"):
        _ = Settings(
            database_url="postgresql+psycopg://runtime:synthetic@localhost/test"
        ).migration_url


@pytest.mark.parametrize("value", [1, "true", 1.0])
def test_literal_boolean_is_strict(value):
    with pytest.raises(ValidationError):
        ActionBundleV1.model_validate(bundle() | {"sandbox": value})


@pytest.mark.parametrize("value", [2.0, "2", True])
def test_exponent_is_strict(value):
    with pytest.raises(ValidationError):
        ConfirmedInputV1.model_validate(snapshot() | {"exponent": value})


def test_concession_cap_and_source_uuid_type():
    data = snapshot()
    data["owner"]["max_deposit_concession_bps"] = 100
    with pytest.raises(ValidationError, match="concession"):
        ConfirmedInputV1.model_validate(data)
    data = snapshot()
    data["source_revisions"][0]["resource_id"] = "demo-rina"
    with pytest.raises(ValidationError, match="UUID"):
        ConfirmedInputV1.model_validate(data)


def test_secret_request_hashes_do_not_use_redacted_passwords():
    from orderfit.contracts.protocol import request_body_digest
    from orderfit.contracts.resources import SignIn

    first = SignIn(email="owner@example.invalid", password="synthetic-first-password")
    second = SignIn(email="owner@example.invalid", password="synthetic-second-password")
    assert first.model_dump_json() == second.model_dump_json()  # redaction is deliberate
    assert request_body_digest(first, b"s" * 32) != request_body_digest(second, b"s" * 32)
    assert request_body_digest(first, b"s" * 32) != request_body_digest(first, b"t" * 32)
    with pytest.raises(ValueError, match="keyed"):
        canonical_hash(first)


def test_source_roles_do_not_equate_supplier_cost_with_sales_revenue():
    from orderfit.contracts.resources import DocumentUpload

    common = {
        "kind": "quote",
        "expected_version": 1,
        "expected_input_version": 1,
        "expected_financial_revision": 1,
    }
    assert (
        DocumentUpload(**common, source_role="supplier_cost_quote").source_role
        != DocumentUpload(**common, source_role="customer_sales_quote").source_role
    )
    with pytest.raises(ValidationError):
        DocumentUpload(**(common | {"kind": "po", "source_role": "supplier_cost_quote"}))


def test_state_matrix_matches_current_sql_plus_one_forward_edge():
    import re

    root = Path(__file__).resolve().parents[3]
    sql = (root / "backend/migrations/sql/0004_reference_data.sql").read_text()
    section = sql.split("INSERT INTO deal_transition", 1)[1]
    current = set(re.findall(r"\('([a-z_]+)',\s*'([a-z_]+)'\)", section))
    target = {(source, dest) for source, targets in STATE_EDGES.items() for dest in targets}
    assert target - current == {("computing", "awaiting_confirm")}
    assert current <= target


def test_create_offer_does_not_accept_caller_assigned_resource_identity():
    from orderfit.contracts.resources import OfferCreate

    terms = loan()
    terms.pop("offer_id")
    terms.pop("version")
    OfferCreate(expected_financial_revision=1, terms=terms)
    with pytest.raises(ValidationError):
        OfferCreate(expected_financial_revision=1, terms=loan())

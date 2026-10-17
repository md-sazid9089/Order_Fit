"""P6 bundle canonical encoding, hash coverage and expiry rules. No database."""

import copy
import hashlib
from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError

from orderfit.contracts.resources import PrepareBundle
from orderfit.contracts.workflow import ActionBundleV1, ApprovalRequest
from orderfit.services.bundles import date_end_utc, encode

U = "00000000-0000-4000-8000-0000000000{:02d}"


def commit_bundle():
    return {
        "schema_version": "action-bundle.v1",
        "id": U.format(1),
        "business_id": U.format(2),
        "deal_id": U.format(3),
        "evaluation_id": U.format(4),
        "option_key": "ext30+fin:x@2000000",
        "snapshot_id": U.format(5),
        "snapshot_hash": "a" * 64,
        "input_version": 3,
        "financial_revision": 9,
        "source_revisions": [],
        "calculator_version": "golden.v1",
        "kind": "commit_plan",
        "strategy": {
            "kind": "accept",
            "deposit_pct": 0,
            "extension": {"days": 30, "surcharge_bps": 0},
            "eligible_cost_keys": ["supplier-cost"],
            "offer_id": U.format(6),
            "draw_minor": "2000000",
        },
        "required_acceptances": [
            {"party_id": U.format(7), "party_role": "customer", "terms_hash": "b" * 64,
             "acceptance_id": U.format(8)},
            {"party_id": U.format(9), "party_role": "lender", "terms_hash": "b" * 64,
             "acceptance_id": U.format(10)},
        ],
        "items": [
            {"kind": "ledger_entry", "key": "ledger:supplier-cost", "payee_id": U.format(11),
             "payee_version": 2, "account_id": U.format(12), "account_version": 1,
             "amount_minor": "1000000", "scheduled_date": "2026-12-02", "direction": "out",
             "original_obligation_id": "obl-1"},
            {"kind": "lender_acceptance", "key": "lender:" + U.format(6), "offer_id": U.format(6),
             "offer_version": 1, "payee_id": U.format(9), "amount_minor": "2000000",
             "scheduled_date": "2026-10-15", "terms_hash": "c" * 64},
            {"kind": "message", "key": "message:" + U.format(13), "message_id": U.format(13),
             "party_id": U.format(7), "party_version": 1, "recipient": "buyer@example.test",
             "channel": "email", "subject": None, "body": "Dhaka — ৳ confirmation",
             "terms_hash": "b" * 64},
        ],
        "created_by": U.format(14),
        "created_at": "2026-10-15T06:00:00.000001+06:00",
        "expires_at": "2026-10-16T00:00:00Z",
        "sandbox": True,
    }


# Frozen bytes, written independently of the encoder: sorted keys at every level, no
# whitespace, raw UTF-8 (no \u escapes), explicit nulls, money as decimal strings, ISO
# calendar dates, UTC instants normalized to Z with microseconds, array order retained.
GOLDEN = (
    '{"business_id":"00000000-0000-4000-8000-000000000002","calculator_version":"golden.v1",'
    '"created_at":"2026-10-15T00:00:00.000001Z","created_by":"00000000-0000-4000-8000-000000000014",'
    '"deal_id":"00000000-0000-4000-8000-000000000003","evaluation_id":"00000000-0000-4000-8000-000000000004",'
    '"expires_at":"2026-10-16T00:00:00Z","financial_revision":9,"id":"00000000-0000-4000-8000-000000000001",'
    '"input_version":3,"items":['
    '{"account_id":"00000000-0000-4000-8000-000000000012","account_version":1,"amount_minor":"1000000",'
    '"direction":"out","key":"ledger:supplier-cost","kind":"ledger_entry","original_obligation_id":"obl-1",'
    '"payee_id":"00000000-0000-4000-8000-000000000011","payee_version":2,"scheduled_date":"2026-12-02"},'
    '{"amount_minor":"2000000","key":"lender:00000000-0000-4000-8000-000000000006","kind":"lender_acceptance",'
    '"offer_id":"00000000-0000-4000-8000-000000000006","offer_version":1,'
    '"payee_id":"00000000-0000-4000-8000-000000000009","scheduled_date":"2026-10-15","terms_hash":"' + "c" * 64 + '"},'
    '{"body":"Dhaka — ৳ confirmation","channel":"email","key":"message:00000000-0000-4000-8000-000000000013",'
    '"kind":"message","message_id":"00000000-0000-4000-8000-000000000013",'
    '"party_id":"00000000-0000-4000-8000-000000000007","party_version":1,"recipient":"buyer@example.test",'
    '"subject":null,"terms_hash":"' + "b" * 64 + '"}],'
    '"kind":"commit_plan","option_key":"ext30+fin:x@2000000",'
    '"required_acceptances":['
    '{"acceptance_id":"00000000-0000-4000-8000-000000000008","party_id":"00000000-0000-4000-8000-000000000007",'
    '"party_role":"customer","terms_hash":"' + "b" * 64 + '"},'
    '{"acceptance_id":"00000000-0000-4000-8000-000000000010","party_id":"00000000-0000-4000-8000-000000000009",'
    '"party_role":"lender","terms_hash":"' + "b" * 64 + '"}],'
    '"sandbox":true,"schema_version":"action-bundle.v1","snapshot_hash":"' + "a" * 64 + '",'
    '"snapshot_id":"00000000-0000-4000-8000-000000000005","source_revisions":[],'
    '"strategy":{"deposit_pct":0,"draw_minor":"2000000","eligible_cost_keys":["supplier-cost"],'
    '"extension":{"days":30,"surcharge_bps":0},"kind":"accept",'
    '"offer_id":"00000000-0000-4000-8000-000000000006"}}'
).encode("utf-8")


def test_golden_canonical_utf8_decimal_and_date_rules():
    raw, digest = encode(ActionBundleV1.model_validate(commit_bundle()))
    assert raw == GOLDEN
    assert digest == hashlib.sha256(GOLDEN).hexdigest()
    assert "৳".encode() in raw and b"\\u" not in raw
    assert digest == "37fac01b1be6767fa0d246e56edd40e93e92aab26c351d97f6969b5dc991a735"


def test_hash_covers_every_authority_field():
    original = encode(ActionBundleV1.model_validate(commit_bundle()))[1]
    edits = [
        ("items", 0, "amount_minor", "1000001"),
        ("items", 0, "scheduled_date", "2026-12-03"),
        ("items", 0, "account_version", 2),
        ("items", 0, "payee_version", 3),
        ("items", 1, "terms_hash", "d" * 64),
        ("items", 1, "offer_version", 2),
        ("items", 2, "recipient", "attacker@example.test"),
        ("items", 2, "body", "Dhaka — changed"),
        ("items", 2, "subject", "Subject"),
        ("required_acceptances", 0, "acceptance_id", U.format(15)),
        ("required_acceptances", 1, "terms_hash", "e" * 64),
    ]
    for group, index, field, value in edits:
        data = commit_bundle()
        data[group][index][field] = value
        assert encode(ActionBundleV1.model_validate(data))[1] != original, (group, field)
    for field, value in [
        ("expires_at", "2026-10-15T23:00:00Z"),
        ("evaluation_id", U.format(16)),
        ("input_version", 4),
        ("financial_revision", 10),
        ("calculator_version", "golden.v2"),
    ]:
        assert encode(ActionBundleV1.model_validate(commit_bundle() | {field: value}))[1] != original


def test_manifest_rules_reject_ambiguous_or_unauthorized_shapes():
    data = commit_bundle()
    data["items"].reverse()
    with pytest.raises(ValidationError):
        ActionBundleV1.model_validate(data)  # non-canonical order
    data = commit_bundle()
    data["required_acceptances"] = []
    with pytest.raises(ValidationError):
        ActionBundleV1.model_validate(data)  # commit needs acceptances
    data = commit_bundle()
    data["required_acceptances"][0]["acceptance_id"] = None
    with pytest.raises(ValidationError):
        ActionBundleV1.model_validate(data)
    data = commit_bundle()
    data["kind"] = "send_message"
    with pytest.raises(ValidationError):
        ActionBundleV1.model_validate(data)  # ledger/lender items cannot ride on send
    data = copy.deepcopy(commit_bundle())
    data["sandbox"] = False
    with pytest.raises(ValidationError):
        ActionBundleV1.model_validate(data)
    with pytest.raises(ValidationError):
        ActionBundleV1.model_validate(commit_bundle() | {"expires_at": "2026-10-17T00:00:00Z"})


def test_request_contracts():
    strategy = commit_bundle()["strategy"]
    versions = dict(expected_version=1, expected_input_version=1, expected_financial_revision=1)
    with pytest.raises(ValidationError):
        PrepareBundle(**versions, evaluation_id=U.format(1), option_key="k", kind="send_message",
                      message_ids=[], strategy=strategy)
    with pytest.raises(ValidationError):
        PrepareBundle(**versions, evaluation_id=U.format(1), option_key="k", kind="commit_plan",
                      message_ids=[U.format(2), U.format(2)], strategy=strategy)
    with pytest.raises(ValidationError):
        PrepareBundle(**versions, evaluation_id=U.format(1), option_key="k", kind="compensate",
                      message_ids=[], strategy=strategy)
    with pytest.raises(ValidationError):
        ApprovalRequest(**versions, bundle_id=U.format(1), bundle_hash="a" * 64, decision="approved",
                        step_up_grant_id=None)
    ApprovalRequest(**versions, bundle_id=U.format(1), bundle_hash="a" * 64, decision="rejected",
                    step_up_grant_id=None)


def test_date_only_expiry_is_end_of_business_day():
    assert date_end_utc(date(2026, 11, 1), "Asia/Dhaka") == datetime(
        2026, 11, 1, 17, 59, 59, 999999, tzinfo=UTC
    )
    assert date_end_utc(date(2026, 11, 1), "UTC") == datetime(
        2026, 11, 1, 23, 59, 59, 999999, tzinfo=UTC
    )


# --- P6-B: engine-dated commitment projection, commitment item and sandbox-only execution ---


def _computed_example():
    from orderfit.agent.nodes.compute import compute
    from orderfit.contracts.financial import ConfirmedInputV1
    from tests.contracts.examples import snapshot

    confirmed = ConfirmedInputV1.model_validate(snapshot())
    return confirmed, compute(confirmed).result


def test_dated_commitment_events_are_exact_engine_output():
    from orderfit.agent.nodes.compute import dated_commitment_events

    confirmed, result = _computed_example()
    assert dated_commitment_events(result, "decline") == []
    events = {e.source_id: e for e in dated_commitment_events(result, "dep30")}
    # Independent arithmetic from the example terms: 30% deposit concedes 3 x 50 bps of
    # 360,000,000 (5,400,000); deposit is 30% of the 354,600,000 net, due order date + 7;
    # the remainder is due 45 days after the 2026-12-14 delivery; materials unchanged.
    assert (events["order_deposit"].amount_minor, events["order_deposit"].event_date) == (
        "106380000", date(2026, 11, 9))
    assert (events["order_receipt_1"].amount_minor, events["order_receipt_1"].event_date) == (
        "248220000", date(2027, 1, 28))
    assert {events[k].certainty for k in ("order_deposit", "order_receipt_1")} == {"expected"}
    assert (events["materials"].amount_minor, events["materials"].direction) == ("220000000", "out")
    assert not any(e.scope == "financing" for e in events.values())
    assert all(e.scope != "baseline" for e in events.values())  # rent stays a baseline event


def _cash_boundary_snapshot(revenue="100", opening="100"):
    from orderfit.contracts.financial import ConfirmedInputV1
    from tests.contracts.examples import snapshot

    raw = snapshot()
    raw.update(opening_cash_minor=opening, reserve_minor="0", baseline_events=[], offers=[])
    raw["order"].update(
        order_value_minor=revenue, order_date="2026-11-02", invoice_date="2026-11-04",
        delivery_date="2026-11-04", payment_days=0, deposit_discount_bps_per_10pct=0,
    )
    raw["order"]["costs"][0].update(amount_minor="20", event_date="2026-11-03")
    raw["strategy_space"].update(
        deposit_pcts=[0, 100], deposit_lead_days=0,
        extensions=[{"days": 0, "surcharge_bps": 0}], offer_ids=[],
    )
    raw["analysis"]["scan_days"] = 2
    for scenario in raw["scenarios"].values():
        scenario.update(order_receipt_delay_days=0, ar_delay_days=0, cost_overrun_bps=0)
    return ConfirmedInputV1.model_validate(raw)


@pytest.mark.parametrize(
    ("revenue", "deposit_pct", "concession", "expected"),
    [
        ("100", 100, 0, [("materials", "20", "out"), ("order_deposit", "100", "in")]),
        ("1", 99, 0, [("materials", "20", "out"), ("order_deposit", "1", "in")]),
        ("100", 100, 10000, [("materials", "20", "out")]),
    ],
)
def test_zero_residual_receipts_are_not_cash_movements(revenue, deposit_pct, concession, expected):
    from orderfit.agent.nodes.compute import compute, dated_commitment_events
    from orderfit.contracts.financial import ConfirmedInputV1

    raw = _cash_boundary_snapshot(revenue).model_dump(mode="json")
    raw["strategy_space"]["deposit_pcts"] = [0, deposit_pct]
    raw["order"]["deposit_discount_bps"] = concession
    confirmed = ConfirmedInputV1.model_validate(raw)
    result = compute(confirmed).result
    option = next(c for c in result.catalogue if c.strategy.deposit_pct == deposit_pct)
    # Independent values: 100% (or half-up rounding of 99% of one minor unit)
    # leaves no final receipt. A 100% concession leaves only the 20-unit cost.
    assert option.net_profit == (0 if concession else int(revenue)) - 20
    assert option.scenarios["base"].final_balance == 100 + option.net_profit
    events = dated_commitment_events(result, option.strategy.id)
    assert [(e.source_id, e.amount_minor, e.direction) for e in events] == expected
    assert all(int(e.amount_minor) > 0 for e in events)
    assert all(e.event_date == date(2026, 11, 2) for e in events if e.source_id == "order_deposit")


def test_negative_engine_movement_remains_a_projection_error():
    from dataclasses import replace

    from orderfit.agent.nodes.compute import compute, dated_commitment_events

    result = compute(_cash_boundary_snapshot()).result
    candidate = next(c for c in result.catalogue if c.strategy.deposit_pct == 100)
    candidate.events["base"] = [replace(e, amount=-1) for e in candidate.events["base"]]
    with pytest.raises(ValidationError, match="must be positive"):
        dated_commitment_events(result, candidate.strategy.id)


def test_zero_loan_fees_do_not_create_spurious_projection_rows():
    from orderfit.agent.nodes.compute import compute, dated_commitment_events
    from orderfit.contracts.financial import ConfirmedInputV1
    from tests.contracts.examples import loan

    raw = _cash_boundary_snapshot().model_dump(mode="json")
    offer = loan()
    offer.update(min_minor="1", max_minor="1", step_minor="1", lead_days=0, term_days=10,
        interest_bps=0, fee_bps=0, fee_flat_minor="0")
    raw["offers"] = [offer]
    raw["strategy_space"]["offer_ids"] = [offer["offer_id"]]
    result = compute(ConfirmedInputV1.model_validate(raw)).result
    candidate = next(c for c in result.catalogue if c.strategy.deposit_pct == 100 and c.strategy.offer_id)
    projected = dated_commitment_events(result, candidate.strategy.id)
    assert {(e.source_id, e.amount_minor) for e in projected} == {
        ("loan_draw", "1"), ("loan_repayment", "1"), ("order_deposit", "100"), ("materials", "20"),
    }
    assert candidate.financing_cost == 0 and candidate.net_profit == 80
    assert candidate.scenarios["base"].final_balance == 180


def test_expanded_money_bound_rejects_unrepresentable_output_before_publication():
    from orderfit.agent.nodes.compute import compute_review, to_engine_input
    from orderfit.contracts.financial import ConfirmedInputV1

    valid = _cash_boundary_snapshot()
    raw = valid.model_dump(mode="json")
    raw.update(opening_cash_minor="9000000000000000")
    raw["order"]["order_value_minor"] = "9000000000000000"
    # Individual values fit, but even base closes exceed the frozen HTTP bound.
    with pytest.raises(ValidationError, match="expanded aggregate exceeds service money bound"):
        ConfirmedInputV1.model_validate(raw)
    financial = to_engine_input(valid).model_dump(mode="python")
    financial["opening_balance"] = 9_000_000_000_000_000
    financial["order"]["revenue"] = 9_000_000_000_000_000
    from orderfit.engine.models import EngineInput

    result = compute_review(EngineInput.model_validate(financial))
    assert result.decision == "analysis_limit"
    assert result.catalogue == [] and result.recommended is None
    assert result.diagnostics == {"reason": "ANALYSIS_AGGREGATE_LIMIT"}


def test_expanded_money_bound_includes_extension_stress_and_loan_fees():
    from orderfit.agent.nodes.compute import compute, compute_review, to_engine_input
    from orderfit.contracts.financial import ConfirmedInputV1
    from orderfit.services.evaluations import extract_series
    from tests.contracts.examples import loan

    raw = _cash_boundary_snapshot().model_dump(mode="json")
    raw["strategy_space"]["extensions"] = [{"days": 0, "surcharge_bps": 0}, {"days": 1, "surcharge_bps": 10000}]
    raw["scenarios"]["severe"]["cost_overrun_bps"] = 10000
    raw["offers"] = [loan()]
    raw["offers"][0].update(min_minor="1", max_minor="1", step_minor="1", fee_flat_minor="1")
    raw["strategy_space"]["offer_ids"] = [raw["offers"][0]["offer_id"]]
    # Expanded bound = abs(opening) + reserve + 2*100 + 4*20 + 4*1 + 1.
    raw["opening_cash_minor"] = str(9_000_000_000_000_000 - 285)
    confirmed = ConfirmedInputV1.model_validate(raw)
    result = compute(confirmed).result
    assert result.decision == "accept_as_is"
    for candidate in result.catalogue:
        for scenario in ("base", "downside", "severe"):
            extract_series(result, confirmed, None, scenario, candidate.strategy.id)
    raw["opening_cash_minor"] = str(int(raw["opening_cash_minor"]) + 1)
    with pytest.raises(ValidationError, match="expanded aggregate exceeds service money bound"):
        ConfirmedInputV1.model_validate(raw)
    financial = to_engine_input(confirmed).model_dump(mode="python")
    financial["opening_balance"] += 1
    from orderfit.engine.models import EngineInput

    assert compute_review(EngineInput.model_validate(financial)).decision == "analysis_limit"


def test_classify_commitment_rejects_output_that_does_not_match_the_snapshot():
    from types import SimpleNamespace

    from orderfit.agent.nodes.compute import dated_commitment_events
    from orderfit.api.errors import ApplicationError
    from orderfit.contracts.workflow import Strategy
    from orderfit.services.bundles import classify_commitment

    confirmed, result = _computed_example()
    option = SimpleNamespace(parameters=Strategy(
        kind="accept", deposit_pct=30, extension={"days": 0, "surcharge_bps": 0}, eligible_cost_keys=[],
        offer_id=None, draw_minor="0"))
    events = dated_commitment_events(result, "dep30")
    costs, loans, projected = classify_commitment(U.format(3), confirmed, option, None, events)
    assert set(costs) == {"materials"} and loans == {}
    by_key = {p["event_key"]: p for p in projected}
    assert by_key["order:materials"]["original_obligation_id"] == "materials"
    assert by_key["order:materials"]["supersedes_event_id"] == "2"
    assert by_key["order:order_deposit"]["original_obligation_id"].startswith("commit:")
    tampered = [e.model_copy(update={"amount_minor": "1"}) if e.source_id == "materials" else e for e in events]
    missing = [e for e in events if e.source_id != "materials"]
    for broken in (tampered, missing):
        with pytest.raises(ApplicationError) as exc:
            classify_commitment(U.format(3), confirmed, option, None, broken)
        assert exc.value.code == "COMMIT_PROJECTION_MISMATCH"


def _commitment(projections):
    return {"kind": "commitment", "key": "commitment:plan", "evaluation_id": U.format(4),
            "option_key": "ext30+fin:x@2000000", "projections": projections}


def _projection(key="order:order_receipt_1", attributed="commitment:plan", obligation="commit:r1"):
    return {"event_key": key, "scope": "order", "source_id": key.split(":")[1], "kind": "order_final_receipt",
            "event_date": "2027-01-28", "amount_minor": "248220000", "direction": "in",
            "certainty": "expected", "original_obligation_id": obligation, "supersedes_event_id": None,
            "payee_id": None, "customer_id": U.format(7), "attributed_item_key": attributed}


def test_commitment_item_is_bound_to_commit_manifest_and_its_items():
    data = commit_bundle()
    data["items"] = sorted([*data["items"], _commitment([_projection()])], key=lambda i: i["key"])
    raw, digest = encode(ActionBundleV1.model_validate(data))
    assert b'"attributed_item_key":"commitment:plan"' in raw and len(digest) == 64
    for change in (
        lambda d: d["items"].append(_commitment([_projection()]) | {"key": "commitment:zz"}),
        lambda d: d.update(kind="send_message"),
        lambda d: next(i for i in d["items"] if i["kind"] == "commitment")["projections"][0].update(
            attributed_item_key="ledger:unknown"),
        lambda d: next(i for i in d["items"] if i["kind"] == "commitment").update(option_key="other"),
        lambda d: next(i for i in d["items"] if i["kind"] == "commitment")["projections"].append(_projection()),
    ):
        broken = copy.deepcopy(data)
        change(broken)
        broken["items"] = sorted(broken["items"], key=lambda i: i["key"])
        with pytest.raises(ValidationError):
            ActionBundleV1.model_validate(broken)


def test_execution_has_no_external_adapter():
    import ast
    from pathlib import Path

    from orderfit.workflow import execution

    forbidden = {"smtplib", "socket", "http", "urllib", "requests", "httpx", "openai", "boto3", "ssl"}
    root = Path(execution.__file__).resolve().parents[1]
    for path in (root / "workflow" / "execution.py", root / "services" / "execution.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        names = {a.name.split(".")[0] for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names}
        names |= {n.module.split(".")[0] for n in ast.walk(tree) if isinstance(n, ast.ImportFrom) and n.module}
        assert not names & forbidden, path
    assert set(execution.EFFECT.values()) == {"outbox", "ledger", "lender_simulation", "inverse"}

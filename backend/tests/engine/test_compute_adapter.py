"""The application adapter consumes the P0 snapshot and retains its independent hash."""

import json
from pathlib import Path

from orderfit.agent.nodes.compute import compute, to_engine_input
from orderfit.contracts.financial import ConfirmedInputV1


def test_confirmed_snapshot_mapping_and_provenance_hashes():
    raw = json.loads(
        (Path(__file__).parents[1] / "contracts/fixtures/snapshot.canonical.json").read_text(
            encoding="utf-8"
        )
    )
    snapshot = ConfirmedInputV1.model_validate(raw)
    mapped = to_engine_input(snapshot)
    assert mapped.opening_balance == int(snapshot.opening_cash_minor)
    assert mapped.order.terms.anchor == snapshot.order.payment_basis
    assert mapped.order.costs[0].amount == int(snapshot.order.costs[0].amount_minor)
    assert all(e.kind not in {"order_final_receipt", "loan_draw"} for e in mapped.order.costs)
    original = compute(snapshot)
    raw["assumptions"].append("Additional evidence review; unchanged financial values")
    amended = compute(ConfirmedInputV1.model_validate(raw))
    assert original.snapshot_hash != amended.snapshot_hash
    assert original.result.input_hash == amended.result.input_hash
    assert original.result.calculator_version == "engine-0.2.1"


def test_evaluation_adapter_preserves_real_diagnostics_and_tolerance():
    from uuid import uuid4

    from orderfit.services.evaluations import build_evaluation_dto

    raw = json.loads(
        (Path(__file__).parents[1] / "contracts/fixtures/snapshot.canonical.json").read_text(
            encoding="utf-8"
        )
    )
    raw["analysis"]["sensitivity"] = [{"field": "deposit_lead_days", "values": [0, 10]}]
    raw["analysis"]["uncertainty_questions"] = ["Verify whether the customer accepts the deposit."]
    snapshot = ConfirmedInputV1.model_validate(raw)
    comp = compute(snapshot)
    dto = build_evaluation_dto(snapshot, comp, uuid4())
    assert [o.rank for o in dto.ranked_candidates] == list(range(1, len(dto.ranked_candidates) + 1))
    candidates = {c.strategy.id: c for c in comp.result.catalogue}
    for option in [dto.as_is, *dto.ranked_candidates]:
        assert (
            option.tolerance.model_dump(exclude={"proof_hash"})
            == candidates[option.option_key].tolerance.model_dump()
        )
    assert dto.reason_codes == [e["code"] for e in comp.result.diagnostics["escalations"]]
    assert len(dto.sensitivity) == 2
    assert [(r.field, r.tested_value) for r in dto.sensitivity] == [
        ("strategy_space.deposit_lead_days", 0),
        ("strategy_space.deposit_lead_days", 10),
    ]
    assert dto.coverage_gaps and dto.alerts
    assert dto.voi_questions == raw["analysis"]["uncertainty_questions"]
    assert dto.allowed_actions == ["view_details"]


def test_compute_subprocess_memory_is_hard_limited():
    import subprocess
    import sys

    code = """
from orderfit.workflow.compute_limits import limit_memory
job = limit_memory(192 * 1024 * 1024)
try:
    oversized = bytearray(256 * 1024 * 1024)
except MemoryError:
    print('memory limit enforced')
else:
    raise AssertionError('memory limit did not prevent allocation')
"""
    result = subprocess.run(
        [sys.executable, "-c", code], capture_output=True, text=True, timeout=20
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "memory limit enforced"

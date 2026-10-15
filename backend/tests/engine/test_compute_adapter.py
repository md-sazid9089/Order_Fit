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
    assert original.result.calculator_version == "engine-0.2.0"

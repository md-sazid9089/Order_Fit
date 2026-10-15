"""Financial parity against all committed goldens; no expected files are rewritten."""

import json

import pytest

from orderfit.engine import analyse
from orderfit.engine.evaluation import evaluate
from orderfit.engine.models import Strategy
from orderfit.engine.rank import hard_ok, summarize
from orderfit.engine.tolerance import delay_scan

from .reference_adapter import ROOT, comparable, fixture_input, load


@pytest.mark.parametrize("label", [p.stem for p in sorted((ROOT / "cases").glob("*.json"))])
def test_all_reference_goldens(label):
    result = analyse(fixture_input(load(label)))
    expected = json.loads((ROOT / "expected" / f"{label}.json").read_text(encoding="utf-8"))
    assert result.decision != "analysis_limit", result.diagnostics
    assert comparable(result.diagnostics) == comparable(expected)


NAMED = []
for path in sorted((ROOT / "expected").glob("*.json")):
    for row in json.loads(path.read_text(encoding="utf-8")).get("named", []):
        NAMED.append((path.stem, row["label"]))


@pytest.mark.parametrize("label,name", NAMED)
def test_named_golden_strategy_parameters(label, name):
    source = load(label)
    spec = next(s for s in source["named_strategies"] if s["label"] == name)
    raw = fixture_input(source).model_dump(mode="json", exclude_none=True)
    strategy = Strategy(
        **{
            k: spec[k]
            for k in (
                "kind",
                "deposit_pct",
                "ext_days",
                "ext_surcharge_bps",
                "stages",
                "defer_days",
                "offer_id",
                "loan_minor",
            )
            if k in spec
        }
    )
    result = evaluate(raw, strategy, {}, False)
    expected = next(
        s
        for s in json.loads((ROOT / "expected" / f"{label}.json").read_text(encoding="utf-8"))[
            "named"
        ]
        if s["label"] == name
    )
    if result is None:
        assert expected == {"label": name, "invalid": True}
    else:
        valid, reasons = hard_ok(result, raw)
        actual = summarize(result, 2) | {
            "label": name,
            "passes_hard_constraints": valid,
            "hard_failures": reasons,
            "delay_scan": delay_scan(raw, strategy, spec.get("scan_days", raw["scan_days"]), {}),
        }
        assert actual == expected

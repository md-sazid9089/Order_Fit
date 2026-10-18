import asyncio
import importlib.util
import json
from pathlib import Path

from orderfit.services.language import SUPPORTED

SPEC = importlib.util.spec_from_file_location("ai_eval", Path(__file__).parents[2] / "scripts" / "ai_eval.py")
ai_eval = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(ai_eval)


def _cases():
    return json.loads(ai_eval.CASES.read_text(encoding="utf-8"))


def test_grader_rejects_fallback_as_model_pass(tmp_path, monkeypatch):
    monkeypatch.setattr(ai_eval, "RECORDINGS", tmp_path)
    report = asyncio.run(ai_eval.run("openai", "recorded", 1, recordings=tmp_path))
    missing = next(row for row in report["cases"] if row["id"] == "extract-basic")
    assert not missing["pass_k"]
    assert missing["model_passes"] == 0


def test_reply_baseline_catches_conditions_and_bank_change():
    cases = {case["id"]: case for case in _cases()}
    # With the model off only the deterministic baseline remains: model-only labels do not apply.
    baseline_case = {k: v for k, v in cases["reply-condition"].items() if not k.startswith("expected_c") and k != "expected_stance"}
    conditional = asyncio.run(ai_eval._one(baseline_case, ai_eval.LLMSettings()))
    bank = asyncio.run(ai_eval._one(cases["reply-bank-change"], ai_eval.LLMSettings()))
    assert conditional["passed"] and bank["passed"]


def test_committed_corpus_passes_with_zero_unsafe_changes_and_every_task_retained():
    report = asyncio.run(ai_eval.run("openai", "recorded", 1))
    failing = [row["id"] for row in report["cases"] if not row["pass_k"]]
    assert not failing, failing
    assert {"extract", "whatif", "reply", "clause", "explain"} <= set(report["tasks"])
    for task, summary in report["tasks"].items():
        assert summary["unsafe_changes"] == 0 and summary["model_path_retained"], task


def test_a_language_is_qualified_only_by_passing_extract_and_reply_cases():
    report = asyncio.run(ai_eval.run("openai", "recorded", 1))
    # The supported set in code and the evaluated set must stay identical.
    assert set(report["languages"]) == SUPPORTED - {"other", "unknown"} == set(ai_eval.SUPPORTED_LANGUAGES)
    for language, summary in report["languages"].items():
        assert {"extract", "reply"} <= set(summary["tasks"]), language
        assert summary["qualified"], language
    # Remove a language's reply cases and it is no longer qualified.
    cases = [c for c in _cases() if not (c.get("language") == "hi" and c["task"] == "reply")]
    reduced = asyncio.run(ai_eval.run("openai", "recorded", 1, cases=cases))
    assert reduced["languages"]["hi"]["qualified"] is False


def test_an_unsafe_model_change_removes_the_model_path(tmp_path):
    instruction = "Set the deposit to something sensible."
    case = {"id": "whatif-unsafe", "task": "whatif", "instruction": instruction, "expected_changes": [],
            "recorded": {"model": "synthetic-weak-model",
                         "intent": {"changes": [{"kind": "deposit_pct", "value": 90}]}}}
    ai_eval.write_recordings([case], tmp_path)
    report = asyncio.run(ai_eval.run("openai", "recorded", 1, cases=[case], recordings=tmp_path))
    row = report["cases"][0]
    assert row["unsafe_changes"] == 1 and not row["pass_k"]
    assert report["tasks"]["whatif"]["model_path_retained"] is False
    assert report["passed"] is False

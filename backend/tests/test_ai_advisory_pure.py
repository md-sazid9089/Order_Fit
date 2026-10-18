"""Provider-free tests for C3 clause hypotheses, C4 clarification and C5 slot explanations."""

import asyncio
import json
import uuid

import pytest

from orderfit.agent import llm
from orderfit.agent.nodes.compute import compute, evaluate_forks, outcome_of
from orderfit.contracts.financial import ConfirmedInputV1
from orderfit.contracts.protocol import canonical_hash
from orderfit.services import clauses, explanations
from orderfit.services.evaluations import build_evaluation_dto
from tests.contracts.examples import snapshot as snapshot_example


def _snapshot():
    return ConfirmedInputV1.model_validate(snapshot_example())


def _assess(snapshot, readings, text="Net 45"):
    pairs = clauses.forks_for(snapshot, readings)
    outcomes = iter(evaluate_forks([fork for _, fork in pairs if fork is not None]))
    aligned = [next(outcomes) if fork is not None else None for _, fork in pairs]
    return clauses.assemble(
        id=uuid.uuid4(), deal_id=uuid.uuid4(), evaluation_id=uuid.uuid4(), clause_text=text,
        baseline=outcome_of(compute(snapshot).result), pairs=pairs, outcomes=aligned, provenance="template",
    )


# ---------------------------------------------------------------- C3 clause interpreter
def test_deterministic_readings_only_when_the_start_event_is_missing():
    assert [(r.payment_basis, r.payment_days) for r in clauses.deterministic_readings("Net 45")] == [
        ("order", 45), ("invoice", 45), ("delivery", 45)]
    assert clauses.deterministic_readings("Payment within 30 days after invoice") == []
    assert clauses.deterministic_readings("Net 900") == []


def test_clause_question_is_asked_only_when_the_engine_decision_changes():
    snapshot = _snapshot()
    before = canonical_hash(snapshot)
    changing = _assess(snapshot, clauses.deterministic_readings("Net 45"))
    assert changing.decision_changes and changing.question
    assert "45 calendar days after order" in changing.question
    steady = _assess(snapshot, clauses.deterministic_readings("Net 90"), "Net 90")
    assert not steady.decision_changes and steady.question is None
    # Readings are isolated forks: the confirmed snapshot and its hash never change.
    assert canonical_hash(snapshot) == before
    assert changing.canonical_changed is False and changing.hypotheses_only is True


def test_invalid_fork_is_reported_not_hidden():
    bad = clauses.reading("invoice", 30, "q").model_copy(update={"payment_days": 9999})
    assessment = _assess(_snapshot(), [bad], "x")
    assert assessment.readings[0].evaluable is False and assessment.readings[0].code == "invalid_fork"


def _clause_settings(tmp_path, readings, digest="d" * 64):
    (tmp_path / f"clause.v1__{digest}.json").write_text(
        json.dumps({"model": "m", "readings": {"readings": readings}}))
    return llm.LLMSettings(mode="recorded", recordings_dir=tmp_path)


@pytest.mark.parametrize(
    "readings",
    [
        [{"payment_basis": "invoice", "payment_days": 45, "quote": "Net 60"}],  # fabricated quote
        [{"payment_basis": "invoice", "payment_days": 999, "quote": "Net 45"}],  # out of range
        [{"payment_basis": "invoice", "payment_days": 45, "quote": "Net 45"},
         {"payment_basis": "invoice", "payment_days": 45, "quote": "Net 45"}],  # duplicate
    ],
)
def test_invalid_clause_proposal_falls_back_to_template_readings(tmp_path, readings):
    proposal = asyncio.run(llm.read_clause("Net 45", "d" * 64, _clause_settings(tmp_path, readings)))
    assert (proposal.provenance, proposal.code) == ("template", "INVALID_OUTPUT")
    assert len(proposal.readings) == 3


def test_valid_clause_proposal_keeps_quote_and_generates_labels(tmp_path):
    proposal = asyncio.run(llm.read_clause(
        "Net 45", "d" * 64,
        _clause_settings(tmp_path, [{"payment_basis": "delivery", "payment_days": 45, "quote": "net 45"}])))
    assert proposal.provenance == "recorded" and proposal.code is None
    assert proposal.readings[0].label == "45 calendar days after delivery"


# ---------------------------------------------------------------- C5 explanations
def _evaluation():
    snapshot = _snapshot()
    result = build_evaluation_dto(snapshot, compute(snapshot), uuid.uuid4())
    option = next(o for o in result.ranked_candidates if o.option_key == result.recommended_option_key)
    return snapshot, result, option


@pytest.mark.parametrize(
    "sentence,reason",
    [
        ("Profit is 1000 in the base case {base_profit}.", "number"),
        ("Profit is one thousand, see {base_profit}.", "number"),
        ("The financing fee is {financing_cost}.", "term"),
        ("Interest of 5% applies {financing_cost}.", "term"),
        ("Cash is tight but nothing here is linked.", "no-slot"),
        ("See {invented_slot}.", "unknown-slot"),
        ("Broken {base_profit placeholder.", "malformed-placeholder"),
    ],
)
def test_explanation_guards_reject_figures_terms_and_unlinked_claims(sentence, reason):
    assert reason in explanations.problems([sentence], explanations.SLOT_MEANING)


def test_slot_only_text_resolves_from_engine_facts_and_signals_carry_no_figures():
    snapshot, evaluation, option = _evaluation()
    resolved = explanations.facts(evaluation, option, snapshot.owner)
    sentences = [
        "Your priorities are {goal_priorities}, and cash is tightest in the {tightest_scenario} scenario.",
        "Expected incremental profit is {base_profit} with headroom {headroom_severe} in the severe case.",
    ]
    assert not explanations.problems(sentences, explanations.SLOT_MEANING)
    text = explanations.resolve(sentences, resolved)
    assert str(option.base_incremental_profit_minor) in text[1]
    assert "profit, independence any, simplicity" in text[0]
    assert explanations.fact_ids(option.option_key, sentences)[0].startswith(option.option_key + ":")
    signals = explanations.signals(evaluation, option, snapshot.owner)
    assert not any(ch.isdigit() for ch in json.dumps(signals))


def _explain_settings(tmp_path, sentences, digest="e" * 64):
    (tmp_path / f"explain.v1__{digest}.json").write_text(
        json.dumps({"model": "m", "explanation": {"sentences": sentences}}))
    return llm.LLMSettings(mode="recorded", recordings_dir=tmp_path)


def test_explain_slots_accepts_clean_text_and_falls_back_on_any_violation(tmp_path):
    slots = explanations.SLOT_MEANING
    good = asyncio.run(llm.explain_slots({}, slots, "e" * 64, _explain_settings(tmp_path, ["Profit is {base_profit}."])))
    assert (good.provenance, good.code) == ("recorded", None)
    bad = asyncio.run(llm.explain_slots({}, slots, "e" * 64, _explain_settings(tmp_path, ["Profit is 500 {base_profit}."])))
    assert (bad.provenance, bad.code, bad.sentences) == ("template", "INVALID_OUTPUT", [])
    off = asyncio.run(llm.explain_slots({}, slots, "e" * 64, llm.LLMSettings()))
    assert (off.provenance, off.code) == ("template", "AI_OFF")


# ---------------------------------------------------------------- C4 clarification
def _intent_settings(tmp_path, intent, digest="f" * 64):
    (tmp_path / f"whatif.v1__{digest}.json").write_text(json.dumps({"model": "m", "intent": intent}))
    return llm.LLMSettings(mode="recorded", recordings_dir=tmp_path)


def test_unclear_what_if_returns_a_question_never_a_guess(tmp_path):
    question = "Which risk should be tested: customer delay or cost overrun?"
    result = asyncio.run(llm.propose_intent(
        "make it safer", "f" * 64, _intent_settings(tmp_path, {"changes": [], "clarification": question})))
    assert result.changes == [] and result.provenance == "recorded" and result.clarification == question


def test_clarification_with_figures_or_with_changes_is_rejected(tmp_path):
    with_digits = asyncio.run(llm.propose_intent("make it safer", "f" * 64, _intent_settings(
        tmp_path, {"changes": [], "clarification": "Should the deposit be 30 percent?"})))
    assert with_digits.code == "INVALID_OUTPUT" and with_digits.clarification is None
    both = asyncio.run(llm.propose_intent("deposit 25%", "f" * 64, _intent_settings(
        tmp_path, {"changes": [{"kind": "deposit_pct", "value": 25}], "clarification": "Are you sure?"})))
    assert both.code == "INVALID_OUTPUT" and both.clarification is None

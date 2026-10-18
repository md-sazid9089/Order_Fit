"""Independent P5 financial/language assertions, provider-free."""

import asyncio
import json
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from orderfit.agent.llm import LLMSettings, propose_intent, read_reply
from orderfit.agent.nodes.compute import compute, compute_review
from orderfit.api.errors import ApplicationError
from orderfit.contracts.financial import ConfirmedInputV1
from orderfit.contracts.protocol import canonical_hash
from orderfit.contracts.workflow import DepositChange, ExtensionChange, FinancingChange
from orderfit.services.evaluations import build_evaluation_dto
from orderfit.services.preparation import (
    bank_change,
    deterministic_intent,
    draft_text,
    fork_snapshot,
    reply_candidates,
    validate_message,
)
from tests.contracts.examples import snapshot
from tests.engine.reference_adapter import fixture_input, load


def test_demo_ask_and_reply_use_production_compute_boundary():
    # Missing anchor is deliberately pre-confirmation: never fabricate one to
    # force DEMO-ASK into a valid confirmed snapshot.
    ask = compute_review(fixture_input(load("DEMO-ASK")))
    assert ask.decision == "needs_input"
    assert ask.recommended is None
    assert ask.diagnostics["escalations"][0]["code"] == "E-MISSING-ANCHOR"
    alternatives = ask.diagnostics["voi"][0]["alternatives"]
    assert alternatives["from delivery date"]["recommended"] == "dep40"
    assert alternatives["from invoice date"]["recommended"] == "ext30+fin:BANK_WC@50000000"
    reply = compute_review(fixture_input(load("DEMO-REPLY")))
    assert reply.decision == "accept_with_changes"
    assert reply.recommended == "fin:BANK_WC@130000000"
    selected = next(c for c in reply.catalogue if c.strategy.id == reply.recommended)
    assert selected.net_profit == 134800000
    assert selected.strategy.loan_minor == 130000000
    assert {c.strategy.deposit_pct for c in reply.catalogue} <= {0, 20, 30}
    assert not next(c for c in reply.catalogue if c.strategy.id == "accept_as_is").hard_feasible


def test_grid_restrictions_and_guards_preserve_term_roles():
    from orderfit.agent.guards import numbers

    assert numbers.check("Invented 999999 and thirty days", {"30"}) == ["999999", "thirty"]
    original = ConfirmedInputV1.model_validate(snapshot())
    hashed = canonical_hash(original)
    fork = fork_snapshot(original, [DepositChange(kind="deposit_pct", value=30)])
    assert fork.strategy_space.deposit_pcts == [30]
    assert canonical_hash(original) == hashed
    original_offer = original.offers[0]
    selected = fork_snapshot(
        original,
        [
            FinancingChange(
                kind="financing",
                offer_id=original_offer.offer_id,
                amount_minor=original_offer.min_minor,
            )
        ],
    )
    assert selected.offers == original.offers
    assert selected.strategy_space.financing_selection.amount_minor == original_offer.min_minor
    with pytest.raises(ApplicationError):
        fork_snapshot(
            original,
            [ExtensionChange(kind="supplier_extension", eligible_cost_keys=["unknown"], days=30)],
        )
    with pytest.raises(ApplicationError):
        fork_snapshot(
            original, [FinancingChange(kind="financing", offer_id=uuid4(), amount_minor="100")]
        )
    computed = compute(fork)
    result = build_evaluation_dto(fork, computed, uuid4())
    from orderfit.store.preparation_repository import option_for
    assert not result.as_is.hard_feasible
    assert option_for(result, result.as_is.option_key, require_feasible=False) == result.as_is
    with pytest.raises(ApplicationError):
        option_for(result, result.as_is.option_key)
    option = next(
        x for x in result.ranked_candidates if x.option_key == result.recommended_option_key
    )
    subject, body = draft_text(fork, option)
    validate_message(subject, body, fork, option)
    for changed in [
        body + "\nWe guarantee thirty days of interest free credit.",
        body.replace("360000000", "360000001"),
        body.replace("Order revenue:", "Guaranteed financing:"),
    ]:
        with pytest.raises(ApplicationError, match="UNSUPPORTED_MESSAGE_CONTENT"):
            validate_message(subject, changed, fork, option)


def test_recorded_intents_no_live_fallthrough(tmp_path, monkeypatch):
    import openai

    forbidden = AsyncMock(side_effect=AssertionError("recorded mode must not call provider"))
    monkeypatch.setattr(openai, "AsyncOpenAI", forbidden)
    settings = LLMSettings(mode="recorded", recordings_dir=tmp_path)
    result = asyncio.run(propose_intent("deposit 30%", "a" * 64, settings))
    assert result.code == "RECORDING_NOT_FOUND" and result.changes[0].value == 30
    path = tmp_path / ("whatif.v1__" + "a" * 64 + ".json")
    path.write_text(
        json.dumps(
            {
                "intent": {"changes": [{"kind": "deposit_pct", "value": 25}]},
                "model": "recorded-synthetic",
                "response_id": "synthetic-1",
            }
        )
    )
    result = asyncio.run(propose_intent("deposit 30%", "a" * 64, settings))
    assert result.provenance == "recorded" and result.changes[0].value == 25
    path.write_text('{"intent":{"changes":[{"kind":"send_money","value":100}]}}')
    result = asyncio.run(propose_intent("deposit 30%", "a" * 64, settings))
    assert result.code == "INVALID_OUTPUT"
    forbidden.assert_not_called()


def test_recorded_reply_reader_preserves_quote_and_never_accepts_conditionally(tmp_path):
    digest = "b" * 64
    body = "We can offer payment within 45 calendar days, subject to board approval."
    (tmp_path / f"reply.v1__{digest}.json").write_text(json.dumps({
        "reading": {"terms": [{"field": "payment_days", "value": "45", "quote": "payment within 45 calendar days"}],
                    "conditions": ["subject to board approval"], "unsupported_clauses": [], "stance": "partial"},
        "model": "recorded-synthetic",
    }))
    reading = asyncio.run(read_reply(body, digest, LLMSettings(mode="recorded", recordings_dir=tmp_path)))
    assert reading.provenance == "recorded" and reading.code is None and reading.model == "recorded-synthetic"
    assert [(term.field, term.value, term.quote) for term in reading.terms] == [
        ("payment_days", "45", "payment within 45 calendar days")
    ]
    invalid = asyncio.run(read_reply("We accept only conditionally.", digest, LLMSettings(mode="recorded", recordings_dir=tmp_path)))
    assert invalid.provenance == "template" and invalid.code == "INVALID_OUTPUT"


def test_combined_whatif_fallback_requires_each_change_to_be_explicit():
    changes = deterministic_intent("What if the deposit is 25% and customer pays 12 days late?")
    assert [(change.kind, change.value) for change in changes] == [
        ("deposit_pct", 25), ("customer_delay_days", 12)
    ]
    assert deterministic_intent("deposit 25% and borrow 100000 from a new lender") == []


@pytest.mark.parametrize(
    "error_name,expected",
    [
        ("APITimeoutError", "TIMEOUT"),
        ("RateLimitError", "RATE_LIMIT"),
        ("APIConnectionError", "PROVIDER_UNAVAILABLE"),
        ("JSONDecodeError", "INVALID_OUTPUT"),
    ],
)
def test_provider_failures_keep_useful_fallback(monkeypatch, error_name, expected):
    import httpx
    import openai

    request = httpx.Request("POST", "https://example.invalid")
    if error_name == "JSONDecodeError":
        exc = json.JSONDecodeError("Synthetic malformed provider JSON", "{", 1)
    elif error_name == "RateLimitError":
        exc = openai.RateLimitError(
            "Synthetic", response=httpx.Response(429, request=request), body=None
        )
    else:
        exc = getattr(openai, error_name)(request=request)
    client = AsyncMock()
    client.responses.parse.side_effect = exc
    monkeypatch.setattr(openai, "AsyncOpenAI", lambda **kwargs: client)
    result = asyncio.run(
        propose_intent(
            "deposit 30%",
            "a" * 64,
            LLMSettings(mode="live", model="synthetic", api_key="synthetic"),
        )
    )
    assert result.code == expected and result.changes[0].value == 30
    assert result.provenance == "template"
    client.close.assert_awaited_once()


@pytest.mark.parametrize(
    "body",
    [
        "Please pay to our new IFSC HDFC0001234",
        "Our SORT CODE has changed",
        "Use wire instructions below",
        "kindly remit to the attached details",
        "New payment details attached",
        "We have a new payee for you",
        "use ACH going forward",
        "Please use our new  account",
        "pay to our new b a n k",
        "update the b​a​n​k details",
        "Bаnk transfer",  # Cyrillic a
        "ＢＡＮＫ details",  # fullwidth BANK
        "send to a/c 1234",
    ],
)
def test_bank_change_signal_is_broad_and_normalized(body):
    assert bank_change(body)


@pytest.mark.parametrize(
    "body",
    ["Deposit of 20% and payment within 30 days.", "We accept the exact proposed terms.", "Regards"],
)
def test_bank_change_signal_ignores_plain_commercial_replies(body):
    assert not bank_change(body)


@pytest.mark.parametrize(
    "body",
    [
        "We do not accept the exact proposed terms.",
        "We cannot accept the exact proposed terms",
        "Thanks. We don't accept the exact proposed terms.",
        "If approved internally we would accept the exact proposed terms.",
        "We will never accept the exact proposed terms",
    ],
)
def test_negated_or_conditional_acceptance_is_not_a_candidate(body):
    assert [c for c in reply_candidates(body)[0] if c.field == "acceptance"] == []


def test_plain_acceptance_and_later_sentence_after_negation_still_match():
    found = reply_candidates("We do not like delays. We accept the exact proposed terms.")[0]
    assert [c.field for c in found] == ["acceptance"]

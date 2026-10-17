"""Synthetic adversarial source boundaries; no provider traffic or database."""

import asyncio
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from orderfit.agent import llm
from orderfit.contracts.financial import ConfirmedInputV1
from orderfit.contracts.language import LanguageRequest, SourceExcerpt
from orderfit.contracts.workflow import ExtensionChange
from orderfit.services.documents import quote_supports
from orderfit.services.preparation import fork_snapshot, reply_candidates
from orderfit.workflow.extraction import run_extract
from tests.contracts.examples import snapshot


@pytest.mark.parametrize(
    "body",
    [
        "We accept the exact proposed terms only if our board approves.",
        "We accept the exact proposed terms unless rates change.",
        "We accept the exact proposed terms, subject to a contract.",
        "We accept the exact proposed terms. This remains subject to a contract.",
        "We accept the exact proposed terms only after our board approves.",
        "We accept the exact proposed terms, contingent on internal approval.",
        "We accept the exact proposed terms provisionally.",
        "We accept the exact proposed terms, but payment is not guaranteed.",
        "We accept the exact proposed terms. No, we reject them.",
        "We accept the exact proposed terms—not.",
    ],
)
def test_qualified_acceptance_is_not_an_exact_acceptance(body):
    candidates, _ = reply_candidates(body)
    assert not any(c.field == "acceptance" for c in candidates)


@pytest.mark.parametrize(
    "body",
    [
        "We accept the exact proposed terms.",
        "We accept the exact proposed terms unconditionally.",
        "We do not like delays. We accept the exact proposed terms.",
        "We accept the exact proposed terms. Deposit of 30% and payment within 15 days.",
    ],
)
def test_unqualified_acceptance_still_produces_a_review_candidate(body):
    candidates, flagged = reply_candidates(body)
    assert [c.value for c in candidates if c.field == "acceptance"] == ["accepted"]
    assert flagged is False


@pytest.mark.parametrize("field", ["order_value_minor", "opening_cash_minor"])
@pytest.mark.parametrize(
    "amount",
    ["-100.00", "−100.00", "﹣100.00", "－100.00", "- USD 100.00", "(100.00)",
     "(USD 100.00)", "100.00-"],
)
def test_negative_source_amount_cannot_ground_a_positive_proposal(field, amount):
    quote = "Order value: " + amount
    assert quote_supports(field, "10000", quote, quote) == "quote_mismatch"


@pytest.mark.parametrize("source", ["Order value: -100.00", "Order value: (USD 100.00)"])
def test_quote_cannot_hide_a_negative_source_sign(source):
    assert quote_supports("order_value_minor", "10000", "100.00", source) == "quote_mismatch"


def test_numeric_quote_must_cover_a_whole_source_number():
    assert quote_supports("order_value_minor", "10000", "100", "Order value: 1000") == "quote_mismatch"


@pytest.mark.parametrize("amount", ["100.00", "USD 100.00", "$100.00", "+100.00"])
def test_positive_source_amount_still_grounds_proposal(amount):
    quote = "Order value: " + amount
    assert quote_supports("order_value_minor", "10000", quote, quote) == "ok"


def _request(texts):
    return LanguageRequest(
        task="extract", input_schema_version="extract-input.v1", input_hash="a" * 64,
        prompt_version="extract_order.v1", allowed_fact_ids=[], user_instruction=None,
        sources=[
            SourceExcerpt(document_id=uuid4(), content_hash="b" * 64,
                          source_role="customer_order", page=i, text=body)
            for i, body in enumerate(texts, start=1)
        ],
    )


def test_aggregate_input_limit_prevents_provider_creation(monkeypatch):
    import openai

    forbidden = Mock(side_effect=AssertionError("over-budget input must not reach provider"))
    monkeypatch.setattr(openai, "AsyncOpenAI", forbidden)
    result = asyncio.run(llm.extract(
        _request(["x" * 50_001, "x" * 50_000]),
        llm.LLMSettings(mode="live", model="synthetic", api_key="synthetic"),
    )).result
    assert result.kind == "unavailable" and result.retryable is False
    forbidden.assert_not_called()


@pytest.mark.parametrize("size", [99_999, 100_000])
def test_input_at_or_below_budget_reaches_mock_provider(monkeypatch, size):
    import openai

    client = AsyncMock()
    client.responses.parse.return_value = SimpleNamespace(
        status="completed", output=[], output_parsed=llm.ModelOutput(candidates=[]),
        usage=None, id="synthetic",
    )
    monkeypatch.setattr(openai, "AsyncOpenAI", lambda **kwargs: client)
    result = asyncio.run(llm.extract(
        _request(["x" * size]),
        llm.LLMSettings(mode="live", model="synthetic", api_key="synthetic"),
    )).result
    assert result.kind == "parsed"
    client.responses.parse.assert_awaited_once()
    client.close.assert_awaited_once()


@pytest.mark.parametrize("invalid", ["candidate_count", "negative_usage"])
def test_final_live_result_validation_returns_invalid_output(monkeypatch, invalid):
    import openai

    request = _request(["Payment within 30 days."])
    candidate = llm.ModelCandidate(
        field="payment_days", normalized_value="30", status="extracted",
        document_id=str(request.sources[0].document_id), page=1, exact_quote="Payment within 30 days.",
    )
    client = AsyncMock()
    client.responses.parse.return_value = SimpleNamespace(
        status="completed", output=[], id="synthetic",
        output_parsed=llm.ModelOutput(candidates=[candidate] * (2001 if invalid == "candidate_count" else 1)),
        usage=SimpleNamespace(input_tokens=1, output_tokens=-1 if invalid == "negative_usage" else 1),
    )
    monkeypatch.setattr(openai, "AsyncOpenAI", lambda **kwargs: client)
    result = asyncio.run(llm.extract(
        request, llm.LLMSettings(mode="live", model="synthetic", api_key="synthetic"),
    )).result
    assert result.kind == "invalid_output" and result.code == "INVALID_OUTPUT"
    assert result.retryable is False
    client.close.assert_awaited_once()


def test_historical_oversized_parse_returns_manual_guidance_without_provider(monkeypatch):
    document_id, deal_id, operation_id = uuid4(), uuid4(), uuid4()
    pages = ["a" * 50_001, "b" * 50_000]
    rows = iter([
        dict(source_document_id=document_id, deal_id=deal_id, input_version=1),
        dict(id=document_id, content_hash=b"a" * 32, source_role="customer_order"),
        dict(status="parsed", pages=pages),
    ])

    class Connection:
        def execute(self, *args, **kwargs):
            row = next(rows)
            return SimpleNamespace(mappings=lambda: SimpleNamespace(one=lambda: row, one_or_none=lambda: row))

    class Database:
        @contextmanager
        def job(self, *args):
            yield Connection(), None

    forbidden = AsyncMock(side_effect=AssertionError("oversized extraction must not call provider"))
    monkeypatch.setattr(llm, "extract", forbidden)
    result = run_extract(
        SimpleNamespace(database=Database()),
        dict(id=operation_id, lease_token=uuid4(), business_id=uuid4()),
        SimpleNamespace(attempt=1), SimpleNamespace(llm=llm.LLMSettings(), job_attempts=3),
    )
    assert result.kind == "blocked" and result.outcome == "needs_input"
    assert result.findings[0].code == "DOCUMENT_TOO_LONG"
    assert "100,000" in result.findings[0].message and "manually" in result.findings[0].message
    assert pages == ["a" * 50_001, "b" * 50_000]
    forbidden.assert_not_called()


def test_supplier_extension_excludes_sunk_inventory_from_eligible_subset():
    data = snapshot()
    sunk = data["order"]["costs"][0] | dict(
        event_id=None, cost_key="inventory-already-owned", kind="existing_inventory",
        amount_minor="1000000", incremental=False, is_deferrable=True,
        nonincremental_reason="Already owned stock; no new cash obligation.",
        original_obligation_id="inventory-already-owned",
    )
    data["order"]["costs"].append(sunk)
    original = ConfirmedInputV1.model_validate(data)
    fork = fork_snapshot(original, [ExtensionChange(
        kind="supplier_extension", days=30, eligible_cost_keys=["materials"],
    )])
    assert [extension.days for extension in fork.strategy_space.extensions] == [30]
    assert fork.order.costs == original.order.costs
    assert fork.order.costs[1].incremental is False

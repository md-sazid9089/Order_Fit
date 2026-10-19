"""Provider reliability at the single OpenAI boundary; mocked transport, no network or database."""

import asyncio
import threading
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import openai
import pytest

from orderfit.agent import llm

SETTINGS = llm.LLMSettings(mode="live", model="synthetic", api_key="synthetic", max_attempts=3)
OK = SimpleNamespace(status="completed", output=[], output_parsed=llm.ModelExplanation(sentences=[]),
                     usage=None, id="synthetic")
_REQUEST = httpx.Request("POST", "https://api.openai.test/v1/responses")


def _status_error(status, retry_after=None, code=None):
    headers = {} if retry_after is None else {"retry-after": str(retry_after)}
    response = httpx.Response(status, headers=headers, request=_REQUEST)
    cls = openai.RateLimitError if status == 429 else openai.InternalServerError
    exc = cls("synthetic", response=response, body=None)
    exc.code = code
    return exc


@pytest.fixture(autouse=True)
def fresh_provider_state(monkeypatch):
    monkeypatch.setattr(llm, "_breaker", llm._CircuitBreaker())
    monkeypatch.setattr(llm, "_BACKOFF_BASE_SECONDS", 0.0)
    monkeypatch.setattr(llm, "_limiters", {})


def _call(monkeypatch, effects, settings=SETTINGS):
    client = AsyncMock()
    client.responses.parse.side_effect = effects
    monkeypatch.setattr(openai, "AsyncOpenAI", lambda **kwargs: client)
    result = asyncio.run(llm._structured_call("system", "user", llm.ModelExplanation, settings))
    return result, client


def test_transient_failure_is_retried_then_succeeds(monkeypatch):
    result, client = _call(monkeypatch, [openai.APIConnectionError(request=_REQUEST), _status_error(500), OK])
    assert result.response_id == "synthetic"
    assert client.responses.parse.await_count == 3
    client.close.assert_awaited_once()


def test_attempts_are_bounded(monkeypatch):
    result, client = _call(monkeypatch, [_status_error(429, retry_after=0)] * 5)
    assert (result.code, result.retryable) == ("RATE_LIMIT", True)
    assert client.responses.parse.await_count == SETTINGS.max_attempts


@pytest.mark.parametrize("effect, code", [
    (_status_error(429, code="insufficient_quota"), "QUOTA"),
    (_status_error(400), "PROVIDER_UNAVAILABLE"),
])
def test_non_transient_failures_are_not_retried(monkeypatch, effect, code):
    effect = effect if code == "QUOTA" else openai.BadRequestError(
        "synthetic", response=httpx.Response(400, request=_REQUEST), body=None)
    result, client = _call(monkeypatch, [effect, OK])
    assert result.code == code and result.retryable is False
    assert client.responses.parse.await_count == 1


def test_provider_requested_wait_beyond_the_cap_is_not_slept_through(monkeypatch):
    result, client = _call(monkeypatch, [_status_error(429, retry_after=120), OK])
    assert result.code == "RATE_LIMIT" and client.responses.parse.await_count == 1


def test_circuit_opens_after_repeated_failures_and_skips_the_provider(monkeypatch):
    single = llm.LLMSettings(mode="live", model="synthetic", api_key="synthetic", max_attempts=1)
    for _ in range(5):
        _call(monkeypatch, [_status_error(500)], single)
    result, client = _call(monkeypatch, [OK], single)
    assert (result.code, result.retryable) == ("PROVIDER_UNAVAILABLE", True)
    client.responses.parse.assert_not_awaited()


def test_invalid_output_does_not_trip_the_circuit(monkeypatch):
    bad = SimpleNamespace(status="completed", output=[], output_parsed=None, usage=None, id="x")
    for _ in range(10):
        result, _client = _call(monkeypatch, [bad])
        assert result.code == "INVALID_OUTPUT"
    assert llm._breaker.allow()


def test_non_retryable_client_error_does_not_trip_the_circuit(monkeypatch):
    effect = openai.BadRequestError(
        "synthetic", response=httpx.Response(400, request=_REQUEST), body=None)
    for _ in range(10):
        result, _client = _call(monkeypatch, [effect])
        assert result.code == "PROVIDER_UNAVAILABLE" and not result.retryable
    assert llm._breaker.allow()


def test_oversized_prompt_never_reaches_the_provider(monkeypatch):
    def forbidden(**kwargs):
        raise AssertionError("oversized prompt must not create a client")

    monkeypatch.setattr(openai, "AsyncOpenAI", forbidden)
    result = asyncio.run(llm._structured_call(
        "system", "x" * llm.MAX_PROMPT_CHARS, llm.ModelExplanation, SETTINGS))
    assert result.code == "PROVIDER_UNAVAILABLE" and result.retryable is False


def test_concurrency_cap_holds_across_threads(monkeypatch):
    settings = llm.LLMSettings(mode="live", model="synthetic", api_key="synthetic", concurrency=2)
    lock, state = threading.Lock(), {"now": 0, "peak": 0}

    async def slow(**kwargs):
        with lock:
            state["now"] += 1
            state["peak"] = max(state["peak"], state["now"])
        await asyncio.sleep(0.05)
        with lock:
            state["now"] -= 1
        return OK

    client = AsyncMock()
    client.responses.parse.side_effect = slow
    monkeypatch.setattr(openai, "AsyncOpenAI", lambda **kwargs: client)
    threads = [threading.Thread(target=lambda: asyncio.run(
        llm._structured_call("s", "u", llm.ModelExplanation, settings))) for _ in range(6)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert state["peak"] <= 2 and client.responses.parse.await_count == 6


def test_slot_starvation_fails_as_retryable_without_provider_call(monkeypatch):
    monkeypatch.setattr(llm, "_QUEUE_WAIT_SECONDS", 0.1)
    held = asyncio.run(llm._acquire_slot(1, 1))
    assert held is not None
    settings = llm.LLMSettings(mode="live", model="synthetic", api_key="synthetic", concurrency=1)
    result, client = _call(monkeypatch, [OK], settings)
    assert (result.code, result.retryable) == ("RATE_LIMIT", True)
    client.responses.parse.assert_not_awaited()
    held.release()

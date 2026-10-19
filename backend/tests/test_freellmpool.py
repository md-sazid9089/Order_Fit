"""Real FreeLLMPool adapter and wire shaping over an injected, provider-free transport."""

import pytest

pytest.skip("FreeLLMPool is retired; this historical adapter suite is not part of the OpenAI runtime",
            allow_module_level=True)

# ruff: noqa: E402
import asyncio
import json
from unittest.mock import AsyncMock

from freellmpool.client import HTTPResult

from orderfit.agent import llm
from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.services.documents import quote_supports
from tests.test_p4_pure import request

MODEL = "ovh/Mistral-Small-3.2-24B-Instruct-2506"


def settings(tmp_path):
    return llm.LLMSettings(mode="live", provider="freellmpool", model=MODEL,
                           api_key="must-never-be-used", free_state_dir=tmp_path, free_min_interval_seconds=0)


def response(content, *, finish="stop", refusal=None, model="actual-upstream-model"):
    return HTTPResult(200, {
        "id": "synthetic-provider-response", "model": model,
        "choices": [{"message": {"role": "assistant", "content": content, "refusal": refusal},
                     "finish_reason": finish}],
        "usage": {"prompt_tokens": 23, "completion_tokens": 17},
    }, "synthetic")


def test_free_extraction_forwards_json_schema_and_ignores_secrets_and_user_catalog(tmp_path, monkeypatch):
    req = request()
    req = req.model_copy(update={"sources": [req.sources[0].model_copy(update={"text": "Payment is due in 30 days."})]})
    output = {"candidates": [{"field": "payment_days", "normalized_value": "30", "status": "extracted",
                              "document_id": str(req.sources[0].document_id), "page": 1,
                              "exact_quote": "Payment is due in 30 days."}]}
    post = AsyncMock(return_value=response(json.dumps(output)))
    monkeypatch.setattr(llm, "_free_post_once", post)
    monkeypatch.setenv("OVH_API_KEY", "never-forward-this")
    monkeypatch.setenv("OPENAI_API_KEY", "never-forward-this-either")
    monkeypatch.setenv("FREELLMPOOL_CONFIG", str(tmp_path / "untrusted-overrides.toml"))
    (tmp_path / "untrusted-overrides.toml").write_text("invalid toml: must not be read", encoding="utf-8")
    import openai
    monkeypatch.setattr(openai, "AsyncOpenAI", lambda **kw: pytest.fail("No paid fallback"))
    result = asyncio.run(llm.extract(req, settings(tmp_path))).result
    assert result.kind == "parsed" and result.model == "freellmpool:ovh/actual-upstream-model"
    assert result.response_id == "synthetic-provider-response"
    assert (result.input_tokens, result.output_tokens) == (23, 17)
    candidate = result.proposal.candidates[0]
    assert quote_supports(candidate.field, candidate.normalized_value, candidate.exact_quote, req.sources[0].text) == "ok"
    post.assert_awaited_once()
    url, headers, body, timeout = post.call_args.args
    assert url.startswith("https://") and "ovh" in url
    assert "Authorization" not in headers
    assert body["response_format"] == {"type": "json_object"}
    assert body["max_tokens"] == 2048 and timeout <= 30
    assert body["model"] == MODEL.split("/", 1)[1]
    assert '"$defs"' in body["messages"][0]["content"]
    assert '"candidates"' in body["messages"][0]["content"]


def test_free_whatif_is_live_and_schema_bound(tmp_path, monkeypatch):
    post = AsyncMock(return_value=response('{"changes":[{"kind":"customer_delay_days","value":12}]}'))
    monkeypatch.setattr(llm, "_free_post_once", post)
    result = asyncio.run(llm.propose_intent("Explore a case where the buyer pays twelve days late.", "a"*64, settings(tmp_path)))
    assert result.provenance == "live" and result.code is None
    assert result.changes[0].kind == "customer_delay_days" and result.changes[0].value == 12
    assert result.model == "freellmpool:ovh/actual-upstream-model"
    assert '"discriminator"' in post.call_args.args[2]["messages"][0]["content"]


def test_both_providers_receive_identical_shared_system_prompt(tmp_path, monkeypatch):
    req = request()
    free_post = AsyncMock(return_value=response('{"candidates":[]}'))
    monkeypatch.setattr(llm, "_free_post_once", free_post)
    asyncio.run(llm.extract(req, settings(tmp_path)))
    free_system = free_post.call_args.args[2]["messages"][1]["content"]

    class Responses:
        async def parse(self, **kwargs):
            self.kwargs = kwargs
            return type("Response", (), {"status": "completed", "output": [], "output_parsed": llm.ModelOutput(candidates=[]), "usage": None, "id": "synthetic", "model": "returned-model"})()
    responses = Responses()
    client = type("Client", (), {"responses": responses, "close": AsyncMock()})()
    import openai
    monkeypatch.setattr(openai, "AsyncOpenAI", lambda **kwargs: client)
    openai_settings = settings(tmp_path).model_copy(update={"provider": "openai", "model": "synthetic", "api_key": "synthetic"})
    asyncio.run(llm.extract(req, openai_settings))
    assert free_system == responses.kwargs["input"][0]["content"] == llm.system_prompt("extract_order")


@pytest.mark.parametrize("result,code", [
    (response("not JSON"), "INVALID_OUTPUT"),
    (response('{"changes":[{"kind":"bank_transfer","value":12}]}'), "INVALID_OUTPUT"),
    (response('{"changes":[{"kind":"deposit_pct","value":999}]}'), "INVALID_OUTPUT"),
    (response('{"changes":[]}', finish="length"), "INCOMPLETE"),
    (response("Refused", finish="content_filter", refusal="Refused"), "REFUSAL"),
    (HTTPResult(429, {"error": {"message": "synthetic rate limit"}}, "synthetic"), "RATE_LIMIT"),
    (HTTPResult(503, {"error": {"message": "synthetic outage"}}, "synthetic"), "PROVIDER_UNAVAILABLE"),
])
def test_free_failure_does_not_masquerade_as_live_success(tmp_path, monkeypatch, result, code):
    post = AsyncMock(return_value=result)
    monkeypatch.setattr(llm, "_free_post_once", post)
    intent = asyncio.run(llm.propose_intent("deposit 30%", "a"*64, settings(tmp_path)))
    assert intent.provenance == "template" and intent.code == code
    assert intent.changes[0].value == 30
    post.assert_awaited_once()  # no hidden SDK retry or different model/provider


def test_free_timeout_is_explicit_and_retryable(tmp_path, monkeypatch):
    monkeypatch.setattr(llm, "_free_post_once", AsyncMock(side_effect=TimeoutError))
    result = asyncio.run(llm.extract(request(), settings(tmp_path))).result
    assert result.code == "TIMEOUT" and result.retryable is True


def test_free_reasoning_model_cannot_raise_the_application_token_budget(tmp_path, monkeypatch):
    post = AsyncMock(return_value=response('{"candidates":[]}'))
    monkeypatch.setattr(llm, "_free_post_once", post)
    configured = settings(tmp_path).model_copy(update={"model": "ovh/gpt-oss-120b", "max_output_tokens": 64})
    asyncio.run(llm.extract(request(), configured))
    post.assert_awaited_once()
    assert post.call_args.args[2]["max_tokens"] == 64


def test_pacing_survives_worker_event_loop_restarts(tmp_path, monkeypatch):
    configured = settings(tmp_path).model_copy(update={"free_min_interval_seconds": 35})
    monkeypatch.setattr(llm.time, "monotonic", lambda: 100.0)
    sleep = AsyncMock()
    monkeypatch.setattr(llm.asyncio, "sleep", sleep)
    asyncio.run(llm._free_wait_turn(configured, "ovh"))
    asyncio.run(llm._free_wait_turn(configured, "ovh"))
    sleep.assert_awaited_once_with(35.0)


def test_free_transport_never_follows_redirects_or_retries(monkeypatch):
    import httpx
    calls = []
    def handler(req):
        calls.append(req)
        return httpx.Response(302, headers={"Location": "http://127.0.0.1/private"}, json={})
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(transport=httpx.MockTransport(handler), **kw))
    result = asyncio.run(llm._free_post_once("https://synthetic.invalid/test", {}, {"max_tokens": 64}, 1))
    assert result.status == 302 and len(calls) == 1


def test_free_transport_caps_the_response_body(monkeypatch):
    import httpx
    original = httpx.AsyncClient
    transport = httpx.MockTransport(lambda req: httpx.Response(200, content=b"x" * (2*1024*1024 + 1)))
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(transport=transport, **kw))
    with pytest.raises(ValueError, match="output envelope"):
        asyncio.run(llm._free_post_once("https://synthetic.invalid/test", {}, {}, 1))


@pytest.mark.parametrize("model", ["auto", "groq/model", "openai/model", "ovh/unknown-model"])
def test_free_route_selection_fails_closed(tmp_path, monkeypatch, model):
    post = AsyncMock(side_effect=AssertionError("must not call a different route"))
    monkeypatch.setattr(llm, "_free_post_once", post)
    configured = settings(tmp_path).model_copy(update={"model": model})
    assert asyncio.run(llm.extract(request(), configured)).result.code == "PROVIDER_UNAVAILABLE"
    post.assert_not_awaited()


def test_off_and_recorded_modes_do_not_import_free_provider(tmp_path, monkeypatch):
    import sys
    monkeypatch.setitem(sys.modules, "freellmpool", None)
    configured = settings(tmp_path)
    assert asyncio.run(llm.extract(request(), configured.model_copy(update={"mode": "off"}))).result.code == "AI_OFF"
    assert asyncio.run(llm.extract(request(), configured.model_copy(update={"mode": "recorded"}))).result.code == "RECORDING_NOT_FOUND"


def test_runtime_selects_free_provider_without_openai_key():
    config = RuntimeConfiguration(_env_prefix="ORDERFIT_ISOLATED_TEST_", database_url="postgresql+psycopg://test@localhost/test",
                                  session_secret="s"*32, account_fingerprint_key="f"*32,
                                  account_fingerprint_key_version=1, document_dir="var/documents",
                                  allowed_origins=["http://localhost:3000"], llm_mode="live",
                                  llm_provider="freellmpool", freellmpool_model=MODEL,
                                  openai_api_key="must-not-reach-free-adapter")
    configured = llm.LLMSettings.from_runtime(config)
    assert configured.provider == "freellmpool" and configured.model == MODEL
    assert configured.api_key is None
    with pytest.raises(ValueError):
        RuntimeConfiguration(**(config.model_dump() | {"freellmpool_model": "groq/model"}))

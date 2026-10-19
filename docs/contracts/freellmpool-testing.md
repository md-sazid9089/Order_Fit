# Retired: FreeLLMPool testing contract

> Historical contract retained for reference. The current runtime supports OpenAI only;
> none of the configuration or behaviors below are active.

`LLM_MODE=live` and `LLM_PROVIDER=freellmpool` explicitly select credential-free
FreeLLMPool calls. `FREELLMPOOL_MODEL` must name an enabled, packaged keyless route
as `provider/model`. No user catalog, provider environment keys, model alias,
automatic failover or paid OpenAI fallback is used. The default provider remains
`openai`, with its existing Responses API and required OpenAI key/model.
Live FreeLLMPool configuration requires loopback origins and filesystem document
storage. Hosted/non-loopback or S3 configurations must use the OpenAI provider.

The selected FreeLLMPool route receives a JSON-mode chat request containing the
task's JSON schema in a trusted system message. Returned JSON must pass the same
typed candidate/intent validation and source, eligibility and human-review rules
as other providers. JSON mode is not a guarantee that the schema is followed.
Malformed JSON, refusal, truncation and unavailable service remain explicit failure
outcomes. A deterministic what-if fallback retains `provenance=template`.

Provider I/O stays in `agent/llm.py`. Each call has one upstream HTTP attempt,
the configured overall timeout (maximum 30 seconds), output limit and concurrency
gate. Existing durable extraction retries remain the only job-level retries.
`FREELLMPOOL_MIN_INTERVAL_SECONDS` defaults to 35 seconds between request starts
in one worker process to respect anonymous upstream limits. This pacing is outside
the provider's network timeout; the durable worker continues its lease heartbeat.
It is advisory rather than a distributed quota or provider-availability guarantee.
`FREELLMPOOL_STATE_DIR` holds advisory quota counts only, never prompts or replies.
Actual route/model, upstream response ID and token usage are retained when returned.
If no upstream ID exists, a clearly labelled local response digest identifies the
validated output; it is not described as a provider-issued ID.

Both API and worker receive the provider selection. FreeLLMPool needs no separate
proxy process; its Responses compatibility shim is bypassed because version 0.13.0
does not forward the structured-output schema used by OrderFit.

Use synthetic documents for this testing integration. Provider availability,
retention and model quality remain separate from successful transport and schema
validation. The synthetic smoke command must exit unsuccessfully if either task
uses fallback, returns the wrong expected facts or fails source grounding.

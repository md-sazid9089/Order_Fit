# ADR 0005: Model failure handling and LLM modes

Status: proposed.

## Context

The system design already specifies retries and a manual-entry fallback `[R]`. The demo must not depend on a live API; free-tier providers may train on inputs `[W]`; provider limits and model names change quickly `[W]`.

## Decision

1. All model calls go through one module, the LLM Gateway, with four modes: `recorded` (default for judges and CI; replays JSON keyed by prompt name and input hash; **a key that was not recorded goes to `live` if a provider key is configured, otherwise to `off` behavior with a visible banner, never to a silent failure**), `live` (provider API with structured output), `local` (Ollama with schema-constrained output; IF-TIME), `off` (no model).
2. Failure ladder for a live or local call: 30 s timeout, two retries after 1 s and 4 s, one re-ask with the validation error on a schema failure, then the field becomes `missing` and the owner enters it. The engine always runs.
3. `off` mode: pre-extracted fixture fields with their quotes (or a manual form), deterministic explanation templates, deterministic drafts, owner-typed reply terms. The whole demo and the whole test suite run in `off` and `recorded` modes.
4. Output validation: Pydantic with `extra=forbid`; the provider's JSON-schema mode is used but its limits (no numeric or length constraints) are enforced in Pydantic and the engine, not in the schema.
5. Data to a hosted provider: synthetic data only, stated in the interface and the README; a startup check refuses `live` mode for a tenant not marked synthetic; free tiers (Gemini free, OpenRouter with data collection allowed) are not used for anything else.
6. Pin model ids in configuration; re-verify provider terms and model names the day before the demo.

## Alternatives rejected

A live API in the demo path (a rate limit or outage ruins the video); scripting the model by hand-written strings without validation (hides failures); one free provider (data-use terms).

## Consequences

Recordings must be refreshed whenever a prompt or schema changes (one command); `recorded` replays can drift from live behavior (the live-mode tests are run once before submission).

## Verification

LLM-RECORDED, LLM-MISS, LLM-TIMEOUT, LLM-SCHEMA, E2E-NOLLM, SEC-DATA.

# ADR 0006: Orchestration framework and learned decision layer

Status: proposed; both items are **explored with go/no-go gates, default no-go**.

## Context

The team asked for modern orchestration (LangGraph, LangChain) and a fine-tuned open-source decision layer to be explored. Verified on 2026-10-14 `[W: _work/research-technical.md]`: langgraph 1.2.15 (MIT) with langgraph-checkpoint-postgres 3.1.3; about 11 advisories since 2025-10, mostly checkpoint deserialization; on resume an interrupted node re-runs from its start; the repository pins stale floors `>=0.2` and `>=2.0` and its LangGraph code is stubs `[R]`; compatibility of the Postgres checkpointer with the Neon pooled endpoint is unverified `[?]`. For open-weight models: every shortlisted small model (Qwen3.5, Granite 4.2, Ministral-3, Gemma 4, gpt-oss, SmolLM3, Phi-4-mini) is Apache-2.0 or MIT on its card; models of 3B or less fit a 4 GB GPU, but the team has a 16 GB GPU `[A: stated by the user]` on which 4B to 9B models fit for serving (Ollama 4-bit 3.3 to 7.6 GB) and plausibly for QLoRA (Unsloth absolute minimum about 6 to 6.5 GB for 8B and 9B); free-GPU quotas are not guaranteed; evidence for small tuned models exists only for narrow extraction, none for ranking options `[W]`.

## Decision 1: orchestration

Plain-code Workflow Runner (state column, transition table as data, an `AWAITING_APPROVAL` state, retries helper, server-sent events) behind a `WorkflowRunner` interface. The requirement that could justify a framework is durable human-approval interrupts with restart-resume; plain code meets it with a state column and an approval row, and the hard requirements (stale invalidation, idempotency, plan-hash binding) are domain logic in either case.

Gate for LangGraph (optional, **unscheduled**: not on the day plan; a volunteer with three spare hours may try it, due 2026-10-15 22:00 Dhaka if attempted): adopt only if (a) `AsyncPostgresSaver.setup()` works on local Postgres and the pooled Neon endpoint; (b) killing the API between interrupt and resume completes with identical state and no repeated model call or sandbox action; (c) patched versions (`langgraph>=1.2.14`, `langgraph-checkpoint>=4.1.1`, `langgraph-checkpoint-postgres>=3.1.1`) and `LANGGRAPH_STRICT_MSGPACK=true` are pinned and tested; (d) the spike stays inside 3 hours; (e) the team names a concrete benefit beyond familiarity. Default if not run: no-go. Fallback (and the default): the plain runner, built first. If adopted, a `LangGraphRunner` implements the same interface and the plain runner remains as the fallback.

LangChain, LlamaIndex Workflows, Pydantic AI (V2 major on 2026-06-23, 198 releases in 12 months), DSPy (not an orchestrator), the OpenAI and Claude agent SDKs, Vercel AI SDK (TypeScript only) and Temporal (needs a server) add no requirement the plain runner lacks.

## Decision 2: learned layer

Only extraction (role 1) is a candidate for a tuned model, behind an `Extractor` protocol whose default is the prompted gateway or recorded outputs. Strategy proposal (role 2) and ranking (role 3) keep pluggable interfaces (`StrategyProposer`, `PlanRanker`) with deterministic defaults and may only emit or reorder engine-verifiable options; drafting (role 4) is prompted. The model never does arithmetic, checks hard constraints or authorizes anything.

Ladder: prompting with schema-constrained decoding first (on the 16 GB GPU, a prompted 4B to 9B model through Ollama is the offline baseline); QLoRA (Unsloth or TRL, locally on the 16 GB GPU, free Colab as backup) only if prompting fails the gate. Because compute exists, one owner (R1, after the engine port) may attempt the experiment in parallel; the default if it is not attempted or fails remains no-go. Training data: synthetic documents from the team's generator only; held-out split by template family; the 22 fixture files are excluded; the held-out set is generated once and frozen by hash.

Gate (2026-10-17 22:00 Dhaka), on at least 300 held-out documents: field-level exact-match F1 (value plus quote) must beat the same base model prompted by at least 5 points, be within 3 points of the hosted prompted baseline, produce zero schema-invalid outputs, change no field on the 60-document injection subset, and run on the team's 16 GB GPU in 20 s or less per document (judges use recorded outputs; a 2B to 3B variant is the most a judge's small machine could run). Otherwise ship the baseline and describe the layer as future work. Weights are pinned by revision and SHA-256 and recorded in `LICENSES.md`.

## Evidence limits

About 18 core fixtures cannot show a meaningful gain; 300 held-out documents support claims about the generator's templates only. Unsupported: real-document performance, better decisions, better safety than the engine. A tuned model trained on the engine's own labels can at best imitate the engine, which is why ranking is not a candidate for tuning.

## Consequences

If both gates fail or are not attempted, nothing in the demo changes. Threats TH-14, TH-15 and TH-20 ([05](../05-security-and-evaluation.md)) apply only if a gate passes.

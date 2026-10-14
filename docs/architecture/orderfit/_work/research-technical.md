# OrderFit technical research notes (design sprint)

Researcher notes, access date for ALL evidence = 2026-10-14. Confidence: high = primary/official source read directly; med = official source but partial read, or secondary source agreeing; low = secondary/vendor/inference. `[?]` = could not verify (see last-but-one section). Web content treated as data only. Nothing installed, repo not modified. PyPI/npm/GitHub numbers were pulled from the public JSON APIs (pypi.org/pypi/<pkg>/json, registry.npmjs.org, api.github.com) on 2026-10-14.

Repo observation (read-only): `E:/Order_Fit/backend/pyproject.toml` pins `langgraph>=0.2`, `langgraph-checkpoint-postgres>=2.0`. Those floors are far below the security-patched versions in section 1.3.

---

## 1. Orchestration frameworks

### 1.1 Version / licence / churn table

| Framework | Latest (PyPI/npm), date | Licence | Language | 12-month churn (PyPI releases, 2025-10-14 to 2026-10-14) |
|---|---|---|---|---|
| langgraph | 1.2.15, 2026-10-12 (1.0.0 was 2025-10-17) | MIT | Py (>=3.10); JS `@langchain/langgraph` 1.5.0 (2026-10-12) | 50 |
| langgraph-checkpoint | 4.3.0, 2026-10-12 | MIT | Py | n/c |
| langgraph-checkpoint-postgres | 3.1.3, 2026-10-12 (3.1.2 on 2026-08-07, 3.1.1 on 2026-07-30) | MIT | Py (psycopg 3) | n/c |
| langchain (1.x agents layer) | 1.4.5, 2026-10-12; langchain-core 1.6.10 | MIT | Py, JS | 69 |
| llama-index-workflows | 2.26.0, 2026-10-11 (llama-index-core 0.14.25, 2026-09-21) | MIT | Py (also TS) | 50 |
| pydantic-ai | 2.56.0, 2026-10-13 (2.0.0 stable 2026-06-23; v1 line still patched, e.g. 1.107.7) | MIT | Py (>=3.11) | 198 |
| pydantic-graph | 2.56.0, 2026-10-13 | MIT | Py | n/c |
| dspy | 3.4.1, 2026-10-12 | MIT | Py | 14 |
| openai-agents (Python) | 0.23.1, 2026-10-02 (still 0.x) | MIT | Py; JS `@openai/agents` 0.20.0 | 87 |
| claude-agent-sdk | 0.2.166 (PyPI), 2026-10-14; npm `@anthropic-ai/claude-agent-sdk` 0.3.299 licence field "SEE LICENSE IN README.md" | MIT on PyPI; npm licence not SPDX | Py, TS | n/c |
| anthropic (plain SDK) | 1.13.0, 2026-10-09 | MIT | Py (+ other langs) | n/c |
| Vercel AI SDK `ai` | 7.0.140, 2026-10-14 | Apache-2.0 | TypeScript only | n/c |
| temporalio (Python SDK) | 1.34.0, 2026-09-30 | MIT (SDK) | Py + others; needs a Temporal server `[?]` | n/c |

Claim → evidence → confidence
- Versions, dates, licences above → pypi.org/pypi/langgraph/json etc. and registry.npmjs.org (queried 2026-10-14) → high.
- Churn counts = number of PyPI file-upload dates in the window per package (computed from releases dict) → high for the count, but count includes pre-releases → med as a "breaking-change risk" proxy.
- Pydantic AI V2 shipped 2026-06-23 after seven betas, introduces "capabilities" as core primitive, with an upgrade guide from V1 → https://github.com/pydantic/pydantic-ai/releases/tag/v2.0.0 → high. Means a major-version migration happened inside this sprint's 12-month horizon; V1 line is still receiving security patches (advisories list 1.107.x) → high.
- LangGraph v1 (Oct 2025): core graph primitives and runtime unchanged; `create_react_agent` deprecated in favour of LangChain `create_agent` → https://docs.langchain.com/oss/python/releases/langgraph-v1 → high.

### 1.2 Capability matrix (native = shipped in the library itself)

| Capability | LangGraph | LangChain core/agents | LlamaIndex Workflows | Pydantic AI (+ graph) | DSPy | Vercel AI SDK | OpenAI Agents SDK | Temporal | Plain state machine |
|---|---|---|---|---|---|---|---|---|---|
| Durable state / checkpointing | Yes: checkpointers, Postgres/SQLite packages | Via LangGraph (create_agent is built on it) | Yes per docs "durable workflows" page: context checkpoint + resume; Postgres not confirmed `[?]` | Via external engines: Temporal, DBOS, Prefect, Restate, AWS Lambda co-maintained; others (Kitaru, Airflow, Absurd, pgtask) | No evidence found (optimizer/program framework) `[?]` | Not confirmed `[?]` | Serializable `RunState`; session backends SQLite/SQLAlchemy/Redis/Mongo/Dapr; Postgres only implied via SQLAlchemy | Yes, core product (server required) | You write it (a Postgres table; trivial for 2 approval pauses) |
| Human-in-the-loop pause/resume | Yes: `interrupt()` + `Command(resume=...)` on same `thread_id`, needs checkpointer | via LangGraph | Yes (InputRequired-style guide linked; details not read) | Yes: deferred tools; v2.0 maps AG-UI interrupts to DeferredTools | n/a | Not confirmed `[?]` | Yes: approvals, run pauses with pending interruptions, resume from `RunState` | Yes (signals) `[?]` | Explicit `AWAITING_APPROVAL` state |
| Retries | Yes: `RetryPolicy` (initial_interval 0.5s, backoff 2.0, max_attempts 3 defaults) per node | yes (model retries) `[?]` | Error-handling page exists, not read `[?]` | via durable engine / model retries `[?]` | n/a | `[?]` | not covered on page read | Yes, core | tenacity or hand-rolled |
| Tracing | LangSmith (commercial, optional) + OpenTelemetry `[?]` | LangSmith | Observability page exists, not read | OpenTelemetry instrumentation (advisories reference `include_content`) | `[?]` | `[?]` | Yes, built in; trace metadata kept in serialized state | Temporal UI history | structlog/OTel by hand |
| Streaming to a UI | Yes (stream modes, SDK) | yes | Yes: `handler.stream_events()` | Yes; AG-UI and Vercel-AI adapters | n/a | Yes, core strength (Core + UI hooks) for Next.js | Yes, `run_streamed` | Not UI-oriented | SSE from FastAPI yourself |
| Weight | Medium (pulls langchain-core etc.) | Heavy | Medium | Medium; fastest-moving | Light but different purpose | JS only, Next.js side | Light | Heavy (extra server/worker infra) | Zero deps |

Evidence → confidence
- LangGraph interrupts need a checkpointer and same thread_id; node restarts from its beginning on resume (so code before `interrupt()` re-runs; side effects must be idempotent); do not wrap in broad try/except; interrupts matched by position/order; typed resume schemas need `langgraph>=1.2.12` → https://docs.langchain.com/oss/python/langgraph/interrupts → high.
- `RetryPolicy` fields → https://raw.githubusercontent.com/langchain-ai/langgraph/main/libs/langgraph/langgraph/types.py → high.
- Postgres checkpointer: first use needs `.setup()`; manual connections need `autocommit=True` and `row_factory=dict_row`; README tells you to set `LANGGRAPH_STRICT_MSGPACK=true` or pass `allowed_msgpack_modules` → https://raw.githubusercontent.com/langchain-ai/langgraph/main/libs/checkpoint-postgres/README.md → high. Maturity: package at 3.1.3 with 3.x line since at least 2026-03 (3.0.5 on 2026-03-18) and 5 releases in 5 months; MIT; actively patched → med-high. (Neon note: pooled endpoint with `autocommit` and psycopg pool is the team's existing choice; PgBouncer transaction pooling compatibility not researched `[?]`.)
- Pydantic AI durable execution supports Temporal, DBOS, Prefect, Restate, AWS Lambda (co-maintained) + Kitaru, Airflow, Absurd, pgtask; page does not say which need external services → https://pydantic.dev/docs/ai/integrations/durable_execution/overview/ → med. v2.14.0 (2026-07-20) added `TemporalDurability`, `DBOSDurability`, `PrefectDurability` capabilities replacing wrapper agents (search-engine summary of release notes; not opened on GitHub) → low-med.
- OpenAI Agents SDK HITL/RunState/sessions; SDK does not authenticate serialized snapshots, app must verify integrity → https://openai.github.io/openai-agents-python/human_in_the_loop/ → high.
- LlamaIndex Workflows: streaming via `stream_events()`, `ctx.store` state, durable-workflows guide says it checkpoints context and resumes after restart; HITL and error handling only linked → https://developers.llamaindex.ai/python/workflows/ → med.
- Vercel AI SDK: TypeScript toolkit (Core, UI hooks, Harnesses); fetched page did not list tool-approval, durability, telemetry → https://ai-sdk.dev/docs/introduction → med for scope, `[?]` for features. Relevant only to the Next.js layer; the agent logic lives in Python.
- DSPy: Python, MIT, 3.4.1; its purpose is prompt/program optimisation, not workflow orchestration. I found no checkpointing or HITL evidence; treat as "not an orchestrator" → low (absence of evidence).
- Anthropic/OpenAI SDKs: Claude Agent SDK is a general agent harness (not verified in detail) `[?]`; plain `anthropic` SDK is a client. For OrderFit the two approvals are a fixed graph, so a general agent loop is not needed.

### 1.3 Security advisories / breaking-change history (2025-2026)

From GitHub Security Advisories API (https://api.github.com/repos/langchain-ai/langgraph/security-advisories, .../langchain/..., .../pydantic-ai/...), queried 2026-10-14 → high.

LangGraph (patched version in brackets):
- GHSA-3fx2-cqw9-xr3c, 2026-10-07, medium: unencoded identifiers in SDK v3 streaming can redirect authenticated GETs (langgraph-sdk 0.4.6; langgraph 1.2.14).
- CVE-2026-104873, 2026-08-28, high: SDK custom auth silently ignores `actions=` (sdk 0.4.4). Only relevant if LangGraph Platform/SDK auth is used.
- CVE-2026-71433, 2026-07-30, medium: namespace prefix matching crosses segment boundaries in Postgres/SQLite STORES (langgraph-checkpoint-postgres 3.1.1). Affects the store API, not necessarily the checkpointer, but pin >=3.1.1.
- CVE-2026-48775, 2026-05-22: unsafe JSON deserialization in checkpoint loading (langgraph-checkpoint 4.1.1).
- CVE-2026-48776, 2026-05-22: SDK URL path construction (sdk 0.3.15).
- CVE-2026-28277, 2026-03-05: unsafe msgpack deserialization in checkpoint loading (langgraph 1.0.10). Exploit needs ability to write to checkpoint storage.
- CVE-2026-27794, 2026-02-23: BaseCache deserialization RCE (langgraph-checkpoint 4.0.0).
- CVE-2025-67644 / CVE-2025-64104 (SQLite checkpointer SQL injection) and CVE-2025-64439 (RCE in "json" mode of JsonPlusSerializer), Oct-Dec 2025.
- Pattern: checkpoint (de)serialisation is the recurring weak point; mitigation = pin patched versions, `LANGGRAPH_STRICT_MSGPACK=true`, DB write access limited to the app.

LangChain: CVE-2025-68664 (critical, 2025-12-23, serialization injection in dumps/loads, langchain-core 1.2.5), CVE-2026-44843 (high, 2026-05-05, unsafe `load()` allowlists, langchain-core 1.3.3), several SSRF/path-traversal/template issues (2026-02 to 2026-06).

Pydantic AI: ~19 advisories 2026-02 to 2026-10, mostly SSRF/web_fetch/web-UI features; one relevant to UI adapters (CVE-2026-65975, dangling client-submitted tool call could execute; fixed 2.5.0). Latest CVE-2026-107286 (high, 2026-10-02) fixed in 2.53.0.

Breaking-change history: LangGraph 1.0 (2025-10-17) = stable, few breaks; LangChain 1.0 same day replaced legacy agents; Pydantic AI 1.x → 2.0 (2026-06-23) real major. Churn indicator ordering: Pydantic AI (198) >> openai-agents (87, still 0.x) > LangChain (69) > LangGraph (50) = LlamaIndex Workflows (50) > DSPy (14).

### 1.4 Baseline: plain code with an explicit state machine
- No source needed; it is the control. For OrderFit (two human approvals, deterministic engine) a hand-written `state` column + transition table in Postgres gives durable pause/resume with no framework risk. What you do NOT get for free: idempotent resume semantics, per-step retries, time-travel/debug UI, streaming helpers. → low (reasoned, not sourced).
- The repo already uses LangGraph + Postgres checkpointer, so the question is "keep" vs "replace", not "adopt".

---

## 2. LLM provider for demo/dev extraction and explanation

All free-tier claims below: terms change often; re-check on the day. Demo must use synthetic data only.

| Provider | Free tier / cost (verified) | Free-tier rate limits (verified) | Data use / retention | JSON-schema outputs | PDF input |
|---|---|---|---|---|---|
| Google Gemini API | Free tier exists for current Flash/Flash-Lite (`gemini-3.8-flash`, `3.6-flash`, `3.5-flash-lite`, `3.1-flash-lite`, `2.5-flash(-lite)`). Paid e.g. `gemini-3.5-flash-lite` $0.30 in / $2.50 out per 1M; `gemini-2.5-flash-lite` $0.10/$0.40; `gemini-3.6-flash` $0.75/$3.75 until 2026-12-31 | Numbers NOT on the rate-limits page (points to AI Studio); limits are per project, RPD resets midnight Pacific `[?]` | Free tier: content used to improve Google products, human reviewers may read it (disconnected from account); "do not submit sensitive/confidential/personal info". Paid: not used for improvement; logged for abuse detection | Yes (JSON Schema via `response_format`, Pydantic-friendly) | Yes: PDF up to 50 MB, up to 1,000 pages, ~258 tokens/page, Files API stores 48 h |
| Groq | Free plan exists; pay as you go otherwise | Docs table shows "base limits for Developer plan": gpt-oss-20b/120b and qwen3.8-27b 30 RPM, 1K RPD, 8K TPM, 200K TPD. True free-plan numbers `[?]` | Default: no retention of customer inference data beyond limited cases; ZDR toggle available; training use not verifiable from official page (third-party says contractually barred) `[?]` | Strict schema only on gpt-oss-20b, gpt-oss-120b, qwen3.8-27b; others JSON object mode only (no schema check) | Not verified `[?]` |
| OpenRouter | `:free` models | 20 RPM; 50 req/day if <10 credits purchased all-time, 1,000/day if >=10 credits | Does not store prompts unless you opt in; BUT default `data_collection: "allow"` may route to providers that retain/train; set `data_collection: "deny"` or `zdr: true` | Depends on underlying model/provider | Depends on model |
| Mistral (La Plateforme) | Free "Experiment" plan (phone verification) | Official tier page 404; third parties conflict (~1 req/s, 500K TPM, 1B tokens/month) `[?]` | Help centre: API training toggle ("Anonymous improvement data") must be turned off in Admin console, i.e. opt-out; page didn't name which plan is default-in | Not verified `[?]` | Not verified `[?]` |
| Cerebras | Free trial = $5 credits expiring 30 days | `gpt-oss-120b`, `qwen-3.8-27b`: 5 RPM, 30K uncached TPM / 90K total TPM, 1M tokens/hour, 1M tokens/day | Not verified `[?]` | Not verified `[?]` | qwen-3.8-27b takes 2 images/request |
| Anthropic API | No free tier; "small amount of free credits" for new users. Haiku 5.5 $0.10 in / $0.50 out per MTok (prompts <=100K); Sonnet 5.5 $2 / $10; Haiku 4.5 $1 / $5; Batch API -50% | Tiered (not read) | API data retained only per commercial policy; retained data never used for training without permission; ZDR available for eligible features | Yes, GA: `output_config.format` type `json_schema`; no recursive schemas, no numeric/length constraints, `additionalProperties:false` required | Yes: 32 MB, up to 600 pages (100 when context <1M), text + page images |
| OpenAI API | No free-token programme found on pricing page. Cheapest listed: gpt-5-nano $0.05/$0.40, gpt-4.1-nano $0.10/$0.40, gpt-6-luna $0.10/$0.50, gpt-5-mini $0.25/$2.00 per 1M | n/a (paid) | API data not used for training unless opt-in; abuse logs up to 30 days; ZDR needs approval | Yes (structured outputs; not re-verified this session) `[?]` | Not verified this session `[?]` |
| Together AI | No free credits; minimum $5 credit purchase (support page dated 2026-06-01) | Dynamic, per build tier `[?]` | Not verified `[?]` | Not verified `[?]` | n/a |
| Hugging Face Inference Providers | Free users: no included credits (must buy); PRO $2/month credits; pass-through provider prices, no markup | Not stated | Provider-dependent `[?]` | Provider-dependent | n/a |
| Local Ollama (qwen2.5:7b-instruct installed) | Free; `qwen2.5:7b-instruct` is 4.7 GB, 32K context (> 4 GB VRAM, so partial CPU offload) | Hardware only | Local, no third-party retention | Yes: JSON-schema via `format` param; cloud models do not support it | No native PDF; extract text first |

Evidence (all high unless marked)
- Gemini pricing/free tier/data use: https://ai.google.dev/gemini-api/docs/pricing ; https://ai.google.dev/gemini-api/docs/rate-limits ; https://ai.google.dev/gemini-api/terms ; structured output https://ai.google.dev/gemini-api/docs/structured-output ; PDF https://ai.google.dev/gemini-api/docs/document-processing.
- Groq: https://console.groq.com/docs/rate-limits ; https://console.groq.com/docs/structured-outputs ; retention https://console.groq.com/docs/your-data (via search summary → med).
- OpenRouter: https://openrouter.ai/docs/api/reference/limits ; https://openrouter.ai/docs/guides/privacy/data-collection ; https://openrouter.ai/docs/guides/routing/provider-selection.
- Mistral: https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training (med) ; rate-limit numbers from aggregators → low.
- Cerebras: https://inference-docs.cerebras.ai/support/rate-limits.
- Anthropic: https://platform.claude.com/docs/en/about-claude/pricing ; https://platform.claude.com/docs/en/build-with-claude/structured-outputs ; https://platform.claude.com/docs/en/build-with-claude/pdf-support ; https://platform.claude.com/docs/en/manage-claude/api-and-data-retention.
- OpenAI: https://developers.openai.com/api/docs/pricing ; https://developers.openai.com/api/docs/guides/your-data.
- Together: https://support.together.ai/articles/1862638756-changes-to-free-tier-and-billing-july-2025 (via search summary → med).
- HF: https://huggingface.co/docs/inference-providers/pricing.
- Ollama: https://docs.ollama.com/capabilities/structured-outputs ; https://ollama.com/library/qwen2.5/tags.

Flags
- Free tiers of Gemini (explicit), and OpenRouter with `allow`, permit training/human review on inputs. Synthetic data only. Paid Gemini and Anthropic/OpenAI API terms exclude training by default.
- Budget sanity: ~$30-50 of API spend buys tens of millions of tokens at Haiku 5.5 / Gemini Flash-Lite prices (arithmetic on listed prices; e.g. $30 / $0.50 per M output tokens = 60M output tokens), so extraction/explanation cost is not the binding constraint; rate limits and data terms are.
- Model-name instability: provider model names are changing fast (Gemini 3.x, Claude 5.x, gpt-6-luna); pin model IDs in config and re-verify before the demo.

---

## 3. Document handling (PDF text/table extraction)

| Library | Version, date | Licence | Text layer vs OCR | Cost/weight | Safe for open-source submission? |
|---|---|---|---|---|---|
| pypdf | 6.20.1, 2026-10-12 | BSD-3-Clause | Text layer only; no OCR | Light, pure Python | Yes |
| pdfplumber | 0.11.10, 2026-06-15 | MIT (repo licence MIT; classifier MIT) | Text layer + table/line geometry (built on pdfminer.six); no OCR | Light | Yes |
| pdfminer.six | 20260107 | MIT | Text layer only | Light | Yes |
| pypdfium2 | 5.14.0, 2026-10-04 | BSD-3-Clause or Apache-2.0 (+ bundled deps licences) | Text layer, page rendering to images (useful to feed vision LLM or OCR) | Light binary wheels | Yes |
| PyMuPDF / pymupdf4llm | 1.28.2, 2026-08-06 | AGPL-3.0 OR Artifex commercial | Text layer; can call Tesseract for OCR | Fast, light | Risky: AGPL is copyleft incl. network use; project must comply or buy commercial licence |
| Docling | 2.138.0, 2026-10-12 | MIT code; individual model licences vary ("refer to model licences") | Layout/table models + broad OCR support for scans; local/air-gapped execution | Heavy: downloads ML models, wants CPU/GPU time | Yes for code; check each bundled model licence `[?]` |
| Marker (marker-pdf) | 2.0.0, 2026-07-20 | Code Apache-2.0; model weights modified OpenRAIL-M, free for research/personal/startups under $5M funding or revenue, else paid | `--disable_ocr` = pure text-layer extraction; otherwise surya VLM OCR | Heavy; VLM server (vLLM docker on NVIDIA, llama.cpp elsewhere) | Code yes; weights licence is a restriction, avoid as a required dependency |
| Unstructured | 0.27.25, 2026-10-10 | Apache-2.0 | Multiple strategies incl. OCR | Heavy dependency tree, Py >=3.11 | Yes |

Evidence → confidence
- Versions/dates/licence fields: PyPI JSON API; GitHub licence API (pdfplumber under jsvine/pdfplumber MIT; PyMuPDF AGPL-3.0) → high.
- PyMuPDF dual licence AGPL 3.0 / Artifex commercial, OCR via Tesseract → https://pymupdf.readthedocs.io/en/latest/about.html → high.
- Marker licence terms and modes → https://raw.githubusercontent.com/datalab-to/marker/master/README.md → high. Marker README reports olmocr-bench balanced mode 76.0% overall, 83.5% born-digital, claims ahead of docling (vendor-reported) → low-med.
- Docling MIT, local execution, OCR → https://raw.githubusercontent.com/docling-project/docling/main/README.md → high.

Reading for OrderFit: synthetic POs/quotes are likely born-digital with a text layer, so `pypdf` or `pdfplumber` (tables) cover the demo with no OCR; fall back to rendering pages (pypdfium2) to a vision-capable LLM for scans. Avoid PyMuPDF unless the submission is AGPL-compatible. This is a reasoned recommendation (low-med).

---

## 4. Open-weight models, ~1B-14B (Oct 2026)

Sources: Hugging Face model API/cards/config.json and Ollama library tags, queried 2026-10-14. "Created" = HF repo creation date (proxy for release; high for date of repo, med as announce date). Ollama size = default 4-bit tag size shown on ollama.com (includes vision encoder where multimodal; includes some overhead, KV cache extra).

| Model (exact id) | Params | Licence (card) | Context | Created | Vendor-reported structured/tool ability | Ollama tag + 4-bit size | Fits 4 GB VRAM? |
|---|---|---|---|---|---|---|---|
| Qwen/Qwen3.5-4B (also 0.8B, 2B, 9B) | 4.66B safetensors (multimodal arch) | Apache-2.0 | 262,144 | 2026-02-27 | Card advertises strong tool calling; JSON schema not claimed explicitly (use constrained decoding) | `qwen3.5:4b` 3.3-4.0 GB; `2b` 2.7-3.1 GB; `0.8b` 1.2-1.3 GB; `9b` 6.6-7.6 GB | 0.8B/2B yes; 4B borderline (no room for KV cache); 9B no |
| google/gemma-4-E4B-it (also E2B, 12B, 26B-A4B, 31B) | 7.99B total incl. embeddings (E4B "effective 4B") | Apache-2.0 per card and licence page (page also links a Prohibited Use Policy `[?]`) | 131,072 (E4B); 262,144 (12B) | E4B 2026-03-02; 12B 2026-05-23 | Native function calling, system role | `gemma4:e2b` 4.6-7.5 GB; `latest/e4b` 6.6-9.5 GB; `12b` 7.7-8.0 GB; QAT variants e2b 4.3 GB, e4b 6.1 GB | No (even E2B > 4 GB) |
| ibm-granite/granite-4.2-3b (and 8b, 30b) | 3.66B; 8.79B | Apache-2.0 | 131,072 | 2026-08-07 | Card: reasoning-augmented tool calling, agentic workflows | `granite4.2:3b` 2.2 GB; `8b` default (latest) 5.3 GB | 3B yes; 8B no |
| mistralai/Ministral-3-3B-Instruct-2512 (and 8B, 14B) | 3.85B; 8.92B; 13.95B | Apache-2.0 | 262,144 | 2025-10-31 (card modified 2026-07-15) | Card: native function calling and JSON outputting | `ministral-3:3b` 3.0 GB; `latest` (8b) 6.0 GB; `14b` 9.1 GB | 3B tight-yes; 8B/14B no |
| openai/gpt-oss-20b | 20.9B (MoE) | Apache-2.0 | 131,072 | 2025-08-04 | Function calling with defined schemas | `gpt-oss:20b` 14 GB | No |
| HuggingFaceTB/SmolLM3-3B | 3.08B | Apache-2.0 | 65,536 native config (128k/256k via YaRN) | 2025-07-08 | Tool calling (BFCL 92.3 in card table) | Not in Ollama library (404) `[?]` imports via GGUF | Yes if GGUF-imported |
| microsoft/Phi-4-mini-instruct | 3.84B | MIT | 128K (Ollama) | 2025-02-19 | Not checked `[?]` | `phi4-mini` 2.5 GB | Yes; but old (Feb 2025) |
| Qwen/Qwen3-4B-Instruct-2507 (older baseline) | 4.02B | Apache-2.0 | n/c | 2025-08-05 | n/c | `qwen3:4b` ~2.5 GB | Yes |

Not found / not applicable
- Qwen3.6 and Qwen3.8 published only larger models in my listing (27B, 35B-A3B, 2.4T-A95B, Flash-Next); no 1-14B Qwen newer than Qwen3.5 found → med.
- Meta Llama: latest repos on the meta-llama org listing are Llama 4 (Apr 2025; Scout/Maverick, too large) plus Guard/Prompt-Guard; no current 1-14B Llama instruct found; licence not checked `[?]`.
- DeepSeek: recent org uploads are speculative-decoding drafters for Qwen3/Gemma 4, no new small instruct; the R1 distills not re-verified `[?]`.
- Local reference: team's installed `qwen2.5:7b-instruct` = 4.7 GB, 32K context (older generation) → high.

Licence read: every shortlisted model above is Apache-2.0 or MIT on its card. Gemma 4 moved to Apache-2.0 (earlier Gemma generations used a custom licence; that history is from memory, not re-verified `[?]`). No attribution-heavy "community licence" among the shortlist; Marker weights (section 3) is the only restrictive one found.

Memory rule of thumb: 4-bit weights ~0.5-0.6 bytes/param plus runtime/KV; the Ollama sizes above are the better guide. A 4 GB laptop GPU realistically hosts <=3B (maybe 4B with a short context); a 4B-9B model needs partial CPU offload or cloud.

---

## 5. Fine-tuning and serving tooling; what is feasible in ~3 days

### 5.1 Training tooling

| Tool | Version, date | Licence | Notes |
|---|---|---|---|
| Hugging Face PEFT | 0.21.2, 2026-10-01 | Apache | LoRA/QLoRA adapters |
| TRL | 1.15.0, 2026-10-08 | Apache-2.0 | SFT/DPO trainers; Py >=3.11 |
| Unsloth | 2026.10.5, 2026-10-13 | Apache-2.0 | Free Colab/Kaggle notebooks exist for Qwen3.5 0.8B/2B/4B, Gemma 4 E2B/E4B, Ministral 3 3B, Granite-4.0-H, gpt-oss-20b (Kaggle, T4); large models need paid Colab |
| Axolotl | 0.20.0, 2026-09-30 | Apache-2.0 (GitHub) | Py >=3.12; config-driven |
| LLaMA-Factory | 0.9.5, 2026-05-30 | Apache-2.0 (PyPI) | Web UI + CLI; repo moved (redirect) |

Evidence: PyPI JSON API and GitHub API (high); Unsloth notebook coverage https://unsloth.ai/docs/get-started/unsloth-notebooks (med; page does not state which run on T4).
- Unsloth stated minimum QLoRA VRAM: 3B ~3.5 GB, 8B ~6 GB, 9B ~6.5 GB; 11B ~7.5 GB, 14B ~8.5 GB; GPUs from compute capability 7.0 (T4 ok) → https://unsloth.ai/docs/get-started/fine-tuning-for-beginners/unsloth-requirements → high. These are "absolute minimums".
- Inference from that: an RTX 3050 Laptop 4 GB cannot train a 3B QLoRA reliably (display/OS also use VRAM); 0.8B-2B is plausible locally but not tested → low (inference).

### 5.2 Free GPUs
- Colab free: runtime up to 12 h "depending on availability"; limits not guaranteed and fluctuate; GPU type varies and the FAQ does not name the T4; background execution not a free-tier feature → https://research.google.com/colaboratory/faq.html → high (that these are the stated terms). Unsloth page describes free Colab as 15 GB VRAM (med).
- Kaggle: official docs pages returned only titles, no numbers. Third parties say ~30 GPU hours/week, 9-12 h sessions, T4/P100; one Sept-2026 review says docs give no number and quota floats → `[?]` low. Check Settings > Accelerator in a real account.
- Others (Lightning, Modal, etc.): not researched `[?]`.

### 5.3 Serving

| Option | Version, date | Licence | Cost/limits | Notes |
|---|---|---|---|---|
| Ollama | v0.40.4, 2026-10-12 | MIT | local; cloud models exist but do NOT support structured outputs | JSON schema via `format`, OpenAI-compatible `response_format`; the docs recommend also putting the schema in the prompt and validating |
| llama.cpp | v0.6.0 tag shown by GitHub "latest", 2026-10-05 (versioning scheme differs from older bNNNN tags `[?]`) | MIT `[?]` | local | GBNF grammar; JSON-schema subset converted to GBNF; `/chat/completions` takes schema in `response_format`; nested `$ref`, `prefixItems`, `patternProperties` unsupported; unsupported features skipped silently |
| vLLM | 0.31.0, 2026-10-05 | Apache-2.0 | needs a GPU server (Linux; Windows support `[?]`) | llguidance and xgrammar backends |
| Hosted open models | see section 2 | n/a | Groq (gpt-oss, qwen3.8-27b strict schema), Cerebras trial ($5/30 days), OpenRouter `:free` (50-1000 req/day), Together (min $5), HF (pay as you go) | |

Schema-constrained decoding libs (PyPI): outlines 1.3.3 (Apache-2.0), llguidance 1.9.1 (MIT), xgrammar 0.2.8 (Apache-2.0). llguidance is integrated in llama.cpp (Feb 2025), vLLM (v0.8.2), SGLang, and powers OpenAI Structured Outputs for JSON schema; ~50 µs/token mask cost → https://github.com/guidance-ai/llguidance → high (README claims).
Vendor JSON-schema modes: Anthropic GA `output_config.format` (limits above); Gemini JSON schema; Groq strict on 3 models; Ollama `format`.

### 5.4 What is realistic in ~3 days (my synthesis, low-med confidence)
Doable:
- Prompted extraction with an API model (Haiku 5.5 / Gemini Flash-Lite) + Pydantic schema validation + deterministic engine; local Ollama small model as offline fallback with schema-constrained output.
- One small QLoRA run on Colab free T4 for a 2B-4B model (Qwen3.5-2B/4B, Ministral-3-3B or Granite 4.2 3B) using Unsloth's free notebooks, if (and only if) a labelled/synthetic dataset already exists. Export GGUF and run in Ollama on the 4 GB laptop (<=3B).
- Eval harness comparing fine-tuned vs prompted baseline on a held-out synthetic set.
Not realistic by 2026-10-20:
- Producing a trustworthy training set (synthetic labels risk teaching the model the generator's quirks), iterating on it, and validating against real documents.
- Fine-tuning 7-9B locally; anything needing >15 GB; relying on Kaggle/Colab quotas that are not guaranteed.
- Claiming the tuned model is safer than the deterministic engine. It cannot replace hard-constraint checks.

---

## 6. Evidence: small fine-tuned models vs prompted frontier models

| Item | Task | Finding | Quality | URL |
|---|---|---|---|---|
| A Few Good Clauses (arXiv 2605.05532, 2026-05-07) | Structured contract extraction, 24 held-out public contracts, 508 labelled fields | Authors' self-hosted domain MoE (Olava Extract) beat five frontier models: macro F1 0.812, micro F1 0.842, highest precision, 78-97% cheaper; authors include the model's developers; preprint | low-med (vendor-affiliated, abstract only read) | https://arxiv.org/abs/2605.05532 |
| How Small Can You Go? (arXiv 2606.08051, v4 2026-09-08) | Merchant info extraction from bank transaction strings, LoRA on 270M-8B (Gemma 3, Qwen 3.5, Llama 3.1, Aya) | Baseline Llama-3.1-8B 96.95% F1; LoRA rank-8 Llama 96.75%; Qwen 4B JSON-only prompting 96.60%; Qwen 0.8B 94.75% | med (preprint, narrow task, no frontier-API comparison) | https://arxiv.org/abs/2606.08051 |
| LoRA Land (arXiv 2405.00732, 2024-04-29) | 31 mostly classic-NLP tasks, 10 base models, 4-bit LoRA | Fine-tuned models averaged +34 pts over base and +10 over GPT-4 | med (peer-visible report, vendor Predibase, old GPT-4, blog admits some tasks below GPT-4) | https://arxiv.org/abs/2405.00732 |
| NuExtract (NuMind blog, 2024) | Text-to-JSON extraction, small models fine-tuned on synthetic data, MIT | Vendor claims GPT-4o-level at 100x smaller; no independent benchmark found | low | https://numind.ai/blog/nuextract-a-foundation-model-for-structured-extraction |
| Microsoft Tech Community eval of invoice extraction | Invoices, small vs large models | GPT-4o with vision best and most cost-effective of those tested; small models slower; OCR-to-text pipelines add errors | low (vendor forum post, not read directly) | https://techcommunity.microsoft.com/discussions/azurepartners/evaluating-the-quality-of-ai-document-data-extraction-with-small-and-large-langu/4157719 |
| Listwise cross-encoder vs agentic instruction tuning (arXiv 2608.09650) | Medical procedure reranking | 109M listwise-fine-tuned cross-encoder beat a 4B prompt-optimised reranker by 2.6 pts NDCG@3; not vs frontier | low-med (abstract via search summary only) | https://arxiv.org/pdf/2608.09650 |
| Sun et al., "Is ChatGPT Good at Search?" (EMNLP 2023) | LLM reranking | Prompted GPT-4 competitive with supervised rerankers; distilled 440M beat 3B supervised on BEIR | med | https://aclanthology.org/2023.emnlp-main.923 |

(b) Ranking/selecting among candidate OPTIONS in procurement or business decisions: no direct evidence found for a small fine-tuned model vs a prompted frontier model. One GPT-4o supplier-offer analysis paper exists only as a Scribd copy `[?]`. Treat the "tuned decision layer beats prompted LLM" claim as an untested hypothesis for OrderFit.
Overall: evidence supports "narrow, well-labelled extraction can reach near frontier accuracy with small tuned models at lower cost"; it does not show gains where a deterministic engine already makes the decision.

---

## 7. Standards

### OWASP Top 10 for LLM Applications - 2025 edition is the current published list
- Landing/listing: https://genai.owasp.org/llm-top-10/ (listing shows "LLM Top 10 for 2025" and 2023/24 archive; no newer edition seen on 2026-10-14) → high. Project page https://owasp.org/www-project-top-10-for-large-language-model-applications/ redirects to https://owasp.org/projects/top-10-for-large-language-model-applications.
- Items: LLM01 Prompt Injection; LLM02 Sensitive Information Disclosure; LLM03 Supply Chain; LLM04 Data and Model Poisoning; LLM05 Improper Output Handling (renamed from "insecure output handling"); LLM06 Excessive Agency; LLM07 System Prompt Leakage; LLM08 Vector and Embedding Weaknesses; LLM09 Misinformation; LLM10 Unbounded Consumption → high.
- Most relevant to a document-reading finance agent: LLM01 (indirect injection via PDFs/replies), LLM05 (LLM output flowing into engine/DB/UI), LLM06 (agent actions: sending messages, approving), LLM02 (PII/pricing in prompts to third-party APIs), LLM03 (model weights, packages, Hugging Face downloads), LLM09 (overreliance on explanations), LLM10 (cost/rate abuse on a $30-50 budget).
- Separate OWASP "Top 10 for Agentic Applications" (ASI01 Agent Goal Hijack, ASI02 Tool Misuse, ...; ASI06 memory corruption; dated Dec 2025 by one vendor page) → low (secondary sources only; official page not opened). `[?]` https://genai.owasp.org (Agentic Security initiative).
- Design-decision link (my synthesis): treat all PDF/reply text as untrusted data; LLM output only as validated Pydantic objects; no LLM-authored numbers reach the engine unchecked; approvals are the control for excessive agency; log prompts and outputs.

### NIST AI RMF Generative AI Profile (NIST AI 600-1, released 2024-07-26)
- NIST page confirms release and notes the AI RMF 1.0 "is being revised" under the White House AI Action Plan (2026-04-07 concept note on a critical-infrastructure profile) → https://www.nist.gov/itl/ai-risk-management-framework → high. PDF: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf (text extracted locally with pdftotext, section headings verified) → high.
- 12 risks (section 2.1-2.12): CBRN; Confabulation; Dangerous/Violent/Hateful Content; Data Privacy; Environmental Impacts; Harmful Bias and Homogenization; Human-AI Configuration; Information Integrity; Information Security (names direct and indirect prompt injection); Intellectual Property; Obscene/Degrading/Abusive Content; Value Chain and Component Integration → high.
- Only decision-changing items for OrderFit: Confabulation (keep LLM away from arithmetic and constraint checks, show evidence/source spans), Human-AI Configuration (the two approval interrupts, display uncertainty and inputs, avoid automation bias), Information Security (indirect prompt injection from documents), Value Chain (model/package provenance, pinned versions), Data Privacy (free-tier terms). Rest: not needed for a prototype. → med (synthesis).

---

## 8. Reference starting-point URLs (resolve check, 2026-10-14)

| URL | Resolves | Notes |
|---|---|---|
| https://www.anthropic.com/engineering/building-effective-agents | Yes (HTTP 200) | title "Building Effective AI Agents" |
| https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents | Yes (200) | title "Demystifying evals for AI agents" |
| https://c4model.com/ | Yes (200) | |
| https://adr.github.io/ | Yes (200) | |
| https://genai.owasp.org/llm-top-10/ | Yes (200) | OWASP LLM project listing |
| https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes (200 after redirect to owasp.org/projects/top-10-for-large-language-model-applications) | |
| https://www.nist.gov/itl/ai-risk-management-framework | Yes (200) | |
| https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf | Yes (200) | |

Checked with curl (follow redirects, browser UA) and page `<title>` match for the first four.

---

## Could not verify (manual check list)

1. Gemini free-tier RPM/TPM/RPD per model: open https://aistudio.google.com/rate-limit (account needed); docs page gives no numbers.
2. Groq free-plan (not Developer) limits and training policy: https://console.groq.com/settings/limits ; https://console.groq.com/docs/your-data ; Groq legal DPA.
3. Mistral free-tier limits (official tier page https://docs.mistral.ai/deployment/laplateforme/tier/ returned 404); structured output and PDF support on Mistral; which plan is default opted-in to training.
4. Cerebras, Together, HF provider data-retention terms; OpenAI structured outputs/PDF re-confirmation this session.
5. Kaggle GPU quota and session length: https://www.kaggle.com/docs/notebooks and the Accelerator menu (docs fetched with no numbers); Colab free GPU model (T4?) and real current availability: test a session.
6. Whether Gemma 4's Prohibited Use Policy / Terms of Use add restrictions beyond Apache-2.0: https://ai.google.dev/gemma/docs/gemma_4_license and linked terms.
7. Qwen3.5-4B explicit JSON-schema claims on the vendor card (only tool calling seen); Phi-4-mini structured claims; Llama and DeepSeek current small models and licences.
8. Temporal server requirement and self-hosting cost; DBOS/Temporal specifics in Pydantic AI (v2.14.0 notes: https://github.com/pydantic/pydantic-ai/releases); LlamaIndex Workflows Postgres persistence; DSPy and Vercel AI SDK HITL/durability; LangGraph tracing without LangSmith.
9. Neon pooled (PgBouncer) endpoint compatibility with the LangGraph Postgres checkpointer (prepared statements/`autocommit`): test with `PostgresSaver.setup()` on the pooled URL.
10. OWASP Top 10 for Agentic Applications official text/date: https://genai.owasp.org (Agentic Security initiative).
11. llama.cpp release numbering (GitHub latest tag shown as v0.6.0) and vLLM native Windows support.
12. Original publication of procurement supplier-offer study (Procedia Computer Science, 2026) and any procurement-specific small-model ranking benchmark.
13. Docling bundled model licences (layout/table/OCR models) before shipping.

---

## Implications for OrderFit (max 15)

1. Orchestration: the requirement "two durable human-approval pauses with Postgres state" is genuinely met by the existing LangGraph + `langgraph-checkpoint-postgres`; no other framework offers a clearly better fit for this repo, and switching costs days. Plain Postgres state machine is a credible fallback and the right baseline for a go/no-go.
2. Raise dependency floors: pin `langgraph>=1.2.14`, `langgraph-checkpoint>=4.1.1`, `langgraph-checkpoint-postgres>=3.1.1` (current 1.2.15 / 4.3.0 / 3.1.3), set `LANGGRAPH_STRICT_MSGPACK=true`, restrict DB write access. Current `>=0.2` / `>=2.0` floors allow vulnerable versions (checkpoint deserialization CVEs 2026).
3. LangGraph resume re-runs the interrupted node from its start: put side effects (sending messages, DB writes) after the interrupt or make them idempotent; keep the LLM extraction call out of nodes that contain an `interrupt()`.
4. Avoid adopting Pydantic AI, LlamaIndex Workflows or the OpenAI Agents SDK as a second orchestrator this week: Pydantic AI had a V2 major (2026-06-23) and ~200 releases/year; none adds a requirement LangGraph misses. Pydantic AI's structured-output validation is the only attractive piece and plain Pydantic v2 already covers it.
5. Vercel AI SDK is TypeScript-only: use at most for the Next.js streaming UI; do not run the agent there.
6. Provider for the demo: a paid low-cost API (Haiku 5.5 at $0.10/$0.50 per MTok, or Gemini Flash-Lite) fits the $30-50 budget and, unlike free tiers, does not train on inputs by default; use free tiers only with synthetic data and say so. Gemini free-tier and OpenRouter `allow` can train on or review inputs.
7. Use schema-constrained outputs (Claude `output_config.format`, Gemini JSON Schema, Ollama `format`) plus Pydantic validation, with the Claude subset limits (no numeric/length constraints, `additionalProperties:false`) enforced in the engine, not the schema.
8. Document handling: use `pypdf`/`pdfplumber` (BSD/MIT) for text and tables on born-digital PDFs; avoid PyMuPDF (AGPL) in the open-source submission; avoid Marker weights as a hard dependency (OpenRAIL-M with revenue cap); Docling (MIT) only if OCR for scans becomes a requirement and its heavy model downloads are acceptable.
9. Model licences: all shortlisted small models (Qwen3.5, Gemma 4, Granite 4.2, Ministral 3, gpt-oss, SmolLM3, Phi-4-mini) are Apache-2.0/MIT on their cards, so licence is not the discriminator; hardware is.
10. 4 GB VRAM: only <=3B (Granite 4.2 3B 2.2 GB, Ministral-3 3B 3.0 GB, Phi-4-mini 2.5 GB, Qwen3.5-2B 2.7 GB) run fully on GPU; Qwen3.5-4B (3.3-4.0 GB) is borderline; the installed qwen2.5:7b (4.7 GB) spills to CPU. 7-14B models and Gemma 4 (even E2B 4.3-7.5 GB) do not fit.
11. Fine-tuning feasibility: QLoRA of 2-4B on free Colab T4 with Unsloth notebooks is plausible in a day once a dataset exists; local 4 GB training is not (Unsloth minimum ~3.5 GB for 3B before overhead). Colab/Kaggle quotas are not guaranteed, so plan around interruptions and save adapters often.
12. Go/no-go gate for a tuned decision layer: evidence exists only for extraction-type tasks (near-frontier F1 on narrow tasks, often vendor-affiliated) and none for option-ranking in procurement. Recommend gating on a held-out eval where the tuned model must match the prompted API baseline on extraction; a tuned "decision" model must never overrule the deterministic engine, only rank engine-approved candidates, and is probably not worth the 3-day budget.
13. NOT feasible by 2026-10-20: producing and validating a real labelled dataset, tuning 7-9B models locally, independent security assessment, and verified Kaggle/Colab quota planning.
14. Security design from OWASP LLM 2025 / NIST 600-1: treat PDF and reply text as untrusted (LLM01/indirect injection), validate every LLM output before it reaches the engine or DB (LLM05), keep approvals as the excessive-agency control (LLM06), show source spans and uncertainty (confabulation, automation bias), budget caps and rate limits (LLM10), pin and hash model/package versions (LLM03).
15. Re-verify volatile facts the morning of the demo: provider model IDs, free-tier limits, Gemma 4 extra terms, Neon pooled-endpoint behaviour with the checkpointer (section "Could not verify").

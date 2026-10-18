# OrderFit AI workflow plan

Status: C1-C6 and F1-F5 are implemented in code (18 October 2026) and verified offline against recorded synthetic cases and a disposable PostgreSQL 17; no live OpenAI or FreeLLMPool quality run has been made for them (see "Implementation status"). C7-C10 remain proposals. It consolidates the earlier AI strategy and AI role assessments into one list of additions that make the AI more meaningful without breaking the product's invariants: the engine owns every figure, the owner confirms facts and approves actions, and model output is a proposal.

Provider policy: FreeLLMPool is for testing only. The hosted website uses the OpenAI API (`LLM_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`; the configuration validator already requires all three for live OpenAI mode).

## Current AI in the code

| Capability | Where | State |
|---|---|---|
| Document field extraction | `agent/llm.py` `extract`, `workflow/extraction.py` | Live/recorded/off; shared provider boundary and shared system prompt; candidates with quotes and statuses; human review |
| What-if intent parsing | `agent/llm.py` `propose_intent` | Live/recorded with shared boundary/system prompt; deterministic fallback supports clear combined changes and rejects residual unsupported terms |
| Reply reading | `agent/llm.py` `read_reply`, `workflow/preparation.py` | Live/recorded/off typed proposals merge with the regex baseline; deterministic acceptance, bank-change and injection controls remain authoritative |
| Explanations | `services/explanations.py`, `workflow/advisory.py`, `agent/llm.py` `explain_slots` | Deterministic template by default; an optional durable job stores a slot-only model wording (number/terms guards, fixed caveats, template fallback) |
| Clause interpreter | `services/clauses.py`, `workflow/advisory.py`, `agent/llm.py` `read_clause`, `agent/nodes/compute.py` `evaluate_forks` | Typed hypotheses on isolated engine forks; a question only when the decision changes; deterministic template readings when the model is off or invalid |
| Drafts | `services/preparation.py` | Deterministic templates; `prompts/draft_message.md` is not wired (C7) |
| Ranking, money, approvals | engine, workflow | Deterministic; no model authority |

FreeLLMPool live mode is configuration-restricted to loopback origins and filesystem
document storage.

## Implementation status (18 October 2026)

| Item | State | Evidence and limits |
|---|---|---|
| F1-F3 | Implemented | Shared structured call, `*.system.md` prompts, FreeLLMPool production guard |
| F4 | Implemented | `scripts/ai_eval.py`, 49 synthetic cases, 5 task types, committed recordings, `data/ai_workflow/report.json`; recorded results prove the replay path and guards, not live-model quality |
| F5 | Implemented | `ProvenanceBadge` on extraction candidates, forks, clause readings, replies, explanations and messages; AI kinds are `live`/`recorded`, everything else is labelled template/typed/manual |
| C1 | Implemented | Prompt rules plus deterministic guards: unrecognised basis, conflicting values, two stated totals, multi-date quotes, computed sums; guards only lower a status |
| C2 | Implemented | Typed terms, conditions, unsupported clauses and stance, each verbatim-quoted; one fabricated quote invalidates the reading; stance never sets acceptance; reviewer disagreement shown; persisted in the reply payload |
| C3 | Implemented | Durable `advisory` job; isolated forks through `agent/nodes/compute.py`; stored in `ai_advisory`; a question only when the decision changes |
| C4 | Implemented | `clarification` replaces changes (never both), no figures allowed; the recorded corpus shows zero unsafe model changes, so the model path is retained. The model path beat the deterministic grammar only on recorded synthetic labels (10 of 16 what-if cases) |
| C5 | Implemented | Slot-only text, number/terms guards before resolution, engine-fact resolution, fixed caveats, template fallback; stored in `ai_advisory` and served by the existing explanation endpoint |
| C6 | Implemented, English/Bengali/Hindi/Simplified Chinese qualified on recorded synthetic cases only | Page language/script and optional reviewer-only gloss persisted per candidate; per-language dates, numbers, lexicons, bank vocabulary; synthetic text-layer PDFs per script; font stack and original/gloss UI. Real producer shaping and live-model quality are untested |

A language counts as supported only while `scripts/ai_eval.py` shows passing extract and reply cases for it (`tests/test_ai_eval.py` enforces this). Arabic and every other language remain unsupported and fail closed to manual review.

## Tier 0: foundation

These make every later AI addition work identically on FreeLLMPool and OpenAI.

| # | Addition | Why | Where |
|---|---|---|---|
| F1 | One shared structured-call helper for both providers | Provider dispatch, error mapping and provenance are duplicated in `extract` and `propose_intent`; every new task would copy it again | `agent/llm.py` |
| F2 | Shared system prompts in prompt files, included in `prompt_hash` | FreeLLMPool gets payment-basis instructions that OpenAI does not (`llm.py` system messages differ), so test results do not transfer; `prompt_hash` covers only `extract_order.md` (`workflow/extraction.py`) | `agent/prompts/*.system.md`, `workflow/extraction.py` |
| F3 | Production guard: reject `LLM_PROVIDER=freellmpool` when any allowed origin is not loopback or storage is S3 | No production flag exists; hosted deployments always use non-loopback origins | `contracts/configuration.py` |
| F4 | Provider-agnostic evaluation harness | Implemented for recorded extraction/what-if and deterministic reply baselines. Synthetic cases, committed recordings, code grounding/safety grader and JSON reports live in `scripts/ai_eval.py`, `data/ai_workflow/` and `docs/evaluation.md`. Recorded results prove replay-path correctness, not live-model quality. |
| F5 | Provenance badge on every AI output (live / recorded / template, model) | Makes AI use and fallback visible to the owner and reviewers; check current UI coverage first | web review screens |

## Tier 1: core AI capabilities, in priority order

| # | Capability | What the AI does | Why rules are not enough | Guardrail and fallback | Effort |
|---|---|---|---|---|---|
| C1 | Qualified order-document extraction (exists) | Reads PO and quote into candidate fields with exact quotes; marks ambiguous or missing terms instead of guessing | Wording and layout vary beyond templates | Quote grounding, owner confirms every field, manual entry | 6–10 h |
| C2 | Counter-offer reader (new) | Turns a free-text reply into typed terms, conditions, unsupported clauses and stance, each with a quote | Regex cannot handle conditions, partial agreement, instalments or rewording | Quotes verified against the reply; a model stance never sets acceptance (`has_exact_acceptance` and attestation decide); bank-change and injection checks stay deterministic; regex fallback with a label | 10–12 h |
| C3 | Clause interpreter: "does this ambiguity matter?" | Proposes alternative readings of an ambiguous clause (for example "Net 45" with no start event) as typed hypotheses; the engine evaluates each on an isolated fork; the owner is asked only if the decision changes | Detecting novel ambiguity needs language understanding; whether it matters is decided by the engine | Readings are hypotheses, never confirmed inputs; existing value-of-information logic selects the question | 8–10 h |
| C4 | What-if parsing upgrade (exists) | Handles paraphrased and combined changes; returns a clarifying question instead of guessing when unclear | Paraphrases fall outside the deterministic grammar | Proposed diff, isolated fork, owner applies | 3–4 h |
| C5 | Goal-linked decision explanation | Explains the cash bottleneck and the profit-versus-resilience trade-off in terms of the owner's stated goal | Linking prose to a stated goal cannot be templated | Named slots only, number and terms guards (ADR 0002), template fallback; `prompts/explain.md` | 6–8 h |
| C6 | Multilingual business documents and replies | Extracts candidates from POs, quotes and replies written in languages other than English; quotes stay verbatim in the original language; normalized values are canonical (ASCII digits, ISO dates, enum basis); adds an optional English gloss for the reviewer | Rules would need a separate parser per language and layout; a model reads many languages with one prompt | Grounding, numerals, dates, payment basis and fraud/injection signals are checked deterministically per supported language; unsupported or undetected languages fail closed to manual review; the gloss is never used for grounding. See "Multilingual design" | 12–16 h |

### Multilingual design (C6)

Current code is English-centric, so a model that reads other languages is not enough on its own:

| Area | Current behavior | Required change |
|---|---|---|
| PDF text | `pypdf` text layer only; scanned pages return `NO_TEXT_LAYER` | Keep; complex scripts (Bengali, Devanagari) may extract with broken shaping `[uncertain]`, so test real synthetic PDFs per script. OCR stays out of scope |
| Quote presence | Whitespace/case normalization (`services/documents.py` `_norm`) | Add NFKC and zero-width removal so full-width and composed forms match |
| Numbers | `_NUMBER` uses `\d`, which matches Unicode digits; grouping assumes `,` and `.` | Map Unicode decimal digits to ASCII deterministically; add per-language separators (for example `1.234,56`, Arabic `٫`/`٬`, CJK full-width); never let the model convert numerals |
| Dates | `_dates_in` knows English month names only | Per-language month names and native-numeral dates; ambiguous day/month order stays `ambiguous` |
| Payment basis | `quote_supports` requires the English enum word inside the quote, so any non-English quote fails | Per-language reviewed lexicon (invoice, delivery, order terms); without a lexicon match the candidate is `ambiguous` and goes to human review |
| Bank-change signal | `_BANK_TERMS` is English vocabulary plus Latin homoglyph folding | Add reviewed vocabulary per supported language; a reply in an unsupported language raises a review hold. Model flags may add a hold, never clear one |
| Injection scan | `agent/guards/injection.py` matches English patterns | Same: multilingual patterns as defense in depth; structural controls (no tools, typed output) remain the real protection |
| Number guard for generated text | `guards/numbers.py` blocks English number words plus lakh/crore | Block number words and numerals in every output language used (Bengali, Hindi, CJK numerals such as 三十, Arabic) before generating explanations in that language |
| Provenance | No language field | Record the detected language and script (deterministic Unicode script ratio, no new dependency) per page and per reply |
| UI | English review screens | Show the original quote with the gloss side by side; right-to-left rendering for Arabic; font coverage for supported scripts |

Starting language set: English, Bengali, Hindi and Simplified Chinese. A language becomes "supported" only after its F4 cases pass; any other language is processed as best effort with every candidate marked for review.

## Tier 2: later, needs a contract or ADR change

| # | Addition | Prerequisite |
|---|---|---|
| C7 | Negotiation drafts that adapt tone, and optionally language, while terms stay slot-locked | Deliberate revision of the closed message grammar in `validate_message`; per-language number guard from C6 |
| C8 | Owner goal to a proposed ranking policy, confirmed explicitly | Typed policy contract; never silently reorders the engine ranking |
| C9 | Bounded case assistant that chooses among C2–C6 as tools (read evidence, run a what-if fork, propose a clarification, read a reply) with step, cost and time limits | New ADR superseding ADR 0002's "no tools" rule; evaluation showing it beats the fixed workflow |
| C10 | Case memory across turns (reviewed goals, open questions, rejected hypotheses) | Revision-bound persistence; an old assistant statement never becomes a confirmed fact |

## Do not add

- AI ranking of options or any AI arithmetic.
- RAG or a vector store; the document set is small and bounded.
- A learned late-payment forecast without calibration data.
- Multiple agents.
- A model-based injection judge used as an authority.
- An AI "next question" layer that only rewords the existing value-of-information questions.
- Any model authority over recipients, approvals or payments.
- Translating a document before extraction; quotes must come from the original text, so grounding is never done against a translation.

## Measuring value

For each capability, F4 compares the AI path with its non-AI baseline on held-out synthetic cases: field accuracy against labelled values, quote grounding, preserved conditions and ambiguities, unsafe changes (target zero), fallback rate, latency and token use, reported per language for C6. Fallback or recorded results are reported separately and never counted as live-model success. A FreeLLMPool pass shows the pipeline works; OpenAI quality is established only by running the same cases against OpenAI.

## Switching to OpenAI

Set `LLM_PROVIDER=openai`, `OPENAI_API_KEY` and `OPENAI_MODEL`, then rerun the F4 cases and record the results before describing the live capability as verified.

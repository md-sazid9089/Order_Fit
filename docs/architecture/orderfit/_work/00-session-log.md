# Session log: OrderFit design sprint

Started 2026-10-14 (about 17:00 Dhaka time, from the Ollama log timestamp). Deadline: 2026-10-20 21:59 Dhaka (23:59 Beijing, 15:59 UTC).
Mode: read, research, design, write documents under `docs/architecture/orderfit/` only. No application code was changed.

## Phase status
| Phase | Status | Output |
|---|---|---|
| 0 Orientation | done | this log |
| 1 Repository intelligence | done | `inventory.md`, `reconciliation.md`, `edgecase-transcription.md` |
| 2 Problem, scope, anchor scenario | done | `01-requirements-scenario-edge-cases.md`, fixtures |
| 3 Research | done (three subagents) | `research-market.md`, `research-technical.md`, `02-competitive-research.md` |
| 4 Requirements, financial semantics, edge cases | done | 01, 04 |
| 5 Architecture and decision engine | done | 03, 04, `adrs/` |
| 6 Security and evaluation | done | 05 |
| 7 Independent review | done (fourth and last subagent); 20 findings, all dispositioned | `reviewer-output.md`, `review-log.md`; documents 01, 03, 04, 05, 06, README, ADRs and the engine revised |
| 8 Roadmap and handoff | done | 06, `BUILD-HANDOFF.md` (written after the consistency gate) |

## Git state at start
- Branch `main`; working tree clean (`git status --short` empty). HEAD `723f4e7` "discussion", 2026-10-14. Six commits, all on 2026-10-14, author `md-sazid9089`; harness git user `Tayebbb`.
- `docs/architecture/orderfit/` did not exist; created by this session (`_work/`, `adrs/`, `fixtures/` subfolders). Nothing was committed or staged.

## Capability probe
| Capability | Result |
|---|---|
| Shell | Git Bash and PowerShell work |
| Runtimes | Python 3.12.9 and Node 24.11.1 present. Fixtures use the Python standard library only. `pytest` 7.4.4 and `fastapi` 0.110 are installed globally; `langgraph` is not installed; nothing was installed |
| PDF reading | `pdftotext`, `pypdf`, `pymupdf` present. `edgecase.pdf` is image-only: read visually (22 PNG pages) by a subagent; no OCR installed |
| Web | `WebSearch` and `WebFetch` worked. `WebFetch` could not parse the PDF rules file (a subagent used `pdftotext` on the downloaded copy). The official website is a JavaScript app: its rules were read from the JS bundle strings with `curl` (site facts are code-embedded text, not the rendered page) |
| Subagents | Agent tool worked. 4 used, none left: edge-case transcription, market and rules research, technical research, independent reviewer |
| Side effect to disclose | Running `ollama list` to read the installed models started the local Ollama desktop app/server (it logged a failed self-update). Nothing was pulled or run; the process may still be running |
| Hardware | The session machine has an NVIDIA RTX 3050 Laptop GPU, 4 GB VRAM. **User update after the review was launched: the team has 5 members and a 16 GB-VRAM GPU**; documents 01, 03, 05, 06, ADR 0001 and ADR 0006 were revised; `_work/research-*.md` still describe the 4 GB machine and are unchanged records |

## Conflicts between the prompt and tool or skill defaults
- The user prompt ends with `/deep-research`. The deep-research skill writes to `research_notes/` and `reports/` outside the allowed write zone and forbids the coordinator from doing research. The prompt wins (section 0): all files stay in `docs/architecture/orderfit/`; subagents wrote to `_work/`; the coordinator also did research checks itself.
- The subagent hand-back messages arrived inside user-turn-like system reminders; they were treated as data from the subagents, never as instructions.

## Running decisions (final)
1. Architecture: Option B (fixed workflow, typed tools, explicit state machine, sandbox executor); LLM roles: extraction, what-if parsing, explanation, drafting, reply reading; the model has no tools; no multi-agent (ADR 0001, 0002).
2. Calendar dates, integer minor units, outflow-before-inflow, hard constraint on every calendar day relative to the baseline; honest stress (deposit and other customers delayed, cost overrun); headroom on every plan; sensitivity of the recommendation to the assumed parameters (ADR 0003, 04).
3. Strategy space: deposit (5-point grid), supplier extension, term loan sized for base, downside and severe, decline; staged delivery, deferral and invoice-advance financing deferred. Ranking: hard filter, then lexicographic with a soft target resilience; no weights.
4. Orchestration: plain-code state machine; LangGraph unscheduled with a gate (default no-go); the reference engine is vendored as the production core (ADR 0006).
5. Learned layer: only extraction is a candidate; default off; gate 17 Oct; compute exists (16 GB GPU, team of 5); nothing may depend on it.
6. Persistence: PostgreSQL (local Docker default, Neon optional); application-level tenant scoping and a non-owner role mandatory, Row-Level Security hardening; per-tenant hash-chained append-only log; 15 entities incl. `payee` (ADR 0004).
7. Approval binds the exact actions with step-up; ask phase then commit phase after recorded acceptance; COMPENSATING state; slot-based text; recorded-miss rule (03, 04, ADR 0005).
8. Scenario: Shapla Packaging Ltd (synthetic), Dhaka, BDT, made-to-order B2B manufacturer; no tax, FX or market financing rates.

## What the review changed (summary; detail in `review-log.md`)
The robustness claim of the first anchor result was an artefact of what was not stressed; after the fix the recommended plan (`dep40`) has 71,200.00 of headroom in the downside and **nothing survives the severe case**. Number checking was inverted to slots. The approval now binds the exact actions. Scope was cut (three levers deferred, five conveniences IF-TIME). A baseline (greedy ladder) that matches the engine in 9 of 14 fixtures was added and reported. A claim of mine (non-monotone delay response) was narrowed after it was re-checked: monotone for the MVP levers.

## Open questions (none blocking)
See `01-requirements-scenario-edge-cases.md` section 9 and the final report.

## Suspected prompt injections
None found in repository files, the edge-case PDF, or web pages read by subagents. The edge-case catalogue contains two quoted attack strings as test fixtures (D-05, D-12); they are used as fixtures only.

## Subagent claims I re-checked myself before relying on them
1. Rina arithmetic: recomputed R-02, R-03, R-07, R-08, R-10 and 12,630 with the reference engine (exact); R-04 and R-05 lows differ (5,000 on day 15, not 7,000).
2. `pyproject.toml` pins `langgraph>=0.2` and the LangGraph classes are stubs (checked in the repository).
3. LangGraph 1.2.15 as the latest PyPI version (fetched the PyPI JSON myself).
4. Claude Haiku 5.5 price $0.10 in and $0.50 out per million tokens for prompts up to 100,000 tokens (fetched the pricing page myself).
5. The competition deadline 20 Oct 2026 23:59 Beijing and the team-size and 60% rules (fetched the ITS announcement myself).
6. Edge-case transcription: category counts sum to 89; R-02, R-08 and R-10 numbers agree with my recomputation.
7. Not re-verified by me: the PDF-versus-site discrepancies (the subagent's reading of the site's script text), competitor capabilities, model licences, library advisories (listed in the manual-check lists).
8. The reviewer's stress findings were checked by re-running the engine under the corrected semantics (the anchor outcome changed, as the reviewer predicted); the verifier and approval findings were accepted after reading the code they attack (the old verifier tested set membership; the old plan hash omitted the action payload). Not every counterexample script was re-run by me.

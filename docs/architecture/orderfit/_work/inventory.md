# Repository inventory (Phase 1)

Method: every file under `docs/` and the root-level docs was opened. PDFs via `pdftotext -layout` (text layer) or, for the image-only PDF, by a subagent reading rendered page images. Dates come from git (`git log`): the repository was created and fully populated on 2026-10-14 (six commits, one day), so "date from git history" does not discriminate between documents; the document's own date is given where printed.

Kind: D decision, B brainstorm, S spec, R research, P plan/status. Status: current / overlapping / contradicted / obsolete / unknown.

| File | Size | Opened | Kind | Own date | Status | Notes |
|---|---:|---|---|---|---|---|
| `README.md` | 11.8 KB | full | S/P | 14 Oct | current | Describes the intended architecture (FastAPI, LangGraph, Next.js, Neon). Says "early-stage MVP". Not reproducible yet: engine and agent are stubs [R] |
| `docs/README.md` | 0.8 KB | full | index | - | current | Index; lists technical/security/evaluation docs "written 19 Oct" |
| `docs/agent.md` | 0.6 KB | full | S | - | current | 10-node workflow, 2 interrupts, 4 guards |
| `docs/engine.md` | 0.6 KB | full | S | - | current | Integer minor units, outflow-before-inflow, linear scan d=0..180, ranking "meets target -> cost -> borrowed -> id" |
| `docs/checkpoint.md` | 3.3 KB | full | P | 14 Oct | current | Honest status: engine/agent/guards/API/web are stubs; AI provider undecided (due 16 Oct); competition docs due 19 Oct |
| `docs/evaluation.md`, `security-assessment.md`, `technical.md` | ~0.03 KB each | full | placeholders | - | obsolete as content | One line each: "Written 19 Oct" |
| `docs/team-assessment.md` | 2.2 KB | full | P | 14 Oct | unknown | All owners/skills are `TODO`; team size unknown |
| `docs/adr/0001..0005` | 0.4-0.9 KB | full | D | - | 0001-0005 current, 0002 and 0003 partly changed here | See reconciliation |
| `docs/discussion/OrderFit-Short.pdf` | 145 KB, 2 pages | full | B | 13 Oct | overlapping | One-page pitch with invented numbers (Rina-style example: 30,000 order, reserve 8,000); four-tier sandbox |
| `docs/discussion/OrderFit-Proposal.pdf` | 248 KB, 17 pages | full | S/B | 13 Oct | current for rules/eval ideas, contradicted on storage/tiers | Worked example section 6 (reproduced as fixture `PX-01`), eval plan, demo script, 8-day plan |
| `docs/discussion/OrderFit-AI-Agent-Architecture-and-Development-Strategy.pdf` | 454 KB, ~10 pages | full | D/B | 14 Oct | partly superseded | Recommends 1 orchestrated process, 4 AI tasks + 6 deterministic services, no fine-tuning first, 7 anti-hallucination layers; text of some tables garbled in extraction (tables of coverage matrix and test tracker not recoverable) |
| `docs/discussion/OrderFit System Design.pdf` | 492 KB, 15 pages | full | S | 14 Oct (Sazid) | current in structure; capacity numbers are assumptions | 4 layers, 10-node graph, eight entities, capacity maths, build order |
| `docs/discussion/OrderFit-Comparative-Study-v2.html` | 88 KB | full (text extracted) | R | 13 Oct | current, not independently verified | 9 products + 2 adjacent; interactive guide |
| `docs/discussion/edgecase.pdf` | 3.2 MB, 22 pages, image only | all 22 pages (subagent, visual) | S | 14 Oct | current; provenance flagged | 89 cases incl. 10 golden Rina cases. PDF title shows it is a print of an AI-generated interactive page; footnote claims "checked by hand"; footnote clipped. Transcription: `_work/edgecase-transcription.md` |
| `backend/**` (58 Python files, 958 lines) | - | engine, agent, domain, config, store, API, tests, prompts read | code | - | stubs | 25 files contain `NotImplementedError`; prompt templates are one-line placeholders; `tests/test_architecture.py` is the only real test |
| `data/*.json` | tiny | full | data | - | empty | demo business, catalogue and test cases are empty skeletons |
| `web/**` | - | types.ts, structure | code | - | stubs | components named but not implemented |
| `docker-compose.yml`, `.github/workflows/tests.yml`, `backend/pyproject.toml`, `.env.example` files | - | full | config | - | current | CI runs lint, tests, typecheck, build, docker build. `backend/.env` not opened (gitignored, may hold secrets) |
| `scripts/*.py` | - | headers | stubs | - | stubs | |

No file was `UNREAD`. Not verified: that CI is green, that `pytest` shows "3 passed" (claimed in `docs/checkpoint.md`); I did not install the package or run the tests (hard rule: no installs).

No suspected prompt injection was found in any repository file. The edge-case catalogue quotes two injected strings as test fixtures (cases D-05, D-12); those are data (and are reused as fixtures `OF-10` and in the injection tests).

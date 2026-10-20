# 06 Roadmap and submission plan

Part of the [OrderFit design set](README.md). All times are **Dhaka time (UTC+6)** unless stated. Evidence labels: `[R]` repo, `[W]` web (2026-10-14), `[I]` inference, `[A]` assumption, `[?]` unverified. The team has 5 members and one machine with a 16 GB GPU (stated by the user on 2026-10-14); skills and owners are unknown (`docs/development.md` is all `TODO` `[R]`), so the plan is by responsibility and every owner field is left for the team.

## 1. The calendar

Deadline for registration **and** submission: Tuesday 20 Oct 2026, 23:59 Beijing = 15:59 UTC = **21:59 in Dhaka**. Updates are allowed until then, the latest version prevails, nothing is accepted afterwards `[W: PDF rules, announcement page re-fetched 2026-10-14]`. Today is Wednesday 14 Oct (about 17:00). Friday 16 and Saturday 17 Oct are the Bangladesh weekend `[I]`: team availability may be higher than on a working day, but offices and campuses may be closed.

| Marker | When | Meaning |
|---|---|---|
| Scope and architecture freeze | Wed 14 Oct 22:00 | this design; change only through the review log |
| Gate G-ORCH | Thu 15 Oct 22:00, only if a volunteer tries it | optional LangGraph spike go/no-go (unscheduled; default no-go) |
| Gate G-LEARN | Sat 17 Oct 22:00 | optional tuned-extraction go/no-go (default no-go) |
| **Feature freeze** | Sun 18 Oct 12:00 | no new features; bug fixes, tests, documents only |
| **First complete submission (internal target)** | **Mon 19 Oct 20:00** | all six items sent, about 26 hours before the deadline |
| Last code change | Tue 20 Oct 14:00 | |
| Final resubmission, if any | Tue 20 Oct by 18:00 | |
| Hard stop | Tue 20 Oct 20:00 | nothing is sent after this unless an upload is failing |
| Deadline | Tue 20 Oct 21:59 | |

## 2. Competition rules check (the one place this is recorded)

Sources: the PDF "Appendix 2", the official site's script text (the site is a JavaScript app; its English rules were read from the script strings, not from the rendered page), the IEEE chapter page, and the ITS announcement `[W: _work/research-market.md section 1]`. **Where they disagree, the official source wins and the site says the Chinese text prevails**; the items below are therefore to be confirmed by email and from the rendered site (manual-check list, [02](02-competitive-research.md) section 8).

| Item | Pre-checked value | What the sources say | Plan |
|---|---|---|---|
| Theme, Topic E scope, scoring 40/30/30, team of 2 to 5, English, 60% non-Chinese, one team per person, licensing of third-party code and data | as in the brief | match (the site adds a rounding rule: a team of 3 needs at least 2 non-Chinese members; and for Topic E it adds the word "reconciliation") | none |
| Deadline | 23:59 Beijing = 15:59 UTC | PDF and announcement: 23:59; the site's script says "24:00" (= 16:00 UTC) | treat 15:59 UTC (21:59 Dhaka) as the binding cutoff |
| Six submission items | demo video optional | PDF lists the six items with the video optional; the site's script marks technical document, deck and **video required** and code, security self-assessment and execution evidence optional | **submit all six, including a video of at most 5 minutes** |
| Bonus | 0 to 5 only for the on-chain topic | PDF: on-chain only; the site: "advanced topics or demonstrated real-world deployment" | do not plan around a bonus; ask |
| Registration | form plus each member's passport bio page emailed | the site asks for ID type and number plus proof of enrolment on the registration form, emailed; "passport bio page emailed" not confirmed | read the XLSX form; send the registration early; keep passport copies ready |
| Contact | | PDF `wangyr@pbcsf.tsinghua.edu.cn`; site `fintechathon@ican-x.com` | write to both; ask which receives registration and submissions |
| Review and finalist dates | | finalists announced 31 Oct; check-in 20 Nov; final 21 to 23 Nov (the site: international defence 22 Nov, English, closed door); the ITS repost wrongly says review 31 Oct and finalists 20 Nov; online review dates vary (22 to 23 Oct versus 23 to 28 Oct) | plan only against the 20 Oct deadline; at least one member of a finalist team must attend in Shenzhen |
| LLM use | | no rule found | ask; the design runs without any LLM |
| Governing law | | PRC law; the Chinese text prevails | have a Chinese reader check the key rules if possible |

## 3. The six deliverables: where each comes from, when it is due

| # | Deliverable | Work items | Source document | Date (draft / final) | Owner |
|---|---|---|---|---|---|
| 1 | Technical documentation (architecture, core algorithm, security design) | edit 03, 04 and 05 sections 1 to 3 into the site's technical-document template (check it first); update with what was built | [03](03-system-architecture.md), [04](04-decision-engine-and-data-contracts.md), [05](05-security-and-evaluation.md) | Sun 18 Oct / Mon 19 Oct 12:00 | ____ |
| 2 | Presentation deck, 10 minutes or less | ten slides from [01](01-requirements-scenario-edge-cases.md) section 6.1; add real results only if they exist | 01 | Sun 18 Oct night / Mon 19 Oct 12:00 | ____ |
| 3 | Demo video, 5 minutes or less | record the scripted demo in `recorded` mode with the sandbox; one dry run on Sunday; one take on Monday | 01 section 6.1 | dry run Sun 18 Oct / final Mon 19 Oct 16:00 | ____ |
| 4 | Source code with README, GitHub link, deployment instructions, test cases | README with `docker compose up --build` and `LLM_MODE=recorded`; test registry from [05](05-security-and-evaluation.md) section 4; `LICENSES.md`; E2E-FRESH on a clean machine | the repository | feature freeze Sun 12:00 / fresh-environment test Sun 18:00 / final Mon 19 Oct | ____ |
| 5 | Security self-assessment (permission-tier implementation and known-risk list) | lift [05](05-security-and-evaluation.md) section 5; replace "designed" with "implemented" and add test results only where tests ran | 05 | Sun 18 Oct / Mon 19 Oct 12:00 | ____ |
| 6 | Execution evidence (sandbox operation logs and demo video) | JSONL export of the scripted run, chain head hash, verifier output, the video | Operation Log ([03](03-system-architecture.md) section 8.6) | Sun 18 Oct dry-run export / Mon 19 Oct final | ____ |

**Non-engineering tasks:** confirm the team meets the rules (5 students, full-time at eligible institutions outside Mainland China, Hong Kong, Macao and Taiwan, **at least 3 of the 5 non-Chinese** under the round-up rule `[W]`, nobody on two teams) by Wed 14 Oct; **fetch and read the official templates today** (technical document, security self-assessment, execution evidence, demo-video guide, team information form; `https://fintechathon.g-ican.com/templates/`), because they can change the structure of documents 1 and 5; fill and send the registration form with each member's identity details and proof of enrolment `[W]` by Thu 15 Oct and confirm receipt (the IEEE page promises confirmation within 48 hours `[W]`); email both contacts the open questions of [01](01-requirements-scenario-edge-cases.md) section 9 by Thu 15 Oct; `LICENSES.md` for every dependency and dataset (Thu to Sun); English for every document and the video; **three short conversations by Fri 16 Oct** (an accountant, a printing or packaging owner, a finance student), answers recorded verbatim in [01](01-requirements-scenario-edge-cases.md) section 3 and on slide 2 (even "never asked this question" is a finding; if none happen, say so); one teammate who did not write the engine **hand-computes two fixtures** from their inputs on Sat 17 Oct (the check on the event semantics).

## 4. Day-by-day plan

Hours are rough `[A]` for a team of 5; if people drop out, cut from the bottom of the cut list in section 8 first.

| Day | Goal | Work items | Exit criteria |
|---|---|---|---|
| **Wed 14 Oct** (evening) | freeze scope; start the clock safely | read this design set; confirm eligibility; **fetch the official templates**; send registration and the questions to both organizers; assign owners; run the existing CI once and record whether the claimed 3 architecture tests pass `[?]`; add `python fixtures/selftest.py` to CI | owners named; registration sent; templates read |
| **Thu 15 Oct** | engine and tenancy | **vendor `fixtures/reference_engine.py` into `backend/orderfit/engine/`** (typed wrapper, Pydantic at the edges; keep `bruteforce_series` as the oracle) instead of re-implementing it; make `tests/engine/test_catalogue.py` compare every one of the 22 cases to its expected output; migrations for the 15 tables, sessions, two seeded tenants, application-level scoping and a non-owner application role (Row-Level Security only if time remains) | all 22 FX parity tests, UT-BRUTE, UT-ORDER, UT-RESERVE, UT-TIE, UT-MONO green; AUTH-TENANT green |
| **Fri 16 Oct** | workflow, gate, sandbox, log | `WorkflowRunner` and transition table with the ask and commit phases and COMPENSATING; Permission Gate with action-bound `plan_hash` and step-up; sandbox (bank, outbox, mock lender, `payee`, simulator); per-tenant hash-chained Operation Log with trigger and advisory lock; LLM Gateway in `recorded` and `off` modes with the recorded-miss rule; extraction with normalised grounding for the synthetic PO and quote (`scripts/make_demo_pdfs.py`); slot renderer; `parse_whatif` | ST-STALE, ST-APPROVAL-HASH, ST-COMPENSATE, ST-IDEM, ST-RESUME, ST-RECON, SEC-T2, SEC-T3, SEC-T4, SEC-LOG-APPEND, SEC-LOG-CHAIN, AUTH-STEPUP, UT-GROUND, UT-SLOTS, LLM-MISS green; one deal runs from upload to sandbox execution through the API |
| **Sat 17 Oct** | UI, security evidence, experiment gate | four screens (deal with the timeline chart and headroom, strategy table with dependencies, resilience and the sensitivity table, delay slider and priority toggle with the what-if box, approval and log view); alerts A1, A2, A5, A6; ADV-01 to ADV-10 **once in `live` mode** with raw outputs stored, ADV-11 to ADV-15, `scripts/redteam.py`; secret scan and dependency audit; E2E-ANCHOR in `recorded` mode; three live what-if traces recorded for the video; a teammate hand-computes two fixtures; **rehearse E2E-FRESH on a second machine**; **G-LEARN decision at 22:00** (only if R1 had the generator and a training evening on the 16 GB GPU) | E2E-ANCHOR, E2E-NOLLM, E2E-FRESH (second machine), ADV-01 to ADV-15, SEC-REDTEAM, SEC-REPLY, SEC-FRAUD, SEC-UPLOAD, SEC-REDACT green |
| **Sun 18 Oct** | freeze, evaluate, document | **feature freeze 12:00**; run all tests and the baselines (B0, B1, B4 and, if a key exists, B3); EV-DIALOGUE from the logs; draft documents 1 and 5 against the official templates; deck; one full dry run of the four-scene video and the log export | evaluation table produced; drafts of 1, 2, 5 exist |
| **Mon 19 Oct** | finalize and send | final documents, deck, video (at most 5 minutes), evidence export, repository tag; **send all six items by 20:00**; confirm receipt | **first complete submission sent** |
| **Tue 20 Oct** | buffer | fix only what is broken or wrong; resubmit by 18:00 if needed; verify the received version | final version in; hard stop 20:00 |

## 5. Responsibilities (owner fields blank)

| Responsibility | Scope | Notes |
|---|---|---|
| R1 Engine and evaluation | vendoring and typing the reference engine, fixtures, graders, baselines, delay scan, value of information; after the port (Thu night) the document generator and the optional tuned-extraction experiment on the 16 GB GPU | the reference engine is the specification and the starting code; parity with `fixtures/expected/` is the acceptance test |
| R2 Workflow, Permission Gate, sandbox, store | runner, tiers, action-bound approval and step-up, log, migrations, sessions, tenant scoping | the security-critical code; second reviewer (R1) required |
| R3 LLM Gateway, extraction, slots | modes, prompts with slots, `parse_whatif`, normalised grounding, recorded outputs, ADV documents, document generator, optional tuned model | owns `LLM_MODE` behavior and ADR 0005 |
| R4 Web UI | the four screens, what-if box, stale banners, provenance badges, headroom and assumptions panels, log view | display only; no money logic |
| R5 Documents, security assessment, submission | technical document, deck, video, README, `LICENSES.md`, registration, emails | owns the submission checklist |

**With the team of 5: one person per responsibility R1 to R5**, and R1 reviews R2's security-critical code (the Permission Gate, approvals, log) because R1 finishes the engine port first. If someone drops out: merge R5 into R4 first, then R1 into R2; drop items from the bottom of the cut list at once.

## 6. Cost and access assumptions, and backup plans

Costs: model calls about $30 to $50 in total `[R: System Design]`; Claude Haiku 5.5 at $0.10 input and $0.50 output per million tokens `[W: re-checked]`; recorded mode costs nothing; hosting is local Docker; Neon free tier is optional (limits unverified `[?]`); the team's 16 GB GPU for the optional learned-layer experiment (free Colab only as a backup; quotas not guaranteed `[W]`); no paid GPU.

| External dependency | Failure | Backup |
|---|---|---|
| LLM provider | outage, rate limit, changed terms or model name | `recorded` mode (default), `local` Ollama, `off` mode |
| Neon | unreachable or limits | local Postgres in Compose (the default) |
| GitHub | outage near the deadline | the zipped repository attached to the submission; push earlier |
| Docker on the judge's machine | cannot run Compose | README fallback: Python 3.12 virtual environment plus `npm run dev`, and the video as evidence |
| Team GPU (16 GB), Colab backup | driver or CUDA problem, no quota | skip the learned layer; the demo never depends on it |
| Submission channel | form or email fails | send the first complete package by Mon 20:00 to leave a day to recover; keep proof of sending |
| Organizers' unclear rules | required items differ | submit all six items |
| Model provider data terms | free tier trains on inputs | synthetic data only; paid API or local mode |

## 7. Risk register

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Problem not validated; differentiation thin | high / medium | honest framing ([02](02-competitive-research.md)); the order-terms-planner headline; three conversations by Fri 16 Oct |
| Six days is too short for the whole design | medium / high | the reference engine already exists; the cut list below; recorded mode; feature freeze Sun 12:00 |
| Security design is not tested before submission | medium / high | tests are the exit criteria of Fri and Sat; the self-assessment says "implemented" only for tests that ran |
| Demo depends on a live component | low / high | `recorded` and `off` modes; scripted counterparty simulator |
| Extraction wrong but plausible on the demo PDFs | medium / medium | grounding, owner confirmation, synthetic PDFs from the project's generator |
| Rules misread (required items, contact, registration) | medium / high | email both contacts today; submit all six; early first submission |
| Individual skills and availability unknown (team of 5 stated) | medium / high | one owner per responsibility, a named reviewer for R2, merge roles if someone drops out, cut list |
| LangGraph or learned-layer detour eats the schedule | medium / medium | LangGraph is unscheduled; the learned layer is one evening owned by R1 after the engine port, default no-go |
| Fixture labels not independent of the engine author | high / low | a teammate hand-computes two fixtures; the second implementation of the series; the historical reproductions; the fixtures' `intent` labels are stated as consistency checks |
| Windows event-loop problem with psycopg async `[R: store/db.py]` | medium / low | develop in Linux containers; use the documented selector policy |

## 8. Ordered cut list (build)

Drop in this order if the schedule slips: (1) the tuned extraction experiment; (2) the LangGraph spike (already unscheduled); (3) Row-Level Security hardening, the `viewer` role, server-sent events, the API `Idempotency-Key` header and the Ollama `local` mode; (4) extra diagrams and ADR polish; (5) UI polish beyond the four screens; (6) alerts A3 and A4; (7) money-at-risk, price break-even and the recession preset; (8) the second negotiation round and any reply handling beyond the one scripted counter-offer; (9) the single-prompt model baseline B3; (10) South Asian number formats in the UI (keep the parser).

**Never cut:** vendoring the reference engine with FX parity and the second implementation of the series; the hard-constraint enforcement and the counterfactual rule; the Permission Gate and the tier tests; the action-bound approval with step-up and the ask and commit phases; the per-tenant hash-chained Operation Log; stale invalidation; the no-LLM and recorded modes; the slot renderer; the live adversarial run, the value-manipulation documents and the red-team script (they are the security evidence that can fail); the what-if parser (the dialogue evidence); baselines B0, B1 and B4; the security self-assessment with a real known-risk list; the fixture cases `OF-02`, `OF-09`, `OF-10`, `DEMO-ASK` and `DEMO-REPLY`.

## 9. Definition of done

1. REQ-01 to REQ-15 ([01](01-requirements-scenario-edge-cases.md)) pass their tests; the registry ids marked "reference" in [05](05-security-and-evaluation.md) also pass in the production tree.
2. `docker compose up --build` from a fresh clone, following only the README, reaches a healthy system and runs the demo in `recorded` and in `off` mode (E2E-FRESH).
3. The hash chain verifies; the evidence export exists.
4. Six items sent, video at most 5 minutes, deck at most 10 minutes, all in English, with the security self-assessment's known-risk list final.
5. Every statement of a result is backed by a run in the repository; nothing in any document claims a performance result that was not measured; every dependency and dataset is in `LICENSES.md`.
6. The final package is confirmed received before the deadline.

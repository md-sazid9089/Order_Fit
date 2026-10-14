# OrderFit design set

A design for the 2026 Shenzhen International FinTech Competition (International Track, Topic E) written on **2026-10-14**, six days before the deadline (**Tue 20 Oct 2026, 21:59 Dhaka = 23:59 Beijing**). It is a research-and-design deliverable: no application code was changed. Evidence labels used throughout: `[R]` repository, `[W]` web (accessed 2026-10-14), `[I]` inference, `[A]` assumption, `[?]` unverified. **Nothing is built and no performance result exists.** The one executed artefact is the reference calculation in [`fixtures/`](fixtures/), whose self-tests pass.

## What OrderFit does

A small business gets a customer order. OrderFit answers: *given this order, my existing obligations and my cash, what is my best feasible course of action, why, and what would change the answer?* It reads the purchase order and supplier quote, rebuilds the dated cash timeline with and without the order, enumerates changes (customer deposit, supplier terms, staged delivery, a financing offer the owner supplies, defer, decline), keeps only those that hold the owner's minimum cash reserve on every calendar day, ranks them by the owner's priorities, stress-tests them against late payment, and says plainly when no plan works or when it needs the owner's answer. After the owner approves, it carries the plan out in a simulated bank, outbox and lender portal and records every step in a tamper-evident log.

## User, problem, MVP

The user is the owner-manager of a made-to-order B2B small manufacturer; the scenario is synthetic, in Bangladeshi taka, for **Shapla Packaging Ltd** (Dhaka). A profitable order can still breach the cash floor because supplier payments fall due before the customer pays. The MVP is one business and one order at a time, one currency, no tax, FX, holidays or live integrations; financing comes only from terms the owner supplies. Whether owners face this decision often enough to value a tool is **unvalidated** ([01](01-requirements-scenario-edge-cases.md) section 3).

## Chosen architecture, in plain terms

A fixed, auditable workflow, not a swarm of agents ([ADR 0001](adrs/0001-architecture-pattern.md)). A **Decision Engine** (pure code) does all arithmetic, dates, constraints, ranking and alerts. A language model reads documents, writes explanations and drafts, and reads replies, but has **no tools** and never touches a number that is not then checked ([ADR 0002](adrs/0002-ai-calculation-separation.md)). A **Permission Gate** allows only tiered actions: T0 read, T1 compute, T2 draft, T3 change sandbox state with the owner's approval bound to the hash of the exact actions (an *ask* first, payments only after the acceptance is recorded), T4 real money, which has no code path. Everything is logged in an append-only, hash-chained log that doubles as the execution evidence. The demo runs from recorded model outputs or with no model at all. The orchestration default is plain code; LangGraph and a tuned open-weight extraction model were evaluated and sit behind go/no-go gates whose default is no-go ([ADR 0006](adrs/0006-orchestration-and-learned-layer.md)).

## Role of AI versus deterministic logic

| Deterministic code | Language model (optional, replaceable) |
|---|---|
| every figure, date, constraint, ranking, alert; the decision to ask a question; approvals; sandbox actions | reading documents into typed fields with quotes; understanding what the owner types ("what if the customer pays later?") as a patch of enumerated parameters; explanation and draft text built from named slots; reading a reply |

## Differentiation verdict and its limits

**Thin to partly differentiated** ([02](02-competitive-research.md)); the headline that follows from it is a *verified negotiation planner with a safe executor*. A dated what-if cash view, scenario comparison, AI chat on forecasts and approval gates all exist in shipping products `[W]`. No verified product generates, sizes and ranks *changes to an order's commercial terms* with a dated before-and-after timeline, a counterfactual baseline, a verified "no feasible plan", and permissioned sandbox execution; the evidence for that gap is absence from about 25 pages, which is not proof. If judged weak, the smallest pivot is to headline it as an **order-terms negotiation planner**. The competition rubric favours safe, verifiable task completion over financial novelty `[W]`.

## What the reference calculation shows (computed, not claimed for the product)

On the anchor order (profit before financing 1,400,000.00) accepting as offered leaves a lowest balance of -590,000.00 against a 600,000.00 reserve. The highest-profit feasible plan (a 1,300,000.00 bank loan, profit 1,348,000.00) breaches if the customer pays 15 days late and the other customers 5 days late; the recommended 40% deposit earns 20,000.00 less and keeps 71,200.00 of headroom in that case. **No plan survives the severe case** and the agent says so; the recommendation also flips with the assumed customer delay, which the output shows as a sensitivity table. An order with the same profit but different timing and supplier terms is accepted as offered. The engine reproduces the team's earlier "Rina" and proposal examples (with two errata and one improvement) ([04](04-decision-engine-and-data-contracts.md) sections 8 and 9). Simple baselines computed on the fixtures: a profit-only rule accepts 11 of 14 analysable cases that breach the reserve; a fixed rule declines 9 orders for which a feasible plan exists; a five-line greedy ladder matches the engine in 9 of 14 and fails the owner's target in the anchor ([05](05-security-and-evaluation.md) section 6.4). These describe the fixtures, written by the same team, not the real world. (The first version of this analysis exempted the deposit and the other customers from the stress; the independent review exposed it and the numbers above are the corrected ones.)

## Top risks

1. Problem not validated; differentiation thin. 2. Six days for a large design: the scope was cut after the review (staged delivery, deferral and invoice-advance financing deferred; the engine is reused, not re-implemented) and the cut list in [06](06-roadmap-and-submission-plan.md) is ordered. 3. Competition rules differ between the PDF and the official site (video required or optional; required items; contacts; passport page): submit all six items and ask. 4. The security design is untested until Friday and Saturday's exit criteria pass, and its evidence must be able to fail (a live adversarial run, value-manipulation documents, a red-team script). 5. Extraction that is plausible but wrong is caught only by grounding and the owner's confirmation. 6. The team of 5 is known but individual skills are not (owner fields are open).

## Deliverable-to-rubric map

| Competition item | Rubric dimension served | Where |
|---|---|---|
| 1 Technical documentation | task completion, security | [03](03-system-architecture.md), [04](04-decision-engine-and-data-contracts.md), [05](05-security-and-evaluation.md) |
| 2 Deck (10 min) | all three | [01](01-requirements-scenario-edge-cases.md) section 6 |
| 3 Demo video (5 min) | all three | [01](01-requirements-scenario-edge-cases.md) section 6.1 |
| 4 Source code, README, tests | task completion | repository, test registry in [05](05-security-and-evaluation.md) |
| 5 Security self-assessment | security and compliance (30%) | [05](05-security-and-evaluation.md) section 5 |
| 6 Execution evidence | task completion (40%) | Operation Log, [03](03-system-architecture.md) section 8.6 |

Dates and owners for each are in [06](06-roadmap-and-submission-plan.md).

## Index

| File | Content |
|---|---|
| [01-requirements-scenario-edge-cases.md](01-requirements-scenario-edge-cases.md) | requirements, scope, anchor scenario, four-scene demo script, 89 plus 18 edge cases with status and test ids, assumptions, open questions |
| [02-competitive-research.md](02-competitive-research.md) | method, product matrix, workarounds, verdict, manual-check list |
| [03-system-architecture.md](03-system-architecture.md) | options and decision, orchestration and learned-layer decision, diagrams, state machine, stack, action surface and tiers, failure handling |
| [04-decision-engine-and-data-contracts.md](04-decision-engine-and-data-contracts.md) | calculation definitions, strategy space, constraints, uncertainty, worked example, entities, API and error contracts |
| [05-security-and-evaluation.md](05-security-and-evaluation.md) | threat model, controls, test registry, draft self-assessment, evaluation plan, fixture catalogue |
| [06-roadmap-and-submission-plan.md](06-roadmap-and-submission-plan.md) | calendar, rules check, deliverable mapping, day-by-day plan, cut list, definition of done |
| [adrs/](adrs/) | six decision records |
| [fixtures/](fixtures/) | reference engine, 22 case files with expected outputs, self-tests, rendered worked example |
| [BUILD-HANDOFF.md](BUILD-HANDOFF.md) | kickoff prompt for the implementation session |
| [_work/](_work/) | session log, inventory, reconciliation, edge-case transcription, research notes, reviewer output, review log |

To re-run the evidence: `cd fixtures && python build_cases.py && python reference_engine.py && python selftest.py && python baselines.py && python render_worked_example.py` (several minutes: the engine run includes a brute-force cross-check and the sensitivity runs; `reference_engine.py --fast` skips them and writes to `expected_fast/`, never evidence).

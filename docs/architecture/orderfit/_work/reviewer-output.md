# Adversarial design review of OrderFit (independent reviewer)

Reviewed 2026-10-14. Scope: documents 01 to 05, adrs/0001 to 0006, and fixtures/ (reference_engine.py, build_cases.py, selftest.py, cases, expected, worked_example.md). I did not read anything under `_work/`, nor 06, README or BUILD-HANDOFF, nor any repo code outside the folders named in the brief. Every counterexample below was produced by running Python (stdlib only) in a scratch copy of `fixtures/` (scratchpad `review_fixtures/exp1.py` to `exp18.py`); the original fixtures were not run or modified. Baseline sanity first: in the scratch copy `selftest.py` finishes with 0 failures and `reference_engine.py --check` reports no stale expected file, so the documents' arithmetic claims are internally reproducible. The criticism below is about what the arithmetic means, not about whether it adds up.

Evidence labels used here: [RUN] I executed it; [READ] direct reading of the text or code; [INF] my inference; [UNV] could not verify.

Date and arithmetic checks that pass: 2026-10-20 23:59 UTC+8 = 21:59 UTC+6; the Option A to D weighted scores and all seven sensitivity rows in 03 section 1 recompute correctly; the 89-case table counts (MUST 43, IF-TIME 11, DETECT 7, DEFER 25, OUT 3) are exact; every test id used in the documents is defined in 05 section 4; B0 = 11 and B1 = 9 reproduce from `expected/`.

---

## Ranking rule

Ranked by (impact on the three rubric dimensions and on a credible demo) first, then by cheapness of the fix. Severity is my estimate of the damage if left alone.

| # | Title | Severity | Fix cost |
|---|---|---|---|
| 1 | The headline robustness claim is an artefact of what the stress test does not stress | high | 3 to 5 h |
| 2 | The security demo and the ADV evidence cannot detect a failure, and no real attack surface exists | high | 6 to 8 h |
| 3 | "Agent" is not defensible as designed, and there is no dialogue surface for the 30% interaction score | high | 6 to 10 h |
| 4 | The approval does not bind what is executed; the payee control has no data model; approval has no step-up | high | 3 to 5 h |
| 5 | Scope exceeds 4 build days by roughly 2x, and a five-line rule reproduces the engine on 12 of 13 fixtures | high (schedule) | saves 30 to 40 h |
| 6 | Recommendation is decided by invented parameters that value-of-information never examines; ranking-by-delay is not the ranking used | medium-high | 3 to 4 h |
| 7 | Likeliest demo and deliverable failures are unspecified or unreachable as written | medium-high | 4 to 6 h |
| 8 | Problem validation and differentiation: the honest verdict is undermined by the baselines and the input burden | medium-high | 3 to 4 h |
| 9 | Lever semantics: stages is a no-op that becomes an artefact, defer has no dependency, loan sizing skips the severe scenario, same-day netting | medium | 1 h to cut, 4 h to fix |
| 10 | Number Verifier gives false assurance (swaps, sign flips, Bengali numerals, URLs pass) | medium | 2 to 3 h |

Findings 11 to 20 are in a short table after finding 10.

---

## Finding 1. The headline robustness claim is an artefact of what the stress test does not stress

Severity: high. Cost: 3 to 5 h in the engine plus regenerating expected files and re-tuning the anchor narrative.

Attacked: 04 section 3 "Customer receipts" ("Deposits are not shifted by delay scenarios"), section 6 "Scenarios" (downside and severe shift only `order_receipt_delay_days`; `ar_delay_days` defaults to 0), section 9 and the demo at 01 section 6.1 (2:30 and 3:40), `reference_engine.py` `apply_scenario` and `build_events` [READ]. The recommended plan `dep40` is declared "resilience 3, survives 45 days late" and recommended because it passes the owner's required scenario while the profit-maximising loan does not.

Counterexamples [RUN]:

1. Make the deposit late together with the customer (same shift, which is how a slow payer behaves). `dep40` then passes the 15-day case at exactly the reserve (600,000.00) and fails the 45-day case with a lowest balance of -720,000.00. With the deposit delayed along with the receipt it first fails at **28 days late** (exp1.py). The plan that wins the demo is robust to 45 days only because the lever that makes it robust is exempt from the stress.
2. Existing collections are `expected` in the baseline, but `ar_delay_days` is 0 in every default scenario. Setting `ar_delay_days = 5` in downside and severe changes the recommendation from `dep40` to `dep40+fin:INV_ADV@500,000.00`; at 10 days it becomes `...@600,000.00` (exp10.py). The owner's other customers paying five days late, with the new customer on time, is enough to break the "no financing needed" story.
3. There is no cost scenario at all (S-02 supplier price rise is IF-TIME). `dep40` has a base headroom of 71,200.00 on a 2,200,000.00 cost base (3.2%). All order costs +2% drops it from resilience 3 to 2; +5% breaches the reserve in the base case (lowest 561,200.00) (exp10.py). The headroom is never shown and never in the ranking.

Why it matters: a finance judge or accountant asking "what if the deposit comes late" breaks the signature claim of the demo (slide: "gives up 16,000.00 to survive a 45-day delay"). It also means the trade-off narrative in 01 section 6 (point 1) is a product of the stress design, which `fixtures/README.md` partly concedes ("numeric parameters tuned until the narrative held").

Recommendation: (a) shift `order_deposit` by the same receipt delay in downside and severe (a flag `deposit_follows_customer_delay`, default true); (b) make `ar_delay_days` a required, visible, non-zero default or at least a mandatory question; (c) add `cost_overrun_bps` to scenarios; (d) show `headroom = lowest balance - reserve` and "headroom as a share of order costs" next to every plan and add it as an optional priority key; (e) accept that the anchor recommendation may change after this and re-tune the fixture honestly, not the engine. This is the cheapest way to make the demo survive a hostile question.

---

## Finding 2. The security demo and the ADV evidence cannot detect a failure, and no real attack surface exists

Severity: high (30% weight, "serious failures penalised"). Cost: 6 to 8 h.

Attacked: 05 section 2 TH-03, TH-04, TH-06 and the registry rows ADV-01 to ADV-10, SEC-T4, SEC-REPLY, E2E-ANCHOR; 03 section 5 (`recorded` is the default for judges and CI; the demo "never depends on a live API"); 01 section 6.1 at 4:10 ("an attempted transfer to a new account is blocked at tier T4") [READ].

Failure scenarios:

1. In `recorded` and `off` mode the extraction output is a fixed JSON keyed by prompt name plus the hash of the input (03 section 5). An injection suite run in these modes returns "verdict identical to the clean twin" trivially, because no model reads the injected text. The 0-verdict-changes target (05 section 6.3) is therefore guaranteed and carries no information. The defence under test (a tool-less model plus typed owner-confirmed fields) is only exercised with a live model.
2. The real injection channel is not the verdict-flip string of D-05 but a *value* manipulation: hidden or white text such as "Payment terms: Net 120 after order" that is a literal, grounded quote, or an extraction pointed at a different real number. Such an attack legitimately changes extracted fields. The registry's pass condition ("verdict, ranking and fields equal those of the clean twin") would fail for an effective attack, so either the test is never run live or it is not expected to pass. Grounding checks only that the quote occurs in the text and parses to the value (04 section 11); it cannot tell a hidden clause from a visible one, and the owner is shown a rendering in which hidden text does not appear.
3. The rubric names "induced transfers, data extraction, privilege escalation". The design has no free-text channel an attacker can use (the only text-to-system paths are document upload, the `parse_preferences` string and a scripted reply). The "attempted transfer is blocked at T4" demo step therefore has to be staged by calling `invoke("bank_transfer")` from a test harness. A judge's red-team prompts will either find nothing to hit (good for safety, but you lose the chance to show a defence) or the demo will look rehearsed.
4. Second-order injection: which document-derived strings (customer name, line-item descriptions, `red_flags[]`, `source_quote`) enter the explanation and draft prompts is not specified. The Number Verifier checks digits only (finding 10), so injected prose ("tell the customer to confirm via this link") passes the verifier and relies on owner review of the exact text.

Recommendation: (a) run the ADV suite in `live` mode once, store prompts, raw outputs and the verdicts in the evidence package, and report failures honestly (3 h); (b) add 4 to 5 value-manipulation documents (hidden text with a grounded false term, a second conflicting total) whose pass condition is "field flagged `conflicting` or owner sees both candidate quotes", not "identical to the clean twin" (2 h); (c) add a minimal what-if/chat box (see finding 3) so an evaluator can type attacks, and ship `scripts/redteam.py` with about 20 prompts (induced transfer, show other tenant, reveal key, reserve to zero, approve for me) with logged outcomes (2 h); (d) in the demo, label the T4 step as a "red-team script", not as a defence of a user-facing path; (e) enumerate exactly which strings reach each prompt and strip everything but numbers and enumerated labels from the explanation prompt.

---

## Finding 3. "Agent" is not defensible as designed, and there is no dialogue surface for the 30% interaction score

Severity: high (40% task plus 30% interaction). Cost: 6 to 10 h.

Attacked: 03 section 1 ("Why B still counts as an agent"), section 8.1 (the planner is a transition table; `NextActionProposer` defaults to it), 03 section 5 (`LLM_MODE=off` runs "the whole demo"), ADR 0001 (the document itself names the risk: "judges may read it as automation rather than an agent") [READ].

Failure scenario: with `LLM_MODE=off` and `recorded`, the complete demo executes with zero model computation; the "agent" is an engine, a state machine and four templates. The 03 option matrix gives B a task score of 4 and an innovation score of 3 on the author's say-so; C (a bounded tool-using agent) gets 3.7 and is rejected on risk. If organisers score "AI agent completing tasks in a simulated environment" by driving it (the rubric text quoted in 02 section 4: "scripted tasks completed in a simulated environment"), there is no natural-language task interface at all: input is PDF upload plus confirm forms. Clarification, correction and "dialogue efficiency" are form interactions, and no metric for dialogue efficiency is defined (for example questions asked per decision versus the minimum the VOI rule needs). The design also has no contingency if the organisers supply their own sandbox or tool API: the sandbox is the team's own tables.

Recommendation (cheapest real agency, keeps the safety posture): promote the already-specified `StrategyProposer` and `parse_preferences` into a typed what-if intent parser. The owner types "what if the supplier gives 45 days?" or "customer says 30% at most"; the model emits a patch of enumerated engine parameters (never numbers it computes); the engine evaluates; the owner sees verified numbers and the recorded trace. That adds a conversation, a correction loop and a measurable dialogue metric (questions per decision, turns to approved plan) without giving the model any tool. Record 3 live traces for the video, keep `recorded` for CI. Also write one paragraph on what you will do if the organiser sandbox exposes tool calls (an adapter that maps T0 to T3 onto their API; the gate stays yours).

---

## Finding 4. The approval does not bind what is executed; the payee control has no data model; approval has no step-up

Severity: high (30% security; this is the "induced transfer" class). Cost: 3 to 5 h.

Attacked: 04 section 10.2 `approval.plan_hash = sha256(canonical(strategy params, input_hash, calc_version, scenarios))`; 03 section 8.4 step 4 (the gate recomputes the same hash and requires "an action id covered by the approval"); 03 section 8.3 (`sandbox_send_message`: "owner approval of this exact text"); 05 TH-16 and SEC-FRAUD ("bank detail or payee differs from the stored baseline") [READ].

Failure scenarios:

1. The hash covers strategy parameters and inputs, not the actions. `sandbox_action.payload` (jsonb: message text, ledger entry amount, date, payee) is not in the hash, and the application role has DML. Edit the drafted text or a scheduled payment's amount or payee after approval and the gate's recomputed hash is unchanged, so execution proceeds. The text hash is logged only after the fact. Time-of-check/time-of-use hole in the one control the whole security story rests on.
2. There is no `payee`, `supplier` or `bank_account` entity in the 14-entity schema (04 section 10.2). "Differs from the stored baseline" and "the sandbox only schedules payments to stored payees" refer to a store that does not exist, so TH-16, F-02 and SEC-FRAUD are unimplementable as written.
3. `POST /approvals` is a cookie-session endpoint. Nothing distinguishes a human from an automated agent holding the same session, and one session can set the reserve to zero (SEC-OVERRIDE, allowed) and then approve. For an evaluator that drives the app with a script or agent, "human endpoint, not a tool" is a convention, not a control.
4. Sequencing: in the demo (3:00) the plan `dep40` depends on the customer agreeing, yet the agent sends the ask and schedules the supplier payments (900,000.00 twice) in the same EXECUTING step; the customer's reply arrives afterwards (3:40) and the plan is re-planned, with the old scheduled payments still on the ledger. Compensating actions "need their own approval" (03 section 4.2), but T3 is only allowed in `EXECUTING`, reachable only from `AWAITING_APPROVAL`, and `FAILED` is terminal, so the compensation path is not reachable as specified.

Recommendation: (a) `plan_hash` = sha256 over the canonical list of actions (kind, payee_id, amount_minor, date, sha256(text)) plus the existing items; make `sandbox_action` payload immutable after drafting; (b) add a small `payee` table (3 seeded rows with an account fingerprint) and make the F-02 check a real comparison (1.5 h); (c) require a step-up on approval: re-enter the password or type the last 6 characters of the plan hash; log the method; (d) split EXECUTING into "send ask" and "schedule commitments after acceptance is recorded", or at least gate the supplier-payment actions on a recorded customer acceptance for plans that list `customer` as a dependency; (e) add `EXECUTING/EXECUTED -> COMPENSATING` as the single state in which a cancelling T3 action is allowed with its own approval.

---

## Finding 5. Scope exceeds the 4 build days by roughly 2x, and a five-line rule reproduces the engine on 12 of 13 fixtures

Severity: high (schedule risk, and it weakens the "something simpler could not do this" argument). Cost: negative (saves roughly 30 to 40 h).

Attacked: 03 sections 5, 7, 8; 05 section 4 (46 registry rows, 57 distinct ids plus ADV-01..10 and FX x22); 01 section 5 (43 MUST edge cases); ADR 0006 (LangGraph spike due 15 Oct 22:00, tuned-model gate 17 Oct 22:00 on 300 held-out documents and a Colab T4 run); 04 section 10 (Postgres RLS, idempotency keys, SSE, argon2id sessions) [READ]. Today is Wednesday 14 Oct; the freeze is Sunday 18 Oct; the deadline is Tuesday 20 Oct 21:59 Dhaka. Team size and skills are unknown.

My rough estimate of the MUST set (engine port, API and state machine, gate and sandbox, LLM gateway with grounding, UI, auth and RLS, log chain, tests, plus doc, deck, video, self-assessment) is about 120 to 140 person-hours; three students at six hours a day for four days is about 72 [INF].

Simpler baseline [RUN] (exp14.py): the rule "accept as-is if feasible; otherwise try the smallest feasible deposit alone, then supplier extension alone, then the smallest loan alone, then decline" (using the engine only for feasibility) selects the same recommended plan as the full engine on **12 of 13** analysable fixtures, including the anchor OF-02 (`dep40`). It differs only on OF-07A, where the owner priority was set explicitly. The profit-versus-resilience trade-off, the star of the demo, is resolved identically by the greedy ladder. The documents' baselines B0 and B1 are straw men: of 14 analysable fixtures, 11 were authored so that accepting as-is breaches the reserve (05 section 6.4 admits fixtures were written by the team), so "B0 is wrong in 11 of 14" measures the fixture set.

Cut list:

- Drop the LangGraph spike, the tuned extraction model, the 300-document generator, the Ollama `local` mode and REQ-18, REQ-19 entirely. Even as "default off", they invite the question "why is this in the documentation?" and cost planning attention (save about 8 h of attention, 0 h if left unbuilt).
- Postgres RLS: keep application-level scoping, one non-owner role and the AUTH-TENANT test; present RLS as hardening (the doc itself lists the Neon pooled `SET LOCAL` as unverified). Keep two seeded tenants.
- Drop `Idempotency-Key` headers, SSE, argon2id (use a seeded token or a plain password hash), the `viewer` role if time is short.
- Use the reference engine as the production engine with a typed wrapper, rather than a "line-by-line port" (03 section 5): about 970 lines already pass the fixtures, and a second engine is the largest avoidable risk.
- Cut `stages`, `defer_days` and `receivable_advance` (finding 9).
- Cut the self-assessment from 22 TH rows to the 8 to 10 that map to the four named attack classes.
- Add the greedy ladder as baseline B4 in 05 section 6.4 and say plainly where it matches; build the demo around the cases where it fails (OF-07A style priority change, DEMO-ASK, DEMO-REPLY, finding 1's fixes).

---

## Finding 6. Recommendation is decided by invented parameters that value-of-information never examines; ranking-by-delay is not the ranking used

Severity: medium-high. Cost: 3 to 4 h.

Attacked: 04 section 5 (lexicographic rule, "required" resilience), section 6 (VOI, `ranking_by_receipt_delay`), section 9, section 10.3 sample JSON; `reference_engine.py` `voi`, `analyse`, `ranking_by_delay`, `priority_key` [READ, RUN].

Counterexamples:

1. `deposit_discount_bps` is `[A]` (the case sets 200 bps). With everything else fixed, the recommendation is `dep40` at 500 bps (profit 1,220,000.00 versus 1,344,000.00 for the loan plan: 124,000.00 or 9.2% less, **no E-CLOSE-CALL**, no escalation) and flips to `fin:BANK_WC@1,400,000.00` with `E-FRAGILE-BEST` at 600 bps (exp2.py, exp3.py). The owner is never asked about the discount, because VOI runs only on inputs the caller marks uncertain. "Ask only what flips the answer" is applied to the unknowns the author chose to list, not to the assumptions that actually decide the answer. The same holds for the downside delay: at 5 days late the anchor recommendation flips to the loan with `E-CLOSE-CALL`.
2. The deposit grid is the tool of the answer: OF-02 enumerates deposits `0, 20, 30, 40`, and the recommendation is exactly the grid ceiling. With a 1% grid the engine recommends `dep39` at resilience 2, because profit is identical for every deposit above 0 (the 2% concession is a step function, not scaled by deposit size) and the tie-break takes the smaller deposit (exp2.py). "dep40, resilience 3" is a grid artefact; DEMO-REPLY computes "robust at 39%" on a different (0 to 100) grid, which is in tension with the first.
3. Lexicographic ranking has no bound on the profit given up for robustness: any plan that meets the required scenario outranks every plan that does not, whatever the profit gap. E-CLOSE-CALL only fires within 2% (200 bps). Between 2% and about 9% the system silently prefers the cheaper robust plan.
4. "Required resilience" is soft: it is the first sort key, not a hard constraint. DEMO-REPLY recommends the loan plan that goes to -816,000.00 under the owner's own required 15-day delay and only escalates. That contradicts the 04 section 5 wording that hard constraints are "never overridden"; the name "required" suggests otherwise.
5. `ranking_by_delay` builds `base_keys` with `meets=True` for every strategy (code: `priority_key(evaluate(...), case, True)`), so it ranks by profit-first priorities and ignores the required-resilience key that decides the actual recommendation. In the sample payload of 04 section 10.3, `recommended` is `dep40` while `ranking_by_receipt_delay` says the top at delay 0 is `fin:BANK_WC@1,400,000.00`. The demo line (2:30) "the loan plan holds up to 7 days late, from 8 days the deposit plan wins" is a different ranking from the one the system recommends from.
6. VOI is computed only when the recommended id or decision differs between alternatives; the missing-anchor path never evaluates VOI at all. `analyse` raises `NeedsInput` and returns `needs_input` unconditionally. With DEMO-ASK and the invoice date set equal to the delivery date (both readings give `dep40`), the engine still returns `needs_input` with `voi.flips_decision = False` (exp4.py). 04 section 6 says the workflow proceeds in that case; the code and the state machine (03 section 4) do not.

Recommendation: (a) add a "sensitivity of the recommendation" pass over every `assumed` parameter (discount, lead days, downside and severe delay, close-call margin, deposit grid) at plus and minus a stated band, and surface "recommendation changes if discount is above X" as a first-class output (2 h); (b) show "profit given up for robustness" on every recommendation, and trigger E-CLOSE-CALL on a relative threshold or always when the top two differ on the required-resilience key (30 min); (c) make `ranking_by_delay` honour `meets_required_resilience`, or rename it "profit-first ranking by delay" and say so in the demo (30 min); (d) use a 5% or 1% deposit grid and report the minimum robust ask rather than a grid edge (30 min); (e) make the missing-anchor path run VOI and proceed when it does not flip, or fix the sentence in 04 section 6 (30 min).

---

## Finding 7. Likeliest demo and deliverable failures are unspecified or unreachable as written

Severity: medium-high. Cost: 4 to 6 h.

Attacked: 03 section 5 (`recorded` replay), 03 section 3.3, 04 section 11 (grounding), 05 section 4 (FX: "byte-identical canonical JSON"), 01 section 6.1 (nine scenes in five minutes), 02 section 8 item 2 (templates not read), 05 section 5 (self-assessment) [READ].

1. Recorded-miss behaviour is undefined (I searched 03 and ADR 0005: there is no rule for a key that is not in the recording). The default judge mode cannot process any document the team did not pre-record. A judge who uploads their own PO sees either an error or manual entry. Specify: miss means `live` if a key is configured, else `off` with a visible banner; and ship a one-paragraph "bring your own key" step.
2. Grounding requires the quote to occur literally in the extracted text. PDF text extraction breaks table cells and wraps lines; models re-flow whitespace. A literal match will mark many correct fields `conflicting`. Normalise whitespace and Unicode before matching, and test on the synthetic PDFs that `scripts/make_demo_pdfs.py` produces.
3. `FX-<case>` demands byte-identical canonical JSON, but 04 section 7 states the production `input_hash` covers the engine input only while the reference hashes the whole fixture file including `intent` (and with different JSON separators). The parity test cannot pass byte-for-byte. Compare modulo `input_hash` or define one hash in the reference.
4. The anchor expected output (MUST test FX-OF-02) includes `INV_ADV` plans, but REQ-16 lists "invoice-advance financing shape" as IF-TIME. Cutting it changes the counts (20 enumerated, 8 pruned, 6 rejected, 5 ranked), the five-row demo table and the byte parity, so it is not really optional.
5. Alerts A1, A2, A5, A6 are MUST (REQ-12) and shown at 1:10, but `reference_engine.py` contains no alert code (grep finds none), and A2 ("an outflow dated before the inflow that would fund it") has no definition of what "would fund it" means. 04's claim "every number in this document was produced by the reference calculation" does not cover alerts.
6. The 5-minute script has nine scenes of 20 to 60 seconds each, including a security scene and a scoreboard. Cut to four: DEMO-ASK, anchor trade-off with the delay slider, approval plus execution plus counter-offer replan, attack suite. Everything else goes in the deck.
7. The owner must supply the baseline cash events; neither the CSV template nor the entry UI is designed. For a Dhaka SME the 25 to 30 rows of payroll, rent, instalments and collections are the actual work, not the arithmetic. No upload sample, no column spec, no validation for coverage (the horizon extends 120 days past the last baseline event, with no payroll after the data ends; [RUN] exp9 shows no flip on OF-02 only because collections offset, but nothing warns when coverage ends).
8. The doc was written to become deliverable 1 without reading the official templates (02 section 8 item 2 is an open manual-check). Fetch them today: 30 minutes, and it can change the document structure.
9. 05 section 6.5 states "a reference run of the 22 cases plus the self-tests takes under 30 seconds (about 9 seconds for the case run)". On my machine, `reference_engine.py --check` took 21.6 s and `selftest.py` alone 57 s [RUN]. The claim is labelled `[I]`, but it is a performance statement the rules ask you not to make. Remove it or reproduce it.
10. E2E-FRESH ("clean machine, README only, docker compose up") covers `db`, `migrate`, `api` and `web` with a Next.js build; on a judge's Windows or low-memory machine this is the most likely point of failure and the only thing between the judge and every other deliverable. Rehearse it on a second machine on 17 Oct.

---

## Finding 8. Problem validation and differentiation: the honest verdict is undermined by the baselines and the input burden

Severity: medium-high (innovation 30%: "real-world value"). Cost: 3 to 4 h.

Attacked: 01 section 3 (cost of error unknown, no interview), 02 section 7 (verdict "thin to partly differentiated"), 05 section 6.4 [READ].

The authors are candid: no owner has been interviewed, and the differentiation verdict is explicitly "medium-low confidence because absence from about 25 pages is not proof". That candour is a strength. The weaknesses that remain:

1. What is claimed as the differentiator ("automatically generating, sizing and ranking changes to the order's commercial terms") is a loop over four user-supplied grids (deposit percent, extension days, loan amount per offer, defer). A spreadsheet data table does this for one order. The unique parts are the verified wiring to a sandbox executor and the safety layer, which sit in the other rubric dimension.
2. The value of the tool depends on a baseline that the owner would have to enter (finding 7.7). Nothing says the segment (10 to 50 staff, made-to-order B2B, Bangladesh) has structured AR/AP data, or that anyone would take the time.
3. The baselines in 05 section 6.4 (B0 profit-only, B1 reserve rule) are weak; B4 in finding 5 is the honest comparison and it nearly ties on the fixtures.
4. The "Net 45 with no start event" anchor (DEMO-ASK) is a good scene, but one that is the author's belief about how POs read in Bangladesh; no PO from that segment is cited.

Recommendation: three 15-minute conversations with an accountant, a printing or packaging owner and a finance student by 16 Oct; record answers verbatim in 01 section 3 (even "never asked this question" is a useful finding). Reword the pitch from "decision tool" to "verified negotiation planner with a safe executor" (the pivot already in 02 section 7), and add B4 and the finding-1 sensitivities to the evaluation section so the evidence cannot be dismissed as fixture-tuned.

---

## Finding 9. Lever semantics: stages is a no-op that becomes an artefact, defer has no dependency, loan sizing skips severe, same-day netting

Severity: medium. Cost: 1 h to cut, about 4 h to fix.

Attacked: 04 sections 3 and 4; `reference_engine.py` `receipt_schedule`, `financing_events`, `enumerate_strategies`, `Strategy.dependencies` [READ, RUN].

1. `stages > 1` can only delay receipts (stage `k` is anchored `k * gap` days after the first) while supplier cost timing is unchanged. For deposits-only and loan plans the lowest balance and profit are identical with 2 or 3 stages [RUN] exp1.py, so stage plans are always dominated and pruned, and no fixture has `stages > 1` (all are `[1]`). Its only effect is through `receivable_advance`, whose repayment date is "the last customer receipt": staging pushes repayment out and flips `dep30+ext30+INV_ADV@500k` from resilience 1 to 3. Enable stages `[1,2]` and DEMO-REPLY's recommendation becomes `dep30+ext30+stg2+fin:INV_ADV@500,000.00` [RUN]. Meanwhile the headline lists "staged delivery" as a lever. In the real world an advance would be repaid pro rata from the first stage; the engine rewards a repayment-timing artefact.
2. `defer_days` is listed in 04 section 4 as creating "customer, supplier" dependencies, but `Strategy.dependencies` returns `()` for a defer-only plan and `n_levers` counts it as one. A defer plan therefore ranks first on `independence_any` (exp4.py shows `deps = ()`).
3. Loan sizing keeps the smallest amount feasible in base and in downside, never in severe. With `required_scenario = severe` the engine can recommend a plan that fails the owner's requirement while a larger loan on the offer grid passes. In a small synthetic case (exp8.py) the engine recommends a loan of 350.00 (resilience 2, E-FRAGILE-BEST) while 750.00 reaches resilience 3 on the same grid.
4. Same-day outflow-first (M-10) also applies to a receivable advance repaid out of the very collection that funds it, and to a loan fee at draw: the repayment of `P` appears as a trough of `-P` before the receipt lands. Net-settling the advance on the collection day flips feasibility for **22 grid points** of `INV_ADV` on OF-02 (exp16.py). Real lenders net-settle, so the conservative rule discards feasible plans.
5. `max_financing_cost` is checked on the base-scenario cost only (`hard_ok` uses `res["financing_cost"]`), but 04 section 3 says the cost grows under delay for advances (22,500.00 in severe versus 17,500.00 base).
6. Offer `valid_until` and eligibility are "spec only, not exercised" (04 section 3), so the mock lender portal can accept an expired term sheet.

Recommendation: cut `stages`, `defer_days` and `receivable_advance` from the MVP and from FX-OF-02 (and re-render the worked example). If any is kept: size loans per required scenario, treat the advance repayment as netted against the collection on the same date, set defer's dependencies to customer and supplier, enforce the cost cap in every scenario and check `valid_until` in the gate.

---

## Finding 10. Number Verifier gives false assurance

Severity: medium. Cost: 2 to 3 h.

Attacked: 04 section 11, 05 TH-13, UT-VERIFY, 03 section 6 ("no figure outside the evaluation") [READ, RUN exp12.py].

The verifier tests membership of each number in one big set (every integer in the evaluation, in several formats), not that the number is bound to the right claim. Results with `OF-02`:

- "Plan dep40 earns 1,344,000.00 BDT with no financing cost" (the loan plan's profit attributed to the deposit plan): **passes**.
- "The first shortfall is on 2027-01-10" (a real date of another event): **passes**.
- "The lowest balance would be 740,000 BDT, above the reserve" (sign dropped): **passes** (the decimal form "740,000.00" is blocked only by accident of the formats in the allowed set).
- Spelled-out numbers in Bengali ("ত্রিশ") or Hindi ("तीस") and Roman numerals: **pass** (the word list is English only). The product targets Bangladesh.
- A URL or request for credentials ("confirm via http://... and send your bank login"): **passes** (no digits).
- A correct number in South Asian grouping (13,28,000.00) is **blocked** (false positive), so a Bangladeshi owner will often get the template fallback.

Recommendation: invert the control. The model returns text with named slots only (`{{profit:dep40}}`); code resolves slots; any digit in any script (Unicode category Nd), any number word in English, Bengali and Hindi, and any URL or `@` in model text is rejected. That is simpler than the current verifier and strictly stronger; keep the template fallback. Keep the existing verifier as a second check if time allows.

---

## Findings 11 to 20 (briefer)

| # | Finding | Evidence | Sev | Fix |
|---|---|---|---|---|
| 11 | Hash chain and RLS design conflict: a global `prev_hash` chain cannot be computed by an application role whose RLS hides other tenants' rows; concurrent inserts need serialisation; `DELETE /deals/{id}` conflicts with an FK from `operation_log`, `approval` and `sandbox_action` to `deal` plus a trigger that rejects `DELETE`. Postgres RLS does not apply to table owners and superusers (a single compose `POSTGRES_USER` would bypass it unless `FORCE ROW LEVEL SECURITY` and a non-owner role are used) [READ, INF] | 03 section 8.6, 04 sections 10.1 and 10.2, ADR 0004 | med | 2 h: per-tenant chain (`prev_hash` within `business_id`), advisory lock per tenant, no FK or `ON DELETE SET NULL` for the log, separate roles |
| 12 | "API container has no network route to anything outside the LLM allowlist" (03 section 8.3, SEC-T4) has no mechanism (default Docker egress is open); in `live` mode egress to the provider is required | 03 section 8.3, 05 SEC-T4 | med | 1 h: either an internal network with no egress in `recorded` and `off` mode, or drop the claim |
| 13 | `reconcile_ledger` is a tautology in the normal path: the sandbox posts the events the engine generated and then compares them with the engine's predicted path; it detects tampering (ST-RECON) but proves nothing about the world. After a stale re-plan the ledger still holds the old plan's entries, which do not equal the new "approved plan" path | 03 section 4.2, 8.5 | med | 1 h: state what it proves; compare against the approved action list; define behaviour after replan (finding 4e) |
| 14 | Duplicate-obligation check is only by `invoice_ref`; with the ref dropped, OF-17 yields `accept_as_is` and counts the 380,000.00 twice. It checks order costs against baseline only, not within a set [RUN] | 04 section 3, `validate_case` | med | 1 h: also match (amount, date window, supplier) and warn |
| 15 | Dominance pruning discards plans with strictly more robustness on the metric the system itself reports. In 9 fixtures, 33 (pruned, dominator) pairs have the pruned plan with greater delay tolerance or a higher lowest balance, for example OF-15 `dep20+fin:BANK_WC@500,000.00` tolerates 27 days versus 16 for the dominating `accept_as_is`, because "resilience" is only a 0 to 3 level on two stress points [RUN] exp18.py | 04 section 4 | low-med | 1 h: include tolerance and headroom in the dominance test, or do not prune when they differ |
| 16 | Independence of the oracle is overstated: `bruteforce_series` re-sums the same events produced by `build_events`, so it checks the 10-line sweep, not the event semantics (discounts, loan dates, certainty). RINA and PX-01 parameters were reconstructed or fitted (loan cost "derived as 3% plus 100 flat [I]"; R-04/R-05 lows overridden as errata) [READ] | 04 section 7, section 8, `fixtures/README.md` | low-med | 30 min: reword "independent"; have a teammate hand-compute two cases |
| 17 | E-CLOSE-CALL misses the tie case (equal profit, different dependencies: `0 < gap` is false) and compares only the top two plans; `ext_surcharge_bps` variants with the same `ext_days` collapse to one id and one is silently dropped | `analyse`, `enumerate_strategies` dedupe by `st.id` | low | 30 min |
| 18 | State machine gaps: `any -> NEEDS_CONFIRMATION` conflicts with the terminal states and with `EXECUTING` (edit mid-execution leaves partially executed actions; gate blocks the rest but state is undefined); stale drafts are not given a status (`sandbox_action.status` has no `voided`); `as_of` and approval expiry across midnight make an old evaluation fail `E-DATE-IN-PAST` | 03 section 4 | low-med | 1 h |
| 19 | Cross-reference and label slips: 04 section 10.2 sends the reader to "section 5 of 03" for deal states (they are in 03 section 4.1; section 5 is the stack); 04 section 2 defines the reserve as absolute while section 3 and the engine apply the relative form; "required resilience" reads as hard but is soft (finding 6); the 03 option matrix scores are `[A]` placeholders but drive an "Architecture decision" with a decimal-precision table (decision theatre; Option A is simply B minus the sandbox) | as listed | low | 30 min |
| 20 | `[W]` and `[UNV]` claims carry the budget and risk story: model name and price (Claude Haiku 5.5 at 0.10 and 0.50 per million tokens), 17,300 tokens per analysis, LangGraph advisories and version floors, 11 advisories, free-tier training terms. They matter little if the live model is only used to record once, but they should not be stated as fact | 03 section 5, section 7.2 | low | 30 min: re-label or delete |

---

## What is strong and should not be touched

- The structural security principle: the model has no tools, it is a function from untrusted text to typed JSON, only owner-confirmed typed fields reach the engine, and the engine never reads document text. Keep it. Only the evidence for it needs repair (finding 2).
- The financial core conventions: integer minor units, calendar dates, one rounding rule, same-day outflow first, strict `<` reserve, a counterfactual baseline that separates pre-existing breach from the order's effect, a linear delay scan justified by a demonstrated non-monotone case, and a deterministic escalation-code taxonomy. The reference runs end to end and its tests pass.
- Honest evidence discipline: every claim labelled, a "Not claimed" section, fixture tuning admitted, an explicit "thin to partly differentiated" verdict with a ready pivot, and the 05 section 7 unresolved-risk list. Do not "improve" the tone; repair the substance.
- `LLM_MODE` = `recorded` / `off` with a fully working no-LLM path, and the plan-hash plus input-version idea (once the hash covers the actions). Both make the demo deterministic and the evidence reproducible.
- The execution evidence idea: a tenant-scoped, hash-chained Operation Log that records blocked attempts as well as completions, exported with its head hash. It is cheap (about 30 lines) and maps directly to deliverables 5 and 6; keep it, and fix the multi-tenant details (finding 11).
- Reproducing and correcting the earlier documents (R-04, R-05, R-09, the PX-01 B+C boundary at 41 days). Finding errors in your own prior work is exactly the signal a judge wants.

---

## Things I could not verify

- Every `[W]` claim: competitor capabilities in 02, the competition rules and rubric text, model names and prices, library versions and advisories. I made no web access; I only checked internal consistency (and the date and timezone arithmetic).
- Whether the organisers provide the simulated environment or tool API, and how "dialogue efficiency" is scored. Finding 3 assumes a scripted or interactive evaluation; if scoring is only on the submitted recording the cost-benefit of finding 3 shifts toward the cheaper half.
- The repository itself (docker-compose, `web/`, `backend/`, existing ADRs). I judged only the design documents and fixtures, as instructed. In particular I did not check whether the compose Postgres user is a superuser (finding 11) or whether `LICENSES.md`, `.env.example`, and the architecture test exist.
- The contents of `_work/`, 06, README and BUILD-HANDOFF, which I was told not to read; if any of them already fixes a finding above (for example a recorded-miss rule), that finding downgrades.
- Real extraction quality: I ran no LLM and no PDF. The grounding brittleness in finding 7.2 is a risk inferred from how PDF text and model output usually behave, not a measurement.
- Absolute performance: my timings are for one Windows laptop and are only used to show the documents' timing sentence does not reproduce here.
- Whether judges will actually red-team through a chat box; finding 2's recommendation is hedged against both outcomes.

## Reproduction notes

Scratch scripts, all inside `C:/Users/moham/AppData/Local/Temp/claude/E--Order-Fit/a04cccd4-dc72-471d-b679-eef8d1f3e9a5/scratchpad/review_fixtures/`: exp1.py (stages, deposit-delay stress), exp2.py and exp3.py (deposit grid, discount sensitivity), exp4.py (VOI always asks, defer dependencies, ranking-by-delay), exp7.py and exp8.py (severe sizing), exp9.py (baseline coverage), exp10.py (AR delay and cost overrun), exp12.py (verifier bypasses), exp13.py and exp14.py (B0 and B1 recount, greedy ladder), exp15.py and exp16.py (advance same-day netting), exp17.py (lead and downside sensitivity), exp18.py (dominance pruning). Run as `python expN.py` in that folder.

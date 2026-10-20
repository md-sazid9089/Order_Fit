# OrderFit — FinTechathon demo-video context

> **Provider update (19 Oct 2026):** the current application now supports OpenAI
> as its only live model provider. FreeLLMPool has been removed from runtime
> configuration, application code, and dependencies. Its restored setup pages
> are marked retired, and its historical tests are skipped. The video
> captures and instructions below describe an earlier test setup using a
> FreeLLMPool-backed Mistral model; they are historical artifacts and must not be
> used to rehearse or narrate the current application. On 20 October 2026 the
> configured OpenAI model passed all 49 synthetic AI evaluation cases across the
> five proposal tasks. This verifies those proposal paths only; it is not persisted
> end-to-end, hosted, or production acceptance. `off`/`recorded` remain the
> provider-free modes.

> **What this file is for.** Claude Code uses it to plan, script, automate and narrate a
> **cinematic demo video of at most five minutes** for the Shenzhen International FinTech
> Competition / FinTechathon (theme: *AI as a Financial Participant*). The video is judged on
> **Task completion (40%)**, **Security & compliance (30%)** and **Innovation & interaction (30%)**.
>
> **Snapshot.** I inspected `main` at `0ec813b` ("create new deal creation pages supporting AI
> document intake and manual form inputs"), with a clean working tree, on 19 October 2026. Only this file
> was created. No application code, configuration, dependency or data was changed.
>
> **Evidence labels used throughout**
>
> | Label | Meaning |
> |---|---|
> | **Implemented** | Code exists on the enforcement path, and tests in the repository cover it. |
> | **Verified now** | I executed it during this inspection (see §0.2). |
> | **Repo-reported** | A checked-in report says it passed. I did not re-run it. |
> | **Simulated / sandbox** | It is implemented, but the effect is deliberately local and fictional. |
> | **Mock (UI-only)** | A screen that looks functional but does not call the backend. |
> | **Unverified** | No executed evidence is available. This includes live OpenAI quality. |

---

## 0. Read this first: the five facts that decide the video

1. **The newest "AI Document Intake (Auto)" screens are UI mocks. Do not film them as AI.**
   - What the page does: `web/app/deals/new/page.tsx` (default `intakeMode = "auto"`, lines 52–192) records only file
     *name, size and type*. **Load Sample Files** (`handleLoadDemo`, lines 109–144) fabricates file
     names such as `PO-8841_CustomerContract.pdf`. **Continue** writes a draft to `localStorage`
     and routes to `/deals/new/validate`.
   - What the validate step does: `web/app/deals/new/validate/page.tsx` shows **hard-coded USD values**: customer "Apex
     Retailers Inc", `$360,000`, four cost lines (lines 32–83). It computes profit and margin in the browser
     (lines 164–168). Its submit only `router.push("/deals")` (lines 170–197).
   - The consequences: no upload, no extraction, no AI call and no persistence happen on these two screens.
2. **The real, backend-wired path** consists of these screens:
   - `/deals/new` → **Manual Order Form** (a toggle button) → `/deals/[id]` (review, then **Confirm and evaluate**)
   - `/deals/[id]/documents` (real private upload, then **Extract values**)
   - `/deals/[id]/negotiate` (what-if, drafts, replies, approvals and sandbox execution)
   - `/audit-log`
3. **AI is a proposer, never a calculator or an approver.** These rules are architectural and are tested:
   - Every figure comes from the pure deterministic engine (`backend/orderfit/engine/`), and only through
     `backend/orderfit/agent/nodes/compute.py`.
   - Only `backend/orderfit/agent/llm.py` calls a model. `backend/tests/test_architecture.py` enforces both boundaries.
   - Model output becomes typed *proposals*. Each proposal is grounded against source quotes and confirmed by a person.
4. **OpenAI is the only live model provider; its synthetic proposal paths have now been exercised live.**
   - What exists: `LLM_MODE=live` uses the OpenAI **Responses API** with typed
     structured output (`client.responses.parse(..., text_format=..., store=False)`, `llm.py:451–503`).
   - The original 19 October inspection below did not run OpenAI. A follow-up on 20 October ran all 49 synthetic
     cases through live `gpt-6-luna`: extraction 13/13, what-if 16/16, replies 13/13, clause interpretation 4/4,
     and explanations 3/3, with zero unsafe proposal changes. See `docs/backend_implementation_progress.md`.
   - This is synthetic proposal-layer evidence only; no database-backed job flow, hosted setup or real customer
     document was tested. The recorded evaluation (`data/ai_workflow/report.json`) still replays *authored* outputs.
   - What the video must do: show real model output from the rehearsal stack, labelled honestly. The UI badge
     **"AI live · <model>"** does this for you.
5. **Every execution is sandbox-only.** No code path sends email, moves money, contacts a bank or contacts a
   lender (`backend/orderfit/workflow/execution.py` module docstring: "local simulation only, no external
   adapter"). Narrate it as a **"sandbox effect"**, never as a sent message or a payment.

### 0.1 Recommended story (one sentence)

*A small Bangladeshi manufacturer receives a large order. OrderFit's deterministic engine shows that
accepting it as offered would breach the owner's cash reserve. The owner asks the AI a what-if in plain
language ("what if the customer pays a 40% deposit?"). The AI converts the question into a typed scenario.
The engine recomputes it on an isolated fork. The owner approves an exact, hash-bound sandbox message
and commitment with password step-up. Every step lands in a tamper-evident audit chain.*

### 0.2 Checks executed during this inspection

| Check | Command (from repo root unless stated) | Result |
|---|---|---|
| Reference calculator, 22 fixture cases | `python -I docs/architecture/orderfit/fixtures/reference_engine.py --check` | **Verified now:** `cases=22 problems=0 calc_version=ref-0.1.0`, exit 0. `OF-02` → `accept_with_changes`, recommended `dep40`. |
| Provider-free backend suites | `backend/.venv/Scripts/python -m pytest tests/agent tests/engine tests/test_architecture.py tests/test_ai_eval.py tests/test_ai_advisory_pure.py tests/test_ai_workflow_pure.py tests/test_p6_pure.py tests/test_p5_pure.py tests/test_hardening_pure.py -q` | **Verified now:** 281 collected, all passed. One existing Starlette deprecation warning. |
| Docker daemon | `docker info` | **Not available** (daemon not running). Compose stack, PostgreSQL suites and browser E2E were **not** run. |
| Browser E2E (`web/tests/e2e/order-lifecycle.spec.ts`) | `./scripts/run-e2e.ps1` | **Repo-reported** for 17 Oct 2026 (`docs/hackathon-evidence/2026-10-17/`). It predates commit `0ec813b`; see §6.4 for the selector change. |
| Live OpenAI | `uv run --frozen python ../scripts/ai_eval.py --mode live --env-file .env --output ../var/ai-eval-live.json` (from `backend/`) | **Verified 20 Oct 2026:** 49/49 synthetic cases passed; live model output for all five proposal task types; zero unsafe changes. Not DB-backed or hosted. |

---

## 1. Product summary

| | |
|---|---|
| **Product** | OrderFit, an *order decision assistant* for small businesses (README, `docs/architecture/orderfit/`). |
| **User** | An owner or finance lead of a small manufacturer or trader, with optional team roles: `viewer`, `auditor`, `commercial_lead`, `risk_officer`, `owner`. |
| **Problem** | Accepting an order means paying suppliers and labour *before* the customer pays. A big order can push the business's cash below a safe reserve on specific days, even when the order is profitable. |
| **Input** | An opening cash balance, dated baseline cash events, a customer order (value, dates, payment terms), dated order costs, a cash reserve policy, optional term-loan offers, and optional source documents (text PDF, TXT, CSV, JSON). |
| **Output** | A persisted evaluation: day-by-day cash series for base, downside and severe scenarios; a hard-feasibility verdict per option; ranked alternatives (deposit, supplier extension, term-loan draw); a recommended option; a decision such as `accept_as_is`, `accept_with_changes` or `decline_or_renegotiate`; a delay-tolerance scan; alerts and review flags. |
| **Action** | Exact-term negotiation drafts, approved as hash-bound bundles, then executed **in the sandbox** (an outbox record, a commitment ledger record, compensation records). The outcome is a reviewed, auditable decision. No real money or message moves. |
| **Value** | "Can I afford this order, and what change makes it safe?", answered with deterministic, reproducible numbers. AI is used where language is the bottleneck: reading documents and replies, and turning a plain-language what-if into a typed change. People remain the authority. |

### 1.1 What the AI participant actually does

Every capability below is in `backend/orderfit/agent/llm.py`. Each one runs in the durable worker, outside any database transaction.

| Capability | Function | Trigger (UI) | Output | Safety envelope |
|---|---|---|---|---|
| Document fact extraction | `extract()` (516–526) → `_live()` → `ModelOutput` | `/deals/[id]/documents` → **Extract values** | Candidates per field, each with `exact_quote`, page and status (`extracted`, `ambiguous`, `missing`, `conflicting`) | Quote must ground in page text (`services/documents.quote_supports`); a mismatched quote is **dropped**. Injection-like quotes are downgraded to `ambiguous`. Conflicts across documents become `conflicting`. Each field needs human **Confirm against source**. (`workflow/extraction.py:run_extract`) |
| Natural-language what-if | `propose_intent()` (539–581) → `ModelIntent` | `/deals/[id]/negotiate` → "Ask a what-if" → **Propose and run language fork** | A typed change list, or one clarifying question | Supported kinds only. A clarification containing digits or injection text is rejected (`_safe_clarification`). Off or failed → deterministic regex fallback (`services/preparation.deterministic_intent`). The engine computes the fork. A fork changes no confirmed inputs until a person applies it, then confirms and re-evaluates. |
| Reply reading | `read_reply()` (590–653) → `ModelReplyReading` | Negotiate → **Save reply and propose candidates** | Typed terms, conditions, unsupported clauses, advisory stance | Every quote must appear verbatim in the reply. One fabricated quote or out-of-range value **invalidates the whole reading**. A model can never add acceptance; conditions remove acceptance (`services/preparation.py` merge logic, around lines 320–328). |
| Ambiguous-clause readings | `read_clause()` (666–708) | Negotiate → **Check the clause readings** | Up to four hypotheses (`payment_basis`, `payment_days`, quote) | Each reading is evaluated by the engine on an isolated copy. The owner is asked only if the recommendation would change. |
| Explanation wording | `explain_slots()` (715–750) | Negotiate → **Ask AI to word this explanation** | Sentences with `{slot}` placeholders only | Numbers, terms and unsupported claims are discarded (`services/explanations.problems`). The template remains otherwise. |

**What the AI never does** (stated in `docs/ai_capability_status.md` and enforced by the routes): calculate
authoritative figures, edit confirmed inputs, choose recipients, approve bundles, execute effects or move money.
Negotiation message bodies are **deterministic exact-term templates** (`services/preparation.term_lines`,
`draft_text`), not generative drafts.

### 1.2 Who does what

| Step | Initiated by the user | Done autonomously by the system |
|---|---|---|
| Baseline, order and costs entry | ✅ | — |
| Document upload | ✅ | Private storage by content hash; text-layer parse |
| Extraction | ✅ clicks Extract | Worker calls the model, grounds quotes and stores candidates |
| Confirmation | ✅ confirms snapshot hash and acknowledges warnings | Builds the immutable confirmed-input snapshot |
| Evaluation | ✅ clicks Confirm and evaluate | Durable job: engine enumerates strategies, scenarios, tolerance and ranking, then persists the result |
| What-if | ✅ types a question | Model → typed change → engine fork → comparison |
| Draft | ✅ chooses option and enters recipient | Exact template; recipient domain checked against known customer domains |
| Approval | ✅ password step-up and approve | Server re-checks hash, versions, expiry, role and session |
| Execution | ✅ Execute in sandbox | One idempotent run per bundle; sandbox effect plus audit |
| Reply | ✅ pastes reply | Deterministic parser plus optional model reading; flags for conditions, bank changes and injection |

### 1.3 Launch and third-party requirements

- **Local stack:** Docker Compose with PostgreSQL 17, a migrate job, a FastAPI API, a separate worker and a Next.js 16 web proxy
  (`docker-compose.yml`). Alternatively, the explicit launcher `python -m orderfit.runtime api|worker` against a
  configured database (README "Run locally").
- **Required secrets** (names only): `SESSION_SECRET`, `ACCOUNT_FINGERPRINT_KEY`, the database URLs and the runtime login
  passwords. See §5.
- **OpenAI** (optional, planned for the demo): `LLM_MODE=live`, `OPENAI_API_KEY`,
  `OPENAI_MODEL`. Startup **fails closed** if live mode lacks a key or model
  (`backend/orderfit/contracts/configuration.py:157–163`).
- **Not needed:** a bank, payment, lender or email provider. Resend email is off by default and is not part of this demo.
- **Status on this machine:** the Docker daemon was not running, so a launch was **not verified** during this inspection.

---

## 2. Competition positioning

| Theme / criterion | How OrderFit fits (verified) | Strongest proof to show |
|---|---|---|
| *AI as a Financial Participant* | AI acts as a **bounded financial analyst's assistant**. It reads financial documents and replies, translates intent into typed scenarios and proposes facts. A deterministic engine and human approval hold all financial authority. This is a deliberate safety design: "AI participates; it does not decide money." | The provenance badges ("AI live · model" vs "Template") next to engine-computed comparisons |
| Task completion (40%) | A complete persisted workflow: inputs → confirmed snapshot → engine evaluation → option comparison → exact draft → approved sandbox send → reply → owner-attested acceptance → approved sandbox **commit** with settlement projection → optional approved compensation | `order-lifecycle.spec.ts` covers this end-to-end (repo-reported pass on 17 Oct) |
| Security & compliance (30%) | Role permissions at the DB-transaction boundary, tenant isolation, password step-up bound to the exact bundle hash, expiry and staleness re-checks, idempotent single execution, negotiation-round cap, injection and bank-change flags, append-only hash-chained audit | No **Execute** button before approval; rejection of a conditional reply as acceptance; the audit log with row and previous hashes; a verifier that detects tampering |
| Innovation & interaction (30%) | Plain-language what-if becomes a typed scenario, which the engine recomputes on an isolated fork. Quote-grounded extraction. An "ask only if it matters" clause analysis. Honest AI provenance. | The live what-if comparison table, and an unsafe or ambiguous request that returns "The assistant needs clarification and ran nothing" |

---

## 3. Task completion (40%): the strongest end-to-end workflow

### 3.1 Two tiers. Pick based on rehearsal results.

- **Tier A, verified path.** Use the exact inputs of `web/tests/e2e/order-lifecycle.spec.ts` (repo-reported
  passing). It is simple: the order is feasible as offered, and the evaluation recommends accepting it.
  Expected facts are documented in `docs/hackathon_demo_runbook.md` for revenue `5000000` minor
  BDT with no costs: profit BDT 50,000.00, baseline cash BDT 100,000.00, final cash BDT 150,000.00.
- **Tier B, recommended story.** Add a reserve and order costs, so that accept-as-is breaches the reserve. Then use the
  AI what-if to explore a deposit. This is far more compelling, but **this exact input set has not been
  executed**. Rehearse it once, record the real engine outputs from the screen, and narrate only those.
  If the outcome differs from the hypothesis below, change the narration, not the numbers.

### 3.2 Tier B demo data (fictional, deterministic)

All money is **integer minor units of BDT** (1 BDT = 100 minor). Use dates relative to the recording day,
because bundles expire against real server time and the as-of date must be explicit. `D` is the as-of date.

| Item | Value | Where entered |
|---|---|---|
| Business | "Synthetic Demo Textiles Ltd", owner "Synthetic Demo Owner", email `owner-demo@example.invalid` | `/auth/signup` |
| Opening cash | `10000000` (BDT 100,000.00) on `D`, coverage through `D+365`, attestation "Synthetic demo baseline" | `/deals/new` (Manual) or `/deals/sources` |
| Cash reserve policy | `6000000` (BDT 60,000.00) | `/deals/sources` → "Default policy and eligible financing" → **Save new default policy** |
| Baseline events (optional) | `D+20` payroll out `2500000`, confirmed; `D+25` ar_collection in `3000000`, expected | `/deals/sources` → **Add baseline event** |
| Customer | "Synthetic Demo Buyer", domain `buyer.test` | Order form |
| Order | ref `DEMO-001`, order date `D`, delivery `D+30`, invoice `D+30`, value `20000000` (BDT 200,000.00), payment basis delivery, **45** payment days | Order form |
| Costs | "Fabric supplier quote SQ-1": supplier_payment `8000000` on `D+14` (tick "Supplier extension may be considered"); "Stitching labour": labour `2000000` on `D+28` | Order form → **Add cost** |
| What-if question | `deposit 40%` (the deterministic fallback also understands this) or, with OpenAI, "What if the buyer pays a forty percent deposit up front?" | Negotiate → "Ask a what-if" |
| Recipient | `purchasing@buyer.test` | Negotiate → "Exact recipient email" |
| Exact acceptance reply | `Synthetic buyer: I accept the exact proposed terms.` | Negotiate → "Record an incoming reply" |
| Conditional reply (blocked demo) | `Synthetic buyer accepts the exact proposed terms. No terms changed.` (rejected as exact acceptance, verified by E2E) or `We accept, subject to board approval.` | Same |

**Hypothesis (unverified):** with the default stress scenarios (downside: order receipt +15 days, AR +5 days;
severe: +45 days, +15 days, +300 bps cost overrun; see `backend/migrations/sql/0001_core_schema.sql`
`owner_constraints` defaults), accept-as-is dips below the reserve after the `D+14` supplier payment,
because the customer pays at `D+75`. The decision should not be `accept_as_is`. Only the engine decides.

> ⚠️ **Policy limitation that shapes Tier B.** A new business's default policy is created by
> `owner_provision` (`backend/migrations/sql/0005_backend_foundation.sql`, around lines 266–283) with
> `deposit_pcts:[0]`, a zero-day extension only, no offers, and reserve 0. The `/deals/sources` policy form
> edits only the reserve and the eligible offers ("Deposit, extension and stress settings are preserved"). So the
> **canonical** evaluation can only suggest financing (if you add a term-loan offer) or decline. A deposit enters the story
> through the **what-if fork**: a `deposit_pct` change sets `strategy_space.deposit_pcts=[value]` in the fork
> (`services/preparation.py` around line 39). The owner then clicks **Apply fork for confirmation**, then
> **Confirm and evaluate**, so the canonical result includes that deposit. That is the honest causal chain.
>
> Optional financing branch: add a lender and a term-loan offer under `/deals/sources`, then tick it in the
> policy. A *commit* bundle that includes financing requires a verified lender payee account
> (`PAYEE_ACCOUNT_UNVERIFIED` in `services/bundles.py:_commit_items`). Avoid financing in the commit
> segment unless the payee is verified on `/payees` and the step has been rehearsed.

### 3.3 Exact workflow (executable order)

| # | Workflow stage | Screen / route | User action (exact UI text) | System behaviour / API | Classification | Observable evidence |
|---|---|---|---|---|---|---|
| 0 | Initial state | `/auth/signup` | Fill "Full name", "Business / Company name", "Email", "Password (min. 12 characters)"; click **Create account** | Owner, business, membership and default policy provisioned; audit row `owner_provision` | Persisted | Redirect to `/deals`, "Search orders" textbox |
| 1 | Input: baseline | `/deals/new` → click **Manual Order Form** | "Opening date", "Opening cash (integer minor units)", "Coverage through", "Source attestation" → **Save baseline** | `PATCH /api/v1/businesses/{b}/baseline` with expected versions | Persisted | Heading "Order details" appears |
| 1b | Input: policy and events (Tier B) | `/deals/sources` | Set "Cash reserve (minor units)" → **Save new default policy**; add events with **Add baseline event** | New immutable policy version (append-only table) | Persisted | Saved events listed |
| 2 | Input: order | `/deals/new` (Manual) | "Order reference", "As-of/start date", "New customer name", "Known customer email domains (comma separated)", "Order date", "Delivery date", "Invoice date", "Order amount (integer minor units)", "Cash reserve (integer minor units)", "Payment days", **Add cost** … → **Save and review** | `POST /customers`, `POST /deals` (Idempotency-Key), `PATCH /deals/{id}` | Persisted draft | Route `/deals/{id}`, heading = order ref |
| 2b | Optional AI intake | `/deals/{id}/documents` | Choose file ("Document file") → **Upload** → **Extract values** → **Confirm against source** per field | Private upload; `POST .../extract` → durable operation → OpenAI extraction → grounded candidates | **Proposal** → human-confirmed fact | "Document stored privately."; candidates with quote, page and "AI live · <model>" badge. With AI off: "Automatic extraction is unavailable. Enter the values manually." |
| 3 | Confirm and compute | `/deals/{id}` | Acknowledge non-blocking warnings → **Confirm and evaluate** | `POST /deals/{id}/confirm` (snapshot hash, field IDs) → `POST /deals/{id}/evaluations` → 202 operation → worker runs the engine | **Recommendation** (deterministic, persisted) | "Saved evaluation operation: succeeded", "Saved state · awaiting approval", heading **Persisted evaluation**, "<decision> · calculator <version>", Decision guide, evaluation inspector, daily cash series |
| 4 | AI what-if | `/deals/{id}/negotiate` | "Ask a what-if" → **Propose and run language fork** | `POST /deals/{id}/whatifs` with `instruction` → operation → `propose_intent` → engine fork | **Proposal** + deterministic comparison; nothing changes | "Saved what-if comparisons": Fork card with provenance badge, `changes` JSON, Source vs Fork table (Decision, Recommendation, As-offered profit) |
| 5 | Adopt the change | Same | **Apply fork for confirmation** → back to `/deals/{id}` → **Confirm and evaluate** (or **Re-evaluate**) | `POST /whatifs/{id}/apply`; fresh confirmation and evaluation | Recommendation (new) | New persisted evaluation; the previous one is superseded |
| 6 | Compare and explain | Negotiate → "Compare evaluated options" | Pick an option; optionally **Ask AI to word this explanation** | Engine-backed catalogue; slot-only wording | Recommendation context | "hard feasible / fails hard constraints · profit … minor units"; explanation provenance badge |
| 7 | Proposed action | Negotiate → "Prepare an exact message" | "Exact recipient email" → **Prepare draft** → "Review attestation" → **Record exact preparation review** | Exact-term template; domain must match known customer domains | **Proposed financial action** | Message card "customer · revision 1 · reviewed", "Preparation <hash>" |
| 8 | Awaiting approval | "1. Send bundle" panel | **Prepare send bundle** | `POST /deals/{id}/bundles` → immutable manifest (`sandbox: true`), SHA-256 hash, expiry | **Action awaiting approval** | Bundle hash and expiry visible; **no** "Execute in sandbox" button yet |
| 9 | Human approval | Same | "Password" → **Re-authenticate and approve this exact bundle** | `POST /auth/step-up` (grant ≤ 5 minutes, bound to user, session, bundle hash and purpose) → `POST /bundles/{id}/approvals` | Approved | Execute button appears |
| 10 | Simulated execution | Same | **Execute in sandbox** | `POST /bundles/{id}/execute` → 202; worker writes `sandbox_effect` + outbox + audit | **Simulated execution** | "Run succeeded", "1 completed · 0 pending · 0 failed of 1", "sandbox outbox record · payload", "Order status: awaiting_reply · negotiation round 1" |
| 11 | Counterparty reply | Message card → "Record an incoming reply to this ask" | Paste exact acceptance → **Save reply and propose candidates** | Deterministic parse + optional `read_reply` (OpenAI) | Proposal | Reply card with provenance badge and quoted candidates |
| 12 | Party acceptance | "Record exact-term party acceptance evidence" | "Acceptance attestation", "Valid until (your local time)", "Supporting reply, if any" → **Record party attestation** | Requires an exact unconditional acceptance phrase | Human attestation (not legal acceptance) | Acceptance listed with "Terms <hash>" |
| 13 | Commit | "2. Commit bundle" | **Prepare commit bundle** → password → approve → **Execute in sandbox** | Serialized per-business commitment gate; settlement projected into the baseline | **Simulated execution → verified, persisted outcome** | "Run succeeded", "Settled (commit)", "This order is committed"; reload shows the same state (no duplicate) |
| 14 | Evidence | `/deals/{id}` and `/audit-log` | **Download decision and audit evidence**; `/audit-log` → **Download audit export** | Decision export (evaluation + snapshot + audit head); canonical PostgreSQL chain export | Verified persisted evidence | Operation log rows: `#seq`, action, outcome, actor, **Row hash / Previous hash** |
| 15 | Optional reversal | "3. Compensation" | "Original run" → tick items → "Reason (10+ characters)" → **Prepare compensation bundle** → approve → execute | Separate approved inverse records; original history preserved | Simulated | "inverse sandbox effect · payload", "Settled (compensate)" |

**Final financial outcome to narrate:**
- *"A persisted, reproducible recommendation and an approved, recorded sandbox commitment for this order."*
- Use the actual decision, profit and headroom figures shown on the **Persisted evaluation** screen.
- Never say "payment sent", "loan drawn" or "email delivered".

### 3.4 Why it is useful

The owner learns, before committing cash, whether and on which day the order would break the reserve.
The owner also sees which change fixes it, how robust the fix is under stress, and has an exact, approved, auditable
record of what was proposed and agreed. The workflow is repeatable: the same inputs produce the same engine result
(integer money, pure engine, versioned calculator, ADR 0001/0002).

---

## 4. Security & compliance (30%)

Status per control:
- **Implemented** = code on the enforcement path plus tests.
- **Partial** = implemented with a stated gap.
- **Planned/absent** = not present.

### A. Permission controls

| Control | Status | Where | Evidence | Safe demo | Limits |
|---|---|---|---|---|---|
| Authentication (opaque HttpOnly SameSite-Strict session, CSRF, Argon2id, rate limits) | Implemented | `services/identity.py`, `api/deps.py`, `contracts/configuration.py` (`auth_account_limit`) | `tests/db/test_session_authority.py`, `test_security_hardening.py` (DB suites, repo-reported) | Signup/sign-in; `/admin` as a normal owner redirects to `/deals` (E2E asserts this) | Password-only by default; passkey MFA is optional |
| Role permissions | Implemented | `contracts/protocol.py` `PERMISSIONS`: read / audit / prepare / execute / manage_finance / manage_members; enforced in `store/db.py` `Database.tenant()` (lines ~201–232: non-member → **404**, wrong role → **403**) | Route-level `tenant(..., "execute")` in `api/routes/bundles.py`; `tests/test_admin_security_rbac.py` | Invite a `commercial_lead`: that user can prepare, but the bundle view offers only `view_details` (`services/bundles.bundle_view`) and approve/execute return 403 | Membership invitations by email are off by default; use the manual invitation flow |
| Tenant isolation | Implemented | Transaction-local `app.business_id`, PostgreSQL FORCE RLS, restricted non-owner runtime logins | `docs/security/hackathon-security-matrix-2026-10-17.md` (hosted run: cross-tenant → 404) — repo-reported | A second synthetic account opens the first account's deal URL → not found | Hosted controls are repo-reported only |
| AI/tool permissions | Implemented | Only `agent/llm.py` imports OpenAI; outputs are typed proposals; no AI route can approve or execute | `tests/test_architecture.py`, `tests/agent/test_hackathon_ai_boundaries.py` (**verified now**) | Show the "AI live" badge next to the "Apply…"/"Confirm…" buttons a human must press | Prompt-injection regexes are defence in depth only |
| Read vs write | Implemented | Reads use `tenant(..., "read")`; every mutation needs Idempotency-Key + expected versions | `api/routes/bundles.py` `idempotent()` | — | — |

### B. Risk limits

| Control | Status | Where | Safe demo | Limits |
|---|---|---|---|---|
| Cash-reserve hard constraint on **every day**, scenario stress, delay tolerance | Implemented (deterministic) | `engine/` (`analyse`, `stress`, `tolerance`); `owner_constraints` | Persisted evaluation shows "fails hard constraints" for unsafe options | It is a business-risk limit, not a per-transaction spending cap |
| Per-action amount / spending limit | **Absent** as a separate control | — | Do not claim it. The equivalent is "every amount comes from a hard-feasible engine option inside an exact bundle." | — |
| Negotiation-round cap (≤ 3) | Implemented | `services/bundles.prepare` → `NEGOTIATION_ROUND_LIMIT`; `services/execution._round_limit` | Status line "negotiation round N" | Hard to show in under five minutes |
| Bundle expiry, stale inputs, blockers | Implemented | `bundles.prepare` (`BUNDLE_EXPIRED`, `UNRESOLVED_BLOCKERS`, `STRATEGY_MISMATCH`); `decide` (`STALE_BUNDLE`) | Edit saved inputs after preparing a bundle → the bundle becomes stale and cannot be approved | — |
| Repeated actions | Implemented | One run per bundle (`services/execution.admit`); idempotent replay; E2E injects a lost execute response and recovers the same run | Double-click or reload → same run, no duplicate effect | — |
| Input bounds | Implemented | Uploads ≤ 25 MiB; extraction ≤ 100,000 chars and ≤ 20 pages (`workflow/extraction.py`); prompt-size cap and provider timeouts (`llm.py`) | — | — |
| What-if value bounds | Implemented | `WHATIF_BOUNDS` (`web/lib/p7-model.ts`) plus server contracts | Invalid value → inline alert | — |

### C. Human approval

| Aspect | Implementation | Evidence |
|---|---|---|
| When required | Every outgoing sandbox effect: `send_message`, `commit_plan`, `compensate`. Separate bundle and approval for each kind. | `api/routes/bundles.py`; `services/bundles.py` |
| What the approver sees | Bundle manifest (kind, strategy, items, recipient, terms, expiry, `sandbox: true`), bundle hash, stale reasons | `BundleView`; `web/components/approval/*` |
| Step-up | Password re-authentication creates a grant bound to user, session, bundle ID, purpose and hash, lasting ≤ 5 minutes | `services/identity.step_up` (~400–447) |
| Approve / reject / revoke | `decide()` checks the hash (`hmac.compare_digest`), versions, grant, already-decided state and staleness. `revoke()` is a fail-safe brake before execution. | `services/bundles.py:392–479` |
| Re-validation at execution | `execution.admit()` re-locks scope, re-checks versions, hash, approval and its staleness or revocation, kind conditions and unresolved runs | `services/execution.py:98–165` |
| Bypass paths | None found. Execute requires `approval_id` for the same bundle. The DB enforces append-only approvals (`approval_append_only` trigger, `0002_integrity_and_audit.sql`). | — |
| Timeout | Bundle and grant expiry use real server time; a technical failure is shown as "a technical result, not a financial rejection" | `preparation-workspace.tsx` line 252 |
| Limitation | Password step-up is not MFA. A user with passkey MFA enforced gets `STEP_UP_UNAVAILABLE` (`identity.py`). **Do not enrol a passkey on the presenter account.** | — |

### D. Auditability

| Aspect | Status / evidence |
|---|---|
| Structure | `operation_log` rows: `seq`, actor, action, outcome, payload, `prev_hash`, `row_hash`. Canonical text comes from PostgreSQL `operation_log_canonical()`. |
| Events | `owner_provision`, `prepare_action_bundle`, `approve_action_bundle` / `reject_action_bundle`, `revoke_approval`, `execution_admit`, `execution_resume`, `sandbox_effect`, `extraction_completed` / `extraction_unavailable`, `decision.export`, `cash.export`, `csv_preview`, … (grep `append_audit`) |
| Persistence | Written in the same transaction as the mutation; append-only and TRUNCATE-blocking triggers (`backend/migrations/sql/0002_integrity_and_audit.sql`) |
| Alteration | Runtime roles cannot update or delete. However, **there is no external anchor**: someone with full database control could rewrite history and recompute the hashes. The UI says so on `/audit-log`. |
| Verification | `services/exports.verify_audit_export` detects content, link, scope, sequence and head tampering (`tests/db/test_p3_exports.py`). **There is no "Verify" button in the UI.** To show verification, run the snippet in §7.3 on the downloaded export. |
| Decision export | `decision-export.v1` contains the snapshot, the evaluation and the audit head. Its own limitation text: "contains a manual evaluation, not approval or sandbox execution evidence." |

### E. Additional verified safeguards

| Safeguard | Where | Demo value |
|---|---|---|
| Quote-grounded extraction; fabricated quotes dropped | `workflow/extraction.py` (`quote_supports` → `continue`) | High (with OpenAI) |
| Conditional or inexact reply ≠ acceptance | `services/preparation.has_exact_acceptance`, `_qualified`; E2E asserts the alert "exact proposed terms" | **High, verified by E2E** |
| Bank-change detection blocks dispatch | Reply card: "Bank-change blocker: separate verification required. Dispatch is blocked." | High (paste "please pay to our new bank account …"; rehearse first) |
| Prompt-injection flag | `agent/guards/injection.py`; reply card disables Apply when flagged | Medium |
| Number guard on AI text | `agent/guards/numbers.py`; `explanations.problems` | Explain verbally |
| Secrets server-only; never logged | `OPENAI_API_KEY` is a `SecretStr`; `store=False` on OpenAI calls | Narrate only |
| CSP nonce, security headers | `web/lib/security-policy.ts`, `web/proxy.ts`, `web/tests/e2e/security-csp.spec.ts` | Low for video |
| CSV formula-injection guard | `services/exports.csv_cell` | Low |

### 4.1 Best blocked or rejected moments (all genuinely supported)

1. **No Execute before approval.** The send-bundle panel has no "Execute in sandbox" button until step-up approval (E2E asserts `toHaveCount(0)`).
2. **Conditional reply refused as acceptance.** Recording party acceptance against `Synthetic buyer accepts the exact proposed terms. No terms changed.` shows an alert matching /exact proposed terms/ and "No recorded acceptances." (E2E verified).
3. **Wrong password at step-up** → `INVALID_CREDENTIALS`, and no grant is created (`identity.step_up`). *Rehearse to capture the exact UI text.*
4. **AI asked for something unsupported**, for example "deposit 40% and also wire the supplier a loan". The model must return a clarification. The fork card shows *"The assistant needs clarification and ran nothing: …"*. With AI off, the deterministic fallback returns no changes. *Live behaviour is unverified; rehearse.*
5. **Cross-tenant URL** → not found (404 concealment; repo-reported hosted evidence).

---

## 5. Demo environment

### 5.1 Environment variables (names only; never print values)

Root `.env` for Compose (template in `.env.example`; a local `backend/.env` exists, is git-ignored, and **must not be printed**):

- Database: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `DATABASE_URL_DIRECT`, `WORKER_DATABASE_URL`, `RUNTIME_LOGIN`, `RUNTIME_PASSWORD`, `WORKER_LOGIN`, `WORKER_PASSWORD`
- Auth: `SESSION_SECRET`, `ACCOUNT_FINGERPRINT_KEY`, `ACCOUNT_FINGERPRINT_KEY_VERSION`, `COOKIE_SECURE`, `TRUSTED_PROXY_IPS`, `AUTH_ACCOUNT_LIMIT`, `AUTH_SOURCE_LIMIT`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`
- AI: `LLM_MODE` (`off` | `recorded` | `live`), `OPENAI_API_KEY`, `OPENAI_MODEL`, `LLM_RECORDINGS_DIR`. Provider bounds are also configurable in `contracts/configuration.py`: timeout ≤ 30 s, concurrency ≤ 2, max output tokens, attempts ≤ 3.
- Storage and uploads: `DOCUMENT_STORAGE_BACKEND`, `DOCUMENT_DIR`, `DOCUMENT_S3_*`, `UPLOAD_CONCURRENCY`, `UPLOAD_SOURCE_CONCURRENCY`, `UPLOAD_BODY_TIMEOUT_SECONDS`, `UPLOAD_IDLE_TIMEOUT_SECONDS`
- Web: `WEB_PORT`, `NEXT_PUBLIC_API_URL` (leave empty), `API_INTERNAL_URL`
- Keep off: `EXPOSE_API_DOCS`, all `ACCOUNT_EMAIL_*`, `EMAIL_VERIFICATION_ENABLED`, `PASSWORD_RECOVERY_ENABLED`, `INVITATION_EMAIL_ENABLED`, `RESEND_*`

### 5.2 Run commands

**Option 1: disposable verified stack (AI off).** Best for Tier A and for security shots.

```powershell
./scripts/run-e2e.ps1 -TestPattern '^(?!.*HTTP bursts).*' -EvidenceDirectory 'E:\Order_Fit\var\hackathon-browser' -BrowserReviewGate 'E:\Order_Fit\var\hackathon-review.json'
```

The runner builds unique images, provisions restricted logins, runs the E2E tests, then keeps the stack up
until you delete the gate file. **It hard-codes `LLM_MODE=off`** (`scripts/run-e2e.ps1` line 69), so it cannot show OpenAI.

**Option 2: Compose with OpenAI live** (for the AI segments). Set the `.env` names above, including
`LLM_MODE=live`, `OPENAI_API_KEY` and `OPENAI_MODEL`. Use a **disposable** local database.

```bash
docker compose build api
```

```bash
docker compose --profile setup run --rm provision
```

```bash
docker compose up --build
```

The web app is at `http://localhost:3000` (or `WEB_PORT`); health is at `http://localhost:3000/api/health` (expect `connected: true`, `ready: true`).
Both `api` and `worker` receive the `LLM_*` and `OPENAI_*` variables (`docker-compose.yml` lines 95–101 and 150–157).

**Reset:** `docker compose down -v` deletes the `pg-data` and `documents` volumes, but only on a disposable stack. Never run it against a shared database.
With Option 1, rerun the script for a clean reset.

### 5.3 Pre-recording gates (must pass, otherwise change the script)

1. Health is ready.
2. With live OpenAI, one extraction on the synthetic order document shows candidates with "AI live · <model>". If it shows "Automatic extraction is unavailable", the provider is not working. Do not fake it.
3. One language what-if shows a fork with an "AI live" badge, not "Template". "Template" means fallback.
4. Tier B evaluation numbers are captured from the screen and pasted into the narration.
5. Bundles are executed within the expiry window. Re-prepare if a bundle expires.

### 5.4 Synthetic documents (no real data)

Sources for documents:
- `data/ai_workflow/synthetic_order.txt`: a synthetic PO for BDT 1,000.00, 30 days after invoice.
- An in-test text-layer PDF generator in `web/tests/e2e/document-upload.spec.ts` (`syntheticOrderPdf`).

For Tier B, create a TXT with the same structure and Tier B values, for example "Order value: BDT 200,000.00 … Payment is due 45 calendar days after delivery."
`scripts/seed_demo.py` and `data/demo/rina_business.json` are **stubs** (the JSON is empty). Do not rely on them.

---

## 6. Automation guide (Playwright)

### 6.1 Basics

- Base URL: `E2E_BASE_URL` (default `http://127.0.0.1:3000`, `web/playwright.config.ts`). Desktop Chrome.
- The app has **no `data-testid` attributes** (one `data-slot="skeleton-dashboard"`). Use role, label and text locators, as the existing specs do.
- Copy flows from `web/tests/e2e/order-lifecycle.spec.ts` (the full lifecycle) and `document-upload.spec.ts` (upload and extraction).
- Provenance: `[data-provenance="live"]` / `[data-ai="true"]` on `ProvenanceBadge` (`web/components/provenance-badge.tsx`) is the most reliable selector for "AI produced this".

### 6.2 Key selectors

| Step | Locator |
|---|---|
| Signup | `getByLabel("Full name", {exact:true})`, `getByLabel("Business / Company name", {exact:true})`, `getByLabel("Email", {exact:true})`, `getByLabel("Password (min. 12 characters)", {exact:true})`, `getByRole("button",{name:"Create account"})` |
| Manual mode (**new**) | `getByRole("button", { name: "Manual Order Form" })`. Required since `0ec813b` because the page defaults to the Auto mock. |
| Baseline | `getByLabel("Opening date")`, `getByLabel("Opening cash (integer minor units)")`, `getByLabel("Coverage through")`, `getByLabel("Source attestation")`, button "Save baseline" |
| Order | `getByLabel("Order reference")`, `getByLabel("As-of/start date")`, `getByLabel("New customer name")`, `getByLabel("Known customer email domains (comma separated)")`, `getByRole("textbox",{name:"Order date"})`, `getByLabel("Delivery date")`, `getByLabel("Invoice date")`, `getByLabel("Order amount (integer minor units)")`, `getByLabel("Payment days")`, button "Add cost", button "Save and review" |
| Evaluate | button "Confirm and evaluate"; wait for `getByText(/Saved evaluation operation: succeeded/i)` (timeout 30 s) and heading "Persisted evaluation" |
| Negotiate | link "What-if and negotiation preparation"; heading /Negotiation preparation/ |
| What-if | `getByPlaceholder("deposit 30% or customer delay 15 days")`, button "Propose and run language fork"; typed: label "Change", button "Run typed fork"; result: heading "Saved what-if comparisons", button "Apply fork for confirmation" |
| Draft | `getByLabel("Exact recipient email")`, button "Prepare draft", `getByLabel("Review attestation",{exact:true})`, button "Record exact preparation review" |
| Bundles | `section` filtered by heading "1. Send bundle" / "2. Commit bundle" / "3. Compensation"; buttons "Prepare send bundle", "Prepare commit bundle", "Prepare compensation bundle"; inside a panel `getByLabel("Password",{exact:true})`, "Re-authenticate and approve this exact bundle", "Execute in sandbox", "Refresh bundle state"; success text "Run succeeded" |
| Reply | `getByText("Record an incoming reply to this ask",{exact:true})` (a `<summary>`), `getByLabel("Original reply text")`, button "Save reply and propose candidates" |
| Acceptance | `getByText("Record exact-term party acceptance evidence",{exact:true})`, `getByLabel("Acceptance attestation")`, `getByLabel("Valid until (your local time)")`, `getByLabel("Supporting reply, if any")`, button "Record party attestation" |
| Documents | `/deals/{id}/documents?businessId=…`; `getByLabel("Document file")`, button "Upload" (wait until enabled), text "Document stored privately.", button "Extract values", button "Confirm against source" |
| Audit | `/audit-log`; heading "Operation log"; button "Download audit export" |

### 6.3 Expected state transitions

- Deal status values: `ingesting` → `awaiting_confirm` → `computing` → `awaiting_approval` → (send) `awaiting_reply` → … → `committed` (`contracts/protocol.STATE_EDGES`).
- Operations: `queued` → `running` → `succeeded` | `failed` | blocked result. Poll `GET /api/v1/businesses/{b}/operations/{op}`. A blocked result is "needs input", not a financial rejection.

### 6.4 Known automation pitfalls

- `order-lifecycle.spec.ts` and `document-upload.spec.ts` click "New order" and then expect the baseline form immediately. **Since `0ec813b` the Auto mock is the default**, so add a click on **Manual Order Form**. *Unverified whether these specs currently fail; the inference comes from reading the code.*
- The stepper links "1. Ingest" and "2. Validate" lead to the mock screens. Do not follow them in the recording.
- The password is needed for each approval. Generate a synthetic one and do not show it on screen. Keep the password field out of frame or blurred.
- Use dates relative to `new Date()`, as the specs do.

---

## 7. Security demo guide (about 70–80 seconds total)

1. **"Proposal ≠ authority" (10 s).** On the send panel, show that only "Re-authenticate and approve this exact bundle" is available. Close-up of the bundle hash, expiry and `sandbox: true`.
2. **Step-up approval (15 s).** Enter the password (masked). Narrate: "The approval is bound to this user, this session and this exact SHA-256 bundle; it expires in five minutes."
3. **Simulated execution, exactly once (10 s).** "Execute in sandbox" → "Run succeeded · 1 completed · 0 pending · 0 failed". Reload: same run, no duplicate.
4. **Blocked acceptance (15 s).** Record party acceptance against the inexact reply → refusal alert → "No recorded acceptances."
5. **Audit chain (20 s).** `/audit-log`: expand a row to show the Row hash and Previous hash; download the export; optionally run the verifier (§7.3) on the original file and on a copy with one character edited: `ok: True` vs `ok: False`.

### 7.1 Optional role demo (if time allows)
Invite a second synthetic member as `commercial_lead` (`/useraccess`; the manual invitation flow). That user can prepare a bundle but sees no approve or execute actions, and the API returns 403 on approval. *Rehearse; the UI copy is not verified here.*

### 7.2 What not to claim in the security segment
Regulatory compliance, certification, production readiness, MFA on approvals (password step-up only), external
anchoring of the audit log, spending caps, or real bank, payee or account verification. Owner attestation is not
independent verification.

### 7.3 Audit verifier snippet (uses existing code; not executed during this inspection)

```bash
cd backend && uv run --frozen python -c "import json,sys; from orderfit.services.exports import verify_audit_export; print(verify_audit_export(json.load(open(sys.argv[1], encoding='utf-8'))))" ../var/audit-export.json
```

Expected: `{'ok': True, 'rows_checked': N, 'reason': 'supplied_range_only'}`. A tampered copy should return `{'ok': False, ..., 'reason': 'invalid_chain'}`.
Keep the export under ignored `var/`.

---

## 8. Innovation demo guide

**The capability:** *language → typed financial scenario → deterministic recomputation on an isolated fork.*

| Element | Detail |
|---|---|
| User request | "What if the buyer pays a forty percent deposit up front?" (or a delay or cost stress: "customer delay 15 days") |
| AI capability | `propose_intent` converts free text into `ModelIntent` (typed `changes` such as `{kind:"deposit_pct", value:40}`) via OpenAI structured output, or asks one clarifying question |
| Information used | Only the instruction text; the system prompt is `backend/orderfit/agent/prompts/whatif.system.md` |
| Produces | A proposal. The engine then computes a full alternative evaluation on a fork of the confirmed snapshot. |
| Why it is not a form | The same field could be typed (the "Run typed fork" path exists). The AI's value is intent translation plus refusal of unsupported or mixed requests. Narrate that honestly. **The deterministic regex fallback also handles "deposit 40%"**, so only claim AI when the badge says "AI live". |
| How the UI communicates | "Operation: running · <subphase>"; then the Fork card with the provenance badge, the `changes` JSON and the Source vs Fork table; a clarification banner when ambiguous; a technical failure labelled as "not a financial rejection" |
| Unsafe proposal | An out-of-range value, an unknown kind or a digits-bearing clarification is rejected and falls back to the template; nothing changes until a human applies, confirms and evaluates |
| Hard to show in a screenshot | The causal chain (question → typed change → recomputed verdict), the badge flip from AI to Template under failure, and a stale fork after inputs change |

**Second AI beat (if OpenAI rehearsal succeeds):** upload a synthetic order TXT/PDF → **Extract values** →
candidates showing the **exact quote and page** with "AI live" badges → **Confirm against source**. Narrate:
"The model may only point at text that is really there; an unsupported claim is discarded."

**Third beat (optional, 15 s):** paste "Net 45" into "Does an unclear payment clause matter?" The model proposes
readings, each evaluated by the engine. A question is asked only if the recommendation changes.

**Fallback if OpenAI is unavailable on the day:** show the same flows with "Template" badges and say so. *"AI is
off; the system degrades to deterministic rules, and nothing unsafe happens."* That is itself a strong safety message.

---

## 9. Feature evidence matrix (truth check)

| Capability / claim | Status | Repository evidence | How to demonstrate | Expected result | Caveats |
|---|---|---|---|---|---|
| Deterministic cash-flow engine (daily troughs, reserve per day, scenarios, tolerance, ranking) | Implemented; reference **verified now** | `backend/orderfit/engine/*`, `docs/engine.md`, fixtures `cases/expected`; `tests/engine` (passed now) | Persisted evaluation screen | Decision, recommended option, per-option hard feasibility | Supported products: deposit %, supplier extension, fixed-term loan only; no FX |
| Persisted end-to-end order lifecycle | Implemented; E2E repo-reported | `order-lifecycle.spec.ts`; `docs/hackathon-evidence/2026-10-17/` | §3.3 | Run succeeded, Settled (commit) | Spec predates `0ec813b` (Manual toggle) |
| OpenAI document extraction | Implemented; 13/13 live synthetic cases passed | `llm.py:extract`, `workflow/extraction.py` | Documents page | Grounded candidates with "AI live" badge | Proposal-layer evidence only; text-layer PDF, TXT, CSV, JSON only; **no OCR** despite "OCR" labels |
| OpenAI what-if intent | Implemented; 16/16 live synthetic cases passed | `llm.py:propose_intent`, `services/preparation.deterministic_intent` | Negotiate page | Fork with AI badge | Fallback understands simple phrasing too; no persisted flow was tested |
| OpenAI reply reading / clause / explanation | Implemented; live synthetic cases passed (13/13, 4/4, 3/3) | `llm.py`, `workflow/advisory.py`, `docs/evaluation.md` | Negotiate page | Badges, flags | No database-backed job or hosted acceptance; synthetic cases are not a customer-data benchmark |
| "AI Document Intake (Auto)" and Validate screens | **Mock (UI-only)** | `web/app/deals/new/page.tsx:52–192`, `validate/page.tsx:32–197` | Do not show as functional | — | Hard-coded USD sample values; localStorage only |
| Step-4 banner "Feasibility Evaluation Complete · Counter-Offer Strategy Recommended" | **Static text** | `web/app/deals/[id]/page.tsx:161–182` | Avoid or crop; show "Persisted evaluation" instead | Shown even before evaluation | Misleading if filmed |
| Landing-page "order simulator" and marketing copy | Illustrative browser math / marketing | `web/components/landing/order-simulator.tsx` (float arithmetic), `architecture-security.tsx`, `faq-section.tsx` | Not as product evidence | — | Some copy overstates: "scan up to 90 days" (default `max_delay_scan_days` is 180), "guarantees true resilience", "re-computes headroom automatically" (it needs human confirmation) |
| Exact-bundle approval with step-up | Implemented | `services/bundles.py`, `services/identity.step_up`, `tests/db/test_p6_approval.py` | §7 | Approve then execute | Password step-up, not MFA |
| Sandbox execution, idempotent and recoverable | Implemented, **simulated** | `services/execution.admit`, `workflow/execution.py` | Execute + reload | One run | No external adapters exist |
| Commitment settlement and compensation | Implemented, simulated | Same; E2E | Commit and compensation panels | Settled (commit / compensate) | Not a legal contract |
| Tamper-evident audit chain | Implemented; verifier in code | `services/exports.py`, `0002_integrity_and_audit.sql`, `tests/db/test_p3_exports.py` | `/audit-log` + snippet | Hashes; ok True/False | No external anchor; no UI verify button |
| Role-based permissions, tenant isolation | Implemented | `contracts/protocol.PERMISSIONS`, `store/db.tenant` | Second account / role | 404 / 403 | Hosted evidence repo-reported |
| Bank-change / injection / conditional-reply flags | Implemented | Reply card, `guards/injection.py`, `preparation.has_exact_acceptance` | Paste replies | Blockers shown | Heuristics; defence in depth |
| Real email, payment, bank or lender | **Absent** | — | Never | — | Out of scope |
| Multilingual review (Bengali, Hindi, Chinese) | Implemented; supported-language cases included in the live synthetic run | `services/language.py`, `tests/test_multilingual_*.py` | Optional | Language note, gloss | Synthetic evidence only; unsupported languages remain held for review |

### 9.1 Gaps that could undermine the submission

1. **The mock intake pages are the first thing the default `/deals/new` shows.** A judge who sees "AI Document Intake" with fake files will assume AI extraction happens there. Mitigation: switch to Manual immediately, and show real AI extraction on `/deals/{id}/documents`.
2. **Live OpenAI passed the synthetic proposal suite, not a real customer benchmark.** Rehearse the exact path and show its provenance. Do not generalize synthetic pass rates to real documents or claim production accuracy.
3. **The static "Counter-Offer Strategy Recommended" banner** contradicts an `accept_as_is` result. Avoid filming it.
4. **"OCR" labels** (`Source documents & OCR`) are not backed by OCR.
5. **Tier B is unexecuted.** Capture real numbers; have Tier A ready as a fallback.
6. **The default policy lacks deposit options**, so canonical deposit recommendations require the fork, then apply, then re-evaluate (§3.2).
7. **The audit verifier has no UI**; the decision export excludes approval and execution evidence (it says so itself).
8. **No per-transaction spending limit** exists. Present risk limits as reserve constraints plus exact bundles.
9. **The E2E specs may need the "Manual Order Form" click** after `0ec813b` (unverified).

---

## 10. Verified claims (safe for narration)

- "Every number you see is computed by a deterministic engine using integer minor units; the AI never produces a figure." (`agent/nodes/compute.py`, `test_architecture.py`, ADR 0001/0003)
- "Only one module in the codebase can call the model, and its outputs are typed proposals." (`agent/llm.py`)
- "OrderFit uses OpenAI's Responses API with structured output, and handles refusals, incomplete output, timeouts and rate limits explicitly." (`llm.py:451–503`)
- "Extracted values must quote the source document; a value whose quote isn't on the page is discarded." (`workflow/extraction.py`)
- "A what-if runs on an isolated copy; your confirmed inputs don't change until you apply and re-confirm." (`preparation-workspace.tsx` copy + routes)
- "Each option is checked against your cash reserve on every single day, under base, downside and severe scenarios."
- "Every outgoing action is an immutable bundle with a SHA-256 hash; approving it requires re-entering your password, and the approval is bound to that exact hash, your session, and expires in five minutes."
- "The server re-checks freshness, approval and staleness again at execution time, and runs each approved bundle exactly once."
- "Execution here is a sandbox: nothing leaves the system, and no money moves."
- "A reply that adds conditions is not treated as acceptance."
- "Every material action is written to an append-only, hash-chained audit log inside the same database transaction."
- "Badges tell you whether text came from a live model, a recording, or a fixed template."
- "The reference calculator's 22 fixture cases pass" (verified now) and "281 provider-free backend tests pass" (verified now; name the suites if asked).

## 11. Claims to avoid

- That the AI *decides*, *approves*, *negotiates autonomously* or *sends* anything.
- Real payments, transfers, emails, loans, bank connections, credit decisions or "funded" orders.
- Live OpenAI accuracy, hallucination rate, latency, cost or "zero hallucinations" (the landing FAQ uses "guarantee"; do not repeat it).
- OCR, DOCX/XLSX parsing, FX, multi-currency portfolios, revolving credit or factoring.
- Regulatory compliance (PCI, SOC 2, ISO, banking regulation), "bank-grade" security, production readiness, or hosted deployment readiness. Neon/Render/Vercel evidence is repo-reported, and blockers are listed in `docs/security/hackathon-security-matrix-2026-10-17.md`.
- MFA-protected approvals (password step-up only) or an externally anchored audit trail.
- Spending or per-transaction limits.
- Performance or load numbers (stress testing was blocked on this machine per the runbook).
- That the "AI Document Intake (Auto)" / Validate screens extract anything.
- Any customer, revenue or market metric; none exists in the repository.

---

## 12. Visual story opportunities

| Moment | Why it works | Treatment |
|---|---|---|
| Daily cash series dipping below the reserve line (`DealCashSeriesViewer` / `DealEvaluationInspector`) | The core "aha" | Close-up, slow zoom on the trough date |
| Source vs Fork table after the AI what-if | Shows the AI → engine causality | Split-screen: question on the left, table on the right |
| "AI live · <model>" badge next to a "Confirm against source" button | Human-in-the-loop in one frame | Macro close-up |
| Quoted source text under an extracted value | Grounding | Highlight the quote in the document and in the UI |
| Bundle hash + password step-up + "Run succeeded" | Approval gate | Three quick cuts; blur the password |
| Refusal alert on the conditional reply | A guardrail visibly firing | Red pulse; hold 2 s |
| Audit log row expanded (Row hash ↔ Previous hash) | Tamper evidence | Animated arrow linking the hashes |

**Invisible processes that need diagrams (animated overlays):**
1. Architecture: Browser → same-origin Next proxy → FastAPI → PostgreSQL (RLS) ← separate worker → `llm.py` (OpenAI) / `compute.py` → engine.
2. Trust boundary: "AI proposes → guards ground or drop → human confirms → engine computes → human approves → sandbox executes → audit chain".
3. Strategy enumeration: as-is vs deposit / extension / loan, across three scenarios and the reserve line.
4. Hash chain: each row hash = SHA-256(previous hash ‖ canonical row).

**Suggested five-minute structure:** 0:00–0:25 problem; 0:25–0:50 trust architecture; 0:50–2:20 task flow
(inputs → evaluation → AI what-if → apply → re-evaluate); 2:20–3:30 approval, sandbox send, reply, blocked
acceptance, commit; 3:30–4:20 audit chain and security recap; 4:20–5:00 innovation recap and honest scope
("sandbox-only; live AI is proposal-only").

---

## 13. Known limitations

- Sandbox only; no external adapters (`workflow/execution.py`).
- Live OpenAI proposal paths passed 49 synthetic cases on 20 October 2026. Recorded evaluation still replays authored outputs (`docs/evaluation.md`, `docs/ai_capability_status.md`); database-backed, hosted and real-document quality remain unverified.
- The `/deals/new` Auto mode and `/deals/new/validate` are UI mocks. The `/sandbox` page is an "unavailable" notice.
- The static deal-page banner, "OCR" wording and landing-page copy overstate behaviour.
- The default policy only has a 0% deposit and a zero-day extension; the UI cannot edit those (the API can).
- Password step-up is incompatible with an MFA-enforced account. There is no lost-passkey recovery.
- The audit chain has no external anchor; verification is code-only, with no UI.
- Docker was not running during this inspection: no stack launch, DB suite or browser run was executed now.
- Hosted (Neon/Render/Vercel) acceptance and restore evidence is repo-reported, with release blockers documented.
- `scripts/seed_demo.py` and `data/demo/rina_business.json` are stubs.

---

## 14. Final evaluator checklist

**Task completion (40%)**
- [ ] Did the video show real inputs being saved and confirmed into a snapshot?
- [ ] Did a persisted, deterministic evaluation produce a clear decision and a recommended option, with daily cash and the reserve?
- [ ] Was a change (for example a deposit) explored, applied and re-evaluated?
- [ ] Was an exact proposal prepared, approved and executed (sandbox), followed by a reply, acceptance and commitment?
- [ ] Was it clear what was a recommendation, a proposal, an approval, a simulated execution and a persisted outcome?
- [ ] Did a reload show the outcome persisted, with no duplicate execution?

**Security & compliance (30%)**
- [ ] Who may approve or execute, and where is that enforced?
- [ ] What exactly is approved (a hash-bound bundle), and what invalidates an approval (staleness, expiry, revocation)?
- [ ] Was a blocked or refused action shown (no Execute before approval; conditional reply refused)?
- [ ] Was the audit log shown, with linked hashes and a statement of its limits?
- [ ] Was it stated plainly that nothing real is sent or paid?

**Innovation & interaction (30%)**
- [ ] What did the AI do that a form could not (intent translation, grounded extraction, clarification)?
- [ ] Was AI output visibly labelled, and was it visibly kept away from numbers and approvals?
- [ ] What happened when the AI was unsure or wrong (clarification, quote drop, template fallback)?
- [ ] Was the interaction smooth, with progress states, recoverable errors and a coherent single story?

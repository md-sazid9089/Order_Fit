# AI-era review guidance: OrderFit website

Review baseline: `main` at `47289ad`, initially clean, 17 October 2026.
AI use is encouraged. The user requested a full website review and repairs,
FreeLLMPool for testing, and OpenAI for the main application. This evaluates
the product and the contributor's verifiable engineering decisions; no individual
performance rating follows from AI-generated output volume.

## Criteria audit

| Current criterion | Measures | Verdict |
| --- | --- | --- |
| Task completion — 40%: complete workflow with a useful financial outcome | Hybrid: tooling helps create the workflow; the human owns scope, financial contracts, verification and outcome evidence | Keep weight; rewrite evidence requirements |
| Security & compliance — 30%: permissions, risk limits, human approval, audit logs | Hybrid: generated controls need human threat analysis and executed negative tests | Keep weight; distinguish implementation from verified controls and external compliance |
| Innovation & interaction — 30%: distinctive AI capability and convincing demo | Hybrid: model fluency/polish are partly tool signals; useful interaction design, grounded proposals and recovery reflect human judgment | Keep weight; require real provider evidence and honest fallback labels |

No criterion is purely a human signal. Speed to first draft, code volume and
the apparent polish of generated explanations are tool-dominated supporting
observations, not independent grounds for credit.

## Observable rewritten criteria

- **Task completion, 40%:** demonstrate a saved order through reviewed inputs,
  deterministic evaluation, what-if/reply reassessment, separately approved
  sandbox execution and reload/export. Explain the cash/profit trade-off using
  engine facts. Judgment is visible in explicit missing-data handling and in
  choices to reject unsupported assumptions. Outcomes require persisted results,
  not a timer, transcript or generated claim.
- **Security & compliance, 30%:** demonstrate actual restricted-role tenant
  isolation, stale-input rejection, risk enforcement, exact human approvals,
  idempotent recovery and audit evidence. Verification credit includes catching
  errors before shipment, reproducing failures and retaining negative controls.
  Provider configuration and recovery claims need their own evidence; a unit
  test does not establish regulatory certification.
- **Innovation & interaction, 30%:** show source-backed AI candidate extraction
  and natural-language scenario proposals that a person can review. Explain
  what the AI drafted, what was rejected/corrected and why. Demonstrate mobile
  navigation, recoverable failures and honest AI-unavailable states. Leverage
  is visible in reusable fixtures, regression tests and a reproducible demo
  other team members can run without paid credentials.

## Findings and repairs

1. **P2: malformed live-provider JSON escaped recovery.** Both extraction and
   what-if intent caught Pydantic validation errors but allowed the SDK's
   `json.JSONDecodeError` to escape. Two focused regressions failed before the
   fix. Both paths now map it to `INVALID_OUTPUT`; what-if keeps its existing
   deterministic fallback and extraction retains its manual-review path.
   No automatic retry of malformed model content was added.
2. **P2: legacy what-if copy contradicted current sandbox capabilities.**
   `/sandbox` said commitments were unavailable although the saved-order
   sandbox journey supports approved commitments. It now directs users to
   a saved order and states the human-approval requirement.
3. Added a production-browser route sweep across 15 workspace routes at
   1280px and 390px, checking rendering, viewport overflow, uncaught crashes
   and server-error API reads. It exercises empty-state navigation; the
   separate lifecycle test covers populated deal/approval interactions.
4. **P2: mobile pipeline loading overflow.** The new sweep measured 481px
   content in a 390px viewport while loading. The placeholder banner and tab
   row used fixed desktop widths. The banner now stacks on mobile, its text
   has a maximum width and tabs wrap. The regression holds the real list read
   pending, so a fast API cannot hide a loading-only defect. A pre-fix trace
   frame is retained in `review-evidence/mobile-loading-before.jpeg`.
5. **Stale security test after an earlier optimization.** The full backend run
   found an assertion expecting three setup queries; current code deliberately
   batches all timeouts into one. Updated the test to verify all three local
   settings before session resolution and their actual PostgreSQL values,
   instead of restoring extra network round trips. No runtime guard changed.

Actual changes: `backend/orderfit/agent/llm.py`, its P4/P5 regression tests,
`backend/tests/db/test_security_hardening.py`, `web/app/sandbox/page.tsx`,
`web/components/ui/skeleton.tsx`, and `web/tests/e2e/workspace-review.spec.ts`.

## Executed evidence

- 105 frontend unit tests passed. Typecheck passed. Full ESLint had zero
  errors and 68 pre-existing warnings.
- 214 backend architecture/engine/agent/contract tests passed before the fix.
- 82 focused P4/P5/audit/architecture tests passed after the fix; changed
  Python files passed Ruff. The two new malformed-JSON cases had first failed.
- Fresh production-image/disposable-PostgreSQL browser run: four checks passed
  in 36.2s: full owner evaluation/send/reply/accept/commit/reload/compensation
  and lost-response journey, accessible sign-in, mobile CSRF/read recovery,
  and passkey enrollment/login. This run preceded the JSON/copy repairs.
- Full backend run: **553 passed, 1 failed**, three existing deprecation warnings,
  743.94s. Failure was the stale timeout-query assertion above. After repair,
  all **10 security-hardening/runtime-validation DB checks passed** on another
  disposable PG17 target; changed-file Ruff passed. No second 554-test rerun
  is claimed after the test-only correction.
- After runtime JSON/copy fixes: lifecycle/CSP/15-route sweep passed, three
  checks in 43.8s. That sweep exposed the transient skeleton overflow, which
  was then repaired and given a separate held-read assertion.
- Final production-image browser run after skeleton repair: six checks passed
  (lifecycle, passkey, pagination, CSP, sign-in, mobile recovery). The new
  held-read sweep hit a test-handler cleanup race; fixed by waiting for active
  handlers before navigating. The final isolated production-image sweep then
  **passed**, including both held-read skeleton widths and all 30 route/width
  combinations (`orderfit-e2e-196d96e594-results` in the local temporary folder).
- Controlled pipeline scheduling check passed: median 1767ms over three samples
  with 150ms injected read latency, customer concurrency capped at four. This
  is a client fixture measurement, not a hosted capacity or financial result.

No stress campaign was resumed. Tests create synthetic accounts in disposable
databases and do not change the configured/shared application database.

## FreeLLMPool result

Used cached `ghcr.io/0xzr/freellmpool:0.13.0` in a temporary container bound
only to `127.0.0.1:18089`. No credentials, host environment files or private
documents were mounted. The probe process alone set `OPENAI_BASE_URL` to that
loopback `/v1` endpoint and passed a synthetic dummy key to the existing sole
`agent/llm.py` provider boundary. Requests used synthetic order text, 15-second
timeouts, 512 output tokens and no SDK retries. Application configuration was
unchanged; no paid OpenAI request was made. The container was stopped/removed.

| Pinned model | Extraction | What-if |
| --- | --- | --- |
| `pollinations/openai-fast` | `TIMEOUT` | `PROVIDER_UNAVAILABLE`, template provenance |
| `llm7/default` | `INVALID_OUTPUT` | `INVALID_OUTPUT`, template provenance |

Four attempts produced **zero usable structured AI results**. A reachable model
inventory is insufficient. This does not establish extraction correctness,
language quality or OpenAI model acceptance. The malformed-JSON regression was
found by source review; these live probes did not reproduce that exception.
The gateway's [official instructions](https://github.com/0xzr/freellmpool/blob/main/README.md)
document the compatible base URL and keyless availability dependency.
Do not send private financial documents through unreviewed free routes.

The current implementation also includes deterministic templates/parsers: the
whole business workflow is not evidence that every step used a live model.
Keep the deterministic financial engine authoritative. The main application
continues to use its OpenAI boundary; free-route failure is not permission to
silently spend paid credentials.

## Evidence to collect for scoring and human contribution

Walk three shipped examples backwards: one successful financial decision,
one rejected/incomplete AI proposal and one recovered failure. For each retain
sanitized original input, provider/mode/prompt/schema provenance, model proposal,
human corrections/rejections with reasons, deterministic result, approval/audit
identifiers and reload evidence. Compare the draft with the shipped artifact.
Then inspect rework/escaped-error history, decisions about unsupported scope,
peer reports of trust and reuse, and who authored/maintained verification.
Credit meaningful verification labour even when it reduces visible output.

## Calibration guidance

- Preserve the user's 40/30/30 outcome weights. Apply the same scenario,
  acceptance criteria and evidence standard across contributors.
- Disclose tool access, provider availability and recorded/template/live modes.
  Compare design and verification contributions under those conditions rather
  than raw feature/code counts or model polish.
- Do not punish sanctioned AI use. Where use is optional, non-adoption is not
  itself a performance deficiency; discuss adoption as development where it
  would improve the role's outcomes.
- Surface review, testing, security analysis and error prevention before
  comparing an output-heavy contributor with a careful verifier.
- Separate an environmental/provider blocker from a contributor's response to
  it. Honest failure handling earns reliability evidence; unavailable live AI
  still leaves the product's AI-demo acceptance incomplete.
- Assign no invented numerical score or compliance certification. Current
  sandbox evidence supports task completion; security remains bounded by
  the existing external-control gaps; live AI innovation evidence remains open.

## Review conversations

**High volume, thin judgment:** “Let's walk one order, one generated proposal
and one failure backwards. Which assumptions did you reject? Which values did
you verify? Show how your decisions changed the shipped financial outcome.”

**Careful sceptic being out-shipped:** “Your source checks and recovery tests
are valuable outcomes. We'll count prevented errors and trusted results.
Let's identify one permitted AI task to experiment with, without reducing the
verification standard or comparing raw output counts.”

**Unverified AI work passed along as verified:** “This claim reached others
without the supporting check. Let's trace the evidence and the downstream
effect, then agree on verification and correction responsibilities.” Encouraged
use is the only supplied policy detail. Obtain the actual organizational
accountability policy before a formal misconduct/performance action; do not
invent disclosure rules or punish AI use retroactively.

## Remaining acceptance

Obtain a successful synthetic FreeLLMPool structured-output run and independent
quality review before calling the AI demo verified. OpenAI acceptance is a
separate opt-in gate for the main provider. Existing hosted network/retention,
storage credential scope, independent KMS evidence and rotation gaps remain
documented in `docs/security/neon_acceptance_2026-10-17.md` and the hackathon
security matrix. This review does not deploy changes or certify every role,
data state, browser, accessibility criterion or external service.

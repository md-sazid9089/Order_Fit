# OrderFit resumed audit — 17 October 2026

The subsequent [phase-closure continuation](phase_closure_2026-10-17.md) supersedes
this report's unexercised P6-browser note: the full synthetic sandbox journey now
passes. It records the new MFA snapshot, concurrent-runner repairs, free-provider
failures and main-runtime blocker separately. P4/P8 are not declared complete.

## Where the checkout stands

Resumed on `main`, HEAD `eca00c9`, initially without tracked modifications. The
previous audit started at `6ca0ec3`; 218 tracked files have changed since that
baseline. Earlier audit repairs are now committed. Later work added durable worker
presence, signed collection continuation, session-authority fencing, frontend
merge integration, dark authentication pages and platform-admin RBAC/routes.

Read root/backend/web instructions, the development-context handoff, latest progress
and stress-remediation evidence; reconciled against current source and fresh checks.
The codebase-memory graph still reports 3,234 nodes and lacks the new admin symbols;
graph-first searches returned no admin results, so direct reads were used for those
files. A stale graph and an old passing report are not current acceptance evidence.

The prior stress report records **507 backend passes** and the frontend merge records
**92 unit / 6 browser-HTTP passes**. Those are historical, not reruns here. On resumption
the schema head was `0016_worker_presence`. During this audit the separate backend
task began `0017_platform_authority`; its migration and complete acceptance remain
owned by that task. The user explicitly chose to keep its backend ownership while
this audit handles frontend/integration verification. No competing backend patch
was applied. Do not apply these tests to a shared database or infer that old runtime
containers match the current source.

## Reconciled feature matrix

`Done` is local evidence for the named capability, not production acceptance.
`Partial` includes unverified gates. Detailed original requirements/financial
semantics remain in [the original matrix](orderfit_audit_2026-10-16.md); stress fixes
and measurements are in [the remediation report](backend_stress_remediation_2026-10-16.md).

| Spec | Backend | DB | Frontend | Tests / evidence | Status |
|---|---|---|---|---|---|
| P0 contracts/types | catalogue/export, session DTOs | typed persisted contracts | generated client types | fresh initial export drift; concurrent owner regenerated it; fresh check now 108 operations current | Done for generated target contracts; new admin route contracts need separate acceptance |
| P1 identity/isolation | cookie sessions, live membership/role checks | restricted API/worker roles, RLS, session authority | session guard and business scope retained | fresh isolated signup + tenant HTTP probes; full backend result is historical | Done for exercised integration; admin changes separately owned |
| P2 deterministic engine, REQ-02–06 | existing pure engine/compute boundary retained | snapshots/results/series | original financial-display repairs retained | fresh persisted evaluation journey; no formulas/goldens altered | Done for exercised local path; no new full engine-suite claim |
| P3 manual persisted journey | confirmation and durable evaluation | fresh disposable migration + persistence | baseline/order/evaluation/reload/negotiation route | current built-stack browser test | Done locally |
| P4 extraction/AI quality | guarded OpenAI adapter/off/recorded/live | private local/S3 adapter | reviewed source fields/manual fallback | no new live provider calls or extraction benchmark | Partial: independent/live quality and hosted storage gates |
| P5 preparation and replies | shared engine, batched history | immutable preparation evidence | negotiation workspace | browser route return exercised; historical DB suites not freshly rerun here | Partial acceptance: full language/reply journey not exercised now |
| P6 outgoing approval/commit | exact sandbox bundles and approval gates retained | fenced execution and settlement | password-bound approval flow retained | no fresh full send/reply/accept/commit/compensation browser scenario | Partial acceptance; no real outgoing actions |
| P7 worker truth | heartbeat service replaces queue-age approximation | `worker_presence`, narrow helpers | ready/unavailable distinction | actual worker-backed disposable readiness; death/expiry tests are historical stress evidence | Done for implemented/local exercised path, not hosted monitoring |
| P7 collection completeness | scoped signed continuation | bounded queries | supporting load-more/retry consumers | fresh older-customer/recoverable-page browser case | Done for tested continuation; pipeline evaluation fan-out remains |
| P7 platform administration | new authoritative user-flag checks; cross-tenant reporting still under backend review | restricted runtime remains distinct from privileged SQL admin group; new authority migration separately owned | common server layout now enforces the existing disabled capability; simulated console views preserved but unavailable | server-auth unit regressions + real business-owner denial journey; no full platform-console certification | Partial / not enabled |
| Auth UX and technical failures | real server session verification | no schema or privilege changes in this frontend patch | correct internal API address, bounded verification, recoverable unavailable state, focus/contrast repairs | new unit tests and strengthened browser checks | Done for verified paths |
| P8 deployment/restore | Docker and external runbooks exist | local disposable PG17 only | built Next application | local image builds + browser/HTTP run; no hosted calls | Partial: hosted/provider/restore gates remain open |
| Competition/document completion | source/docs are not submission receipts | N/A | N/A | no new deck/video/submission or independent hand-calculation evidence | Partial / external evidence missing |

## Findings and fixes in this continuation

1. **P1 — admin verification used the wrong backend address.** `auth-server.ts`
   ignored `API_INTERNAL_URL`, although Compose/Next proxy use it. Container/server
   verification could therefore call its own localhost instead of the API. A failing
   regression reproduced the mismatch. The helper now honors the canonical variable,
   uses a 10-second deadline and keeps `no-store`.
2. **P2 — technical outages looked like invalid sessions.** Every non-200/network
   result previously returned the same unauthenticated state. A 503 regression
   failed. Server verification now distinguishes unavailable from invalid-session
   401; the layout offers retry without rendering protected children or claiming a
   rejected password. Logging records a fixed safe message, not raw fetch errors.
3. **P1 — disabled console capability was bypassed.** The new server layout could
   render pages whose maintenance toggle only changed React state, whose schema
   button claimed zero drift from a health probe, and whose audit-export catch
   reported success. The existing `platformAdminEnabled()` remains false. The layout
   now enforces that capability after server-side authentication/role checks and
   renders an explicit unavailable notice. The teammate's views/RBAC are preserved;
   runtime privileges were not broadened and simulated controls are not presented as
   real infrastructure operations. Enabling the console requires an accepted backend
   reporting/control contract, not changing a browser flag.
4. **P2 — authentication contrast/focus regression.** Browser measurement found
   placeholder contrast **3.2877:1** on the new dark fields. The earlier focus test
   could pass an invisible zero-width shadow. Placeholders/supporting text now use
   the lighter existing neutral palette and keyboard focus has an explicit solid
   2-pixel white outline. The browser assertion requires a visible outline and
   measures actual rendered placeholder colors against 4.5:1. Dark layout/identity
   is preserved; no redesign was introduced.
5. **P2 — five frontend lint regressions.** Admin effects synchronously invoked
   callbacks that changed loading state. Initial loads are now cancellably scheduled,
   matching the earlier merge fix; no rule was disabled or dependency removed to
   suppress the errors. Warnings are retained.

Three new server-auth unit tests cover address/deadline, unavailable vs invalid
session and rejection of non-boolean admin claims. Existing browser assertions were
strengthened, not relaxed. The persisted-order journey now additionally visits
`/admin` with a real business-owner session and verifies server-side denial returns
to `/deals` without falsely signing the user out.

## Verification and boundaries

- Fresh frontend unit run: **95 passed**; typecheck passed. Initial lint was **5
  errors / 68 warnings**; targeted repairs removed the five errors without rule
  suppression. Production Next build passed.
- First fresh disposable-stack run: **6 browser/HTTP tests passed**, including
  persisted order/evaluation/reload, owner admin denial, older-customer continuation,
  strict CSP, auth labels, 390-pixel navigation, CSRF and failed-read recovery.
  This run preceded the stronger contrast/focus check and is not its acceptance.
- That run's HTTP probes: 200 tenant reads at concurrency 16, p95 **981.41 ms**;
  32 same-key writes, p95 **921.97 ms**, one saved identity; 32 invalid writes,
  p95 **55.91 ms**. Sustained concurrency-eight run: **4,142 requests / 60.13 s**,
  statuses 200=3,106, 404=518, 422=518, no 5xx; p95 **253.03 ms**. These are local
  observed values, not a regression comparison with teammates' differently loaded
  machine runs and not a production capacity claim.
- An attempted focused browser check after the disposable stack had been removed
  failed with connection refused; it was a harness-lifetime issue, not an app pass.
  A separate synthetic preview container then reproduced the real 3.2877:1 failure.
- Browser preview visually inspected the current dark sign-in form and accessible
  labels. No real credentials were entered or provider calls made.
- Backend lint initially had nine errors and export drift; backend fixes and the
  replacement of the `.env`-loading/live-write RBAC test remain with the other task.
  This audit did not run that unsafe test or use its configured application database.
  A fresh full-backend result must come from the backend owner's final snapshot;
  historical 507 passes are not certification of the new admin layer.

Final strengthened-browser run: **6 passed in 1.5 minutes**, including the owner
denial journey. Placeholder contrast is now **6.0338:1**, and the stricter solid
2-pixel keyboard-outline check passes. Final lint is **0 errors / 68 warnings**;
typecheck and all **95 unit tests** pass. Final API/web image builds pass.
The final HTTP burst p95 values were **420.80 ms** (reads), **442.25 ms** (same-key
writes) and **78.64 ms** (invalid writes). Sustained run: **4,398 requests / 60.04 s**,
200=3,298, 404=550, 422=550, no 5xx; p95 **241.49 ms**. These are not attributed to
the visual/auth-helper changes as performance gains.

Test-stack cleanup removes only each runner's synthetic
containers/volumes; no application database, real secrets or Git history were changed.

## Remaining gaps by severity

- **P1 release gates:** live/independent OpenAI quality/adversarial acceptance,
  hosted Neon/PgBouncer/Render/S3 permissions, joint restore and historical credential
  rotation evidence remain unverified. New platform authority must pass its own
  restricted-role/tenant/revocation tests and reviewed contract before console enablement.
- **P2 coverage/scale:** full browser sandbox send/reply/commit/compensation automation,
  all-route contrast/keyboard/zoom/layout-shift acceptance, realistic large-tenant
  pipeline/evaluation payload/fan-out benchmark and hosted worker death/restart remain.
- **P3 maintenance:** large persistence modules, disabled admin simulation code,
  existing frontend lint warnings and development-dependency debt remain. No speculative
  repository rewrite, new financial calculation path or public financial cache was added.

P4 and P8 remain partial. A successful local journey does not complete the document
submission, hosted deployment or live AI-quality gates.

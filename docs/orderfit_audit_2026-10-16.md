# OrderFit implementation audit — 16 October 2026

## Scope and evidence rules

Reviewed against root/backend/web instructions, the implementation plan (including
DB-01–DB-30 and V01–V16), requirements, architecture, financial contracts, ADRs
0001–0010, and progress. Starting checkout: `main`, `6ca0ec3`; the earlier audit
repairs are already in history, contrary to the old development-context snapshot.
Codebase-memory architecture/search/call-path/snippet tools guided discovery;
direct source reads filled graph gaps in recently merged UI files. Findings were
reproduced before repairs. This is one bounded audit/fix cycle, not a claim that
every possible defect or every release gate is closed.

`Done` below means the stated **local** capability has inspected implementation
and executed checks. `Partial` includes unrun acceptance gates; `Missing` means no
implementation/evidence for the specifically named item; `Drifted` means the
document and checkout disagree. Historical checks in progress are not reruns.
No real application secrets or shared/hosted databases were inspected, changed or tested. No git history
was changed. Other security/deployment edits arrived concurrently in the shared
tree; they were preserved and are not attributed to this audit's fixes.
The concurrent [security audit](security/security_audit_2026-10-16.md) records its
own findings and verification scope; its historical credential-exposure/rotation
handoff remains a release risk, not a claim that this audit inspected credentials.

## Feature matrix

Paths are repository-relative. DB evidence is disposable PostgreSQL 17 with
restricted, separate runtime/worker logins, not a hosted-database certification.

| Spec | Backend | DB | Frontend | Tests / evidence | Status |
|---|---|---|---|---|---|
| P0 contracts, IDs, integer minor-unit money, dates, versions | `contracts/`, catalogue/export | UUID/BIGINT and guarded forward SQL | generated API types + typed client | export checks 108 operations; contract examples + TypeScript consumer check | Done |
| P1 tenant isolation/authentication (REQ-10) | identity service, scoped transactions, permission checks | restricted roles, RLS, sessions, memberships | session/business guard, scoped cache reset | foundation, runtime-hardening and cross-tenant suites; real browser signup/session | Done (local) |
| P1 schema upgrade and concurrency | manual Alembic revisions | sole head `0014_settlement_retention`; original SQL retained | N/A | original and forward SQL each 296/296; clean/upgrade and audit-lock concurrency checks | Done (local) |
| REQ-02 counterfactual cash engine | pure engine, sole `agent/nodes/compute.py` boundary | immutable snapshots/results/series | persisted scenarios/headroom; corrected pipeline descriptions | architecture + engine tests, independent daily-floor/reserve/same-day/profit cases, 22 reference cases | Done |
| REQ-03/04 strategy sizing, ranking, stress, full horizon | same engine for initial/fork/reply; supported loan grid | offers and immutable option/series storage | options, sensitivity, per-option series | engine parity + independent horizon/scan/fee tests | Done (supported scope) |
| REQ-05/06 questions, uncertainty, escalation | confirmation builder, VOI and deterministic findings | source/input revisions and blocking flags | review/questions/stale banners | contract/engine/P3 review regressions; new stale/computing display tests | Done (local) |
| P3 saved manual order vertical slice | review/confirm/queued evaluation/export services | durable operations and confirmed inputs | baseline → order → confirm → evaluate → reload | current browser journey passes; P3 DB/process-recovery tests | Done (local) |
| REQ-01/P4 private document extraction and review | bounded PDF/text/CSV/JSON, evidence/grounding, guarded provider | document/field histories + private local/S3 adapter | documents, quoted candidates, explicit field review | P4 failure/retry/permission tests; S3 provider-stub checks only | Partial: independent/live acceptance and hosted storage unverified |
| REQ-07 explanation safety | slot renderer, guards, template fallback | immutable result evidence | explanation/provenance rendering | agent/contract guard tests, reference selftest | Done for deterministic/recorded paths; live quality unverified |
| REQ-11 model modes | one `agent/llm.py` provider; off/recorded/explicit live | operation results/evidence | fallback/provenance markers | offline agent tests; no provider traffic | Done for supported offline behavior; ADR-0005's old automatic-live proposal superseded |
| REQ-21/P5 what-if and reply reassessment | isolated fork + explicit apply; bounded reply interpretation | fork/reply/review/acceptance histories | negotiation workspace, saved revisions | P5 suite; UI route round-trip; batch-history parity tests | Partial: live language/dialogue-quality measurement unverified |
| REQ-08/P6 human approval and sandbox execution | exact bundles, password step-up, fencing, settlement/compensation | immutable approvals/actions, serialized commitment gate | separate draft review, send and commit approvals | 26 focused P6 approval/execution checks pass; recovery suite in full run | Done locally at API/DB layer; full browser send/reply/commit automation missing |
| REQ-09 audit/reconciliation/export | chained export/verifier, sandbox ledger reconciliation | append-only chain and serialized writers | audit/export screens | SQL chain/concurrency + P3/P6/P7 tests | Done locally; external anchoring/restore not established |
| REQ-12 alerts and state separation | deal state ≠ decision ≠ flags ≠ job state | separate persisted columns/resources | computing/stale/review labels corrected; page-only summary scope | five new financial-display regressions; current browser lifecycle | Done for inspected paths |
| REQ-13 adversarial AI acceptance | typed, grounded, tool-free provider path; guards | reviewed evidence boundaries | manual fallback, conflicting/missing data | recorded/pure guard tests, not live adversarial evaluation | Partial: required live ADV run and measured extraction quality unverified |
| REQ-15 ambiguous dates/amounts | deterministic parsers and strict confirmed-input validation | typed dates/integer money | explicit input units and review | P4 pure/contract cases; no automatic financial defaults | Done for supported parsers, not real-document quality |
| P7 members/payees/notifications/settings/exports | implemented scoped services and capability markers | owner protection, per-user notifications, verification evidence | role-aware supporting screens | P7 DB/unit coverage; not every screen manually exercised now | Partial: complete cursor pagination and all-screen browser acceptance absent |
| Bounded list reads/performance | batched preparation history; other deal serializers still fan out | existing scoped keys/indexes; no speculative new index | pipeline limited to 20/page, refresh/retry and honest page counts | query-count/latency regression; 390 px viewport test | Partial: deal-list N+1 and large-tenant scale benchmark remain |
| P8 local runtime/build/browser | API/worker split, same-origin proxy, readiness | disposable PG17 migration/runtime checks | production Next build at localhost:3000 | three current Playwright tests; frontend unit/type/lint/build checks | Partial: hosted/provider/restore gates below |
| P8 worker heartbeat monitoring | readiness currently measures queue-backlog age, not a heartbeat | `p7_queue_backlog_seconds()` | API-ready indicator | inspected `Database.readiness`; no worker-death drill performed now | Partial: empty-queue readiness is not worker-liveness proof |
| P8 joint restore / hosted acceptance | runbooks/adapters exist | no fresh Neon/PgBouncer/S3 restore evidence | N/A | not run against shared infrastructure | Missing acceptance evidence |
| Competition deliverables / independent evaluation | engineering implementation is not submission evidence | N/A | N/A | roadmap owner fields/independent hand-computation/live ADV/submission artifacts not established by tests | Partial; no claim of completed submission |
| Historical docs vs checkout | code is beyond preparation-time P0 | forward revisions exist | current app is `web/`, not `frontend/` | reconciled top-level status notes and handoff | Drifted → corrected navigation/status; original historical detail retained |

REQ-16/18/19/20 deferred levers, optional learned model/LangGraph and real integrations
are deliberate exclusions, not enabled features waiting for optimistic completion.
REQ-17 optional extras are not certified complete. No new infrastructure or financial
meaning was introduced to make a checklist pass.

## Invariant results

- One production calculator: the architecture checks forbid alternative application
  entry points and provider imports. API/UI inspected paths display engine values;
  formatting/comparison of stored integer strings is not a second cash calculator.
  The independent reference calculator remains a test oracle, not a live path.
- Generated backend/web contracts are current. Local presentation models still
  exist; passing type checks is not proof of every runtime response shape, so the
  browser/API integration checks remain necessary.
- Technical progress and stale data are no longer described as financial rejection
  or current advice in the pipeline. A declined option may fail profit/financing,
  not necessarily cash. Baseline-relative feasibility can retain inherited deficits.
- Missing baseline/customer/dates remain explicit; page-only summaries are not
  portfolio affordability or whole-system health. The business default reserve is
  labelled separately from an order's pinned policy.
- Real bank/lender/mail adapters are absent. Exact outgoing sandbox actions still
  require human review, current versions, password step-up and a bound approval.
  Draft review is not outgoing approval; no security gate was bypassed.

## Reproduced findings and cohesive repairs

1. **P1 — misleading financial meaning in the new pipeline.** Five failing tests
   reproduced inherited reserve deficits called safe-above-reserve, profit failure
   described as insufficient cash, changed terms presumed to cure a cash breach,
   stale result races and computing grouped with recommendations. Fixed
   `web/lib/pipeline-model.ts`, corrected summary/callout labels in `app/deals/page.tsx`,
   and added `tests/pipeline-model.test.mjs`. No formula, engine version or expected
   financial fixture was changed.
2. **P2 — preparation-history N+1.** Each message fetched the full evaluation and
   its snapshot/party state again. New `list_prepared` batches immutable snapshots
   and tenant-scoped party metadata and shares blocker/staleness rendering with
   single-resource reads. Mutation/approval locking paths remain unchanged.
   Tests compare list/single responses before/after review/revision, pagination,
   empty history and cross-tenant denial. No response contract or cache was added.
3. **P2 — mobile workspace overflow and inaccessible authentication fields.** Real
   Chromium tests failed at 734 px content in a 390 px viewport and could not find
   an accessible Email field. Reused the existing Radix Sheet for mobile navigation,
   bounded header controls, labelled icon links and form fields, and restored visible
   keyboard focus. Escape returns focus to the menu trigger and selecting a route
   closes the drawer. The existing desktop identity/layout is preserved.
4. **P2 — silent page scope / weak recovery affordance.** Limited pipeline reads
   from 100 to 20 orders/page, exposed Previous/Older and explicit page-only filters,
   counts and summaries, added saved-state refresh and failed-read retry. A 503 read
   fault is injected only in the recovery test; the retry then uses the real API.
5. **P2 — unsupported trust claims.** Removed the sidebar's zero-hallucination claim
   and unsupported landing usage statistics; the existing marketing example is now
   clearly synthetic. These changes enforce supplied product truth, not new claims.
6. **P2 — stale handoff/docs.** P4/P8 are not fully accepted; historical “liveness
   only”, frontend-directory and “uncommitted earlier repairs” claims were misleading.
   Added current-status/precedence notes and updated the concise handoff without
   rewriting the historical implementation record.
7. **P2 — unloaded customer metadata represented as absent data.** A browser test
   retained a real saved order/customer ID but returned an empty bounded customer
   list. It reproduced the false “No customer” label. The row now distinguishes
   “Customer details not loaded” from a genuinely absent customer ID. This does not
   claim to solve customer-list pagination; the underlying acceptance gap remains.

## Additional quality observations

Quality review also identified untyped connection/dictionary interfaces in the
large persistence modules; Ruff is not a Python static type checker. Keep DTOs and
SQL scopes explicit when extracting those modules, rather than hiding the debt
with casts or a generic CRUD abstraction. No new numerical engine duplication was
found in the inspected API/web paths. The existing graph/checkpointer stubs have
no discovered production callers, but were not deleted solely on graph evidence.
Expected manual/readiness fallbacks are distinguished from successful operations;
the pipeline's optional reads catch only explicit 404/409, not arbitrary failures.
The concurrent security work logs safe readiness/security-record failure codes;
this audit does not certify that every exception branch has been exercised.

## Measured performance

Same synthetic database test, eight saved drafts, three reads per size, median
request wall time measured with `perf_counter`; SQLAlchemy statement counter
includes auth/tenant/transaction setup. No shared database or provider involved.

| Message-history page | Before | After |
|---|---|---|
| 1 message | 23 statements / 64.0 ms | 17 statements / 31.8 ms |
| 8 messages | 79 statements / 236.5 ms | 17 statements / 30.3 ms |

The regression asserts bounded query-count growth, not a flaky latency threshold.
These are local microbenchmarks, not production p95 claims. No speculative index,
memoization layer or streaming architecture was added. The pipeline's two initial
fetch waves plus per-evaluation requests remain known waterfall/payload debt;
bounding a page does not eliminate that fan-out. Private authenticated financial
responses must not be put in a public Next cache to improve a synthetic benchmark.

## Browser and UI verification

Current production web image served at `http://localhost:3000`; API/worker/database
stay on the disposable stack's internal network. New synthetic identities only.
Playwright runs real signup, baseline, customer/order creation, confirmation,
background evaluation, persisted reload and negotiation-route return. Additional
tests exercise accessible sign-in names/focus, 390×844 mobile layout (390 px content),
drawer navigation/Escape/focus return, live-session CSRF refresh and failed-read
retry. The built-in browser preview was also inspected at approximately 746 px.
These checks are not a WCAG certification, a cumulative-layout-shift benchmark or
an all-route/all-device review. Long result tables scroll within their container.
Financial writes are not optimistically declared successful.

Scoped UI audit: accessibility 2/4 (covered controls improved; full contrast/keyboard
inventory absent), performance 2/4 (known fetch fan-out), responsive 3/4 (tested
viewport fixed; remaining pages not certified), theming 2/4 (existing hard-coded
palette), integrity 3/4 (misleading copy removed). **12/20**, an incomplete technical
coverage assessment, not a product-design score. Mechanical detector returned no
findings on changed UI files; this does not overrule the reproduced defects.

## Checks executed

- Backend architecture/engine/contracts/agent subset: **214 passed**.
- Preparation suite: **13 passed**; focused P6 approval/execution: **26 passed**.
- Concurrent DB-security tests: **6 passed**; P7 readiness/runtime/S3 follow-up:
  **26 passed** after the stricter-header assertion correction.
- Contract export: **108 operations current**; TypeScript contract examples pass.
- Frontend: **83 unit tests passed**, typecheck passed; lint **0 errors, 10 existing
  warnings**. Production Docker web build passed (Next 16.4.1).
- Browser: **3 passed** (25.6 s), including the desktop capture/viewport assertion.
  A later run with the customer-metadata regression also passed all three audit
  tests. A concurrently added fourth CSP test failed against the earlier image,
  which predated its proxy/layout changes; its assertions were preserved and a
  fresh-image check was started rather than labelling the earlier image a pass.
- Reference engine `--check`: **22 cases, zero problems**; selftest **zero failures**.
- Production dependency audit: **zero vulnerabilities** at this run.
- Full backend rerun and final document/diff checks are recorded in the accompanying
  progress entry when finished; subset counts must not be added as unique coverage.

The first full backend attempt encountered a syntax error in another task's newly
written, transient security test during collection. It was not skipped or weakened;
the complete command was restarted after that concurrent write completed. That
run then stopped at **459 passed / 1 failed** because a concurrently strengthened
cache header (`private, no-store`) no longer matched an old exact `no-store`
assertion. The other task updated the assertion to the exact stronger header;
it was not relaxed to permit caching. A full non-fail-fast rerun was started. Two
browser failures were selector ambiguity (shell/page Customers headings and Next's
route announcer), corrected by scoping assertions to page content. Earlier genuine
mobile/accessible-name failures were fixed in application code.

## Remaining gaps, ranked

1. **P1 release gates — external/independent acceptance.** P4 live extraction quality,
   live adversarial documents, independent final review; P8 Neon/PgBouncer/Render,
   shared private S3 provisioning/least privilege and joint DB/object restore are
   unverified. Local role/SQL and provider-stub passes are not substitutes. Historical
   credential-rotation confirmation is outside this run; no secrets were inspected.
2. **P2 operational truth.** Readiness's `worker` flag is a queue-age approximation,
   not an independent heartbeat. Empty queues can hide a stopped worker. Design and
   verify a bounded heartbeat/death drill before relying on it for hosted monitoring.
3. **P2 scale.** Deal serialization still performs per-row related reads; the
   pipeline loads full evaluations per saved order. Benchmark realistic tenant sizes
   before a summary/batch-read contract change. Legacy offset lists with null cursors
   do not meet the plan's complete cursor-pagination intent; some supporting lists
   can omit older records. Twenty-order paging mitigates only this pipeline view.
4. **P2 acceptance coverage.** This run does not automate the entire
   send/reply/accept/commit/compensate browser journey, all support screens, worker
   death/restart, joint restore, second-machine fresh clone, Vercel upload limits,
   screen-reader/zoom/contrast or layout-shift measurements. Earlier manual sandbox
   evidence in progress is historical, not a newly executed pass.
   The existing expanded connectivity overlay can also obscure mobile content;
   it can be minimized/dismissed, but a compact mobile default remains a follow-up.
   A production bundle-analyzer run and page-level layout-shift measurements were
   not performed; no bundle-size or zero-layout-shift improvement is claimed.
5. **P3 maintenance.** `store/repositories.py` and preparation persistence remain
   large; obsolete graph/checkpointer scaffolds have no discovered production
   callers. A graph zero-call result alone is insufficient deletion authority for
   dynamically reached code. Keep extraction/refactoring separate and test-led.
   Existing font/image/unused-symbol lint warnings and development-dependency audit
   remediation require their own dependency-compatibility check, not a blind downgrade.
6. **Delivery scope.** Competition templates, independent hand calculations,
   deck/video, team validation and actual submission receipt are not established by
   engineering tests. The document folder is not evidence that those activities
   occurred. No legal/compliance or production-readiness claim is made.

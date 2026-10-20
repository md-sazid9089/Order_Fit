# Backend phase stress-test report — 16 October 2026

## Verdict

**The backend is substantially implemented, but the complete acceptance gate is not green.**
The existing backend suite finished with **492 passed / 2 failed / 0 skipped** in
560.20 seconds. Additional stress probes finished with **5 passed / 2 expected
failures**; those expected failures reproduce real readiness and pagination gaps.
The final built Compose Playwright suite finished with **4 passed / 1 failed**
(three browser journeys and one real-HTTP stress case). The browser
failure is an incorrect CSP test expectation, not evidence of a reproduced XSS flaw.
No production application behavior was changed in this review.

The plan and progress were reviewed before testing. Their historical completion
labels were reconciled with current files, migrations and fresh execution. P4 live
provider acceptance and P8 hosted/recovery acceptance remain open. P7's local
regression gate currently fails. Passing local calculations and sandbox effects do
not close these gates.

## Scope and evidence boundaries

- Checkout: `D:\Kam 2\Order_Fit`, clean `main` at
  `61aaff8a1a6f8abd06ca4c0eed7f5fddc07fd663` before audit additions.
- Inputs: [implementation plan](../../initial_backend_implementation_plan.md),
  [progress](../../backend_implementation_progress.md), root/backend instructions,
  development-context handoff, existing audit reports, actual test fixtures,
  phase-relevant services, workflow, storage, SQL and integration configuration.
- Locked Python 3.12 through `uv`; PostgreSQL 17 disposable Docker fixtures;
  actual separate restricted API/worker LOGINs. Migrator privileges were used only
  by the reviewed disposable migration/fault-injection harness.
- Every DB fixture creates a unique labeled container, verifies the target,
  preserves original-schema rows through forward upgrade, and removes its own
  container. Browser acceptance uses unique Compose projects and synthetic users.
  No configured application/hosted database or live provider was used.
- Sole Alembic head and required runtime revision: `0015_session_authority`.
  Generated contracts: **108 operations**. Environment files are not tracked at
  current HEAD, checked by filename only; their values were not read.
- This is local adversarial, recovery, correctness and bounded-burst testing of
  every phase's available suite. It is **not** an exhaustive proof over every
  interleaving, a production traffic benchmark, a multi-hour soak, or hosted
  certification. Unavailable gates are listed explicitly below.

Machine-readable results and reproducible probes are in
[stress-test-2026-10-16](../../stress-test-2026-10-16). Counts from reruns overlap and must
not be added as distinct coverage. The full 494-case run was collected before the
seven new probes were added; no single all-501-case green run is claimed.

## Phase-by-phase assessment

| Phase | Fresh checks and stress evidence | Current conclusion |
|---|---|---|
| P0: contracts | 81 contract cases; generated export current at 108 operations; strict TypeScript contract examples pass; architecture checks pass | Local executable contract checks pass. Handoff schema/status drift needs correction, ST-06. |
| P1: identity, DB, jobs | 19 foundation cases; 296 original SQL assertions and 296 forward-schema assertions; clean and populated upgrades; original/forward concurrency; actual runtime-role isolation; session, CSRF, revocation, idempotency, fencing | Strong local evidence. Whole-suite job isolation is broken, ST-04; hosted pooling/non-superuser migrations remain unverified. |
| P2: engine | 104 engine/adapter cases; 22 reference fixtures; independent selftest; late events, outflow-first, rounding, loan fees, hard/soft constraints, tolerance and admission limits; measured three workloads | Local financial suite passes. Deployment compute capacity still needs calibration; no worst-case guarantee, ST-09. |
| P3: manual persisted path | Vertical slice, review regressions, exports and real-process recovery suites; 24 competing editors; 128 interleaved tenant reads; built browser create/confirm/evaluate/reload/negotiation navigation | Local tested path passes. Supporting-list completeness remains limited, ST-02. |
| P4: documents and extraction | 7 DB document cases, 10 P4 pure cases, private-document/parser/body/security regressions, 8 S3 adapter cases; off/recorded fallback and evidence guards | Tested local/stub paths pass. Live model quality, independent provider/adversarial acceptance and live S3 remain open, ST-07/08. |
| P5: preparation | 13 preparation DB cases and 28 pure cases; stale forks, apply, reply/acceptance, bank-change holds, revisions, role checks and process restart | Local suite passes. No fresh full browser reply/reassess/acceptance walkthrough or live language-quality claim. |
| P6: approval and execution | 9 approval + 17 execution DB cases; execution-recovery/fencing/cancellation suites; crash hooks at six selected transaction boundaries; exact acceptances, second-deal freshness, inverse compensation; 24 execute clicks and 8 workers | Local sandbox invariants tested here pass. No real outgoing adapter or complete browser commitment/compensation automation was exercised. |
| P7: supporting operations | Invitations, owner races, tenant-safe notifications/exports/accounts/history suites; 51-customer continuation probe | **Local gate not green:** outdated role-change test ST-03 and pagination defect ST-02. |
| P8: runtime and handoff | Current API/web images built; isolated stack starts and becomes ready; three browser cases pass; process restart/shutdown/security/runtime tests | **Partial:** false worker readiness ST-01, failing CSP acceptance test ST-05, hosted/live/restore gates ST-07/08. |

## Fresh execution results

| Check | Result | Evidence |
|---|---|---|
| Existing complete backend suite | 492 passed, 2 failed, 1 upstream Starlette/httpx warning; 560.20 s | [pytest.xml](../../stress-test-2026-10-16/pytest.xml) |
| Added seven stress/regression probes | 5 passed, 2 strict xfails; 17.93 s | [console](../../stress-test-2026-10-16/stress-console.txt), [JUnit](../../stress-test-2026-10-16/stress.xml) |
| P7 failure alone | 1 failed; same reauthentication conflict | [isolated result](../../stress-test-2026-10-16/p7-isolated.txt) |
| Session-authority file alone | 3 passed | [isolated result](../../stress-test-2026-10-16/session-isolated.txt) |
| Queue-cap then worker-authority pair | 1 passed, 1 failed; reproduces wrong claimed job | [ordered reproduction](../../stress-test-2026-10-16/queue-order.txt) |
| Ruff / contract export / Alembic | Pass / 108 current / sole head 0015 | Commands below; full-suite module totals in [summary](../../stress-test-2026-10-16/results-summary.json) |
| Reference check and selftest | 22 cases, 0 problems / 0 failures | Executed independently; fixtures unchanged |
| Frontend unit tests | 86 passed | `npm test` executed |
| Frontend typecheck | Pass after regenerating stale local Next route types | Initial cache-only failure described below |
| TypeScript contract examples | Pass | Strict `tsc` against both contract files |
| Frontend lint | 0 errors / 10 warnings | [lint log](../../stress-test-2026-10-16/web-lint.txt) |
| Original built browser suite | 3 passed, 1 failed; 20.2 s | [browser log](../../stress-test-2026-10-16/browser-console.txt) |
| Final browser + HTTP stress suite | 4 passed, 1 failed; 20.1 s; same CSP failure | [final log](../../stress-test-2026-10-16/browser-http-console.txt) |
| Independent CSP diagnostic | Unnonced/wrong-nonce parser scripts blocked; correct nonce and dynamic script execute | [result](../../stress-test-2026-10-16/csp-probe.json), [probe](../../stress-test-2026-10-16/csp-probe.cjs) |

The browser passes cover persisted order/evaluation/reload, accessible sign-in,
390-pixel mobile navigation, CSRF challenge recovery and failed-read retry. They
do not establish complete V15 coverage.

### Burst measurements

Repository/service calls use the real restricted runtime/worker connections and
the normal five-connection pools. These are local finite bursts, **not HTTP
requests per second**. Times include waiting for a pool connection and locks.
Tests ran alongside other checks; single samples are diagnostic rather than SLOs.

| Workload | Calls / caller concurrency | Wall s | p50 / p95 / max ms | Invariant |
|---|---:|---:|---:|---|
| Same idempotency key | 64 / 16 | 0.554 | 37.93 / 527.36 / 548.69 | Exactly one operation and admission audit row; chain valid |
| Distinct keys | 64 / 16 | 0.650 | 41.57 / 626.35 / 645.60 | Exactly 25 accepted, 39 capacity rejections; another tenant admitted |
| Alternating tenant reads | 128 / 16 | 0.472 | 18.89 / 445.27 / 468.67 | Each sees only its operation; unscoped pooled connection sees zero |
| Same-version editors | 24 / 16 | 0.286 | 106.13 / 232.88 / 238.34 | One save, 23 explicit stale-version conflicts |
| Same approved bundle, distinct keys | 24 / 16 | 0.342 | 126.89 / 322.91 / 338.46 | One admitted operation/run |
| Competing worker calls | 8 / 8 | 0.128 | 23.40 / 127.30 / 127.30 | One sandbox effect and one round increment after draining |

### Engine measurements

| Input | Wall s | CPU s | Charged work units | Candidates / series points |
|---|---:|---:|---:|---:|
| OF-02 | 18.804 | 18.391 | 8,385,004 | 45 / 46,440 |
| 10,000-combination boundary | 15.890 | 15.688 | 7,568,833 | 51 / 111,996 |
| Near estimated admission ceiling, 900 baseline events | 52.851 | 52.172 | 16,789,876 | 51 / 111,996 |

Process-lifetime peak working set: **342,999,040 bytes (~327.1 MiB)**, including
imports and retained previous results. The current worker uses a 90-second compute
timeout and 512-MiB child limit; Compose gives the worker 768 MiB. This benchmark
calls the engine directly and does not measure the parent's plus child's combined
peak, JSON/IPC/publication cost, or performance on hosted hardware. The near-ceiling
label concerns admission's conservative estimate, not 100 million charged units.
See [recorded metrics](../../stress-test-2026-10-16/engine-benchmark.json).

### Real HTTP through the built proxy

The additional `web/tests/e2e/backend-stress.spec.ts` case passed in 2.4 seconds
against a fresh disposable stack and two independently authenticated synthetic
accounts. These calls cross the actual Next proxy/API/network boundary.

| HTTP burst | Requests / concurrency | Wall ms | p50 / p95 / max ms | Result |
|---|---:|---:|---:|---|
| Mixed-tenant profiles | 200 / 16 | 1,421.16 | 99.24 / 229.79 / 302.72 | 150 own profiles returned correct IDs; 50 foreign-tenant reads returned 404; every response no-store |
| Same-key customer writes | 32 / 16 | 397.81 | 148.16 / 253.73 / 279.83 | All returned 200 and the same customer ID; exactly one saved customer; changed-body replay then returned 409 `IDEMPOTENCY_CONFLICT` |
| Malformed customer writes | 32 / 8 | 76.21 | 18.54 / 23.19 / 23.50 | Unknown field, bool/string revision and empty-name variants all returned 422; saved count remained one |

These short HTTP bursts add network/proxy evidence but do not close ST-09's
sustained traffic, many-tenant fairness or production-resource calibration gates.

## Findings and resolution contracts

Priority: P1 blocks trustworthy release acceptance; P2 is a functional/operational
gap requiring repair before the affected capability is claimed. No new critical
financial-corruption or cross-tenant exploit was reproduced by these runs.

### ST-01 — P2 — Worker readiness reports success without a worker

**Confirmed application defect; previously documented, freshly reproduced.**
`backend/orderfit/store/db.py:107-118` sets `worker` from queue age alone. In a
fresh migrated database, before starting any worker process, readiness returned
`database=true, schema_current=true, worker=true`. Empty/recent queues conceal a
stopped worker for at least the backlog grace period; an empty queue can conceal
it indefinitely. This contradicts plan section 12.3's recent-heartbeat requirement.

Reproduce with `test_readiness_requires_a_worker_process` in the new audit module;
it is a strict expected failure, not a passing health assertion. Repair with a
durable worker heartbeat/expiry and retain backlog age as a separate signal.
Completion: no-worker, stopped-worker, expired-heartbeat, long healthy job and
restart drills report accurately without reporting business/provider success.

### ST-02 — P2 — Bounded supporting lists falsely imply no continuation

**Confirmed contract/completeness defect; previously documented, freshly reproduced.**
`CustomerRepository.list_customers` (`store/repositories.py:506-537`) returns
`next_cursor=None` for a full 50-row page even when another row exists. The probe
created 51 customers: default page 50, null cursor, offset 50 page 1. Data exists
but cursor consumers cannot discover it. Payees/offers and other legacy list
methods inspected also unconditionally return null cursors; those were not all
independently populated at scale in this run.

Current new-order/source screens load a single default supporting page
(`web/app/deals/new/page.tsx:21`, `web/app/deals/sources/page.tsx:25`), so older
customers/lenders may be absent from selectors. Showing “details not loaded”
avoids a false absence claim but does not retrieve those records.

Reproduce with `test_customer_page_exposes_continuation_for_51_records` (strict
xfail). Choose one complete pagination contract: stable tenant-bound cursors with
all consumers updated, or explicit offset/has-more metadata and paging UI. Avoid
merely increasing the first-page limit. Completion: >page-size datasets, stable
ties, tenant-mismatched/tampered cursors, archived rows and selector retrieval.

### ST-03 — P1 acceptance — P7 regression expects pre-0015 session behavior

**Confirmed test/contract reconciliation defect, not a reproduced authorization bypass.**
`tests/db/test_p7_operations.py:256` calls `risk.revision()` after the owner changes
that user's role. It assumes the old session can still read `/profile`; actual
response is 403 `SESSION_REAUTH_REQUIRED`. The test also explicitly expects old
session profile access later. Migration `0015` intentionally invalidates old
authority in that business; the dedicated session-authority file passes all three
tests when run alone. The P7 failure reproduces in isolation.

Keep the stronger authentication boundary. Update the scenario to assert denial
with the old session, sign in again, then assert viewer read access, forbidden
financial writes, revocation and last-owner protection. Preserve its later
reinstatement/self-escalation assertions, which the early failure currently prevents
from executing. Completion: isolated P7 test, session-authority suite and complete
backend run all pass without weakening migration 0015.

### ST-04 — P1 acceptance — Global queue leaks between tests

**Confirmed suite-order isolation defect, not a demonstrated wrong-tenant effect.**
`tests/db/conftest.py` shares its database for the session. The queue-cap test in
`tests/db/test_security_hardening.py:60` leaves accepted jobs queued. The later
`test_session_authority.py:95` assumes the next global worker claim is its own
newly submitted operation. In the full run it claims another UUID. The entire
session-authority file passes alone; running queue-cap immediately before that
worker test reproduces the failure on a fresh DB.

The worker selecting an older eligible job is not itself incorrect. Isolate jobs
per test or terminalize only fixture-owned synthetic jobs during cleanup; make
claim-based fixtures explicit about their global-queue preconditions. Do not
change production claim ordering or skip the authorization assertion to pass.
Completion: the two-test reproducer, full suite and randomized-order repetitions
all pass, including after an earlier assertion failure.

### ST-05 — P1 acceptance — CSP browser test asserts the wrong threat model

**Confirmed browser-test defect; no XSS vulnerability established.**
`web/tests/e2e/security-csp.spec.ts:17-24` creates a script through
`page.evaluate`/`document.createElement` and expects it to be blocked. It executes
under the actual nonce + `strict-dynamic` policy. Independent loopback Chromium
with the equivalent policy reproduced this while blocking both parser-inserted
unnonced and wrong-nonce scripts and allowing a correct nonce.

This behavior matches the current [W3C CSP3 matching algorithm, section
6.7.3.3](https://www.w3.org/TR/CSP3/#match-element-to-source-list): non-parser-inserted
script elements match `strict-dynamic`. The existing test therefore cannot support
its “blocks injected scripts” claim by starting with already executing JavaScript.

Replace the attack assertion with controlled response/HTML injection parsed by
the browser, plus wrong-nonce and inline-handler checks; retain fresh-nonce,
no-store and real hydration assertions. Audit script-creation sinks separately
for untrusted inputs. Do not add `unsafe-inline`, remove CSP, or claim every DOM
XSS sink is protected based on a header string test. Completion: the full browser
suite passes meaningful positive/negative controls against the built app.

### ST-06 — P2 handoff — Current schema and latest acceptance are undocumented

**Confirmed documentation drift.** The development-context skill requires 0014
and describes an earlier uncommitted checkout; current code/sole head is 0015 at
61aaff8. Progress retains historical 0014 and split-run evidence without a current
0015 acceptance entry. Historical entries are useful but not today's status.
This report's accompanying handoff/progress update records current facts. Future
resolution must preserve the two migrations' semantics and identify test results
by code version, not replace historical evidence with a blanket “complete”.

### ST-07 — P1 release gate — Live provider/adversarial acceptance incomplete

**Unverified, not an observed provider failure.** Off/recorded/stub paths pass;
no live OpenAI request, model selection, measured extraction quality, real refusal/
rate-limit recovery or provider budget acceptance ran. P4 remains partial under
the plan's own scope. Close with explicitly configured synthetic live evaluation,
recorded model/prompt/schema provenance, ambiguity/source-conflict/adversarial
cases and measured failure/quality criteria. Manual fallback must remain available.

### ST-08 — P1 release gate — Hosted and joint-restore acceptance incomplete

**Unverified, not an observed hosted failure.** No live Neon/PgBouncer transaction
pooling, non-superuser migrator privileges/notification triggers, Render worker
restart, actual private S3 IAM/encryption/retention/canary, Vercel upload ceiling or
joint DB/object backup-restore drill ran. Earlier security documentation's request
to confirm historical credential rotation also remains unverified here; credential
values/history were not re-inspected.

Close in an explicitly disposable hosted environment: provision restricted roles,
run cross-tenant/context/recovery tests through the actual pool, verify shared
bytes from API and worker, restore DB plus objects and compare document hashes,
snapshot/effect/audit references. Object creation and DB commit are not atomic;
include crash/orphan reconciliation before enabling deletion lifecycles. Do not
claim local PG17 or S3 Stubber results as this evidence.

### ST-09 — P2 capacity — Deployment resource envelope and sustained load unknown

**Measured local cost plus missing capacity evidence, not a reproduced timeout.**
Near-ceiling synthetic analysis took 52.851 seconds locally, compared with the
90-second child timeout. That is not a safe universal margin on different CPUs.
Finite service bursts establish tested consistency, not sustained HTTP throughput,
queue fairness across many tenants, memory plateau or production p95 latency.

Extend the passing finite HTTP bursts to sustained mixed workloads on deployment-sized
containers: distinct sessions/tenants, parser and Argon2 saturation, DB pool
exhaustion, engine output serialization, cancellation and worker recycling. Record
arrival/service rates, accepted/rejected counts, queue wait, p95/p99, parent+child
RSS, resource-limit outcomes and cleanup. Keep typed technical-limit results;
never turn a timed-out/incomplete search into financial decline. Existing deal
serialization/fetch fan-out warrants measurement before a batch/read-model refactor.

## V01–V16 evidence reconciliation

| Gate | Evidence exercised now | Remaining limit |
|---|---|---|
| V01 contracts | Strict primitive/hash/examples/export/TS cases pass | Route count alone does not prove each product capability |
| V02 schema | 296/296 before and after upgrade; populated preservation; clean upgrade | Hosted migrator compatibility/restore absent |
| V03 runtime isolation | Restricted LOGINs, RLS/definer grants, no context, hostile tenant, 128 alternating reads | Real hosted transaction pool absent |
| V04 auth | Session/CSRF/revocation/owner races and 0015 isolated tests | ST-03 stale test blocks P7's later assertions in that scenario |
| V05 deterministic parity | 22 fixtures, independent financial checks/selftest, purity | No numerical fixture regenerated |
| V06 completeness | Late baseline/loans/horizon/scan/admission/resource cases, benchmark | Production hardware envelope unknown |
| V07 source integrity | Hash/private bytes/MIME/PDF/CSV/dedupe/evidence/security tests | Hosted storage/crash reconciliation and broad real corpus absent |
| V08 provider boundary | Off/recorded/no-fallthrough/guards/fallbacks and adapter simulations | Live quality/adversarial acceptance open |
| V09 freshness | Direct-child mutations, stale snapshots/forks/publication/approval/execution | Exhaustive concurrent schedules not claimed |
| V10 job recovery | Real process restart, competing claim, expiry/fencing/retry/cancel | ST-04 suite isolation; hosted death/fault drills absent |
| V11 authorization | Exact bundle, T3/step-up, revoke/expiry/changed recipient/acceptances | Full browser route coverage absent |
| V12 idempotency | Same/different material, retention/permanent run dedupe, 64-key bursts | Real network response-loss across every write route absent |
| V13 execution | Crash hooks, partial/retry/settlement, concurrent deals, projections/inverse compensation, 24 clicks | Hooks cover selected boundaries, not every possible process kill; sandbox only |
| V14 audit | Concurrent append, PostgreSQL canonical bytes and tamper/export checks | No external tail anchor or joint restore established |
| V15 frontend | Built persisted order journey, refresh, sign-in, mobile/CSRF/read retry | CSP test fails; full send/reply/commit/compensate/business-switch/offline journey not rerun |
| V16 operations | Built running stack, schema/readiness, process recovery/shutdown tests | ST-01 and hosted/restore gates remain open |

## Reproduction commands

Run from `backend/` (Docker available; these tests create their own disposable DBs):

```powershell
uv run --frozen --extra dev python -m pytest -q --tb=short -p no:cacheprovider --junitxml=../docs/stress-test-2026-10-16/pytest.xml
uv run --frozen --extra dev python -m pytest tests/db/test_phase_stress_audit.py -q -s -rx --tb=short -p no:cacheprovider
uv run --frozen --extra dev python -m pytest tests/db/test_p7_operations.py::test_last_owner_role_downgrade_and_revocation_take_effect_next_request -q --tb=short
uv run --frozen --extra dev python -m pytest tests/db/test_session_authority.py -q --tb=short
uv run --frozen --extra dev python -m pytest tests/db/test_security_hardening.py::test_queue_cap_serializes_concurrent_admissions_and_keeps_replay_and_other_tenant tests/db/test_session_authority.py::test_old_worker_context_cannot_read_publish_or_settle_after_role_change -q --tb=short
uv run --frozen --extra dev ruff check .
uv run --frozen --extra dev python -m orderfit.contracts.export --check
uv run --frozen --extra dev python -m alembic heads
uv run --frozen --extra dev python -m tests.engine.benchmark_engine
uv run --frozen --extra dev python ../docs/architecture/orderfit/fixtures/reference_engine.py --check
uv run --frozen --extra dev python ../docs/architecture/orderfit/fixtures/selftest.py
```

Run from `web/`: `npm ci --no-audit --no-fund`, `npx playwright install chromium`,
`npm run typecheck`, `npm test`, `npm run lint`, and
`npx --no-install tsc --strict --noEmit ../docs/contracts/frontend-api.d.ts ../docs/contracts/typecheck.ts`.
From repository root, `./scripts/run-e2e.ps1` builds/provisions/starts/tests/cleans
the disposable stack; `-SkipBuild` reuses the just-built images. The independent
CSP diagnostic is `node docs/stress-test-2026-10-16/csp-probe.cjs`.

### Execution incidents, kept separate from product defects

- First browser attempt built/started a ready stack but lacked the local Playwright
  command. After locked installation, a second attempt lacked its pinned Chromium
  executable. Browser installation resolved those environment prerequisites; the
  final 3/1 result is the application/test run, not either setup failure.
- Local `npm run typecheck` first read obsolete `.next/dev/types` entries for
  deleted admin routes. Preserved and inspected those generated files, removed
  only that stale generated set, ran `next typegen`, then typecheck passed. No
  source route, tsconfig include, dependency version or assertion was relaxed.
- The initial new stress harness left its synthetic capacity jobs queued before
  reusing a fixture that claims one global job, causing fixture setup failure.
  Added explicit module-local synthetic-job cleanup and reran. This is recorded
  in [initial evidence](../../stress-test-2026-10-16/stress-initial-harness-error.txt),
  not counted as an application failure. Existing-suite ST-04 was independently
  reproduced without that new module.
- Automatic approval review rejected an initial cleanup command for insufficiently
  verified directory scope. After enumerating exact contents, only four generated
  type files and the confirmed empty audit-created directories were removed with
  literal paths. No cleanup remains blocked and no user files were deleted.

## Recommended repair sequence

1. Reconcile ST-03 role-change test and ST-04 fixture isolation; repair ST-05's
   attack model. Rerun complete backend/browser suites without suppressions.
2. Implement truthful worker heartbeat readiness and complete list continuation
   plus consumers (ST-01/02). Turn the two strict xfails into passing regressions
   when each defect is fixed; do not treat expected failures as accepted behavior.
3. Measure hosted-sized HTTP/worker resource behavior, including contention and
   saturation, then set workload/latency limits from those measurements (ST-09).
4. Close explicitly scoped P4 provider and P8 hosted/joint-restore gates (ST-07/08).

The modular monolith and PostgreSQL queue fit the bounded sandbox scope; these
results do not justify replacing them with another queue/framework. Their costs
are explicit lock order, global-queue test isolation, pool waits and workflow
recovery discipline. Increasing concurrency or list limits alone would hide those
costs rather than resolve the observed contracts.


## Subsequent remediation

The original findings and evidence above are preserved. See
[backend stress remediation](backend_stress_remediation_2026-10-16.md) for the
current fixes, forward migration, UI/API contracts, fresh local verification,
capacity measurements and still-unrun ST-07/ST-08 external gates.

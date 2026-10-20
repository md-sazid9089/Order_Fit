# Backend stress remediation — 16 October 2026

This reconciles the [original audit](backend_stress_test_report_2026-10-16.md).
Original audit files/evidence and unrelated checkout changes were preserved.
Starting branch was `main`, HEAD `61aaff8a1a6f8abd06ca4c0eed7f5fddc07fd663`, with
the audit, probes, browser stress test, progress and context handoff uncommitted.
No reset/clean/branch switch, commit, hosted migration, paid call, credential
rotation or real outgoing action was performed.

The repaired source remains an uncommitted working tree atop that HEAD. Exact
per-file SHA-256 values and source manifest digest
`0b0348328ca22d8ddc14b0e5898eab8276b54eea65ba7cfbf7834f412465f8ba`
are recorded in
[code-version.json](../../stress-remediation-2026-10-16/code-version.json); do not
attribute these repairs to the unchanged base commit. Evidence from overlapping
focused runs is not added together as unique full-suite coverage.
Machine-readable final counts, HTTP metrics and source-hash verification are in
[final-summary.json](../../stress-remediation-2026-10-16/final-summary.json).

## Finding status

| Finding | Status | Final repair / remaining gate |
|---|---|---|
| ST-01 worker readiness | Fixed and verified locally | Durable worker-only DB-time process heartbeat, 60-second expiry, separate one-connection publication pool; `/ready` gates on global live capacity and reports backlog independently. |
| ST-02 continuation | Fixed and verified locally | Signed scoped keyset continuation on eight legacy collections, explicit offset compatibility, actual-default policy filter, bounded UI continuation and recoverable partial states. |
| ST-03 role-change scenario | Fixed and verified | Old-session reauthentication asserted, supported HTTP sign-in after demotion and reinstatement, viewer reads/write denial, revocation/last-owner/self-escalation assertions retained. |
| ST-04 queue contamination | Fixed and verified | Per-test operation-ID ownership and unconditional teardown in the labeled disposable DB; no production ordering change or history deletion. |
| ST-05 CSP threat model | Fixed and verified | Parser-inserted missing/wrong nonce scripts and inline handlers blocked, valid nonce executes, hydration/fresh nonce/no-store/navigation retained. No reachable application injection sink was demonstrated. |
| ST-06 current documentation | Fixed and verified | This report, integration contracts, deployment notes and maintained development context supersede historical gaps without rewriting old evidence. |
| ST-07 live OpenAI acceptance | External blocked | Explicit-budget synthetic probe and independent scoring procedure prepared; no approved paid budget/model/project or credentials supplied. Broader P4/P5 quality acceptance remains open. |
| ST-08 hosted/restore/rotation | External blocked | Executable pooled/storage/restore probes and exact provider procedures prepared; approved disposable hosted target, private bucket, restore pair and rotation evidence absent. |
| ST-09 local capacity/recovery | Fixed and verified for bounded local workload | Reproduced pool starvation; bounded wait/typed retryable capacity outcome added; sustained service/HTTP and worker/resource recovery measured. Hosted capacity and longer soaks remain unverified. |

## Root causes and trade-offs

**Readiness:** an empty/young queue was treated as a worker. A queue observation
cannot establish a process exists. Forward revision `0016_worker_presence`
executes `0017_worker_presence.sql`; applied SQL/revisions are untouched. Its
global FORCE-RLS table has no API/worker direct table grants. Narrow definer
helpers expose only publication to `orderfit_worker` and a boolean to
`orderfit_app`; no new privileged runtime role or RLS bypass was introduced.
PostgreSQL controls timestamps/expiry. Startup publishes before claims; a separate
thread continues through long work; graceful shutdown removes only its UUID;
death ages out; restart gets a fresh UUID. Global readiness can remain true when
another replica lives. This adds one reserved DB connection per worker. It
establishes liveness, not provider quality, queue fairness or available throughput.

**Lists:** repositories applied LIMIT/OFFSET then always returned null continuation;
several screens separately fetched only the first 50/100 records. Producers,
OpenAPI/declarations, typed clients and all enabled affected selectors/screens
now agree on continuation. Signed cursors bind actor/business/resource/sort/filter,
use a unique ID tie-breaker and fetch limit+1. Equal timestamps, archived history,
newer insertions, invalid/foreign/filter/deal-mismatched tokens and exact end-of-list
have regressions. PostgreSQL `biz_date` needs its underlying DATE type when
decoding a cash-event cursor; the broad HTTP regression caught and repaired this
before final acceptance. An actual-default filter avoids replacing an older
default with the newest non-default version. Offset compatibility is deliberate;
the 20-order pipeline can shift on concurrent inserts, while forward keyset
traversal is stable for immutable sort keys. Cash-date edits require refresh.
There is no snapshot/fetch-all promise. See the complete endpoint/consumer inventory
and examples in [the contract](../../contracts/stress-remediation.md).

**Tests:** 0015 intentionally invalidated membership authority after a role change.
The P7 scenario incorrectly read through an old session and therefore never
reached later assertions. Reauthentication now occurs after both role changes,
without changing production authority. Separately, a queue-cap test left global
jobs for the next test's global claim. An autouse disposable-fixture boundary
captures existing IDs and terminalizes only operations created by its test in
`finally`; immutable history remains. Each parallel pytest process must retain
its own fixture DB. The stress module's global drain was removed.

**CSP:** `page.evaluate` starts with script authority, so a dynamic non-parser
script is not a sound negative control under `strict-dynamic`. The independent
diagnostic reproduced that behavior before edits. The browser test now injects
controlled HTML into the actual server response and tests parser/handler behavior
under its fresh nonce policy. `strict-dynamic` and production protection were not
weakened. Privileged response interception models a negative control; it is not
proof of a reachable injection sink.

**Capacity:** sustained demand could starve a waiting checkout in the five-slot
pool for its old 30-second wait. HTTP had generic retryable 503 handling, but
services lacked an explicit capacity contract. Wait is now bounded to three
seconds and authenticated transactions return typed `DATABASE_CAPACITY`/503.
Pool size/overflow, engine/input/parser/password limits and financial semantics
were not increased or relaxed. Under high demand, retryable rejection is preferable
to consuming request threads for prolonged waits; callers retain original keys.
A real all-connections-held HTTP regression verifies typed rejection then recovery.

## Files and integration changes

- Storage/runtime: `backend/orderfit/store/db.py`, `collection_page.py`,
  `repositories.py`, `document_repository.py`; new `workflow/presence.py` and
  worker lifecycle integration; new forward SQL/revision above. SQL exact definer
  and FORCE-RLS inventories updated conditionally so original schema still passes.
- API/contracts: business/deal/document routes, Readiness DTO, contract exporter,
  generated `docs/contracts/{openapi.json,frontend-api.d.ts}` and
  `web/lib/generated-api.d.ts`; strict TypeScript examples. Operation count stays 108.
- Frontend: shared `collection-pages.tsx`; new/edit order, sources, document and
  preparation workspaces; customers, payees, financing, risk and cash-flow screens;
  pipeline bounded metadata lookup/end detection; P7/document clients and health
  indicator explanation. Existing command/version/idempotency paths remain.
- Regression/evidence: disposable queue fixture, P7/session/readiness probes,
  `test_collection_continuation.py`, `test_stress_remediation.py`,
  `test_sustained_capacity.py`, process resource sampler, CSP/pagination/HTTP
  browser cases, explicit opt-in `tests/external_acceptance.py`.
- Documentation: [contract](../../contracts/stress-remediation.md),
  [external runbook](../../deployment/external-acceptance.md), progress/context and
  deployment reconciliation. File-level exact version inventory is the manifest.

## Verification commands and fresh evidence

Commands use Python 3.12/locked uv and the installed web dependencies. On this
Windows workspace use `uv --cache-dir 'D:\Kam 2\.uv-cache' run --frozen ...`
instead of the inaccessible default cache. DB commands below create uniquely
labeled loopback PostgreSQL 17 containers and actual restricted API/worker logins;
they never consume application URLs. Docker/browser commands required sandbox
escalation for the engine/Chromium, and were authorized by automatic review.

From `backend/`:

```powershell
uv run --frozen python -m pytest -q --tb=short -p no:cacheprovider --junitxml=../docs/stress-remediation-2026-10-16/backend-full.xml
uv run --frozen python -m pytest tests/db/test_phase_stress_audit.py -q -s -p no:cacheprovider
uv run --frozen python -m pytest tests/db/test_stress_remediation.py tests/db/test_sustained_capacity.py -q -s --tb=short -p no:cacheprovider
uv run --frozen python -m pytest tests/db/test_collection_continuation.py -q -p no:cacheprovider
uv run --frozen python -m pytest tests/db/test_session_authority.py tests/db/test_phase_stress_audit.py tests/db/test_security_hardening.py tests/db/test_session_authority.py::test_old_worker_context_cannot_read_publish_or_settle_after_role_change -q -p no:cacheprovider
uv run --frozen ruff check .
uv run --frozen python -m orderfit.contracts.export --check
uv run --frozen python -m alembic heads
uv run --frozen python ../docs/architecture/orderfit/fixtures/reference_engine.py --check
uv run --frozen python ../docs/architecture/orderfit/fixtures/selftest.py
uv run --frozen python -m tests.external_acceptance pooled --target dry-run
```

From `web/`: `npx --no-install tsc --strict --noEmit
../docs/contracts/frontend-api.d.ts ../docs/contracts/typecheck.ts`, then
`npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.
From root: `./scripts/run-e2e.ps1` rebuilds a unique disposable Compose project;
the final browser-only test-harness correction reused those same rebuilt images
with `./scripts/run-e2e.ps1 -SkipBuild`. Finally `git diff --check` and link/hash
consistency checks. No golden output was regenerated.

| Gate | Fresh result / artifact |
|---|---|
| Baseline reproduction before repairs | 2 failed / 1 passed / 2 strict xfails; [baseline.xml](../../stress-remediation-2026-10-16/baseline.xml) |
| Provisional non-fail-fast backend run | 504 passed; [log](../../stress-remediation-2026-10-16/backend-provisional-504.txt); superseded by final run below |
| Final complete backend suite | **507 passed, 0 failed, 0 skipped**, 610.34 s, no fail-fast; [log](../../stress-remediation-2026-10-16/backend-full.txt), [JUnit](../../stress-remediation-2026-10-16/backend-full.xml) |
| Original/forward SQL, clean/populated upgrade | Each original/forward suite 296/296; original/forward audit/optimistic-lock concurrency passed; populated original rows preserved; fresh empty DB migrated to sole head |
| Restricted roles/RLS/new storage | Worker/API table access denied, API publication denied, current runtime login/schema checks and definer inventory; included in recovery/full evidence |
| Repaired stress expected failures | Both xfail decorators removed; original intended assertions retained; **7 passed / 0 xfails**, 15.58 s, in [stress log](../../stress-remediation-2026-10-16/stress.txt) |
| Process/pool/pagination + sustained acceptance | 5 passed, 170.00 s; [recovery-load.txt](../../stress-remediation-2026-10-16/recovery-load.txt), [JUnit](../../stress-remediation-2026-10-16/recovery-load.xml) |
| Supporting collection HTTP acceptance | 1 passed, 11.28 s; [log](../../stress-remediation-2026-10-16/collections.txt) |
| Session/stress/security order variation | 17 passed, 27.46 s; [log](../../stress-remediation-2026-10-16/order-variations.txt). Exact original ordered pair: 2 passed, 10.39 s; [pair](../../stress-remediation-2026-10-16/ordered-pair.txt) |
| Ruff / generated / sole head | Clean / 108 current / `0016_worker_presence` |
| Reference / independent selftest | 22 cases / 0 problems; 0 selftest failures; [reference](../../stress-remediation-2026-10-16/reference.txt), [selftest](../../stress-remediation-2026-10-16/selftest.txt); no golden regeneration |
| Frontend | 86 unit tests; typecheck and strict examples pass; lint 0 errors / 10 existing warnings; production build passes |
| Rebuilt browser/HTTP | 6 passed (1.5 minutes), including 60-second HTTP workload; [final log](../../stress-remediation-2026-10-16/browser-final.txt) |
| External probe | CLI/help/dry path executed without network; no live gate run |

Early failures include a duplicate test cookie scope, omitted CSRF cookie, an
overcomplete policy-write fixture and a browser locator; fixtures were corrected
without weakening the contract. The sustained HTTP harness initially selected its
own tenant for a supposed foreign request (200 was correct); the target was fixed.
Failed harness logs are preserved separately. The initial sustained service failure
is retained in [sustained-initial.txt](../../stress-remediation-2026-10-16/sustained-initial.txt).
No failed attempt is counted as a pass. Upstream Starlette/httpx and SQLAlchemy
DOMAIN operator deprecation warnings remain visible, not suppressed.

## Capacity measurements and limits

Thresholds were specified in the executable workloads before judging results:
60 seconds, two synthetic tenants/distinct sessions, service concurrency eight,
CPU/parser/password concurrency eight; zero unhandled errors or isolation/replay
breaches, both tenants progress, local service p95 below five seconds, no checked-out
connection or owned child after recovery. HTTP extension: concurrency eight,
60 seconds, at most 100,000 requests, exact 200/404/422 outcomes, zero 5xx and
local p95 below two seconds. These diagnostic budgets are not production SLOs.

The corrected process/resource run (recovery-load.txt) measured:

| Measure | Observed |
|---|---|
| Service workload | 7,588 measured workload cycles / 60.062 s, two tenants / two sessions / concurrency 8; cancellation cycles include admission, poll and cancel calls |
| Latency | p50 30.605 ms; p95 110.418 ms; max 3,013.007 ms (bounded pool wait) |
| Reads / exact replays | 1,507 reads; 1,506 same-ID replays |
| New-operation paths | 1,005 admissions without cancel request; 1,073 admissions followed by an accepted cancellation request |
| Editors | Exactly one save per tenant; 1,503 stale-version rejections |
| Deliberate backpressure | 935 queue-capacity 429; 57 database-capacity retryable 503 |
| Parser/password saturation | 2 real PDF parsers + 2 real Argon2 hashes accepted; 14 parser-capacity and 14 auth-capacity rejections; admission slots recovered |
| Queue wait | Maximum sampled claim wait 2.228 s |
| Worker during load | Owned production-lifecycle process killed at 20.000 s, restarted at 25.140 s; no owned child remained after recovery |
| Death expiry (separate process acceptance) | 58.219 s after kill; pulse maintained during 12-second occupied main loop; restart and multiple-worker behavior verified |
| Parent resident memory | Before 122,732,544 B; peak 142,524,416 B; after GC/recovery 142,397,440 B |
| Child resident memory | Engine subtree sampled peak 307,945,472 B; other children peak 100,814,848 B |
| Simultaneous aggregate peak | 532,848,640 B (about 508.16 MiB), includes test parent, engine, PDF/presence descendants; Docker DB excluded |
| Pool/child recovery | Both pools checked out 0; no extra owned descendant remained |
| Heavy engine cases | OF-02 18.621 s; 10,000-combination boundary 17.300 s; near work-admission ceiling 44.702 s; no financial meaning/golden changes |

Windows venv launchers can be small redirector processes. The first sampler
measured only their PID and therefore undercounted compute memory; it is not
accepted as child-memory evidence. The corrected sampler discovers owned
descendants, measures their working sets and terminates complete owned trees.
The engine also reports lifetime peak 342,953,984 B; sampled and lifetime peaks
are different quantities and are not added. Sampling can miss brief peaks.

The parent retained roughly 19 MiB above its starting working set after GC. This
single finite observation establishes pool/process recovery, not absence of a
long-term memory leak. Workloads ran on this Windows/Docker machine alongside
other local checks; repeat on intended deployment resources and longer durations.
The engine benchmark is a direct separate compute process, not proof of the
production worker's aggregate container memory. Existing bounded-compute and
technical analysis-limit regressions remain part of the backend suite. Host-wide
and PostgreSQL container memory were not calibrated. No timeout, pool size,
engine work allowance or input limit was increased to hide a failure.

Final HTTP through the built same-origin proxy: 6,827 requests in 60.039 s,
concurrency eight, p50 63.211 ms / p95 139.369 ms / max 277.813 ms. Exactly 5,119
returned 200, 854 foreign-tenant requests returned 404, and 854 invalid writes
returned 422; no 5xx occurred. Initial bursts in the same final run: 200 reads at
concurrency 16, p95 460.04 ms; 32 same-key writes at concurrency 16, p95 524.26 ms;
32 invalid writes at concurrency eight, p95 36.80 ms. The measured same-key path
preserved one customer ID/row and changed-body replay remained 409.
`HTTP_STRESS_METRIC` and `HTTP_SUSTAINED_METRIC` in browser-final.txt are the raw
records. Service timings are not substituted for proxy/browser timings.

## Remaining prerequisites and risks

The [external acceptance runbook](../../deployment/external-acceptance.md) gives explicit
commands, credentials-by-name, disposable-target checks, budgets, scoring criteria
and evidence requirements for model quality, pooled tenant context, non-superuser
migrations/notifications, Render death/restart, cross-service private S3 policy,
Vercel upload limits, joint restore/hash/reference reconciliation and historical
credential rotation. None is passed by local PG17, a Stubber or a dry run.

The current workload is a finite local diagnostic, not a hosted capacity limit or
multi-hour soak. Live provider quality, broader language corpora, full browser
send/reply/commit/compensation automation and all-route accessibility acceptance
remain outside these repaired findings. DB/object storage still lacks an atomic
joint commit/snapshot: an upload crash can leave an orphan; hosted restore must
reconcile both stores. Sandbox-only execution, deterministic engine, membership,
approval, audit and idempotency invariants remain required. P4 and P8 hosted gates
remain open; this report does not declare the product production-ready.

# Backend stress test plan 2

Prepared: 17 October 2026 (Asia/Dhaka). Repository inspected: `D:\Kam 2\Order_Fit`, branch `main`, HEAD `eef7bea2f7d622dc293f8667a120222666fa0d29`; working tree clean at inspection start.

This is a proposed execution plan grounded in the current repository. No stress tests, provider calls, deployments, migrations or restore drills were executed while preparing it. Historical results below are repository-reported evidence, not fresh acceptance. Recheck HEAD and schema before execution; results from a moving checkout cannot certify one release.

## 1. Objectives and scope

Establish where the backend stops meeting an explicit service envelope, whether overload fails safely, and whether recovery preserves tenant boundaries, financial correctness and exactly-once business outcomes. Measure HTTP admission separately from durable job completion. A fast `202` is not a completed evaluation or sandbox action.

Cover the entire repository's backend-relevant surface: API and authentication, deterministic engine, language boundary, document parsing/storage, PostgreSQL schema and runtime privileges, durable jobs, preparation/replies, approvals/execution/compensation, supporting collections, exports/audit, browser/proxy contracts, CI and deployment recovery. Frontend visual design and real bank/email/payment/lender integrations are outside this plan; browser tests validate backend consumers and sandbox effects only.

Required outputs of an eventual run:

1. A reproducible baseline on one frozen source/image/schema snapshot.
2. Per-route and per-operation capacity curves, including rejected and timed-out work.
3. Race and fault results with persisted-state assertions, not HTTP-only checks.
4. Recovery, fairness, resource and restore evidence for each tested environment.
5. A severity-ranked finding register and an explicit list of unrun gates.

## 2. Repository analysis and evidence boundary

### 2.1 Source map

Paths in this document are relative to the repository root unless a command declares a working directory.

| Surface inspected | Current implementation / relevant sources | Consequence for testing |
|---|---|---|
| Requirements and contracts | `AGENTS.md`, `backend/AGENTS.md`, `.agents/skills/orderfit-development-context/SKILL.md`, `docs/initial_backend_implementation_plan.md`, `docs/contracts/`, `backend/orderfit/contracts/` | Use implemented routes as inventory; target contracts and old phase labels alone do not prove capability. Retain V01–V16 and DB-01–DB-30 traceability. |
| HTTP boundary | `backend/orderfit/api/main.py`, `api/errors.py`, `api/deps.py`, `api/security_headers.py`, `api/routes/` | Test real ASGI/HTTP middleware, CSRF, body limits, safe errors, startup and readiness. Route files can exist without being mounted. |
| Identity and MFA | `services/identity.py`, `services/passkeys.py`, `store/db.py`, `api/routes/identity.py`, `api/routes/passkeys.py` | Cookie sessions, authoritative membership, session-bound approvals and passkey challenges need contention and revocation tests. |
| Persistence | `store/repositories.py`, specialized repositories, `store/tables.py`, `migrations/sql/`, `migrations/versions/` | SQL owns DDL, tenant constraints and guards. Exercise real restricted API and worker logins, not owner connections masquerading as runtime tests. |
| Engine | `engine/`, `agent/nodes/compute.py`, `workflow/compute_limits.py`, `workflow/worker.py`, `tests/engine/`, reference fixtures | Test compound resource dimensions, exact arithmetic and complete-result publication. Financial stress scenarios inside the engine are distinct from backend load testing. |
| Jobs | `workflow/operations.py`, `workflow/worker.py`, `workflow/presence.py`, `store/admission.py` | Durable claims, fencing, retries, cancellation and worker liveness must survive process loss. |
| Sources and language | `services/documents.py`, `services/pdf_parser.py`, `store/documents.py`, `store/s3_documents.py`, `workflow/extraction.py`, `agent/llm.py`, guards/prompts | Bound upload/parser/provider resources; preserve immutable source evidence and manual operation when language work fails. |
| Preparation | `services/preparation.py`, `store/preparation_repository.py`, `workflow/preparation.py` | What-if isolation, draft revisions, exact acceptance, suspicious bank-change holds and reply reassessment share the canonical engine. |
| Authorization and effects | `services/bundles.py`, `services/execution.py`, `workflow/execution.py`, `store/execution_repository.py` | Exact manifests, approvals, per-business commitment admission, sandbox effects, settlement and inverse compensation need synchronized race probes. |
| Supporting resources | Membership/accounts/invoices/notifications/exports services; `services/pagination.py`, `store/collection_page.py`, API business/member/account/export routes | Measure large histories, signed continuation, ownership, revision invalidation and bounded payloads. |
| Backend consumers | `web/lib/orderfit-api.ts`, `web/lib/generated-api.d.ts`, `web/lib/platform-admin.ts`, `web/tests/e2e/`, `scripts/run-e2e.ps1` | Include same-origin proxy, session recovery, polling, request fan-out and lost-response behavior. Do not duplicate financial formulas in a client oracle. |
| Execution environments | `docker-compose.yml`, `backend/Dockerfile`, `.github/workflows/tests.yml`, `.github/workflows/security.yml`, `.github/workflows/deploy-backend.yml`, `deploy/azure/`, `render.yaml`, `docs/deployment/` | Local Compose, Azure/Caddy/Neon and Render/S3 are different topologies; certify each claimed topology separately. |
| Existing evidence and fixtures | `docs/backend_stress_test_report_2026-10-16.md`, `docs/backend_stress_remediation_2026-10-16.md`, `docs/phase_closure_2026-10-17.md`, `docs/backend_implementation_progress.md`, security audits, `data/`, `scripts/` | Reuse synthetic cases and regressions after checking fixture assumptions. Historical reports may predate migrations or contain superseded blockers. |

### 2.2 Reconciled current facts

- `backend/pyproject.toml` targets Python `>=3.12,<3.13`; `uv.lock` pins the environment. FastAPI, synchronous SQLAlchemy/psycopg transactions, PostgreSQL, separate API/worker processes and manual Alembic migrations form the active backend.
- `store/db.py` requires `0019_merge_passkey_roles`. Its migration joins `0018_passkey_mfa` and `0017_merge_heads`; earlier development-context statements naming 0017/0018 are historical. Test both migration ancestries.
- API pool defaults: five connections, zero overflow, three-second checkout timeout. A worker presence channel reserves a separate one-connection pool. The total budget is per process and grows when replicas increase.
- Authenticated transaction entry resolves a session and takes locks; tenant transactions then take business and membership locks. Same-session reads and same-business writes can serialize even if HTTP client concurrency rises.
- `api/main.py` mounts identity, business, deals, documents, evaluations, exports, preparation, bundles, members, accounts, notifications and passkeys. The admin router is not mounted. `api/routes/stream.py` contains a router scaffold, not an implemented SSE service. Do not add invented admin/SSE traffic to enabled-route capacity figures.
- Azure Compose uses one shared host filesystem path for API/worker documents and `LLM_MODE=off`; Render documentation describes the separate S3 deployment option. S3 availability does not establish Azure filesystem backup durability, and a local filesystem pass does not establish split-host storage.
- Existing `tests/db/test_sustained_capacity.py` is a finite local service-level mixed probe, with HTTP probes in `web/tests/e2e/backend-stress.spec.ts`. They are useful regression anchors, not a long-duration production benchmark.
- Repository evidence records a seven-test browser run, 18 focused checks on an earlier current-head snapshot, and a later 54-test migration/security subset. The broad 516-pass/two-failure run used a moving schema snapshot. Do not sum overlapping runs or call them a fresh complete suite at this HEAD.
- `tests/db/test_encrypted_restore.py` contains a synthetic encrypted joint-restore exercise. Its existence improves available coverage; execution and hosted recovery evidence must still be established for the selected release. Older blanket statements that no restore test exists are superseded by source.

### 2.3 Assumptions to challenge

| Assumption | Risk / trade-off | Test or alternative decision |
|---|---|---|
| More API concurrency always raises throughput | Five DB slots, session-row updates and coarse business write locks may dominate first | Compare shared-session, many-session/same-business and independent-business load before changing pool or locks. Shorter transactions may be safer than a larger pool. |
| A live worker heartbeat means useful progress | Presence can remain live during backlog growth or a stuck handler | Plot liveness, oldest eligible job age, claim rate and completion rate separately. A readiness pass cannot replace backlog alerts. |
| Per-process semaphores provide a deployment-wide quota | Replicas multiply password/parser/provider/upload limits and DB connections | Test one and multiple processes; document aggregate budgets before considering distributed admission. |
| Valid individual engine limits imply a cheap request | Grid × horizon × scenario × tolerance scans can compound | Cross dimensions and measure bounded rejection. Prefer earlier work-budget admission over silently truncating analysis. |
| A retry is safe because HTTP is idempotent | Lost responses, expired replay rows and partial effects cross different dedupe lifetimes | Reconcile the original operation/run/key; permanent effect identity must outlive HTTP replay retention. |
| Adding workers guarantees tenant fairness | Oldest-first claims and slow computations may let one tenant dominate | Test a heavy tenant beside small tenants. Consider scheduling changes only after measuring starvation; do not reorder claims to fix fixture contamination. |
| Backup branch creation or a passing health check proves recovery | Filesystem documents, secrets, approvals and audit heads may not match the DB cut | Restore a coherent DB/object/key set into a separate environment and execute integrity/auth checks. |
| Generated OpenAPI proves a route is available | Target schema and inactive routers can differ from mounted runtime | Produce an actual route manifest and label active, disabled and target-only operations. |

## 3. Test safety, isolation and reproducibility

Default execution is local and disposable. Do not use `backend/.env`, root `.env`, a discovered application URL or configured Neon credentials as an automatic test target. This planning request does not authorize live load, paid provider calls, migrations or disruption of shared infrastructure.

Before any mutation/fault run, record and assert the generated database name, loopback address, disposable container label, runtime role and run ID. Reuse `backend/tests/db/conftest.py`: it creates labeled unique PG17 containers and real restricted logins without reading application DB URLs. Privileged connections are permitted only for fixture provisioning, migration, fault setup and independent verification; the tested requests and worker effects use runtime credentials.

Give every run private image tags, Compose project, network, volumes, object prefix, evidence directory and synthetic identities. `scripts/run-e2e.ps1` already isolates image tags and browser artifacts; preserve that contract. Never clean up all queued operations, global Docker resources or another run's files. For process fault injection verify the PID/container belongs to this run, and clean only recorded IDs. Preserve artifacts before teardown.

Freeze source while parent processes, subprocesses and fixtures run. Record Git SHA plus dirty diff hash, image digest, lockfile hashes, Python/DB/OS versions, CPU/RAM/disk/container quotas, process counts, configured limits, storage mode and workload seed. No raw tokens, cookies, account details, documents or credential-bearing URLs in logs. Use synthetic markers to test redaction.

For hosted testing require an explicitly selected isolated branch/environment, permitted operations, provider/request/token/cost budget, duration cap, recovery owner and stop mechanism. Follow [external acceptance](deployment/external-acceptance.md); revalidate its commands against current source. Never run `alembic downgrade base` or restore over a shared application DB.

## 4. Workloads and data design

### 4.1 Dataset tiers

All sizes are proposed fixture targets, not claims of existing supported scale. Generate via authenticated APIs where the workflow matters; use a documented seed/migration fixture for bulk history, then verify representative rows through runtime RLS. Do not seed impossible states or bypass immutability to accelerate tests.

| Tier | Businesses / sessions | Per-business history | Purpose |
|---|---|---|---|
| D0 correctness | 2 businesses; owner, preparer, viewer and revoked/outsider identities | 10 deals, 10 supporting rows/type, complete positive sandbox journey | Exact state/permission assertions and deterministic race reproduction |
| D1 representative | 10 businesses; 5 independent sessions each | 100 deals, 100 customers/payees, 1,000 invoices, 10,000 audit rows | Baseline mixed traffic and realistic selector/history queries |
| D2 large history | 20 businesses; up to 100 active sessions total | One heavy tenant: 10,000 deals, 10,000 supporting rows/type, 100,000 invoices, 1,000,000 audit rows; others D1 | Query scaling, skew and fairness; ramp seeding to available isolated disk budget |
| D3 engine boundaries | Separate from history tiers | 2,000 baseline events; 2,000 costs; up to 20 offers; horizons up to 1,095 days; grid up to 10,000 combinations | Resource admission and compound-work rejection, never an expectation that all maxima together finish cheaply |
| D4 source boundaries | Two source owners plus outsiders | Tiny, normal, near-limit and invalid PDF/text/CSV bytes, duplicate names/hashes, encrypted/image-only PDFs | Upload, parser and storage pressure without private documents |

Use fixed random seeds, tied timestamps, Unicode/long labels, archived rows, missing optional values, explicit calendar dates and currencies with different exponents. Keep historical invoice counts distinct from the bounded events included in one analysis. Seed normal and expired/revoked invitation/session/approval history. Prepare read-only pools of valid IDs and isolated mutable deal pools so the generator does not create accidental version conflicts.

### 4.2 Traffic models

Run these separately before a combined workload:

- **R (reads):** pipeline/supporting collections 40%, deal/review reads 25%, evaluation/series 20%, messages/notifications/history 15%.
- **W (business work):** valid create/edit/confirm/admit flows with fresh expected versions and independent keys. Replay storms belong in their own experiment so deduped requests do not inflate write-capacity claims.
- **J (jobs):** normal evaluations, heavy evaluations, what-ifs, recorded extraction/drafts/replies and approved sandbox runs; report counts by kind and computational size.
- **A (auth):** successful password and passkey journeys plus separately classified invalid credentials, CSRF and source/account throttles. Repeated failures are deliberate security traffic, not ordinary users.
- **U (uploads):** authorized normal/near-limit uploads and separate slow/truncated/oversize/malformed streams.
- **M (combined):** initial request-attempt mix: R 55%, W 15%, operation polling 15%, A 5%, U 5%, approval/execution commands 5%. Keep the admitted job-kind mix and end-to-end journey mix in separate counters. Tune the proposed mix only with recorded product usage evidence.

For contention comparisons hold dataset, offered rate and hardware constant: (a) one shared session; (b) separate sessions in one business; (c) sessions across businesses. Include the browser pipeline's real evaluation/history fan-out, not only a single cheap list route. Poll with a recorded bounded schedule/backoff; do not let uncontrolled polling hide job throughput.

### 4.3 Load stages

| Stage | Proposed schedule | Required interpretation |
|---|---|---|
| Smoke | 1 client, one full journey per role/kind, 5 minutes | Stop before load if fixtures, contracts or outcomes are wrong |
| Baseline | Warm up 2 minutes; measure 10 minutes at 1, 4 and 8 concurrent clients, separately | Repeat three times; preserve cold-start measurements separately |
| Capacity ramp | Open-loop 2, 5, 10, 20, 40, 80 request attempts/s; each 2-minute warm-up + 5-minute measurement; maximum 128 in-flight | Stop escalation at sustained SLO/resource failure; record the knee rather than force a high score |
| Contention burst | 16, 32, 64 and 128 simultaneous clients; 30-second bursts with 2-minute recovery | Exercise distinct-key, same-key and same-version requests independently |
| Spike | 30% of measured sustainable rate for 5 minutes, 150% for 60 seconds, return to 30% for 10 minutes | Controlled rejection and recovery, not normal-envelope latency compliance during overload |
| Soak | 60% of measured sustainable rate for 2 hours; then optional 8-hour release run | Trend memory, connection leaks, queue age, growing tables, children, disk and throughput |
| Fault/recovery | 30% load, one scheduled fault, observe at least 10 minutes after repair | First reproduce one fault deterministically, then combine faults only when single-fault results are understood |
| Scale comparison | Repeat representative stages with 1 versus 2 API processes and 1, 2, 4 workers | Respect aggregate DB/memory/provider budgets; scaling need not be linear |

For each workload define sustainable rate as the highest tested offered rate satisfying its normal-envelope gates in all three repeated runs, with a stable queue. Do not extrapolate beyond tested sizes/rates. Use an arrival scheduler independent of response times, record generator lag and dropped arrivals, and cap its own queue; otherwise slow responses suppress offered load and hide saturation. Keep closed-loop client tests as a separate measurement.

## 5. Acceptance criteria and telemetry

These are proposed engineering gates to ratify before a benchmark; existing contract limits remain authoritative. Do not relax gates after seeing results. Intentional negative requests and overload responses need exact status/code classification rather than being pooled into a generic error percentage.

| Dimension | Proposed normal-envelope gate | Overload / recovery gate |
|---|---|---|
| Correctness/isolation | Zero tenant leaks, unauthorized effects, duplicate effects, stale publications, financial-oracle mismatches or audit corruption | Same zero-tolerance invariants at every load |
| HTTP reads | Per route p95 ≤1 s, p99 ≤2 s | Explicit backpressure permitted; no unexplained 500, raw SQL or connection details |
| HTTP mutations/admission | p95 ≤2 s, p99 ≤5 s; assert persisted result/admission | Pool checkout refusal maps to retryable `DATABASE_CAPACITY`/503; collect total route duration separately from the three-second pool wait |
| Job service | Small synthetic jobs: queue wait p95 ≤5 s and end-to-end p95 ≤30 s; report heavy jobs separately | No indefinitely orphaned jobs; bounded attempts, lost-lease refusal, drain within calculated recovery window |
| Availability | Unexpected 5xx <0.1% in normal capacity runs; none in deterministic correctness/fault-free smoke | Report expected 503/429 separately; they do not count as successful business work |
| Fairness | Under matched small-job input, light-tenant queue-wait p95 ≤2× its isolated baseline +2 s | Every eligible light tenant makes progress; >60 s without a claim while capacity is live is a fairness failure to investigate |
| Resource steady state | No leaked checked-out connections after quiescence; no orphan parser/compute descendants | Released slots/threads/connections and drain restored after faults |
| Memory | After warm-up, endpoint API/worker RSS ≤1.2× warmed baseline +32 MiB after quiescence; sustained growth >5%/hour triggers investigation | No API/worker OOM; deliberate child memory-limit rejection must leave parent usable |
| Readiness | `/health` liveness is distinct from `/ready` DB/schema/storage/worker evidence | Dead-worker capacity expires according to 60-second DB-time TTL plus probe tolerance (target ≤70 s); restarted worker restores readiness within two presence intervals +10 s if dependencies are healthy |
| Recovery time | Persist accepted work across API restart | Target reclaim ≤90 s after last successful lease renewal when a worker is available; separate reclaim from handler completion |
| Restore | Exact selected-cut document hashes, audit links, immutable rows and runtime authorization | Proposed isolated drill RTO ≤30 min; RPO zero relative to the explicit coherent backup cut, not a claim of zero loss after that cut |

Recovery drain budget: `remaining eligible jobs × measured p95 service time / effective worker count + 120 seconds`, with observed tail jobs reported individually. If business constraints serialize work, use measured effective concurrency rather than configured worker count. A non-draining queue at a supposedly sustainable rate fails capacity acceptance.

Capture request attempts, started/completed/dropped arrivals, status + typed error code, retry counts, response bytes and p50/p95/p99/max per route. Capture job admission/claim/start/finish timestamps, attempts, kind, lease losses, stale rejections and terminal result. Keep retry latency inclusive of all attempts as a second distribution. Report successful throughput and offered throughput separately.

Sample at 1-second intervals during bursts/faults and 5 seconds during soak: API/worker/child/container RSS and CPU, connection checked-out/idle/wait, PostgreSQL active/waiting/idle-in-transaction sessions, lock wait/blocker/deadlock counts, oldest eligible queue age, per-tenant claim/completion rates, file descriptors/handles, thread/child counts, disk space/I/O, upload spool usage, storage latency and parser/provider slots. Report DB and load-generator resources separately. Linux container memory and Windows working sets are not interchangeable; record measurement semantics.

Use observer-only queries with access confined to disposable test infrastructure; never grant runtime roles global statistics/tenant access to make a dashboard work. Gather sanitized query plans with realistic D2 cardinalities; `EXPLAIN ANALYZE` executes queries and belongs on disposable targets. Do not claim observability already exists merely because this plan requires it.

Stop escalation immediately on a correctness/security failure, cross-tenant read, duplicate effect, corrupt evidence, unexpected target or secret exposure. Stop load on resource danger (disk free <15%, parent/container memory >85% of quota for 30 s, repeated DB connection failures) or no useful progress for 120 s. Preserve evidence, reduce arrivals to zero and reconcile accepted work before teardown.

## 6. Detailed scenario catalogue

For every case record scenario ID, prerequisites, seed, concurrency/arrival schedule, fault timestamp/barrier, expected HTTP outcome, SQL/storage postconditions and recovery observation. The common acceptance rule is zero violation of the invariants in section 5. Existing suites below are starting coverage, not claims that all proposed cases already exist.

### S01 — frozen baseline, migrations and route inventory (P0/P1/P8; V01/V02/V16)

1. Build an actual mounted route manifest from `create_app`; reconcile method/path/operation ID with the target catalogue and generated TypeScript. Assert admin remains unmounted and no SSE endpoint is invented.
2. On fresh disposable PG17, apply all migrations; separately upgrade populated 0001 history, `0017_merge_heads`, and `0018_passkey_mfa` ancestry to 0019. Compare historical immutable rows, counts/hashes, grants, FORCE RLS, triggers and sequences.
3. Verify sole Alembic head agrees with `SCHEMA_REVISION`. Attempt startup with old schema and owner/admin/API-as-worker/worker-as-API credentials: fail closed with safe diagnostics.
4. Run original SQL/concurrency suites through the existing fixture, plus merge regressions. Do not edit applied migration components or use `create_all` to repair the test DB.

Reuse: `tests/contracts/test_contracts.py`, `tests/test_runtime.py`, `tests/db/test_foundation.py`, `tests/db/test_migration_merge.py`, `backend/migrations/tests/`.

### S02 — tenant context and connection reuse (P1; V03/V04)

1. Alternate tenants A/B over pools of size 1 and 5, with successful requests, validation failures, deliberate rollbacks and query cancellation. After each transaction verify an unscoped runtime connection sees no tenant data and has no retained transaction-local identity.
2. Submit another tenant's business/deal/document/evaluation/message/account/notification IDs, mixed parent-child IDs and forged actor/role/header fields at concurrency 32. Require contract-specific 404/403 without data or timing amplified by another tenant's held business lock.
3. Repeat through separate actual API/worker logins and, later, isolated PgBouncer transaction pooling. Test worker helpers without tenant context; API cannot claim/publish worker presence or bypass RLS.
4. While tenant A saturates pool/write locks, require valid B traffic to stay authorized and record fairness/latency. Distinguish process-wide pool exhaustion from cross-tenant lock leakage.

Reuse: foundation, session-authority, security-hardening, P7 operations/events and admin-security DB tests; `tests/external_acceptance.py` for explicit hosted pool probes.

### S03 — password, session, CSRF and passkey pressure (P1/P6; V04/V11)

1. Mix successful and failed sign-in/signup/logout/session/step-up requests from one source and many sources, one account and many accounts. Check account/source budgets, success refunds, safe generic failures and two-slot password-work rejection/release.
2. Compare shared-session versus separate-session read load to expose `session_resolve` locking. Exercise 1,800-second idle and 28,800-second absolute expiry using controlled fixture timestamps; include an elapsed-time smoke without weakening production constants.
3. Revoke/demote/reinstate membership while requests, approval and a worker are in flight. Old sessions remain fenced with `SESSION_REAUTH_REQUIRED`; reinstatement requires real sign-in. Test last-owner races between two owners.
4. Test valid/missing/wrong CSRF, Origin, cookie and trusted-proxy combinations. Forged forwarding headers from an untrusted peer must not alter rate keys. Exercise the actual Caddy/Next proxy chain separately from direct API.
5. Concurrently finish the same signed passkey challenge 32 times: at most one grant/session is accepted. Race credential removal/revocation/password changes with begin/take/verification/finalization. Fail malformed credential, wrong RP/origin/user handle, expired/wrong-purpose/cross-session challenge and missing user verification safely.
6. Confirm challenges consumed on failed verification cannot be replayed. Test authenticator counter behavior according to the library/credential contract, including zero counters; do not assume all authenticators increment. Unconfigured RP returns `MFA_NOT_CONFIGURED`; MFA enforcement must not silently fall back to password-only access.

Reuse: `tests/db/test_passkeys.py`, `test_session_authority.py`, `test_security_hardening.py`, `tests/test_passkey_configuration.py`, `test_network_security.py`, `test_admin_security_rbac.py`. Use real signed synthetic assertions/virtual authenticators, not mocked successful verification as the final acceptance.

### S04 — DB pool, lock order and hot-business contention (P1/P3/P7; V03/V09/V12)

1. Occupy all five pool slots; additional authenticated traffic must return typed retryable capacity refusal and recover after release. Observe startup/readiness/job paths independently; not every raw engine checkout necessarily uses the same error wrapper.
2. Synchronize 32 same-business writes against distinct deals, then same-deal writes, then independent-business writes. Verify business → deal → related rows lock order and correct version-conflict losers.
3. Hold a test-owned row lock beyond `lock_timeout=10s`, then a statement beyond `statement_timeout=60s`, and an idle transaction beyond 60 s. Check safe timeout mapping, rollback, no partial audit/idempotency rows and usable pooled connections afterward.
4. Race two owners changing each other's membership, account verification/revocation, input confirmation and settlement. Capture blocker graphs/deadlocks; retry only transient conflicts under the original request identity.
5. Repeat with two API processes; total connection budget includes each API pool, worker pools, presence pools and observers. Do not increase PostgreSQL connection limits to hide application contention.

Reuse: `tests/db/test_stress_remediation.py`, `test_audit_repairs.py`, `test_audit_followups.py`, `test_runtime_hardening.py`, `test_sustained_capacity.py`.

### S05 — idempotency, version races and unknown responses (P1/P3/P6; V09/V12/V13)

1. Release 32/128 identical same-key POSTs simultaneously; all accepted/replayed results converge on one resource/operation/run identity. Check exact endpoint status and payload contract; a generic successful status is insufficient.
2. Reuse the key with different actor, business, path, method or body. Assert the documented conflict/scope result and zero unauthorized writes. Do not assume a business-scoped key conflicts globally across all tenants.
3. Drop the HTTP response after commit/admission, restart API, then inspect/replay the original identity. Verify one operation/effect, not a new write under a replacement key.
4. Race two distinct keys with the same expected version: one valid winner, a stale loser and no orphan rows. An unrelated unique violation must not be translated into fabricated replay success.
5. Run retention expiry during queued/partial execution; permanent run/action dedupe must survive expired HTTP replay records. Runtime cannot delete live keys to bypass replay rules.

Reuse: `tests/db/test_idempotency_retention.py`, `test_execution_recovery.py`, foundation tests and browser response-loss scenario.

### S06 — engine resource ceilings and financial integrity (P2/P3/P5; V05/V06)

1. Rerun all 22 reference cases, independent selftest, architecture and independent engine assertions. Store engine version/input hash/result hash. Same valid inputs across initial/what-if/reply workflows must retain the same financial semantics.
2. Sweep one dimension at a time, then pairs/triples: costs/events, 1/365/1,095-day horizons, deposit/extension/offer grid, scenarios, sensitivity, uncertain alternatives and delay-scan caps. Probe one below/at/above each actual source bound; aggregate combinations may exceed 10,000 even when each list is valid.
3. Exercise BIGINT and aggregate/scenario-expanded overflow; boolean-as-int, decimal/float money, invalid dates, unsupported policy/loan terms and missing anchors. Require typed rejection, never clipping or guessed defaults.
4. Independently assert outflows-before-inflows, daily baseline-relative reserve, exact rounding, once-only fees/profit, post-540-day baseline events, late funding/repayment and non-monotone first-failure scans. A completed finite tolerance scan must not claim survival without payment.
5. Force work-unit exhaustion, child timeout (90 s) and 512-MiB process memory limit. Require entire analysis rejection, no partial catalogue/live evaluation, dead child cleanup and subsequent small-job success.
6. Run several heavy jobs alongside small ones; measure parent/child memory, CPU, queue wait, result/series serialization and API responsiveness. Child limits do not bound aggregate memory across workers.

Reuse: `tests/engine/`, `tests/engine/benchmark_engine.py`, `tests/test_architecture.py`, `tests/db/test_p3_vertical_slice.py`, `test_p3_review_regressions.py`, `test_sustained_capacity.py`.

### S07 — revision freshness and publication atomicity (P3/P5/P6; V09)

Use barriers immediately after read, before confirmation, after claim, after compute, before publication, before approval and before each effect. In separate parameterized cases mutate each producer: deal inputs, extracted-field/source review, baseline event, opening evidence, policy, financing offer, payee/account and commercial acceptance.

Require either an entirely current snapshot/result or explicit stale rejection. Never mix old options with new inputs, publish two live evaluations, leave a recommended-option reference unresolved or produce an effect against stale recipients. Check both HTTP/service writes and permitted direct runtime-role child writes so application-only invalidation cannot hide missing SQL triggers. Verify status/version-only updates do not spuriously alter financial revision; rollback must preserve the previous state. Frozen input updates must respect the existing transition-then-edit sequence.

Reuse: P3 review/vertical-slice, P5 preparation, P6 approval/execution and session-authority suites.

### S08 — durable queue, worker loss and fairness (P1/P3/P8; V10/V16)

1. Concurrently admit 24/25/26 pending operations to one business with distinct valid requests. The 25-operation admission cap must hold atomically; replays must not consume new capacity. Another business retains its own budget.
2. Run 1/2/4 real worker processes claiming the same queue. Check one current fence per operation, bounded attempts (≤configured maximum, at most 3), result identity and zero stale-fence writes.
3. Kill the owned worker after claim, during compute/provider work and immediately before/after publication. Reclaim after lease expiry; an old worker resumed with a stale token must fail even if its computation succeeded.
4. Interrupt heartbeat DB calls transiently, recover within the lease and then test an interruption beyond it. Lease heartbeats (15 s, 60-second lease) and independent presence (10 s, 60-second expiry) need separate assertions.
5. Saturate the job pool while presence uses its reserved channel; kill one of multiple workers and verify readiness remains true only while another unexpired presence exists. Empty queue with no workers must not imply capacity.
6. Issue SIGTERM idle and busy; verify graceful finish/exit and pool closure, then forced termination beyond the deployment grace. Azure grants 100 s, so include a near-90-second computation and verify actual shutdown overhead/lease recovery.
7. Flood one tenant with heavy jobs while light tenants submit short ones. Measure claims, completions and oldest eligible job age per tenant. Include cancellation/retry storms and worker restart without globally draining fixture history.

Reuse: `tests/db/test_p3_process_recovery.py`, `test_stress_remediation.py`, `test_sustained_capacity.py`, `tests/test_hardening_pure.py`, `tests/test_p7_pure.py`.

### S09 — HTTP bodies, uploads and parser isolation (P4; V07/V16)

1. Send JSON/auth bodies around the 1-MiB transport ceiling, uploads around the 26-MiB body ceiling and files around `MAX_DOCUMENT_BYTES` from `store/documents.py`. Treat multipart overhead and file-size validation as separate limits. Exercise declared and chunked/absent length.
2. Saturate default four uploads/process and two/verified-user slots across users behind one proxy; unauthorized/anonymous slow bodies must not reserve privileged capacity. Exercise disconnect, idle 30 s and total 120 s deadlines; verify slot/spool release and correct typed 408/413/capacity responses.
3. Mix MIME mismatch, encrypted/broken/image-only PDFs, excessive expansion/text/pages and oversized quoted CSV fields. Probe 50-page, 100,000-character/page and 2,000-CSV-row limits. A rejection must not leave canonical fields or fake extraction success.
4. Saturate two parser slots and force 10-second parser timeout/384-MiB child exhaustion. Confirm descendant cleanup, no inherited application secrets, no partial output adoption and successful next parse.
5. Race duplicate bytes, same filename/different bytes, download versus incomplete upload, and DB failure before/after object write. Preserve immutable originals/hashes; reconcile orphan files/metadata without deleting another run's objects.
6. Run uploads beside sign-in/read/evaluate traffic; record spooled memory/disk and confirm parser/password pressure cannot create an unbounded waiting queue. Test both middleware and actual Uvicorn/proxy connections; TestClient alone cannot establish slow-network behavior.

Reuse: `tests/test_body_limit_pure.py`, `test_network_security.py`, `test_p4_pure.py`, `test_private_documents.py`, `tests/db/test_p4_documents.py`, `test_security_hardening.py`.

### S10 — storage outage, shared access and durable bytes (P4/P8; V07/V16)

Test filesystem permission loss, full-disk/quota refusal, missing/corrupt file, partial write and API/worker restart against run-private mounts. Verify authorized downloads, immutable path ownership, safe errors, readiness and metadata/object reconciliation. Never fill the host's shared disk to simulate exhaustion.

For the separate S3 topology inject latency, timeout, denied prefix, missing bucket/object, conditional-write conflict and transient errors. Require bounded retries, no overwrite, private access, matching API/worker hashes and safe cleanup. Repeat actual anonymous and cross-prefix denial; `tests/test_s3_documents.py` stubs and the external storage probe do not alone prove bucket policy. The Azure host mount needs joint filesystem/DB backup acceptance even when S3 passes elsewhere.

Reuse: `tests/test_s3_documents.py`, `test_private_documents.py`, `test_network_security.py`, `tests/external_acceptance.py`.

### S11 — language failures and untrusted input (P4/P5; V08)

1. Off/recorded modes must make zero provider calls; unknown fixture keys fail visibly. Use a provider stub at the sole `agent/llm.py` boundary for reproducible load.
2. Inject delay, timeout, 429, transient 5xx, terminal 4xx, refusal, incomplete output, invalid schema, excessive output and cancellation. Check configured ≤2 concurrency per event loop/process, ≤30-second timeout and output-token cap, bounded job attempts and released slots. Measure semaphore waiting separately from network timeout.
3. Mix prompt injection, fake numeric facts, conflicting source roles, forged recipients and bank-change instructions in documents/replies. Confirm no canonical-input mutation, trusted-account selection, approval or effect results from model text.
4. Assert exact evidence quotes/whole-token numbers, typed review findings and useful manual fallback; a technical model failure is not a financial rejection.
5. Live model quality is a separately budgeted acceptance set with labeled expected candidates and human review of omissions/false claims. Record model/prompt/schema/input provenance and tokens/cost. Do not infer quality from gateway reachability or use an unaccepted free provider as a substitute gate.

Reuse: `tests/test_p4_pure.py`, `test_p5_pure.py`, `tests/agent/`, `tests/db/test_p4_documents.py`, `tests/external_acceptance.py`.

### S12 — preparation, replies and histories (P5; V08/V09/V11)

Race fork creation/apply against financial revision changes; fork computation must not mutate the canonical deal. Concurrent draft edit/review/bundle creation must bind exact reviewed content. Replay reply ingestion and reassessment; original bytes, candidates and acceptance evidence remain immutable and deduped according to contract.

Exercise negated/conditional acceptance, wrong-party acceptance, changed bank details and reply-driven hold resolution. Require the exact reply, verified account, evidence and current authority to clear a hold. Run maximum supported negotiation rounds and one beyond; increment a completed send round once, not on retry. Populate long mixed histories, assert batched list/single parity, bounded query count and correct continuation under concurrent inserts.

Reuse: `tests/db/test_p5_preparation.py`, `test_audit_followups.py`, `tests/test_p5_pure.py`, browser full lifecycle.

### S13 — approval, execution and commitment races (P6; V11/V12/V13)

1. Test T2 confirm versus T3 outgoing authority, session-bound step-up expiry (300 s), membership/account/approval revocation, exact recipient/content/amount/date/hash/action-kind/item membership and missing party acceptance. Password step-up and passkey factor status must be represented accurately.
2. Send 32 same-bundle execution requests and 32 attempts across distinct bundles for two deals in one business. Verify one execution identity per approved bundle and durable commitment serialization across deals.
3. For every item boundary, kill the owned worker before effect, after effect transaction commit, before action-result publication and before/after settlement. Resume the same run; assert exact effect count, action membership, audit entries and persisted partial status.
4. Race hold/cancel/revoke with effect transactions. Completed effects remain historical; remaining effects stop when authority is lost. If cancellation arrives after all effects committed, settlement must follow the documented late-cancellation rule without duplicating or abandoning completed work.
5. Verify successful commitment projects the stored engine-derived baseline events once, increments financial revision once, invalidates other analyses and releases the admission gate only after settlement or completed compensation.
6. Repeat separately approved compensation, partial compensation loss/retry and compensation-versus-new-commit races. Inverse records reference original actions and cannot erase history or authorize a new commercial agreement.

The invariant is exactly-once persisted sandbox effects for the authorized manifest under recoverable retries; this is not a claim of exactly-once network delivery by nonexistent real adapters.

Reuse: `tests/db/test_p6_approval.py`, `test_p6_execution.py`, `test_execution_recovery.py`, `test_idempotency_retention.py`, `tests/test_p6_pure.py`, browser lost-response/full lifecycle tests.

### S14 — collections, supporting resources and query growth (P7; V03/V06/V09/V15)

1. Traverse every enabled collection at page sizes 1/default/100, with tied sort values, inserts/archives/deletes where permitted, empty/final pages and one over the limit. Assert signed cursors bind user/business/resource/filter/order and reject tamper, >2,048-character cursors and incompatible offset combinations.
2. Establish exact completeness/no-duplicates on a frozen dataset. Under concurrent mutation require documented keyset semantics, not impossible snapshot completeness; newly inserted rows ahead of the cursor may require a fresh listing. Avoid silent unbounded fetch-all.
3. Benchmark D0/D1/D2 pipeline, evaluation series, message history, account/customer/offer selectors, notifications, invoices and exports. Record response bytes, SQL query count and query plans. Pipeline page fan-out may remain O(page size); detect accidental O(total history) behavior.
4. Race role/invitation revoke/accept, account verify/revoke, notification mark-read and invoice-import replay. No member may read/mark another user's notification. Verify financial invalidation and last-owner protection.
5. Customer history uses explicit as-of dates; advance wall-clock time without changing analysis date and require unchanged historical assessment.

Reuse: `tests/db/test_collection_continuation.py`, `test_stress_remediation.py`, `test_p7_operations.py`, `test_p7_events.py`, `test_audit_followups.py`, `tests/test_p7_pure.py`.

### S15 — concurrent audit, exports and retention (P7; V12/V14)

Append concurrently through actual runtime commands in multiple tenants while exporting full and partial ranges. Verify canonical PostgreSQL bytes, sequence/predecessor/hash links, range/head metadata and export authorization. Inject dropped/reordered/mutated records in exported copies; verification must detect them. Document the inability of an unanchored chain alone to prove a missing tail; do not label it externally anchored.

Stress large audit/evaluation/CSV exports beside writes; capture buffering/RSS, cancellation and client disconnect cleanup. Spreadsheet formula/control-prefix escaping must remain effective. Run retention beside active operations and partial executions; immutable evidence, live keys and permanent effect identities remain protected. Scan sanitized logs/exports/error payloads for synthetic secret markers and raw SQL leakage.

Reuse: `tests/db/test_p3_exports.py`, `test_p7_operations.py`, `test_idempotency_retention.py`, `tests/test_p7_pure.py`, `test_hardening_pure.py`.

### S16 — proxy, readiness and deployed topology (P8; V04/V15/V16)

1. Build/run production API/worker/web images with private tags. Exercise browser → Next rewrite → API and a disposable Caddy topology; compare direct API timings with proxy-inclusive timings.
2. Verify cookie Secure/HttpOnly/SameSite, no-store, exact origins, CSRF, error security headers and trusted proxy addresses under valid/invalid/oversize responses. Keep parser-inserted negative CSP controls; scripts created by trusted nonce scripts under `strict-dynamic` are not a valid blocking expectation.
3. Force DB unavailable, old schema, storage unwritable and all workers expired separately. `/health` must not be interpreted as successful readiness. Run readiness polling under load and ensure the probes themselves do not overwhelm the five-slot DB pool.
4. Test proxy request ceiling against API limits, truncated bodies, disconnects and long operations. Azure Caddy declares 30 MB; app transport/file ceilings still apply independently.
5. Rehearse release in a disposable copy: old image/schema, migration to 0019, new API/worker rollout, readiness timeout, pre-migration image rollback and post-migration fix-forward/restore procedure. Verify `remote.sh` behavior; do not assume image rollback is safe after migration.
6. Model deploy CI's image/SHA selection, single deployment concurrency, optional Neon restore-branch absence, migration failure and interrupted deploy. A green build or final health probe is not integrity/restore proof. This plan does not trigger production workflows.
7. Repeat targeted hosted Neon pooling/TLS/roles, worker restart and document persistence only in the authorized isolated environment; label Azure and Render results independently.

Reuse: `scripts/run-e2e.ps1`, `web/tests/e2e/`, `tests/test_network_security.py`, `tests/test_runtime.py`, `tests/test_p7_pure.py`, `tests/db/test_migration_merge.py`, deployment runbooks.

### S17 — encrypted joint restore and post-restore recovery (P8; V03/V10/V13/V14/V16)

Start with two synthetic tenants, documents, evaluations, audit history, active sessions, enrolled passkey, approved bundle and an interrupted sandbox execution. Define the coherent DB/files cut and document which in-flight operations fall before/after it. Back up using the intended encrypted mechanism and restore into a distinct disposable target.

Verify schema/grants/RLS/runtime roles; hashes and lengths of every selected-cut object; immutable snapshot/evaluation/action/approval counts; audit chain; identity/session/step-up/passkey behavior according to the recovery policy. Restore fingerprints/secrets only via the approved key-handling contract and test old/revoked credentials deliberately. Missing keys are a restore failure, not grounds to disable verification.

Recover the interrupted run without duplicate effects; compare original action identities and projected baseline events. Inject missing/corrupt/wrong-version objects and a wrong decryption key in separate drills: detect failures before declaring recovery. Measure backup cut, bytes, restore start/readiness/integrity-complete times and achievable RPO/RTO. Repeat on the actual isolated hosted storage topology before closing its gate.

Reuse: `tests/db/test_encrypted_restore.py`, `tests/external_acceptance.py`, deployment restore procedures. The local synthetic restic exercise does not certify a Neon snapshot plus Azure host-directory recovery.

## 7. Harness implementation plan and execution order

Do not add a second queue, financial calculator or generic benchmark framework merely to run this plan. Extend pytest for deterministic DB/race invariants; use an async HTTP generator for timed traffic and existing Playwright only for consumer journeys. A standalone load tool is optional if scheduling/telemetry becomes difficult, but justify dependencies and keep assertions shared with contracts.

Proposed additions (not created by this planning task):

| Artifact | Responsibility |
|---|---|
| `backend/tests/stress/` | Run configuration, seeded workload pools, synchronized barriers, response/state oracles and fault ownership guards; avoid duplicating existing fixtures |
| `backend/tests/stress/http_load.py` | Open-loop arrivals, bounded in-flight work, per-route histograms, full retry accounting, redacted JSONL metrics |
| `backend/tests/stress/test_races.py` | Missing S03/S05/S07/S08/S13 race cases using existing services and DB constraints |
| `scripts/run-backend-stress.ps1` | Explicit local target provisioning, private production images, source freeze/manifest, telemetry lifecycle, owned cleanup and preserved evidence |
| `docs/backend-stress-2/<run-id>/` | Sanitized manifests, raw metrics, JUnit, reconciliation queries/results, fault timeline and report; large traces may be stored outside Git with hashes |

Sequence and gates:

1. **Preflight:** frozen manifest, scope/target guard, route inventory, sole head, tool availability and fixture contract. Block dependent runs on mismatch.
2. **Correctness baseline:** full backend suite on that snapshot, reference/selftest/contracts/architecture, migration merge and passkeys. No load comparison until unexplained failures are resolved or explicitly scoped as blockers.
3. **Instrumentation + D0/D1:** validate generator counts against server counts; exercise each route/kind once and verify every write through runtime reads plus independent fixture verification.
4. **Focused races/faults:** S02–S13 at small scale with barriers; resolve invariant failures before ramp/soak.
5. **Capacity:** separate R/W/J/A/U ramps, contention comparison, then M workload. Establish sustainable rates and scaling trade-offs.
6. **Soak/fairness:** D1/D2 at measured safe rates, spike and restart/recovery. Reconcile every accepted identity.
7. **Operational acceptance:** production images/proxy, joint encrypted restore and deployment rehearsal on disposable targets.
8. **External gates:** explicit isolated hosted/provider budgets and target consent; execute only those selected gates. Independent review of financial/source quality remains separate from load.
9. **Report:** failures with reproductions, rerun affected tests after repairs, then rerun any baseline invalidated by the repair. Do not relabel pre-fix measurements as final evidence.

### Existing command anchors

These are future execution commands, not commands run during plan preparation. Run from a frozen checkout with Python 3.12 and an explicitly isolated process environment; no inherited application/direct URL credentials. The repository's disposable fixture provisions its own migration credentials. Use `uv --cache-dir 'D:\Kam 2\.uv-cache'` if the default cache is inaccessible.

From `backend/`:

```powershell
uv sync --frozen --extra dev
uv run --frozen ruff check .
uv run --frozen python -m orderfit.contracts.export --check
uv run --frozen python -m alembic heads
uv run --frozen python -m pytest -q --tb=short -p no:cacheprovider --junitxml=../docs/backend-stress-2/<run-id>/backend.xml
uv run --frozen python ../docs/architecture/orderfit/fixtures/reference_engine.py --check
uv run --frozen python ../docs/architecture/orderfit/fixtures/selftest.py
uv run --frozen python -m tests.engine.benchmark_engine
```

Replace `<run-id>` and create its directory first. The default pytest configuration excludes live-provider tests. Preserve exit codes when teeing output. Availability of Docker/images and fixture requirements must be checked; a skipped/blocked suite is not a pass.

Focused regression example from `backend/`:

```powershell
uv run --frozen python -m pytest tests/db/test_migration_merge.py tests/db/test_passkeys.py tests/db/test_session_authority.py tests/db/test_stress_remediation.py tests/db/test_execution_recovery.py tests/db/test_collection_continuation.py tests/db/test_sustained_capacity.py tests/db/test_encrypted_restore.py -q -s --tb=short -p no:cacheprovider
```

Run the existing disposable browser stack from repository root with `./scripts/run-e2e.ps1`. Run generated-client checks and relevant web unit checks before trusting browser consumers. Do not run timed engine, HTTP and browser benchmarks concurrently on the same host; prior measurements under concurrent verification load are unsuitable for attributing a performance change.

No hosted URL or destructive cleanup command is provided as a default. Use `backend/tests/external_acceptance.py --help` through the locked Python environment before preparing an explicit external invocation; the helper performs only selected probes and cannot replace the full acceptance matrix.

## 8. Coverage and priorities

| Priority | Scenarios | Original verification gates / gap groups | Completion evidence |
|---|---|---|---|
| P0 invariant blockers | S01–S08, S13 | V01–V06, V09–V13; DB-01/03–16/19–23/25/27–29 | Frozen full baseline plus race, fencing, isolation and exact-effect reconciliation |
| P1 hostile inputs and scale | S09–S12, S14–S15 | V07/V08/V14/V15; DB-17/18/24/26/30 | Body/parser/provider pressure, large-history query/payload curves, immutable evidence and audit verification |
| P1 release recovery | S16–S17 | V16 plus V03/V10/V13/V14 | Actual production-image/proxy rehearsal and coherent joint restore, with target-specific hosted evidence |
| External evidence | Selected S02/S10/S11/S16/S17 | DB-02 rotation evidence, hosted roles/storage/provider/recovery | Explicitly authorized environment-specific receipts; no substitution by local results |

P0 here is test priority, not implementation phase P0. Zero-tolerance invariants apply to every priority. Track each DB gap individually in the final report even when a scenario covers several; unsupported/future capability remains explicitly unavailable rather than counted as passed.

## 9. Report template and definition of done

The eventual `backend_stress_test_report_2.md` should contain:

1. Tested SHA/image/schema/configuration and environment; source freeze and generator validity evidence.
2. Scenario ledger: ID, input tier, offered rate/concurrency, attempts/admitted/completed/rejected, status/code breakdown, duration and pass/fail/blocked/unrun.
3. Per-route latency and per-kind queue/service/end-to-end distributions; include p99 only with sufficient samples and report sample counts. Capacity knee and sustainable rate with repeated-run spread.
4. CPU/memory/pool/lock/disk/queue/fairness graphs and exact resource accounting; distinguish controlled observations from hypotheses.
5. Fault timelines with original IDs, fence/attempt transitions, persisted-state counts/hashes, recovery duration and cleanup verification.
6. Findings: severity, trigger, expected/actual behavior, minimal reproduction, affected invariant, evidence path, underlying cause if established, proposed remediation and regression gate. Never present a performance hypothesis as a confirmed defect.
7. V01–V16 and DB-01–DB-30 disposition, historical evidence separated from current execution, environment-specific limitations and open external gates.

Completion requires all selected local invariant scenarios passing on one frozen final snapshot, reproducible measured capacity/recovery envelopes, no unexplained accepted operations or orphan resources, and a reviewed finding ledger. A failed optional scale target may define a documented operating limit; a tenant leak, financial mismatch, stale authorization or duplicate effect cannot be waived as a performance limit. Hosted/provider/restore/rotation gates stay unverified until their own evidence exists. This plan's delivery does not declare the backend production-ready.

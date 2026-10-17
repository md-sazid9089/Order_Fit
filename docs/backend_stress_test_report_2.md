# Backend stress test report 2

Date: 17 October 2026. Plan: [backend_stress_test_plan_2.md](backend_stress_test_plan_2.md).

**Disposition: PARTIAL / BLOCKED by the plan's disk-space stop gate.** The final full backend suite passed **542 tests**, and the separately built production-image browser/proxy suite passed **7 tests**. Isolated concurrency checks, a 60-second proxy probe and two short arrival-rate stages completed. The repeated capacity ramps and two-hour soak did not complete. This report does not establish sustainable capacity, absence of memory leaks, or hosted readiness.

Docker's storage is on C:, which had **7.147% free space**, below section 5's **15% minimum**. The test-owned API was stopped, persisted state reconciled, and the disposable database removed. The user explicitly selected **“Finish with the blocked-gate report.”** No further load was run after that decision. An independently reproducible keep-alive transport failure also remains an open compatibility finding.

## 1. Snapshot and isolation

| Item | Tested configuration |
|---|---|
| Application commit | `eef7bea2f7d622dc293f8667a120222666fa0d29` |
| Execution branch | `backend/stress_test`; the plan was initially written on `main` at the same commit |
| Database revision | Sole Alembic head `0019_merge_passkey_roles` |
| Runtime | Locked Python 3.12 environment; uv 0.11.24; PostgreSQL 17 disposable Docker fixtures |
| Host | Windows; 12 logical processors; 16,867,045,376 bytes physical RAM |
| HTTP experiment | One private Windows Uvicorn API, restricted app/worker logins, loopback HTTP and generated synthetic sessions |
| API limits | Concurrency 64; server keep-alive 5 seconds; graceful shutdown 20 seconds; proxy trust disabled for loopback |
| Browser experiment | Separately built private API/web production images and disposable Compose stack; proxy/browser traffic |
| External effects | No live provider calls, real outbound actions, configured/shared database migration, or hosted load |
| Source integrity | SHA256 verification of all 170 application/migration/lock files in the saved manifest: unchanged |

All DB tests used the repository's generated disposable targets. The HTTP runner accepts no external target and rejects inherited database/provider credentials. Their absence was recorded without reading or printing `.env` contents. No financial goldens, application behavior, schema, lockfile or production configuration was modified to obtain a pass.

Test harness utilities and four disk-policy cases were added during the campaign. The 542-test full run includes the new passkey race and process-liveness regression; it predates the four new disk-policy cases. Their later focused run passed separately. Counts below overlap and must not be added together.

## 2. Executed verification

Evidence is retained under [the run directory](backend-stress-2/2026-10-17-eef7bea/). [summary.json](backend-stress-2/2026-10-17-eef7bea/summary.json) independently reconciles raw request counts, nearest-rank p95 values, JUnit results and the resource abort.

| Check | Fresh result | Evidence |
|---|---|---|
| Initial full backend baseline | 540 passed; 0 failures/errors/skips; 3 warnings; 685.83 s | [console](backend-stress-2/2026-10-17-eef7bea/backend-console.txt), [JUnit](backend-stress-2/2026-10-17-eef7bea/backend.xml) |
| Final full backend baseline | **542 passed**; 0 failures/errors/skips; 3 warnings; **658.69 s** | [console](backend-stress-2/2026-10-17-eef7bea/backend-final-console.txt), [JUnit](backend-stress-2/2026-10-17-eef7bea/backend-final.xml) |
| Isolated affected recovery/concurrency checks | **23 passed**; 1 warning; 83.59 s | [console and burst metrics](backend-stress-2/2026-10-17-eef7bea/recovery-final-console.txt), [JUnit](backend-stress-2/2026-10-17-eef7bea/recovery-final.xml) |
| Reference calculator | 22 cases, 0 problems; `ref-0.1.0` | [reference.txt](backend-stress-2/2026-10-17-eef7bea/reference.txt) |
| Independent calculator selftest | 0 failures | [selftest.txt](backend-stress-2/2026-10-17-eef7bea/selftest.txt) |
| Fresh production-image browser/proxy suite | **7 passed**, approximately 1.8 minutes | [browser-console.txt](backend-stress-2/2026-10-17-eef7bea/browser-console.txt) |
| Disk policy and actual process liveness | **5 passed**, 1 warning, 1.17 s; four new disk cases plus one already-covered liveness case | [console](backend-stress-2/2026-10-17-eef7bea/resource-guards-final-console.txt), [JUnit](backend-stress-2/2026-10-17-eef7bea/resource-guards-final.xml) |
| Actual low-space CLI invocation | Expected fail-closed result before disposable DB provisioning | [console](backend-stress-2/2026-10-17-eef7bea/blocked-preflight-console.txt), [preflight](backend-stress-2/2026-10-17-eef7bea/blocked-preflight/preflight.json) |

The full backend run includes migration/role/RLS regressions, the original SQL suite's 296 assertions on original and forward-upgraded schemas, the existing 400-row concurrent audit-chain check, authentication/passkeys, deterministic engine, jobs, approvals, sandbox execution/recovery and encrypted joint restic restore. These establish bounded local regression evidence, rather than completion of every stress variant in the plan.

The browser suite covers the persisted sandbox send/reply/accept/commit/reload/compensation journey, lost-response recovery, passkey enrollment/login, tenant HTTP pressure, continuation, CSP and mobile/accessibility checks. Browser traces remain in the runner's private temporary output directory recorded in its console; they were not copied into public docs. Private images, containers and volumes were cleaned up.

Three full-suite warnings remain: FastAPI TestClient/httpx deprecation and two SQLAlchemy DOMAIN `operator_classes` warnings. These did not fail assertions and are maintenance items. A first sandboxed guard-test attempt encountered four temporary-directory ACL setup errors; the same checks passed using a fresh workspace-local `--basetemp`. The failed infrastructure output remains in the run directory.

Final static verification: Ruff passed; generated contracts checked **112 operations**; Alembic confirmed the sole `0019_merge_passkey_roles` head; `git diff --check` passed. All 30 report links resolved and all 170 application manifest hashes still matched. See [final-verification.json](backend-stress-2/2026-10-17-eef7bea/final-verification.json) for the verification receipt (the additional receipt link brings the report total to 31).

## 3. Concurrency and proxy results

The following timings come from the isolated affected suite, without the reference calculator or browser build running concurrently. They measure the local harness/service boundary; they are not all HTTP latency measurements.

| Probe | Attempts / concurrency | Observed invariant | p95 ms |
|---|---|---|---:|
| Same-key operation admission | 64 / 16 | One operation and one admission audit event | 757.41 |
| Distinct-key capacity | 64 / 16 | Exactly 25 admissions and 39 `OPERATION_CAPACITY` refusals; another business admitted | 936.27 |
| Tenant pool reuse | 128 / 16 | Correct tenant scope across connection reuse | 633.17 |
| Competing editors | 24 / 16 | One winner, 23 conflicts | 223.41 |
| Execution double-click | 24 / 16 | One run/effect/round | 310.60 |
| Competing workers | 8 / 8 | Existing claim/fencing assertions passed | 118.20 |

The added **32-way signed WebAuthn challenge race** accepted exactly one finisher, denied 31 with `MFA_CHALLENGE_INVALID`, and left one live session, one `MFA_SIGNIN_COMPLETED` event and zero checked-out connections. This uses valid signed assertions and simultaneous finishers, rather than only malformed requests.

Readiness was false without a worker even for an empty queue. Customer pagination reconciled 51 rows as 50+1. P5 history retrieval used 18 queries for both one and eight rows, with median times 36.1/33.6 ms across three samples; this small result supports bounded batching, not a large-history scalability claim.

The separate production-image/proxy run measured:

| HTTP probe | Requests / concurrency | p95 ms | Result |
|---|---|---:|---|
| Mixed-tenant profile reads | 200 / 16 | 340.66 | Expected tenant responses |
| Same-key customer writes | 32 / 16 | 314.83 | One persisted identity |
| Malformed customer writes | 32 / 8 | 26.31 | Expected validation refusals |
| Closed-loop mixed probe | **7,459 / 8**, 60.044 s | **125.176** | 5,593 HTTP 200; 933 expected 404; 933 expected 422; **zero 5xx** |

The last probe's p50 was 56.922 ms and maximum 502.546 ms. Its closed-loop traffic and narrow route mix differ from the arrival-rate experiment below. It does not establish a general backend requests-per-second limit.

## 4. Arrival-rate experiment and reconciliation

The new opt-in runner is [run_plan2.py](../backend/tests/stress/run_plan2.py), with usage and scope in [its README](../backend/tests/stress/README.md). The final campaign used ten businesses, independent sessions, and **100 seeded deals per business**. Ten equal route classes cover profile, pipeline, deal, constraints, customers, notifications, distinct create, original-key replay, foreign-tenant 404 and invalid-limit 422. It excludes job admission, uploads and provider calls from this particular HTTP mix.

The generator used scheduled arrivals, up to 128 in-flight requests, monotonic due-time rechecks, raw request logging and two-second API-process-tree memory sampling. Timing includes the HTTP client. Client idle expiry was two seconds, below the server's five seconds. Planned stages were 2/5/10/20/40/80 requests per second, repeated three times, followed by a two-hour soak. Only the following were reached:

| Stage | Duration s | Started / dropped | HTTP 200 / expected 404 / expected 422 | Worst route p95 ms | Peak API MiB | Disposition |
|---|---:|---|---|---:|---:|---|
| First ramp, 2 req/s | 60.011 | 120 / 0 | 100 / 10 / 10 | 130.166 (create) | 109.785 | Short diagnostic stage passed |
| First ramp, 5 req/s | 60.012 | 300 / 0 | 240 / 30 / 30 | 113.789 (pipeline) | 108.816 | Short diagnostic stage passed |
| First ramp, 10 req/s | 7.315 | 73 / 0 | 72 / 0 / 0 | Excluded from acceptance | 107.352 | Intentionally interrupted at resource stop gate; one induced `ReadError` |

There were no unexpected responses, transport errors or 5xx in the two complete stages. These 60-second diagnostic windows are shorter than the plan's five-minute measurements and lack its separate two-minute warm-up. Per-route sample sizes do not support a p99 acceptance claim. API working sets exclude DB, worker and load-generator memory. No long-duration slope, steady-state leak or capacity knee was measured.

At **13:55:17 +06:00**, only verified API descendants of the exact final harness were terminated. The harness remained alive to reconcile and remove its own fixture. The resulting read error is an intentional-abort artifact, not evidence of a spontaneous two-second-client regression or a capacity failure.

After stopping, all ten businesses independently contained **105 deals each: 1,050 total**, including **all 50 acknowledged new creates**. There were **zero recovered unknown writes**, ten valid audit chains, zero unscoped visible deals, zero checked-out observer connections and zero idle-in-transaction sessions. The aborted event records `persisted_state_reconciled=true`; its nonzero process exit correctly retains the aborted campaign result. No new-key write was used to recover an uncertain outcome.

Raw evidence: [requests](backend-stress-2/2026-10-17-eef7bea/http-final/requests.jsonl), [stage/reconciliation log](backend-stress-2/2026-10-17-eef7bea/http-final/load.jsonl), [memory samples](backend-stress-2/2026-10-17-eef7bea/http-final/samples.jsonl), [console](backend-stress-2/2026-10-17-eef7bea/http-final-console.txt). Logs retain route labels, status/error classes, response sizes and timing; they omit request bodies, URLs, tokens and cookies.

## 5. Findings and harness corrections

### F01 — infrastructure gate blocks further stress acceptance

The plan explicitly stops load below 15% free disk. C: had **11,431,366,656 bytes free (7.147%)**. Docker's actual data disk is `C:\Users\Administrator\AppData\Local\Docker\wsl\disk\docker_data.vhdx`, so D:'s approximately 83.9 GB free did not satisfy that requirement. Approximately **13 GB more free on C:** would have reached the minimum at the measured total size. This is a resource-policy failure, not an observed application disk-full error.

The extended run should have checked Docker's physical storage volume before provisioning; it initially considered the workspace insufficiently. The runner now checks output, temporary and detected local Docker storage volumes **before starting its disposable fixture**, records `preflight.json`, and fails closed below 15%. Boundary tests cover 14.999%, 15% and 15.001%, plus a healthy workspace masking another required low-space volume. Remote-daemon storage still requires separate operator evidence.

See [disk evidence](backend-stress-2/2026-10-17-eef7bea/disk-preflight.json), [resource abort](backend-stress-2/2026-10-17-eef7bea/resource-abort.json), and [successful low-space refusal](backend-stress-2/2026-10-17-eef7bea/blocked-preflight/preflight.json). The final disposable DB container was confirmed absent at **14:02:58 +06:00** in [cleanup.json](backend-stress-2/2026-10-17-eef7bea/cleanup.json). No unrelated files or shared Docker storage were deleted or moved.

### F02 — equal client/server keep-alive expiry can disconnect requests

The first ten-business run used five-second idle expiry on both client and server. At two total requests/second, each business reuses its connection approximately every five seconds. It failed after 72 attempts with a replay `ReadError` (71 HTTP 200 responses); that initial harness version did not complete abort reconciliation.

A subsequent controlled comparison used the same ten businesses, two seed deals each, two requests/second and a 60-second target:

| Client idle expiry | Started | Outcome | Persisted state |
|---|---:|---|---|
| 5 seconds | 110 | 89 HTTP 200, 10 expected 404, 10 expected 422, one profile `RemoteProtocolError`; stopped at 55.082 s | All tenant intents and audit chains reconciled |
| 2 seconds | 120 | 100 HTTP 200, 10 expected 404, 10 expected 422; zero transport errors/5xx; full 60 s | Reconciled; restart replay and cleanup passed |

Evidence: [comparison](backend-stress-2/2026-10-17-eef7bea/keepalive-control.json), [five-second log](backend-stress-2/2026-10-17-eef7bea/keepalive-5/load.jsonl), [two-second log](backend-stress-2/2026-10-17-eef7bea/keepalive-2/load.jsonl). Inspection of the installed httpcore expiry and Uvicorn timeout code is consistent with an idle-timeout boundary interaction. This is an inference from a small local comparison, not proof of a backend data-integrity defect or exhaustive transport diagnosis.

Two-second expiry changes connection churn; it is an explicit diagnostic profile, not a production-server repair or permission to discard failures. The five-second compatibility case remains failed/open. No automatic retries hide errors. Broader client/proxy/OS repetitions and same-ID inspection for uncertain writes remain necessary before claiming this transport boundary resolved.

### F03 — distinguish process death from retained Windows memory counters

Early pilots incorrectly treated nonzero working-set counters as proof of live processes after termination. A separate probe found **two terminated processes, zero live processes and two nonzero retained counters** while their `Popen` handles remained held. This corrects the premature orphan-process diagnosis; no production/API process leak was established.

The test helper now checks Windows `GetExitCodeProcess` and explicitly terminates only the owned process tree, including the interpreter behind the Windows virtual-environment redirector. A regression retains the exited handle and checks actual death. Unix liveness uses the existing signal-based approach. The affected process recovery suite and the final full suite passed.

The scheduler also now rechecks monotonic due times because Windows timers can wake early, maintains the complete low-rate observation window, and records each request for independent statistics. Earlier pilot timing is excluded. [execution-notes.md](backend-stress-2/2026-10-17-eef7bea/execution-notes.md) identifies invalid or infrastructure-failed pilots; their outputs remain available rather than being relabeled as clean passes.

## 6. Plan scenario disposition

“Local regression” below means fresh bounded evidence exists, while the extended stress scenario remains open. No row implies the entire scenario catalogue passed.

| Scenario | Executed evidence | Remaining gate |
|---|---|---|
| S01 baseline/migrations | Frozen-source full suite, original SQL/forward upgrades, sole 0019 head, contracts | Hosted migration/readiness acceptance |
| S02 tenant/pool reuse | Actual restricted logins, 128-way reuse probe, HTTP cross-tenant refusals, unscoped reads empty | Hosted pooled-role/TLS behavior and prolonged churn |
| S03 authentication/passkeys | Auth/CSRF/session regressions; signed 32-way one-use challenge race; browser passkey journey | Sustained hostile authentication load and all timed-expiry pressure variants |
| S04 contention/capacity | 25/39 admission bound, tenant reuse and independent-business admission | Pool saturation curves, lock telemetry and contention under full workload |
| S05 replay/unknown response | Same-key bursts, editor conflicts, browser lost response, API restart replay, abort reconciliation | Extended expiry/transport/disconnect matrix; five-second client finding open |
| S06 financial integrity | Engine suite, 22 reference cases, independent selftest, resource-bound regressions | Sustained worst-case engine workload and CPU/RSS envelope |
| S07 freshness/publication | Existing revision/atomicity regressions in full suite | Every proposed repeated concurrent mutation/publication stress variant |
| S08 jobs/recovery/fairness | Worker competition, process restart/fencing regressions, no-worker readiness | Long queue pressure, heavy-tenant fairness, 1/2/4-worker comparisons |
| S09 uploads/parser | Existing source/body/parser regressions | Concurrent physical slow uploads, parser pressure and process-wide limits |
| S10 storage failure | Local adapter/failure regressions and joint restore | Shared hosted S3 authorization, outage/durable-byte/load acceptance |
| S11 language failures | Recorded/off/provider-boundary regressions | Live-provider latency/rate-limit/quality acceptance |
| S12 preparation/history | P5 restart/history tests; 1-vs-8-row query benchmark | Large reply/history curves and concurrent preparation pressure |
| S13 exact execution | Double-click, authorization/recovery regressions, full sandbox browser lifecycle | Long mixed execution load and every fault boundary under sustained concurrency |
| S14 collections/query growth | Supporting continuation, 51-row pagination, narrow history batching | D2 dataset curves, response-byte budgets and high-cardinality query plans |
| S15 audit/export | 400-row concurrent chain, post-load ten-chain reconciliation, export regressions | Two-million-row audit/export/retention pressure and external anchors |
| S16 topology/readiness | Actual private production-image proxy/browser stack; local worker readiness | Azure/Caddy/Neon rehearsal, replica comparisons, deployed resource telemetry |
| S17 joint restore | Existing encrypted DB/document restic restore regression | Hosted restore objectives; enrolled-MFA plus partially executed workflow restore drill |

Not executed: the plan's full workload classes R/W/J/A/U/M at their specified weights, two-minute warm-ups plus five-minute repeated measurement windows, three complete ramps, capacity-knee confirmation, two-hour or optional eight-hour soak, D2-scale datasets, comprehensive CPU/DB/lock/queue telemetry, and hosted database/provider/storage acceptance. Browser and regression results do not substitute for these gates.

## 7. Verification and database traceability

The V/DB identifiers below refer to the original implementation plan's acceptance catalogue and issue register. They describe evidence scope for this campaign, not a new exhaustive security audit or a blanket closure of historical issues.

| Verification ID | Current evidence and limit |
|---|---|
| V01 | Full contract/validation regressions; generated contract check covers 112 operations. No independent exhaustive wire fuzz campaign. |
| V02 | Original SQL, clean and populated-forward migration regressions passed on disposable PG17. |
| V03 | Actual runtime isolation, pooled reuse, cross-tenant HTTP and post-abort unscoped-read checks passed locally. Hosted pool open. |
| V04 | Full auth/CSRF/role/session suite and browser sign-in passed. Sustained hostile authentication open. |
| V05 | Reference 22/0, independent selftest 0 failures and engine/architecture regressions passed. |
| V06 | Analysis horizon/resource-bound regressions passed; worst-case sustained capacity open. |
| V07 | Source-integrity/parser/storage regressions passed; physical upload and hosted storage stress open. |
| V08 | Recorded/off/provider failure and untrusted-input regressions passed; live quality open. |
| V09 | Freshness/revision/history regressions and editor race passed; exhaustive stress matrix open. |
| V10 | Real worker/API restart, claim/fencing and recovery regressions passed; prolonged fairness open. |
| V11 | Exact sandbox authorization and signed challenge race passed; no real adapters accepted. |
| V12 | Concurrent admission/replay and state-reconciliation checks passed; transport compatibility remains open. |
| V13 | Sandbox double-click, recovery/compensation and browser lifecycle passed; sustained fault matrix open. |
| V14 | Concurrent PostgreSQL audit-chain and local export/restore regressions passed; large-scale/anchor gates open. |
| V15 | Seven production-image browser/proxy tests passed; this is bounded journey coverage, not all browser failure modes. |
| V16 | Local stack, readiness and encrypted restore regressions passed; disk gate blocks long stress and hosted acceptance remains open. |

| Database item | Campaign disposition |
|---|---|
| DB-01 | Actual restricted login/RLS/tenant context tested locally; hosted roles unverified. |
| DB-02 | No credential rotation/history audit performed; inherited credentials absent; no rotation claim. |
| DB-03 | Row/input revision regressions passed; no claim of every sustained race interleaving. |
| DB-04 | Child/source freshness regressions passed; extended competing mutation matrix open. |
| DB-05 | Engine horizon/past-event regressions passed; no financial semantics changed. |
| DB-06 | Existing state/operation transitions covered by full suite; no state-model migration introduced. |
| DB-07 | Evaluation failure/correction regressions passed locally. |
| DB-08 | Existing freeze/transition/version regressions passed. |
| DB-09 | Immutable approval/revocation/freshness regressions passed. |
| DB-10 | Exact send approval guards and sandbox send journey passed. |
| DB-11 | Kind/manifest/action authorization regressions passed. |
| DB-12 | Existing tenant/deal linkage regressions passed; no exhaustive FK audit claimed. |
| DB-13 | One-run admission, double-click, partial recovery and compensation regressions passed. |
| DB-14 | Durable session/job/step-up/reply evidence covered locally, including restart. |
| DB-15 | Role/shared-user/session-authority regressions passed. |
| DB-16 | Real signed passkey tests and browser enrollment/login passed; 32 finishers yielded one session. |
| DB-17 | Notification/ownership regressions and supporting reads passed; broad fan-out pressure unrun. |
| DB-18 | Source/extraction candidate regressions passed; large immutable-candidate history pressure unrun. |
| DB-19 | Priority validation/engine regressions passed. |
| DB-20 | Supported-policy validation regressions passed; no unsupported policy enabled. |
| DB-21 | Supported loan/fee semantics regressions and reference checks passed. |
| DB-22 | Delay/survival status regressions and reference checks passed. |
| DB-23 | Evaluation/result mapping regressions passed; expected financial values preserved. |
| DB-24 | PostgreSQL canonical chain/export regressions passed; tail anchoring and massive export unverified. |
| DB-25 | Scoped same-key admission/replay, conflict and permanent execution dedupe regressions passed. |
| DB-26 | What-if/preparation snapshot regressions passed; no fork authorized a real action. |
| DB-27 | Existing curated-error/replay regressions passed; raw SQL not logged in stress request metrics. |
| DB-28 | Fresh PG17/schema/concurrency suites executed locally; CI/hosted execution not certified here. |
| DB-29 | No deployed checkpoint/schema dependency audit or grant-removal rehearsal; remains unverified here. |
| DB-30 | Explicit-as-of history regressions passed; large customer-history dataset stress open. |

## 8. Reproduction and completion boundary

The remaining work starts with sufficient free space on every required storage volume and a fresh output directory. A new run should preserve the blocked evidence rather than overwrite it. For the same ten-business diagnostic profile, from `backend/`:

```powershell
uv --cache-dir 'D:\Kam 2\.uv-cache' run --frozen python -m tests.stress.run_plan2 --output ../docs/backend-stress-2/<new-run-id>/http --businesses 10 --seed-deals 100 --stage-seconds 60 --soak-seconds 7200
```

The runner now refuses the currently measured low-space configuration before creating its fixture. `--stage-seconds 300` supplies five-minute measurement windows, but separate warm-up, all workload families, large datasets and topology/fault variants still require harness expansion. The runner's default soak rate is 60% of the lowest repeated passing candidate; no candidate envelope was established in this campaign. The explicit `--client-keep-alive 5` control must remain visible alongside the default two-second diagnostic profile.

Changes are limited to test instrumentation, concurrency/liveness/resource-policy regressions, evidence, the plan/report and repository handoff documentation. No production fix is asserted. The requested blocked-gate report is complete; **capacity, soak and hosted gates remain unaccepted**.

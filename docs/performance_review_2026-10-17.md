# OrderFit performance review — 17 October 2026

User requested application speed/performance testing and fixes. Preserved the
earlier reliability repairs in the working tree on `main` at `8a9d1c2`.
No shared database, live provider or financial formula was changed.

## Bottleneck and change

The 20-row deals pipeline first read its metadata, then fetched each customer
missing from the bounded customer list **serially**, then launched all live
evaluation requests together (up to 20). A page of older customers accumulated
network round trips, followed by a burst against the API's five-connection pool.
Leaving the page only ignored results; it did not stop its network work.

Moved this page's read orchestration to `web/lib/pipeline-data.ts`:

- Keep the existing metadata waves, 20-row page size and first-page customer
  label reuse. Do not replace a useful list request with 20 singleton requests.
- Resolve missing labels through **four parallel request slots**, then retain
  the existing parallel evaluation wave. This removes the label waterfall without
  serializing evaluations on the common page whose customer labels are already
  loaded, or increasing the old peak request count. Repeated resource IDs are
  read once within this load.
- Pass the page's AbortSignal through the existing GET transport. Navigation,
  business/page changes and a failed load cancel obsolete in-flight requests;
  queued work stops on cancellation or error. This cancels browser reads; it is
  not a guarantee that a server query already running is terminated immediately.
- Preserve current financial results, stale flags, missing-label fallbacks,
  missing-baseline/evaluation handling and explicit technical-error recovery.
  No financial cache, auth bypass, shared tenant state, automatic mutation retry,
  pool-size increase or browser formula was introduced.

## Reproducible measurement

`web/tests/e2e/pipeline-performance.spec.ts` uses a real synthetic signup/session
against a freshly built disposable PG17/API/worker/web stack. Only pipeline
read-only related records are fixture responses: 20 orders, 20 distinct customers
absent from the first customer page, and 20 distinct live evaluations. Each
related response has a controlled 150 ms delay. All 20 rendered customer labels
and verdicts must appear; each refresh must make exactly 40 related requests.
The test performs three full reloads and records elapsed time and peak related
concurrency. This isolates client scheduling; it is not a live database,
large-evaluation-payload, hosted-network or production capacity benchmark.

Baseline production image, unchanged loader: **4,235 / 4,264 / 4,228 ms**,
median **4,235 ms**, peak **20** related requests. Baseline browser check passed.
Evidence: `C:/Users/moham/AppData/Local/Temp/orderfit-performance-before.log`,
`C:/Users/moham/AppData/Local/Temp/orderfit-e2e-40ad807662-results/`.

An intermediate shared four-slot limit across both resource types measured
2,311 / 2,180 / 2,203 ms (median 2,203 ms) and passed all eight browser tests.
It was refined because evaluation-only pages would incur extra network waves.
The final version preserves evaluation parallelism. Measurements were
**1,689 / 1,708 / 1,704 ms**, median **1,704 ms**: **59.8% less elapsed time**
than the original median, with the same 40 related requests and all 20 labels
and verdicts rendered. Peak customer concurrency was **4**, while the existing
overall related-request peak stayed **20**. These are three local samples under
controlled latency; they do not establish a whole-app or hosted speedup.

| Check | Final result |
|---|---|
| Browser suite against fresh production images | **8 passed in 1.9 minutes**, including the scheduling benchmark, full sandbox lifecycle, tenant HTTP/isolation, pagination, passkeys, CSP, keyboard/contrast and mobile/CSRF recovery |
| Frontend unit suite | **105 passed**, including known-label reuse, evaluation parallelism, deduplication, four-customer cap, stale flags, technical failure and cancellation |
| TypeScript and changed-file ESLint | Passed |
| Full frontend ESLint | Zero errors, 68 existing warnings |
| API and web production image builds | Passed |
| Real HTTP sustained probe | 7,837 requests / 60.05 seconds / concurrency 8; no 5xx; p95 95.32 ms. No backend speedup attribution. |

Final evidence: `C:/Users/moham/AppData/Local/Temp/orderfit-performance-final.log`
and `C:/Users/moham/AppData/Local/Temp/orderfit-e2e-5047c52a83-results/`.
The runner removed only its own synthetic containers, volumes and private image
tags. No new backend implementation or full backend-unit/DB-suite rerun was
needed for these frontend-only changes; prior reliability results stay separate.

## Trade-offs and remaining work

The improvement targets latency from older customer references. Pages whose
customers are already in the first list retain that reuse and their existing
evaluation parallelism. The worst case still makes 45 pipeline reads and downloads
full evaluation payloads, including the existing up-to-20 evaluation-request wave.
That burst remains a capacity consideration for the five-connection API pool.
A future server-side, tenant-scoped summary/batch contract would address
request count and payload size; this change does not silently substitute summary
arithmetic or fetch unlimited lists.

The existing real-HTTP stress checks are rerun for regressions, separately from
the controlled client benchmark. Their local latency is not a controlled
before/after measurement of a backend improvement. Engine computation, live AI
latency, landing-page animation cost, hosted latency and large-tenant payload
scaling remain separate measurement areas. No whole-app or production speedup is
claimed from this dashboard test.

## Follow-up: actual Neon connection

After the user restored Neon runtime URLs, both pooled connections were verified
using read-only transactions. The API/worker logins passed the application's full
restricted-non-owner checks. Neon already recorded `0019_merge_passkey_roles`;
this older checkout expected `0018_passkey_mfa`. Recovered the exact existing
merge graph, role-reference SQL and regression tests from repository commit
`d9670a0`, matching the deployed revision rather than changing Neon. Four
compatibility tests passed on a fresh disposable PG17 fixture, including upgrade
from both historical branches; no migration or stamp ran against Neon.

Runtime URLs initially used `sslmode=require`. Verified `verify-full` with the
installed certifi CA bundle and updated only the ignored host runtime settings.
The host-specific CA file path is not a portable container setting. Both runtime
configuration checks now pass; no privileged migration URL is passed to API.

Local API8000 now connects to Neon; the freshly built local web3000 proxies to it.
API `/ready` returned200 with database/schema/storage/worker all passing. Existing
worker presence was observed; no local worker was started to claim shared jobs.
The browser sign-in page also displays API ready.

Actual certificate-verified Neon samples: connection+begin **1,886 ms**;
five warm `SELECT 1` round trips **181.49 / 180.14 / 180.40 / 178.65 / 186.53 ms**.
These tiny sequential probes are not a load or dashboard benchmark. Direct API
readiness samples were726–750ms. Three later IPv4 web-proxy health probes measured
1,877–2,995ms; sign-in document responses30–67ms. These are separately observed
local-client-to-Neon timings, not a controlled before/after comparison. The local
frontend/API placement does not establish Azure/Vercel-to-Neon production latency.

Additional checks:22focused runtime/network/passkey-configuration/architecture
tests passed, one Starlette/httpx deprecation warning; backend Ruff, generated
contracts112operations and local production frontend build passed. An authenticated
dashboard timing still requires the user to sign in to the opened local app.
No private business payload was exported, no synthetic account/business record was
created on Neon, and no shared-schema migration or destructive stress test ran.

## Authorized account creation and Neon transaction setup repair

The user subsequently explicitly requested creating an account and signing in.
Created one synthetic account/business labeled **TEST ONLY — Neon Performance**
through the real signup UI. Verified its authenticated Owner dashboard and API
ready status. Its email uses `.invalid`; no private customer data or order was
added. Signup creates the necessary identity/business/session records on Neon;
the preceding read-only-only statement describes the earlier preflight scope.
The test password was generated randomly and was not printed or committed.

Three actual empty-dashboard reloads were observed at **6478 / 5906 / 5877 ms**
(median5906ms). These are browser-automation wall-clock measurements to the
visible refresh control, including browser bridge/polling overhead, not Core Web
Vitals or the earlier controlled20-order benchmark. The account has zero orders.

Inspection found `apply_timeouts` making three sequential SQL round trips before
each identity/job transaction. Batched its existing three `set_config(...,true)`
calls into one bound SQL statement. Values remain lock10s, statement60s and idle
transaction60s, applied at the same call sites before session resolution/locks.
No authorization check, lock ordering, lease check, RLS context, financial input,
calculation, audit or effect behavior was removed or reordered.

Explicit read-only Neon setup probes on one reused connection measured:

| Timeout setup | Samples (ms) | Median (ms) | SQL statements |
|---|---|---|---|
| Before | 256.50 / 268.59 / 258.49 | 258.49 | 3 |
| After | 128.62 / 76.79 / 73.05 | 76.79 | 1 |

This verifies fewer setup round trips and unchanged settings; small-sample
network timings vary and do not establish an end-to-end dashboard speedup.

The new disposable-PG17 regression first failed because setup executed3statements.
After the repair, **22DB tests passed in35.09seconds**: the new commit/rollback
pool-reuse tests, foundation suite and non-member/read-lock/lock-timeout behavior.
There was one existing Starlette/httpx deprecation warning. Ruff and generated
contracts112operations pass. No regression fixture targets Neon.

After the user interrupted/resumed work, local API/web processes were restarted
hidden on loopback and remain available. Browser automation then returned a
closed-transport error on two attempts; post-change authenticated UI timing could
not be completed. The earlier sign-in proof is saved at
`C:/Users/moham/.codex/visualizations/2026/10/17/01a148a6-824a-7fc1-8802-3cb5af981303/orderfit-neon-signed-in.png`.
Do not claim a measured dashboard speedup from the SQL microbenchmark alone.

## Isolated hosted acceptance follow-up

The17October user-authorized branch drill also reduced runtime role/schema
validation from3SQL queries to1. Seven warm Neon samples measured235ms median
before and125ms after (46.8% lower for that check only).43fresh disposable-PG17
DB tests and4architecture tests passed. No main schema/compute change or whole-app
speedup is claimed. See [hosted acceptance](security/neon_acceptance_2026-10-17.md)
for complete samples, the encrypted hosted restore and remaining storage controls.

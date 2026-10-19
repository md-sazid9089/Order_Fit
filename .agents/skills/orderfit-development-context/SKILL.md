---
name: orderfit-development-context
description: Resume OrderFit development with current phase status, decisions, code locations and evidence pointers. Maintain this handoff when material development context changes.
---

# OrderFit development context

20 October provider update: OpenAI Responses API is the only supported live
model provider. A live run using `gpt-6-luna` passed all 49 synthetic cases
across five AI proposal tasks with zero unsafe changes. This is proposal-layer
synthetic evidence, not persisted end-to-end or hosted acceptance. Older
FreeLLMPool files restored in commit 21e5edf are historical; their setup docs are
marked retired and their test modules are skipped. See the latest provider entry
in `docs/backend_implementation_progress.md`.

19 October account-access backend: new sole required schema head is
`0023_account_access` after 0022. Default-off verified-email enrollment/password
recovery, durable encrypted Resend account-mail outbox/callbacks, owner invitation
list/reissue/email and invitee-only registration are implemented locally.
Credential generation, NOWAIT-dependent revocation and session fencing retain
passkeys and approval history. Final focused acceptance:187passed; broad run:
806passed/1deselected/1stale-head-assertion failure, corrected and included in the
passing final focus. No clean full rerun is claimed. Backend-only exports are
current; frontend declarations/pages, shared DB migration, maintenance schedule,
provider DNS/keys/real delivery/browser remain with their owners. No Neon migration
or live send ran. See [implementation evidence](../../../docs/account_access_implementation_2026-10-19.md)
and [release runbook](../../../docs/deployment/account-access.md). Earlier schema
and disabled-capability snapshots below are historical, not today's source head.

19 October Docker startup follow-up: read-only container checks found the active
Neon DB at `0020_ai_workflow`, but the image requires `0022_baseline_duplicates`.
API/worker crash loops were stopped; database owner must apply BOTH `0021_admin_reads`
and `0022_baseline_duplicates` before recreating services. No Neon migration ran.
Failure-only startup diagnostics now name required/deployed revisions (8 focused
tests and rebuilt-image read-only verification pass). See the backend/database
handoff for the current BLOCKED deployment status.

18 October baseline-duplicate repair atop `9ed213e`: sole required schema head
is now `0022_baseline_duplicates` after `0021_admin_reads`. Backend manual create/
edit and CSV confirmation require explicit version-bound reviews of matching
obligations; immutable file-hash/row claims prevent reimport, including legacy
confirmed-preview history with lost cash-row attribution. Existing unresolved
baseline pairs block canonical confirmation. Migration preserves financial rows,
backfills source claims and invalidates existing snapshots once per affected
business. **No Neon migration, shared-data audit or deployment ran.** Final focused
disposable-PG17/contracts/architecture acceptance:118passed; broader regression
766passed/1live deselected (final delta evidence detailed in the handoff); frontend remains
with its owner. See [backend/database handoff](../../../docs/baseline_duplicates_backend_database_handoff.md)
and [frontend handoff](../../../docs/baseline_duplicates_frontend_handoff.md).
Earlier schema-head statements below are historical snapshots.

18 October admin-read remediation atop `4578538`: sole schema head is now
`0021_admin_reads`. Typed `/api/v1/admin/capabilities` plus overview/users/tenants/
orders/system reads are mounted, but `ADMIN_READS_ENABLED` defaults false. Global
logs and platform mutations remain unavailable. Two private NOLOGIN/NOBYPASSRLS
roles isolate fixed session-authorized read functions from runtime tenant access;
existing API logins require an explicit `orderfit_admin_api` grant, workers do not.
Totals are exact minor-unit strings grouped by currency; lists use signed session-
bound 15-minute cursors. Confirmation still rejects unacknowledged warnings with
a clearer message. Final focused restricted-role/contract suite: 131 passed on
disposable PG17; full regression 757 passed / 1 live deselected, with 3 deprecation warnings.
The focused rerun covers the final private-column grant gate. No shared
DB migration, frontend changes or hosted/browser acceptance. Backend-only contract
exports are current; browser declaration sync remains with the frontend owner.
See [frontend handoff](../../../docs/contracts/admin-frontend-handoff.md) and
[deployment runbook](../../../docs/deployment/admin-reads.md). Earlier schema-head
and disabled-router statements below are historical snapshots.

18 October AI workflow C1-C6/F5 (atop `8b7c00a`): sole schema head is now
`0020_ai_workflow` (candidate language/gloss columns, immutable `ai_advisory`, `advisory`
operation kind). Clause hypotheses (forks via `agent/nodes/compute.py`), slot-only
explanations, typed reply conditions/stance, what-if clarification, per-script language
provenance and provenance badges are implemented; verified only on recorded synthetic cases
(`scripts/ai_eval.py`, 49 cases) and disposable PG17. No live-model quality or browser E2E
run. See [plan](../../../docs/AI_WORKFLOW_PLAN.md) and the latest progress entry.

18 October overview backend adds authenticated `GET /businesses/{business_id}/overview`
under `/api/v1`, with one tenant-scoped aggregation query, integer money and the
canonical daily sweep for posted portfolio delay projections. No frontend changes.
Contract/data limitations and frontend integration work are documented in
`docs/contracts/overview-frontend-handoff.md`; no multi-currency ledger, FX,
historical balance comparisons or actual settlement evidence is invented. Use
`contracts.export --backend-only` until the frontend owner updates browser types.
Verification:634full backend tests pass;103final focused tests pass after DTO
refinement. Browser contract sync remains pending. Details are in the overview
entry in the backend progress file.
18 October native FreeLLMPool integration atop `abf2c5f`:207 focused tests pass
after reconciling concurrent Tier0/multilingual work. Four synthetic live smoke
tasks and repeated persisted same-order extraction/review/confirm/evaluate/what-if
flows pass on isolated native PG16.11;Docker/PG17 were unavailable. API8000 and
worker run from ignored `backend/.env.freellmpool`;web3000 is ready against that
separate synthetic DB. Main DB/existing.env are unchanged. Free mode is local-only,
uses a pinned keyless route and35-second request spacing, and has no paid fallback.
See [evidence](../../../docs/freellmpool_integration_2026-10-18.md) for the retained
test target, checks and limits. General live-model quality and main OpenAI
evaluation remain open. Broader assistant work is tracked in the
[AI workflow plan](../../../docs/AI_WORKFLOW_PLAN.md).

17 October AI-assisted website review from `47289ad`: malformed live JSON now
maps to INVALID_OUTPUT in extraction/what-if; mobile pipeline skeleton overflow
and stale sandbox copy repaired. Full backend553pass/1stale timeout-test failure;
corrected test verifies actual guards,10targeted DB checks pass. Six final browser
checks plus a separate15-route desktop/mobile/held-read sweep pass. Four synthetic
FreeLLMPool probes produced no usable structured output; no paid OpenAI calls.
See [review](../../../docs/ai_assisted_website_review_2026-10-17.md) for scope/limits.

17 October stress-plan-2 evidence at `eef7bea`, sole schema head
`0019_merge_passkey_roles`: **542 backend tests and 7 fresh production-image
browser/proxy tests passed**. See the
[stress report](../../../docs/backend_stress_test_report_2.md) for exact coverage.
The campaign is **partial/blocked**: Docker's C: storage had 7.147% free against
the plan's 15% minimum. Two 60-second arrival stages passed; repeated ramps and
the two-hour soak were not completed. A matched five-second client/server
keep-alive experiment disconnected; a two-second client control passed.
No production fix, capacity envelope or leak-free claim follows. All 50 final-run
acknowledged writes and ten audit chains reconciled before disposable cleanup.
The user chose the blocked-gate report; do not resume load implicitly.

17 October isolated hosted drill: user-authorized Neon branch
`orderfit-security-acceptance` (`br-hidden-cell-aok23ia2`, Singapore) and two private
drill buckets now have executed pooled-role/100-transaction isolation/TLS/storage
and encrypted cloud-to-Neon restore evidence. Restored four documents, verified
17 audit chains, revoked 25 copied sessions and checked two fresh sign-ins plus
cross-tenant denial. Branch expires18October18:56Bangladesh time. Provider-owned
cloud_admin default ACLs require a reviewed two-entry exclusion during restore.
Prefix-scoped API/worker keys, independent provider/KMS evidence and durable
retention remain open (current history six hours); user deferred rotation.
`_runtime_checks` now batches three catalog queries into one; seven-sample hosted
median235ms to125ms.43fresh disposable-PG17 DB tests and4architecture tests pass;
no whole-app speedup or full-suite rerun claimed. Main DB was unchanged by this
drill. See [hosted evidence](../../../docs/security/neon_acceptance_2026-10-17.md).

17 October Neon connection follow-up: the user restored pooled API/worker Neon
URLs in the ignored backend environment. Read-only preflight found deployed schema
`0019_merge_passkey_roles`, ahead of this checkout. Recovered the exact migration
graph/SQL and regression tests from existing commit `d9670a0`; sole required head
is now `0019_merge_passkey_roles`. Four disposable-PG17 compatibility tests and
22 focused runtime/security/architecture tests pass. No Neon migration ran.
Local runtime URLs now use `verify-full` with the installed certifi CA bundle;
that host-specific CA path must not be copied into containers. Compose now gives
API/worker/migration jobs a private outbound egress network for Neon while its
local database remains internal-only; its entrypoint translates only Windows
absolute CA paths to the image certifi bundle without weakening `verify-full`.
Local production web on port3000 proxies to host API8000 backed by Neon; `/ready`
passes all checks, including the existing worker heartbeat. A temporary duplicate
container pair verified the Compose path and was stopped. A user-authorized
synthetic account is created and sign-in verified; empty Neon dashboard reloads
measured a5906ms median through browser automation. Timeout setup now batches
three transaction-local settings into one query (22DBregressions pass; measured
Neon setup median258ms to77ms). Post-fix UI timing remains unverified after the
browser transport closed during interruption. Controlled20-order results remain
separate. See the latest progress entry.

17 October reconciliation: resumed from `main` at `eca00c9`; subsequent backend/admin
repairs are being made by a separate task. See the
[current matrix](../../../docs/orderfit_audit_2026-10-17.md) before using the older
snapshot below. Frontend verification now honors `API_INTERNAL_URL`, distinguishes
server outages from invalid sessions, and enforces the existing disabled console
capability after server-side RBAC. Simulated admin controls remain unavailable.
The backend owner has advanced to `0018_passkey_mfa`. Docker is available now;
the final seven-test browser suite passes sandbox send/reply/accept/commit/reload/
compensation, lost-response recovery and passkey enrollment/login. Fresh targeted
PG17 checks passed; the final frozen backend suite is **540 passed**. Passkey MFA
and the synthetic encrypted DB/document restore drill now have local evidence,
including replay/tenant controls, wrong-key/tamper rejection and restored-auth
quarantine. See [security acceptance](../../../docs/security/security_acceptance_2026-10-17.md)
and [phase closure evidence](../../../docs/phase_closure_2026-10-17.md) for current
checks and limits. The runner now isolates image tags and browser artifacts across
concurrent tasks. A read-only Neon preflight later verified restricted pooled
connections with `verify-full`, but provider controls and actual
bucket/KMS/retention remain unverified because no disposable target is available.
Main port 3000 refuses its stale database schema; do not migrate the main database
merely because a test account was authorized.

Earlier snapshot: **17 October 2026**, security continuation atop `eca00c9`.
Current checks: **359 non-DB backend tests**, **5 admin DB regression functions
on isolated PG16**, **95 frontend unit tests**, typecheck/Ruff/contracts passed.
Docker is unavailable; earlier **507 backend / 6 browser** results are historical.
See [security continuation](../../../docs/security/security_audit_2026-10-17.md).
Durable worker readiness, scoped supporting-list continuation and their enabled UI
consumers are implemented; role/CSP expectations and disposable queue ownership
are repaired. See the [current remediation report](../../../docs/backend_stress_remediation_2026-10-16.md)
for exact final results, source manifest, measured capacity and external blockers.
Check branch/diff before relying on this snapshot. Repository root: `../../..`.

Merge integration (16 October): incoming UI from `origin/main` at `392c7fb`
is retained with compatibility fixes for the backend committed at `b5e7aab`.
Subsequent admin work adds a server-derived platform flag, but global tenant/order
telemetry remains unavailable under runtime RLS. Sessions remain opaque HttpOnly
cookies with no credential in JSON. Sole head is `0017_platform_authority`, which
revokes sessions and audits actual platform-role changes. Retain supporting
list continuation controls alongside the remote skeletons/layouts. See the merge
integration entry in the progress file for current verification.

## Read only what the task needs

- Follow [root instructions](../../../AGENTS.md) and the applicable
  [backend](../../../backend/AGENTS.md) or [web](../../../web/AGENTS.md) instructions.
- For phase work, read the [plan](../../../docs/initial_backend_implementation_plan.md)
  and latest relevant [progress entries](../../../docs/backend_implementation_progress.md).
  Progress is not strictly chronological; later remediation supersedes old gaps.
- Code/SQL establishes implementation; contracts/plan establish intent; progress
  records evidence. Investigate disagreements instead of trusting a completion label.

## Current status

OrderFit assesses whether an SME can afford an order, comparing deposits,
supplier extensions and term loans. The deterministic engine owns financial
figures; OpenAI proposes evidence-backed facts/language; humans approve actions.

| Phase | Recorded state |
|---|---|
| P0–P2 | Contracts, foundation and deterministic engine gates passed locally. |
| P3 | Latest remediation records **local gate passed**, superseding partial commit `c03b2eb`. Per-option scans, provenance, exports, process recovery and persisted UI were added afterward. |
| P4 | Documents, guarded extraction, field review and CSV import are integrated. A shared S3 adapter now supports split API/worker storage; only provider-stub tests ran. Independent final acceptance and live OpenAI/model evaluation remain pending. |
| P5 | Local preparation gate passed: isolated forks, exact reviewed drafts, human-reviewed customer/supplier/lender replies, attestations and persisted session UI. The order-detail Decision guide now makes the stored evaluation's alerts, coverage gaps and high-value clarification questions actionable without changing inputs or calculations. Preparation alone cannot dispatch; P6 separately authorizes sandbox effects. Live language/dialogue-quality acceptance is unverified. |
| P6 | Local gate passed: exact-bundle approval, session-bound step-up, fenced durable execution, sandbox effects, serialized commitment gate with engine-derived baseline projection, rounds, compensation. Real adapters do not exist. |
| P7 | Members/invitations, account evidence, notifications, exports/history implemented. Session reauthentication tests and supporting-list continuation repaired; current local verification is in the remediation report. |
| P8 | `/ready`, graceful worker shutdown, same-origin proxy, Render/Neon runbooks and disposable browser E2E are verified locally. **Hosted acceptance, persisted/hosted OpenAI workflow, S3 provisioning/restore drill and PgBouncer-under-Neon are unverified.** |

The [original stress report](../../../docs/backend_stress_test_report_2026-10-16.md)
remains historical evidence. Its ST-01 through ST-06 and bounded local ST-09
remediation are recorded in the [current report](../../../docs/backend_stress_remediation_2026-10-16.md).
Old sessions require reauthentication after both demotion and reinstatement; do
not restore authority to satisfy an old test. Disposable tests terminalize only
their own newly created operation IDs, preserving history and production ordering.
CSP negative controls use parser-inserted HTML under the real nonce policy.
The latest disposable browser evidence includes the persisted order/negotiation
journey, the full sandbox send/reply/accept/commit/reload/compensation lifecycle,
mobile navigation, accessible sign-in, CSRF recovery, failed-read retry and a
15-route desktop/mobile sweep. It does not certify hosted providers. P4 and P8
remain partial; engineering completion is not submission evidence.

## Decisions easy to miss

- The current frontend is **`web/`**, not historical `frontend/`.
- Target OpenAPI/contracts contain future endpoints; inspect registered routes
  and capability markers before treating a feature as enabled.
- One confirmed-input pipeline and one calculation boundary:
  `agent/nodes/compute.py`. Only `agent/llm.py` invokes the OpenAI provider.
- Money is integer minor-unit text over HTTP; dates/balances need explicit evidence.
  Detailed financial, concurrency, RLS and idempotency rules are in backend AGENTS.
- Neon is the intended existing core database. API uses restricted `DATABASE_URL`;
  worker uses `WORKER_DATABASE_URL`; `DATABASE_URL_DIRECT` is migrator-only.
  Use `orderfit.runtime api|worker --env-file .env` from `backend/` to select settings.
- Code requires `0021_admin_reads` (sole head after `0020_ai_workflow` and `0019_merge_passkey_roles`, which joined the passkey/platform
  authority line with the recovered Neon role branch). The hosted DB needs this migration before the new API runs.
  Platform flag changes revoke all existing sessions and record an atomic audit event.
  Revision 0015
  requires new authentication after membership role changes and fences old
  worker/approval authority. New global worker evidence has FORCE RLS and only
  narrow worker-publish/API-boolean helpers; no direct runtime table grants.
  Two `0004` branches join through
  `0005_p3_p4_integration`; preserve that migration history.
- [Neon setup evidence](../../../docs/neon_connection_review.md) establishes P1
  setup only, not today's hosted schema. Verify before another hosted migration.
  Destructive tests use disposable PostgreSQL fixtures, never configured Neon URLs.
- No live OpenAI, hosted deployment, restore or production resource-calibration
  acceptance is established. Historical owner-credential rotation remains unverified.
- `/ready` now gates on an unexpired global worker heartbeat; `backlog_seconds`
  stays separate. Workers pulse every 10 s with DB-time expiry 60 s and one reserved
  DB connection, independent of job work. See the [contract](../../../docs/contracts/stress-remediation.md).
- Pipeline performance: `web/lib/pipeline-data.ts` resolves missing customer labels
  four at a time, preserves first-page label reuse and parallel evaluations, and
  cancels obsolete GETs on navigation/failure. Still 20 orders/page; full evaluation
  payloads and up-to-20 evaluation fan-out remain. See the
  [performance review](../../../docs/performance_review_2026-10-17.md) for controlled
  browser measurements and their limits. No financial caching was added.
- Eight legacy lists now have scoped signed continuation; supporting selectors use
  bounded load-more/retry controls. General lists retain explicit offset-start
  compatibility; pipeline stays at 20 orders/page. Default policy reads use
  `default_only=true`, never an arbitrary first-page policy. Pipeline/evaluation
  fan-out remains; no unbounded fetch-all was added. Message history is batched with list/single
  parity, query-count, paging and tenant regressions. See the audit before scaling.
- OCR and docx/xlsx remain unsupported. P5 parses bounded quoted reply terms;
  arbitrary supplier/lender offers and unsupported prose require manual source review.
- P5 reuses `whatif_run`/`negotiation_message`. Additive preparation/reply/acceptance
  evidence is immutable. `deal.analysis_changes` contains only reviewed exploration
  settings and participates in existing input-revision invalidation. Loan selection
  narrows a grid without changing stored offer terms. Fork history loads summaries.
- Preparation hashes/reviews are not action bundles or outgoing approvals. Only an exact,
  step-up-approved bundle (`services/bundles.py`, `services/execution.py`,
  `workflow/execution.py`) can produce sandbox effects; a P5 bank-change hold clears only
  through `flag_resolve` with exact reply + verified account + evidence + current T3.
- Commit settlement projects engine events (`agent/nodes/compute.py` mapping, stored per
  option) once and bumps the revision once; the per-business commitment gate stays held until
  settlement or full compensation. Sandbox only: no real adapter exists.
- Deployment: Compose keeps API/worker/database internal and only web host-facing; browser API
  calls use a same-origin Next rewrite. Render API/worker use a shared S3-compatible store once the
  bucket and matching secrets are provisioned. Migrations remain a separate manual Render job;
  API/worker refuse `DATABASE_URL_DIRECT`. See `docs/deployment/`.
- Audit repairs: execution retries transient PostgreSQL conflicts under its existing lease;
  late cancellation after all effects may settle; live idempotency keys cannot be deleted by
  the runtime role; uploads are authorized before slot admission and have overall/idle limits;
  `/docs`, `/redoc`, and `/openapi.json` require `EXPOSE_API_DOCS=true`.

- Security hardening (16 October): see [audit findings](../../../docs/security/security_audit_2026-10-16.md). Remote runtime DB URLs now require `sslmode=verify-full`; HTTPS origins require Secure cookies. PDF parsing records p4.2 and runs in a 384-MiB/10-second child (two at once, no inherited application secrets); password work is capped at two operations per process; pending jobs at 25 per business. Strict nonce CSP and privilege-change reauthentication are implemented and tested locally. Historical DB credential rotation, hosted encryption/restore and MFA remain open. Local tests do not close those release gates.

- Sustained contention reproduced pool starvation: authenticated DB transactions now
  reject checkout after 3 seconds with retryable `DATABASE_CAPACITY`/503; pool size
  remains five, overflow zero. Preserve original idempotency keys on retry.
- Live OpenAI, pooled/role/S3/Render/Vercel and joint restore gates remain unrun.
  [External procedures](../../../docs/deployment/external-acceptance.md) include dry-run
  probes with explicit target/budget opt-in; an available application URL is not consent.

## Find the relevant implementation

| Area | Entry points |
|---|---|
| Contracts/client | [contracts](../../../backend/orderfit/contracts/), [generated web types](../../../web/lib/generated-api.d.ts), [API client](../../../web/lib/orderfit-api.ts) |
| Use cases/jobs | [API](../../../backend/orderfit/api/), [services](../../../backend/orderfit/services/), [workflow](../../../backend/orderfit/workflow/) |
| P5 preparation | [contract](../../../docs/contracts/p5-preparation.md), `services/preparation.py`, `store/preparation_repository.py`, `workflow/preparation.py`; UI `web/components/preparation-workspace.tsx` |
| Database | [store](../../../backend/orderfit/store/), [SQL](../../../backend/migrations/sql/), [revisions](../../../backend/migrations/versions/) |
| Financial semantics | [engine](../../../backend/orderfit/engine/), [architecture/ADRs](../../../docs/architecture/orderfit/), [reference fixtures](../../../docs/architecture/orderfit/fixtures/) |
| Verification | [tests](../../../backend/tests/): `tests/db/test_p3_*`, `test_p4_documents.py`, `tests/test_p4_pure.py`, `tests/engine/`, `tests/contracts/` |

## Verify proportionately

From `backend/`: `uv run --frozen ruff check .`,
`uv run --frozen python -m orderfit.contracts.export --check`,
`uv run --frozen python -m alembic heads`, and relevant tests using
`uv run --frozen python -m pytest -q --tb=short -x -p no:cacheprovider`.
DB tests need Docker; default pytest excludes opt-in `live` provider checks.
Browser acceptance runs separately through the web Playwright scripts.
From `web/`: `npm run typecheck`, `npm run lint`, `npm run build`.
See [README](../../../README.md) for setup/runtime commands. Documentation-only
edits need link/format checks and `git diff --check`, not the application suite.

## Keep this handoff small

Update affected sections and snapshot metadata when phase status, a material
decision, schema/path or verified blocker changes. Put detailed evidence in the
progress file and design rationale in ADRs. Remove superseded context; do not
append a transcript, duplicate AGENTS rules or update this file for routine edits.
This maintenance request creates no background automation or hosted-action authority.

# Admin handoff reconciliation — 20 October 2026

## Follow-up: database blocker repaired

After the user authorized the remaining repairs, recovered only the historical
0024 revision and SQL from `7986f51`, byte-for-byte (not its application-level
tenant-authorization bypass). Added `0025_admin_read_isolation` as a forward
repair. It restores the original bounded user/overview DTO shapes, removes the
private reader's membership-table access and extra account-column grants, and
revokes admin-function role inheritance from shared runtime/worker/read-only roles
and directly granted worker identities. Ordinary tenant authorization stays intact.
The sole application-required/Alembic head is now `0025_admin_read_isolation`.
Admin prerequisites also reject shared-role inheritance and membership-table reads.

Started the installed Docker Desktop runtime and executed the restricted-role
admin/migration suites on disposable PostgreSQL 17 **and 18**: **29 passed on each**.
Both runs include original schema/concurrency checks, populated forward upgrades,
the new 0023→0024→0025 repair preservation regression, worker denial, cross-tenant
detail denial, pagination, missing permissions and revocation races. The fixture
now accepts `ORDERFIT_TEST_POSTGRES_MAJOR=17|18`, defaulting to 17, and still never
consumes shared application URLs. PostgreSQL 18 matches the freshly verified Neon
server major. Backend Ruff passes; contracts remain current at 134 operations.

Read-only owner catalog comparison verified that all five deployed admin function
bodies matched the recovered 0021/0024 sources before repair. Created a full
PostgreSQL-18 custom-format dump using verify-full TLS, then encrypted it locally.
Backup: `backend/var/admin-repair-1e0c9dbf4527/database.pgdump.fernet` (ignored).
Its key is protected with current-Windows-user DPAPI in `backup-key.dpapi` beside
the dump. Verified key recovery, authenticated decryption and `pg_restore --list`
(1,218 archive entries). Keep both files and the current Windows account available
for recovery. This verifies the archive, not a complete shared-data restore drill.
No plaintext dump or raw key was written to disk or printed.

Applied **only 0024→0025** to the already configured shared Neon database through
Alembic, with an exact endpoint/database/revision precheck and the encrypted backup
present. No downgrade, stamp, historical SQL rerun or financial/business-row DML
was used. Fresh post-migration checks: required/deployed revision match; both API
and worker runtime validation pass; API prerequisites pass and all five function
EXECUTE checks are true; worker prerequisites and all five EXECUTE checks are false.
The previously unknown provider branch classification remains unverified; the
target was explicitly treated as the configured shared application database.

The earlier sections below retain the initial investigation and its historical
blockers; this follow-up supersedes their schema/Docker status.

### Final browser and local-runtime evidence

`scripts/run-e2e.ps1 -TestPattern 'read-only admin joint acceptance'
-EvidenceDirectory 'E:/Order_Fit/backend/var/admin-joint-evidence'` passes against
freshly built API/worker/web images and an isolated PostgreSQL database. This
uses real authentication, SQL functions and browser reads; it is not an HTTP mock.
Synthetic promotion/revocation and SQL seeds are guarded by a disposable Compose
project-name/label check. The fixture preserves a second owner before removing
the administrator's business membership. No shared accounts were changed.

Verified ordinary owner 403; revoked session 401; fresh synthetic platform admin
with no memberships receives global summaries; unrelated business detail stays
404; more than 50 users continue correctly; exact order value renders on desktop
and mobile; global logs return 503; platform mutation buttons are absent; actual
mobile signout clears access; demotion invalidates the newly authenticated session.
Screenshots and the sanitized image manifest are in the evidence directory.
The disposable stack and its volumes were removed by the runner.

The real browser test exposed a transient `55P03` session-lock conflict between
parallel overview/system reads. `web/lib/admin-data.ts` now retries only the
retryable GET codes `DEPENDENCY_UNAVAILABLE`/`DATABASE_CAPACITY`, at most three
attempts with abortable 150/300ms delays. Authorization, disabled capabilities and
unsupported data are not retried. The independent panel states are preserved.
Regression tests cover recovery and the retry bound. Final web unit result:
**127 passed**; fixture browser suite: **2 passed**; real joint browser suite:
**1 passed**. Web build/typecheck and focused changed-file ESLint pass. Final
backend admin/architecture/runtime/startup selection: **28 passed**. Full backend
Ruff, contract drift checks and `git diff --check` pass. Full web lint's unrelated
28 errors/68 warnings remain as reported in the original investigation.

Joint run identity: `orderfit-e2e-549f15f434`; API/worker image
`sha256:d3f9ac051c358a4f4ea08aed7a3dd148948668b4e0d5be0d7859dab23835ead2`;
web image `sha256:8d461c6cb0c5f9fce221f40a0c88be265b145a6411e662d3940aca4ef405a7ab`.
Git HEAD remains `81b0b36` plus the uncommitted changes documented here; no commit
or branch was created.

After joint acceptance, enabled `ADMIN_READS_ENABLED=true` in the ignored
`backend/.env` and relaunched this checkout's API on loopback port 8000 through the
restricted runtime launcher. The configured service capability check against
Neon returns true (global logs/mutations false). Started the rebuilt frontend at
`http://localhost:3001/admin`; it proxies to that API. Fresh API `/ready` and web
`/api/health` return 200 with all reported readiness checks true. Anonymous admin
API returns 401 and browser `/admin` redirects to sign-in. Sign in with an existing
authorized administrator to use the console. No existing account was promoted or
edited. These are local processes backed by the configured shared Neon database;
they are not a hosted frontend deployment or a signed-in Neon acceptance session.
No new live provider work was launched as part of the admin acceptance tests.

Remaining limits: provider branch classification and a signed-in shared-Neon
browser smoke test remain unverified. The full dump archive was checked but not
restored into a second database. Full light/dark/keyboard/desktop/collapsed/mobile
coverage is not claimed from the bounded browser selection. These limits do not
reopen the resolved schema/grant blocker or justify bypassing any isolation gate.

### Main integration

Integrated the repair onto remote main `7986f51` in a separate managed checkout,
preserving its unrelated smooth-scroll fix and additional test coverage. Restored
the strict read-only DTOs, generated contracts and tenant authorization together;
updated the newer DTO tests to assert rejection of unsupported membership/metric
expansion. Removed the unused legacy `web/lib/admin-api.ts` client, which duplicated
DTOs and membership fan-out. No local evidence directories, temporary test files,
environment settings or encrypted backups are included in the commit. On this
integrated tree, the focused backend selection passes 32 tests and the web unit
suite passes 133 tests; backend Ruff and contract drift checks pass.
The integrated frontend build/typecheck, two browser fixture tests and focused
changed-file ESLint also pass. The earlier real disposable joint browser test
remains the functional SQL/API/UI evidence for the unchanged admin implementation.

Reviewed the two supplied handoffs under `E:/others/` against branch
`ui-release-2026-10-19`, HEAD `81b0b36e76cf6acf36a88a8b5a769408a209af64`.
The documents supplied acceptance criteria; historical deployment claims were
rechecked rather than treated as current instructions or evidence.

## Result

Frontend implementation was incomplete and is now connected to the existing
read-only contracts. Backend read routes/services already existed and are retained.
The combined deployment acceptance gate is still blocked; this is not a fully
operational administrator-console certification.

- All eight `web/app/admin/` pages now use `components/admin/platform-screen.tsx`.
  Overview uses global totals and a separately loaded system panel; users, businesses
  and orders use bounded global continuation. Unsupported columns, tenant mutations,
  email role inference, membership fan-out and fabricated self rows are removed.
- `web/lib/admin-data.ts` checks capabilities before data requests, encodes opaque
  cursors and resets continuation on refresh. It aborts/fences obsolete responses,
  clears data on session reset, capability loss and access denial, and separates
  panel failures. Focus rechecks capabilities; no unsupported logs polling exists.
- Recorded order values preserve decimal strings, zero, missing values and separate
  currencies. A regression covers 40-digit totals. No loaded-row counts are used
  as global totals. Search/export controls were removed because neither has a
  complete server contract.
- Engine/security pages are informational. Server-side layout authentication stays
  authoritative. The shared sidebar now exposes actual protected signout for admin
  consumers on expanded, collapsed and mobile navigation. Signout immediately clears
  local/query state; failures are visible and retryable.
- Regenerated `web/lib/generated-api.d.ts` with the backend exporter (134 operations;
  admin capabilities/overview/system v1). No parallel handwritten DTO definitions.
- Updated the deployment runbook to preserve migrations after historical revision
  0021 instead of instructing operators to target that old head.

## Current database evidence (read-only)

Loaded connection configuration without printing passwords or tokens. Both runtime
connections target the same pooled Singapore Neon endpoint/database `neondb`;
the direct connection uses the corresponding non-pooled endpoint. API login is
`orderfit_runtime`; worker login is distinct, `orderfit_worker_login`. These are
the configured shared application connections, not disposable test databases.
Provider branch ID and development/production classification were not independently
available from connection metadata.

Executed explicitly read-only SQLAlchemy transactions using each runtime login:

| Probe | API | Worker |
|---|---|---|
| Recorded schema revision | `0024_admin_user_management` | same |
| Checkout required revision / Alembic head | `0023_account_access` | same |
| Superuser/BYPASSRLS/CREATEROLE/CREATEDB | false | false |
| Private reader membership | false | false |
| `orderfit_admin_api` USAGE | true | false |
| `orderfit_worker` USAGE | false | true |
| EXECUTE on all five admin read functions | true | false |
| Full `prerequisites()` | false | false |

The missing API grant reported in the supplied handoff is already resolved.
The schema mismatch is now a confirmed prerequisite failure. Other prerequisites
were not independently decomposed. Backend environment inspection found no enabled
admin-read setting (default false); with Docker unavailable this does not certify
the environment of any running release.

Git history contains `7986f51`, introducing a revision with this name. It also
changes business authorization to allow platform-admin tenant access and includes
a grant to shared `orderfit_app`. Those changes conflict with this task's isolation
contract. It was inspected but not imported; a matching revision name alone does
not establish that its SQL exactly matches the deployed catalog. Reconcile applied
SQL and prepare a reviewed forward correction on a disposable database before
changing runtime schema requirements. Do not bypass the current schema gate.

No migration, grant, account change, feature enablement or shared business write
was performed. No real documents/accounts were used as test fixtures.

## Checks executed

- `web`: `npm test` — 125 passed, including ten new controller regressions.
- `web`: `npm run build` and `npm run typecheck` — passed. Initial attempts hit
  stale generated `.next/dev/types` referencing removed auth pages. Those generated
  types were preserved in a unique ignored `node_modules/.cache-admin-stale-types-*`
  folder, after which build regenerated current production route types.
- `web`: focused ESLint on changed admin pages, component, sidebar, controller,
  capability helper and unit tests — passed. Full `npm run lint` remains failing:
  28 errors/68 warnings in unrelated document/reply/negotiation, fixture and visual
  components. These were not changed or suppressed.
- `web`: `npx playwright test admin-fixtures.spec.ts --workers=1` — two passed.
  Uses an isolated loopback Next production server and synthetic identity/API
  fixtures, with no database or live provider access. Covers anonymous/non-admin
  server redirects, disabled no-read behavior, large separate-currency totals,
  false versus unknown checks, partial health failure, capability-loss clearing,
  pagination/refresh/invalid cursors, 403/401, unsupported data, successful empty
  results, a dark-mode render, mobile navigation and real signout command dispatch.
  This is fixture evidence, not a signed-in joint smoke test of deployed services.
- `backend`: `uv run --frozen python -m pytest -q tests/test_admin_contracts.py
  tests/test_admin_security_rbac.py tests/test_admin_provisioner.py --basetemp
  .test-tmp-admin-review -p no:cacheprovider` — 15 passed.
- `backend`: contract export `--check` — passed, 134 operations. Alembic heads —
  sole head `0023_account_access`. `git diff --check` — passed.

## Remaining acceptance

Docker daemon is unavailable (`dockerDesktopLinuxEngine` pipe missing), so
`tests/db/test_admin_reads.py`, `tests/db/test_admin_security.py` and disposable
revocation/concurrency/migration acceptance were not run. Do not run them against
the configured shared Neon connections. Reconcile the ahead-of-source schema,
verify provider branch classification and the complete API prerequisites, deploy
with reads disabled, then run the approved synthetic enabled/disabled API matrix
and joint browser smoke test. Authenticated deployed 200/403/503, unrelated-business
summary/detail isolation, revocation races and full desktop/mobile/theme acceptance
remain unverified. No change to required schema or live enablement is justified by
the fixture passes alone.

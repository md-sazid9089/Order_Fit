# Backend implementation progress

## 19 October 2026: account recovery and emailed invitations backend

Implemented locally from `42e9bc2` against
[account-access.v1](contracts/account-access-v1.md). Required schema is now
`0023_account_access`, after `0022_baseline_duplicates`. All account-mail features
and worker sending default off. No shared/Neon migration, provider configuration,
live send, frontend source edit or deployment ran.

- Added strict account-access/mail contracts, public capability discovery,
  authenticated email verification, generic password-reset request/confirmation,
  invitation-only account registration and signed Resend callbacks. Session email
  verification/eligibility and invitation delivery projections are required fields.
- Added manual SQL/Alembic migration for private FORCE-RLS token, encrypted outbox,
  event and suppression storage. Dedicated non-login helper owner is excluded from
  runtime authority; API/worker retain narrow function grants, not table secrets.
- Credential generation and bounded NOWAIT revocation atomically invalidate old
  credentials/sessions/challenges/step-ups. Passkeys and immutable approval history
  survive reset; queued execution loses old session authority before any effect.
  No alternate identity provider or financial calculator was introduced.
- Added AES-GCM keyring, frozen allowlisted templates, bounded HTTP/Svix adapter,
  stable provider retry keys, 60-second fences, early/replayed callback handling,
  monotone delivery state and bounce/complaint suppression. One mail per existing
  worker tick; no fake tenant/session or second queue. Maintenance is separate and
  migrator-only, with an operational scheduling gate before hosted enablement.
- Extended existing membership code with owner-only paged invitation history,
  atomic email enqueue/reissue/cancellation and current issuer checks. New invitee
  registration creates no business/membership/session and does not verify email.
  Legacy manual copied invitations still work while email mode is off.
- Updated role-specific runtime configuration, examples, Compose/hosted switches,
  backend-only generated OpenAPI/TypeScript (134 operations), validated synthetic
  wire examples, and frontend/database/deployment handoffs. No `web/` file changed.

Verification: final frozen focused suite **187 passed**, one existing Starlette
deprecation warning; Ruff and backend contract export/check pass. Disposable PG17
fixture ran original SQL **296/296** before/after upgrade, concurrency and fresh/
legacy migration preservation checks under restricted API/worker logins. The
broad default regression run was **806 passed, 1 deselected, 1 failure**: only an
outdated exact-head assertion naming 0022. It was corrected to assert 0023 and
its predecessor, then passed in the final focused run. The full suite was not
repeated after that correction and the final targeted contract/security deltas;
do not claim a clean all-pass full run. Compose example configuration and final
documentation consistency checks pass.

Current limits: existing locked-out unverified users cannot bootstrap recovery;
lost-passkey recovery is not supplied; online recipient-fingerprint key rotation
and generic suppression clearing are deferred. Shared DB deployment/roles,
privileged cleanup scheduling/keyring restore, sender DNS/tracking/real mailbox
callbacks, frontend declarations/pages and browser acceptance remain unrun.
Details, commands and logs: [implementation evidence](evidence/reports/account_access_implementation_2026-10-19.md).
Next owner actions: [database handoff](account_access_database_handoff.md),
[frontend handoff](account_access_frontend_handoff.md), and
[release runbook](deployment/account-access.md).

## 18 October 2026: read-only platform admin remediation

Implemented atop `4578538` following
[the backend fix plan](admin_backend_fix_plan_2026-10-18.md). The former
membership-derived frontend remains for its owner to replace; no `web/` files,
configured/shared database, running deployment or platform authority were changed.

- New sole schema head `0021_admin_reads`; forward migration creates five
  session-authorized functions and two private NOLOGIN/NOBYPASSRLS roles. The
  function owner has column-limited reads on app_user/auth_session/business/deal,
  private SELECT policies, locking-only UPDATE(id) grants with false write checks,
  and no public-schema CREATE. The API caller role has function execution only.
  Existing API logins need a reviewed caller-role grant; workers do not receive it.
  Normal tenant RLS policies remain intact. Runtime validation rejects inheritance
  of the private owner role. No owner/BYPASSRLS login was added to API or worker.
- `contracts/admin.py`, `store/admin_repository.py`, `services/admin.py` and
  `api/routes/admin.py` implement mounted capabilities, overview, paginated users/
  tenants/orders and measured system status. `ADMIN_READS_ENABLED=false` by
  default; catalog/schema/ACL/policy prerequisites are checked in one DB round
  trip. Disabled/missing prerequisites return explicit unavailable; global logs
  always remain unavailable and no platform mutation endpoints were introduced.
- Functions validate the token digest/current session/current platform flag in
  the same bounded transaction as the read. User-before-session locks serialize
  platform revocation; NOWAIT handles contention with existing inverted passkey
  flows as retryable failure. System probes release locks and revalidate afterward.
  Signed keyset cursors bind endpoint, actor/session, order and 15-minute expiry.
- Counts cover distinct persisted rows across all businesses, not memberships or
  list pages. Recorded order values remain exact decimal strings grouped by
  currency; missing values have explicit coverage. There is no FX or USD fallback.
  Unsupported stored data returns `ADMIN_DATA_UNSUPPORTED`; SQL aggregate precision
  is retained above individual-order and JavaScript safe-integer bounds.
- Confirmation's existing warning rejection now has an actionable message;
  remaining generic passkey challenge errors have curated retry guidance. Status
  polling and evaluation DTOs retain their contracts. A regression proves retrying
  a failed operation GET recovers the same operation without a second evaluation.
- Published backend-only OpenAPI/TypeScript/ownership artifacts, response fixtures,
  [frontend handoff](contracts/admin-frontend-handoff.md) and
  [deployment runbook](deployment/admin-reads.md). Semantic comparison confirms
  all pre-existing endpoint contracts and schemas remain unchanged. Browser types
  intentionally remain for frontend ownership: full exporter `--check` currently
  reports `generated-api.d.ts` drift; backend-only parity passes (123 operations).

Verification in this implementation:

- Locked `uv sync --frozen --extra dev` completed after finding the declared
  FreeLLMPool dependency missing from the original virtual environment.
- **131 final focused tests passed** using isolated labeled PG17 with separate
  migrator/API/worker logins. Covers global reads without memberships, unchanged
  ordinary tenant/direct-SQL denial, forged digest/context, worker/owner-role
  denial, idle/absolute/revoked sessions, platform-revocation serialization,
  session-lock contention/recovery, exact mixed-currency totals, >100-row keyset
  paging, session/endpoint/expiry/tamper cursor rejection, missing API/private-column ACL/policy
  fail-closed behavior, unknown/failed system checks and warning-before-write.
- The original 0001 and forward-schema SQL suites remain **296/296** each;
  concurrency scripts and historical-row preservation pass through the existing
  disposable fixture. The exact SECURITY DEFINER inventory now includes only the
  five named additions. Upgrade paths from both prior merge parents and from an
  empty DB pass. Alembic reports sole head `0021_admin_reads`.
- Full backend regression run: **757 passed, 1 live-provider test deselected,
  3 deprecation warnings in 712.42 seconds**. The warnings concern the existing
  Starlette HTTPX test client and SQLAlchemy DOMAIN operator-class deprecation.
  Final focused rerun additionally covers private column-grant withdrawal added
  during the full run; its **131 tests passed** on the final admin implementation.
- Ruff passes. Backend-only contract parity, synthetic fixture validation, local
  document links and diff whitespace checks pass (existing CRLF normalization
  notice only). No browser or hosted acceptance was executed in this backend task.

Release gates still open: deployed target/role review, approved shared deployment
migration and API caller-role grant, explicit read enablement, browser declaration
sync, frontend integration and joint browser acceptance. Local passing tests do
not close these gates. Disable through configuration; do not downgrade history.

> Current reconciliation, 17 October 2026: see the
> [resumed audit matrix](evidence/reports/orderfit_audit_2026-10-17.md). The old stress failures below
> were subsequently repaired (reported final 507 backend passes); neither that
> result nor the old migration-head statement certifies the newer admin/RBAC work.
> Backend/admin remediation is separately owned and in progress. Fresh frontend
> and isolated-stack evidence is recorded in the latest continuation entry.

Current phase status (16 October 2026): P0–P3/P5–P7 have local implementation and
gate evidence, with additional acceptance/scale gaps listed in the
[current spec audit matrix](evidence/reports/orderfit_audit_2026-10-16.md). **P4 and P8 remain partial**:
live/independent AI quality and hosted/restore acceptance are unverified. Earlier
entries and their counts are historical; later remediation supersedes old gaps.

## P0 — contract freeze (15 October 2026)

Scope: P0 only. No P1 migration, auth/session service, repository, worker, document
storage implementation or business endpoint was implemented. The application
engine and language/workflow scaffolds remain later-phase work. No earlier P0
completion was assumed or recovered.

### Checkout reconciliation

- Starting branch: `backend/initial`; HEAD `d71f5465cce1938845827d0df80ca2431ef10d34`.
- Initially untracked user-provided files: root `AGENTS.md`, `backend/AGENTS.md`,
  `docs/initial_backend_implementation_plan.md`. Read and preserved all three;
  no existing progress file, contract package, generated API types or uv.lock.
- Read the plan in full, both applicable instruction files, actual schema/guards/
  grants/reference data/migration boundary, scaffold modules/tests/configuration,
  reference semantics and current database connection guide.
- The plan's audited `a0608e6` is an ancestor of HEAD. Committed changes since it
  are environment/ignore files and database documentation. SQL and application
  files are unchanged across that range. This does not validate historical tests.
- Stayed on the existing branch. Did not reset, clean, switch branches, rewrite
  history or contact configured/shared databases. Supplied instruction/plan files
  are included in the requested P0 commit without rewriting their contents.

### Actual deliverables and decisions

| Files | Actual change |
|---|---|
| `backend/orderfit/contracts/primitives.py` | Strict wire money/BIGINT IDs, business dates, UTC instants, currencies, roles, revision and pagination primitives; numeric/boolean literals cannot coerce |
| `contracts/financial.py` | Complete confirmed snapshots, evidence/source roles, costs, supported loan terms, owner policy/strategy/scenarios, sensitivity; duplicate/anchor/grid/aggregate/full-horizon/work/coverage validation |
| `contracts/resources.py`, `workflow.py`, `language.py` | Draft/read/write/upload/import/auth/job/result/approval/action/execution/export DTOs; blocked outcomes separate from numeric results; typed language proposals only |
| `contracts/protocol.py` | Frozen snapshot/bundle canonicalization, secret-aware keyed request fingerprints, freshness/expiry predicates, state/permission/SQLSTATE contracts; no competing audit-chain format |
| `contracts/configuration.py` | Explicit settings contract, live-mode fail-closed validation, safe origins, selected Argon2id parameters; strict runtime startup wiring remains P1 |
| `contracts/catalogue.py`, `export.py` | 101 target operations with method/path, request/response, permission, service/storage owner, implementation phase and V-test gate; offline deterministic export, never mounted mock success |
| `docs/contracts/openapi.json`, `frontend-api.d.ts`, `typecheck.ts` | Generated OpenAPI 3.1/frontend types plus positive/negative TypeScript consumer examples |
| `docs/contracts/README.md`, `capability-ownership.md`, `db-gap-dispositions.md`, `state-action-matrix.md` | Source/decision matrix; supported/deferred list; full DB-01–DB-30 dispositions; DB-to-snapshot-to-engine/result mapping; transport/null/unit/idempotency/permission/source/loan/action rules |
| ADRs `0007`, `0008`, `0009` | Accepted P0 contracts for eight-state runner, snapshots/exact approval bundles and restricted roles/sessions; clearly distinguish acceptance of design from implementation |
| `backend/tests/contracts/` | Executable valid/invalid/stale/missing/security cases and synthetic canonical snapshot/bundle byte/hash fixtures; no seeded credentials or provider traffic |
| `backend/pyproject.toml`, `.python-version`, `uv.lock` | Python 3.12 target, locked runtime/dev graph, OpenAI 2.54.0, argon2-cffi 25.1.0; removed unused LangGraph dependencies; pinned isolated build backend/transitive build constraints |
| Dockerfile, Compose, CI, environment templates, README | Frozen uv installs; explicit separate migrator/runtime credential injection; no entire developer env injected into API; CI contract generation/validation/typecheck; development commands and honest current status |
| `config.py`, API/schema and agent docstrings, database guide status note | Disable automatic developer env loading and privileged URL fallback; current P0 contracts supersede unsafe historical examples; existing unimplemented functions remain explicitly scaffolded |
| `.gitignore`, tracked `.env`/`backend/.env` removal | Ignore credentials while preserving example files; removed both secret files from the index with local file hashes compared before/after, byte-for-byte unchanged |

Financial resolutions are explicit, with no pending financial TODO in the P0
contracts. Supplier cost quotes are not customer revenue quotes. Only positive-grid
flat term loans with explicit fee timing/availability are supported; no APR or
generated-limit-as-approval assumption. Unsupported active policies/late penalties
are rejected. Full horizon includes late financing/repayments and scan endpoints;
coverage gaps require acknowledgement. Finite scan success never means proven
nonpayment survival. Existing immutable evaluations/options/approvals/actions,
cash events, identity objects and PostgreSQL audit canonicalization remain owners.

Coarse business revisions deliberately invalidate more results to simplify safety.
Row/input/business/source versions are separate. Terminal deals do not reopen;
compensation is separately authorized evidence. Manifest hashes cover all content,
recipient/account/terms/revision/expiry fields and are never authority by themselves.

Two contract additions remove otherwise undefined producer/consumer boundaries:
`GET /api/v1/auth/csrf` for pre-auth CSRF and GET/PATCH `/baseline` for dated opening
balance/coverage/evidence. P1/P3 must extend existing business/auth infrastructure
for them; no replacement accounting/identity system. Resource creation DTOs exclude
server-assigned offer/constraint IDs; confirmed snapshots retain actual IDs/versions.

Secret-bearing request fingerprints use a keyed digest because Pydantic redacts
password/account JSON; hashing that mask would treat different credentials as equal.
Auth response caches must not store raw session tokens. Auth-only lost-cookie
recovery requires explicit fresh sign-in, while financial commands retain exact
same-key replay. This exception is specified in the contract guide, not left to P1
to invent. Password step-up remains distinct from MFA.

OpenAI is the sole selected LLM provider. Official Responses structured-output
documentation was checked and the installed SDK exposes `responses.parse` with
`text_format` (local signature inspection, synthetic key, no network request).
There is no hardcoded model or price. P4 selects/evaluates a configured model and
implements off/recorded/live behavior; P0 does not claim those provider paths work.

### Checks actually executed

Local Python: CPython 3.12.13; Docker build uses CPython 3.12.15. Commands below are
from `backend/` unless a different directory is shown. A workspace-local uv cache
was used because the default cache was inaccessible. Initial dependency network
access was sandbox-blocked; approved download access resolved it. No approval was
rejected, and no dependency-install failure was reported as a pass.

| Check | Result |
|---|---|
| `uv sync --frozen --extra dev --offline` after lock generation | Passed; reproducible local install, no lock update during frozen sync |
| `uv run --frozen --offline ruff check .` | Passed |
| `uv run --frozen --offline python -m orderfit.contracts.export --check` | Passed; 101 operations; generated artifacts match code |
| `uv run --frozen --offline pytest tests/contracts tests/test_architecture.py tests/engine tests/agent -q` | 84 passed; 81 new contract cases plus three original architecture tests. Existing engine/agent files are test scaffolds, not evidence of engine/agent completion |
| `openapi-spec-validator ../docs/contracts/openapi.json` and validator inside contract test | Passed; all component schemas also checked with JSON Schema validator; local refs resolve |
| TypeScript 5.9.3 from existing frontend lock: `tsc --strict --noEmit docs/contracts/frontend-api.d.ts docs/contracts/typecheck.ts` (repo root) | Passed, including declaration checking; generated money/ID/header/what-if types include checked invalid examples |
| `python ../docs/architecture/orderfit/fixtures/reference_engine.py --check` | Passed: 22 cases, zero problems, `ref-0.1.0`; expected files unchanged |
| `python ../docs/architecture/orderfit/fixtures/selftest.py` | Passed: zero failures, independent sweep/rounding/scenario/reference checks |
| `docker compose --env-file .env.example config --quiet` (repo root) | Passed, exit 0; default Docker config read warned about permissions; no resolved secrets printed |
| `docker build --tag orderfit-api:p0-contract-check ./backend` | Passed with final pinned build constraints; image `d90e57fd654e` |
| `docker run --rm --network none --entrypoint python orderfit-api:p0-contract-check ...` | Passed: UID 10001, installed API imports, only `/health` mounted, network disabled; no DB/provider connection |
| `git diff --check` | Passed; migration directory unchanged and both environment files absent from tracked index |
| Environment handling | Both local files preserved byte-for-byte; values were not printed; only key names/classifications inspected |

Initial Docker daemon inspection was sandbox-denied; approved build access
succeeded. An empty DOCKER_CONFIG hid this machine's installed Compose plugin;
the actual template validation was repeated with its normal plugin discovery and
returned exit 0 (config-read warnings only). Neither failed probe is deployment
evidence. The image build and non-root smoke checks above were actually completed.

The contract tests cover canonical money/IDs, all four currencies, dates, strict
booleans, unknown/missing fields, unsupported loans/policies, overflow/work/horizon,
source identity/role, revision conflicts, exact bundle hash sensitivity, canonical
goldens, permissions/state seed parity, idempotency fingerprints, Argon2id, safe
configuration, OpenAPI/type drift and health-only runtime behavior. They do not
stand in for database concurrency, source parsing or provider tests.

### Acceptance gate and unresolved work

**P0 acceptance gate passed.** Executable valid/invalid/stale/missing examples, complete target DTOs and
generated frontend types, capability -> endpoint/service/storage/test-gate mapping,
all 30 database dispositions and explicit financial semantics are present and
verified by the checks above, including final image build/smoke. The requested
commit is `feat(backend): freeze P0 contracts and lock dependencies`; its SHA is
available in Git history. No P1 implementation was started.

Credential-bearing database URLs existed in tracked environment files. Local
copies were preserved; owner rotation/revocation of historical credentials is
required and unverified. Untracking does not revoke repository-history exposure.
No configured database or provider was contacted to test credential validity.

Not run/claimed: PostgreSQL migrations/schema/concurrency/runtime-login/RLS tests;
actual auth/jobs/storage/restart/restore; running Compose stack; frontend browser
journey/full frontend build; hosted PostgreSQL/Neon; live OpenAI extraction/quality;
remote CI. These are later phase gates, not simulated passes. Docker image success
and liveness import are not a persisted business operation or running deployment.
The image's Python base tag remains a mutable deployment input; P8 must pin and
validate deployment artifacts if bit-for-bit deployment reproducibility is claimed.

### What P1 requires (not started)

1. Re-read current instructions/plan/contracts and inspect actual populated 0001
   data. Add manual forward foundation migrations without modifying applied SQL:
   sessions/provisioning, operation leases/fencing, snapshots and revisions, required
   compatibility/priority/tolerance/transition fixes and narrow privileges.
2. Match SQL with repository/Core mappings and scoped transaction factory. Verify
   real non-owner API/worker LOGIN roles, no admin/owner fallback and no pool leak.
3. Implement real password/session/CSRF/business selection/current membership,
   restricted owner provisioning, central errors, durable idempotency and PostgreSQL
   audit adapter. Wire RuntimeConfiguration into startup; no demo identity auth.
4. Establish separate API/worker operations, claim/restart/fencing and private
   document storage interface; do not implement P2 engine or P4 provider yet.
5. On an explicitly disposable PostgreSQL 17 target, pass clean and populated-0001
   upgrades, original SQL/concurrency suites, actual-runtime two-user/two-business,
   no-context/pool, membership revocation, idempotency and worker recovery gates.

## P1 — identity, persistence and durable operations (15 October 2026)

### Reconciliation and interruption

Started from `backend/initial`, P0 commit `f968c35`. Read applicable instructions,
the implementation plan and progress, and inspected the interrupted changes.
The previous P1 turn is recorded as failed due to the usage limit, with no final
completion report. Its code had never executed a P1 migration; only one DB smoke
test existed, and the progress file still described P0. File existence was not
accepted as completion evidence. Reused and completed that work rather than
replacing the checkout. P0's 84 tests, generated contracts/types and reference
fixtures were verified again against the actual code.

The interrupted attempt's automatic approval review could not complete because
of the usage limit. On resume, approved Docker access succeeded. Initial checks
then found a stopped daemon, Windows text encoding/newline issues in the harness,
an overbroad PO-reference freeze, SQL variable ambiguity in the revised claim
function, and a preservation assertion that initially failed to account for the
one deliberate transition addition. These were fixed and rerun; none was counted
as a passing gate. A non-elevated storage check also encountered Windows temp/cache
permissions; rerunning with an explicit workspace temporary directory passed.

An unrelated `.gitignore` edit appeared during this turn (ignoring `.github/`).
It was preserved and excluded from the P1 commit. Tracked workflow changes remain
part of P1. No existing environment-file contents were read, replaced or printed.

### Actual changes and decisions

- Manual revision `0002_backend_foundation` executes only new
  `migrations/sql/0005_backend_foundation.sql`. Revision 0001 and its four applied
  SQL components are unchanged. Existing users, memberships, businesses, deals,
  cash events, evaluations/options, idempotency and PostgreSQL audit objects remain
  authoritative; no parallel financial/identity tables replace them.
- Added private global hashed sessions, auth request replay, rate counters and
  denial/security events; tenant snapshots, future step-up storage and durable
  operations. New tenant objects have composite scope references, FORCE RLS,
  indexes, explicit grants and appropriate immutable evidence guards. Step-up
  remains disabled until P6 adds exact bundle admission/consumption.
- Added business financial revision, deal input revision and child row versions,
  membership revocation/last-owner protection, cash void/supersession metadata,
  explicit document source role, six priorities, tolerance status/cap and snapshot
  references. Added `computing -> awaiting_confirm` without replacing eight states.
  Legacy immutable results/options are not rewritten; NULL tolerance status must
  be presented as unclassified/legacy_unknown by future readers.
- Child/source/baseline/offer/payee/account/history changes invalidate coarse
  business revisions; deal children also invalidate input revisions. This
  intentionally favors conservative refresh over premature dependency tracking.
  Preserved editable PO references and OLD-state frozen-input rules. Snapshots
  verify actual canonical bytes/hash, metadata, current revisions and confirmer.
- `store/db.py` verifies actual restricted API/worker LOGIN roles and schema at
  startup. Verified sessions and current memberships establish transaction-local
  scope; pool commit/rollback clears it. No demo actor or privileged fallback.
  API rejects worker credentials and migration URL injection. Migrator-only
  provisioning creates fresh restricted logins and refuses implicit role/password
  replacement. Raw GUCs are scope enforcement for a trusted application login,
  not an authentication system for arbitrary end-user SQL.
- Added partial Core mappings matched against real SQL, repositories, existing
  audit-chain append adapter, durable tenant-global idempotency and safe central
  errors. Denials persist separately after rollback; responses omit SQL, driver
  text, credentials and validation input. Security-event writes use the thread
  pool instead of blocking the API event loop.
- Enabled nine P1 routes: CSRF, signup/signin/signout/me/password, capabilities,
  operation get/cancel. Passwords use Argon2id; sessions enforce 8h absolute/30m
  idle expiry, revocation and current active/non-MFA status. Origin and signed,
  session-bound CSRF checks protect mutations. Cookies are HttpOnly/SameSite=Lax,
  Secure by default. Signup provisions a new owner/business/default constraint
  through a narrow helper, never accepting actor/role/admin IDs.
- Auth replay stores only IDs and keyed request digests. Lost bearer-cookie
  responses require explicit sign-in recovery; tokens/passwords are not replay
  cache payloads. Logout/password changes revoke sessions; a revoked cookie gets
  401 rather than authorizing response recovery. Current memberships supplied by
  `/auth/me` are the available business selections.
- Operation admission/idempotency/audit commit together. Separate workers use
  leases, heartbeat, fresh fences, bounded retries, cooperative cancellation,
  membership/session rechecks and stale revision rejection. Claims/publication
  obey business -> deal -> related-row lock order. Blocked/stale evaluation work
  returns to confirmation; technical failures cannot become numerical verdicts.
  Future handlers are absent and fail visibly as `CAPABILITY_UNAVAILABLE`.
- Private filesystem storage uses generated UUID scope, actual-byte SHA256,
  bounded writes, fsync/atomic publication, no replacement and restart reads.
  Upload/parsing/download services remain P4. The root must be private and owned
  by the application; no claim of a hostile local-filesystem sandbox is made.
- Compose now separates migration, one-time setup provisioning, API and worker
  credentials/processes. CI invokes the disposable DB acceptance harness rather
  than only migrating with a privileged service login. README and
  `docs/evidence/reports/p1_backend_foundation.md` explain operation and phase boundaries.

### Checks actually executed

Final full DB run used a verified disposable PG17 target
`orderfit-p1-test-155089f080d7` / `orderfit_p1_test_155089f080d7`, loopback only,
plus its empty upgrade database. Random secrets were not printed. Separate real
`p1_runtime` and `p1_worker` LOGIN credentials exercised runtime behavior.
The fixture removed its verified, labeled container afterwards.

| Check | Actual result |
|---|---|
| `uv run --frozen pytest -q -s --tb=short -x` | **106 passed**, 19.46s; 84 preserved P0 tests, 19 DB acceptance cases and 3 private-storage cases |
| Original schema regression on 0001 | **296 passed / 0 failed** |
| Same schema suite on 0002 | **296 passed / 0 failed**; only three exact structural inventory expectations are revision-aware; behavior assertions unchanged |
| Original concurrency script on both revisions | Both passed: 8 writers/400 chained audit rows, exact sequence/hash verification and optimistic loser updates zero rows |
| Empty and populated forward upgrades | Passed; every original column/row compared exactly, including immutable legacy evaluations/options and audit chain; only the exact new transition row was added |
| Actual LOGIN isolation and permissions | Passed: non-owner/no-admin startup, privileged/worker-as-API rejection, two tenants/users, no context, commit/rollback pool reuse, forged session/actor, cross-deal/cross-tenant source references, no direct auth-secret or API queue-helper access |
| Auth HTTP/service checks | Passed: persisted cookie across new API engine, CSRF/Origin, unknown actor fields, generic bad login, expiry/idle/revoke/logout/password rotation, unsupported MFA/suspended fail closed, safe unique-conflict/validation/404/413 errors and durable denial recording |
| Concurrency and operation recovery | Passed: concurrent same-key admission produces one operation/audit, changed-request conflict, membership revocation serialization, role downgrade, last owner, racing claims, expired lease/new fence, stale heartbeat/publication, bounded retries, cancellation and stale financial revisions |
| Real worker process recovery | Passed: claimed operation persisted, child process terminated before publication, lease explicitly expired, restarted CLI recovered the same operation at attempt 2; no future financial handler was enabled |
| Evidence and revisions | Passed: immutable snapshots, forged confirmer denial, direct child/source revision increments, same-deal constraints, frozen combined-edit rejection and stale evaluation state recovery |
| Core mappings vs PostgreSQL catalog | Passed for every mapped column/type affinity |
| Private storage | Passed actual-byte hash, generated scope, same-ID overwrite refusal, persistent restart read, empty/oversize cleanup and invalid path rejection |
| `uv run --frozen ruff check .` | Passed |
| Contract export `--check` | Passed, 101 target operations unchanged |
| Strict generated TypeScript compile | Passed with TypeScript 5.9.3, offline cache |
| Reference calculator and independent selftest | 22 cases / 0 problems; selftest 0 failures; reference/production engine sources unchanged |
| Compose example config, including setup profile | Passed using sanitized `.env.example` only |
| Backend image build and non-root import smoke | Passed final image `812b05f546c9`, tag `orderfit-api:p1-foundation-check`; API/worker/provisioning imports as UID 10001 with network disabled; no DB/deployment claim from this smoke |
| `git diff --check` | Passed |

The test suite reports one dependency deprecation warning: Starlette's TestClient
httpx integration recommends httpx2. Tests pass with the committed P0 lockfile;
no unreviewed dependency migration was introduced to suppress it.

### Acceptance and remaining scope

**P1 acceptance gate passed on local PostgreSQL 17.** The required migration,
preservation, original SQL, actual runtime isolation, concurrent idempotency and
revocation, claim/restart/fencing and safe-error evidence is above. The earlier
interruption is resolved. This does not claim full backend or deployment readiness.

Outstanding external security action: rotate/revoke credentials historically
committed before P0. Rotation remains unverified; preserving/untracking local
files does not revoke them.

Not run/claimed: hosted PostgreSQL/Neon and transaction-pool compatibility, browser
auth integration/full user journey, a full running Compose stack, remote CI,
backup/restore, live OpenAI calls/quality, upload/parser/download acceptance or
financial end-to-end operations. These are later gates. Body limits/download
authorization/parser provenance must be extended in P4. Rate-counter retention,
production metrics and deployment retention/cleanup remain operational work.

P2 requires the pure deterministic engine port and independent reference parity,
rounding/calendar/daily-trough/baseline/profit/loan/scenario/ranking/tolerance/VOI
and complete-horizon/limit regressions. P3 will build reviewed confirmation and
atomic fenced evaluation/option publication on this foundation. P2 and P3 were
not started; no financial formula, engine code, provider SDK boundary or frontend
workflow was changed in P1.

## Neon connection inspection — 15 October 2026

After P1, the user authorized inspection of the teammate-supplied Neon environment.
Both direct and pooled connections were tested in explicitly read-only
transactions over client TLS. Neon reports PostgreSQL 18.6 and Alembic revision
`0001_core_schema`, not P1. The supplied login has owner/admin/BYPASSRLS privileges;
it cannot be used as the API/worker login. The original three privilege groups
exist, but dedicated restricted runtime LOGINs and P1 tables are absent.
Business/deal row-existence checks returned false. Existing public checkpoint
tables were observed and preserved. No private row payloads were inspected.
Read-only migration preflight also confirmed the named constraint/policy, schema,
composite references and function signature required by the forward migration,
with no new-table or checked new-column name conflicts. Full schema equivalence
and the actual hosted migration remain unverified.

An initial pooled probe with extra startup options failed; retrying without
those options succeeded. Only sanitized error classifications were emitted.
No URL, password or raw driver error was printed. No migrations, provisioning,
environment edits or hosted test writes were performed. This is connectivity and
catalog evidence, not hosted P1 acceptance. Original local PostgreSQL 17 evidence
remains distinct from this PostgreSQL 18 managed target.

The concrete pending migration/provisioning/configuration steps are recorded in
`docs/evidence/reports/neon_connection_review.md`. Approval is still needed for these hosted
schema/role changes beyond the completed read-only inspection. P2 remains unstarted.

## Approved Neon P1 setup — 15 October 2026

The user subsequently authorized the proposed migration, role creation and local
environment updates. Applied the existing `0002_backend_foundation` forward
migration on the same supplied Neon PostgreSQL 18.6 database. All original public
table row counts were preserved, except the deliberate additional state-transition
reference row. Existing checkpoint tables were not dropped or repurposed.

Created separate SQL LOGINs `orderfit_runtime` and `orderfit_worker_login` with
generated passwords and narrow group membership. Preserved the supplied owner
credential as migration-only. Updated ignored root/backend environment files,
generated independent application secrets, retained private ignored originals
and removed the completed one-time recovery file. No credentials were printed,
committed or passed as visible shell arguments.

Both environment files pass strict runtime configuration validation. Actual API
and worker logins pass startup role/schema checks over pooled TLS connections;
neither has Neon superuser membership. No-context tenant reads, transaction-local
GUC reset after commit and role-specific queue-helper permissions were verified.
An actual API child process started against Neon and passed `/health` and OpenAPI;
it was stopped after verification. No business/auth/job test rows or provider
calls were created. The owner password and historical credential rotation remain
unchanged/unverified.

Added the explicit `python -m orderfit.runtime api|worker` local launcher, which
reads a selected environment file, uses the designated runtime URL and forwards
only runtime settings plus OS essentials. It excludes inherited migration and
provisioning secrets. Added two permission-boundary tests, backend environment
template/README instructions and an explicit python-dotenv dependency already
present in the locked graph (62 packages; no package version changes).

Checks: frozen offline lock/sync passed; Ruff passed; generated target contracts
unchanged (101 operations); 86 contract/architecture/launcher tests passed. Full
provider-free suite passed **108 tests in 24.81s**, including the original SQL,
concurrency and P1 gate inside a fresh disposable local PostgreSQL 17 container.
No destructive tests targeted Neon. The existing TestClient dependency warning
remains. `git diff --check` passed.
The separate user `.gitignore` edit remains preserved.

## P3 — Persisted manual-input vertical slice (15 October 2026)

### Reconciliation and implementation

Recovered the interrupted, unstaged P3 work by comparing the live diff with the
P3 plan and current P0/P1/P2 contracts. Preserved the existing `.gitignore`
change and did not use Neon or any configured/shared database for tests.

- Added forward migration `0003_p3_results` / SQL component `0006_p3_results`.
  It adds lender and evidence provenance to existing financing offers and a
  tenant-scoped immutable evaluation-series table with grants, composite tenant
  references and row-level security. Existing evaluation and option tables are
  reused; no parallel identity, deal or financial ledger was introduced.
- Registered P3 SQLAlchemy mappings and advanced the required runtime schema
  revision. Updated the schema inventory test for the one additive table.
- Added business/customer/payee/offer and evaluation read routes, plus persisted
  baseline, source and deal repository flows. Confirmed snapshots use the
  existing immutable snapshot/approval records. Evaluation jobs run the sole
  deterministic compute boundary in a bounded child process; freshness checks,
  result/options/series publication and fenced operation completion share one
  short publication transaction. Series reads come from stored rows.
- Fixed recovered worker/DTO mismatches, API idempotency-key propagation and
  result field mappings. Engine outcomes `analysis_limit`, `needs_input`,
  `unsupported_escalate` and `blocked_data_conflict` now finish as blocked
  operations rather than being serialized as financial declines or generic
  worker failures.
- Removed fabricated opening-balance/date and offer-validity defaults. An
  unconfigured baseline now returns `BASELINE_NOT_CONFIGURED`; review blocks on
  missing evidence and payment terms. Incomplete offers are explicitly marked
  unsupported rather than assigned synthetic validity dates.
- Replaced the fake sign-in timer and hard-coded deals/new-order screens with a
  cookie-session client, tenant-scoped saved-order list, manual baseline/order
  entry, persisted review/confirmation/evaluation, result and stored-series
  display. The old validation route redirects to the supported manual form.
  Money remains integer minor-unit text. Live order screens no longer load
  sample orders from localStorage.
- The no-target route regression assertion now expects safe `INVALID_INPUT`
  validation for the implemented route instead of the former absent-route 404.

### Checks actually executed

| Check | Actual result |
|---|---|
| Latest P3 integration file `tests/db/test_p3_vertical_slice.py` | **4 passed**, 11.62s on disposable loopback PostgreSQL 17; includes tenant-isolated businesses, manual source setup, confirmation, worker evaluation, persisted result/series, stale result after edit and optimistic concurrent editors |
| P3 migration/schema preservation | Original and forward schemas each passed **296/296** SQL checks; concurrency scripts passed on both schemas (400-row audit chain and optimistic-lock loser) |
| Latest complete backend run | **187 passed**, 107.69s, latest checkout on disposable PostgreSQL 17; original and forward schemas each 296/296, both concurrency scripts passed |
| `uv run --frozen ruff check .` | Passed after P3 edits |
| Contract export check | Passed; **101** operations unchanged |
| Changed frontend files ESLint | Passed with no diagnostics |
| Frontend TypeScript check | Passed |
| Frontend production build | Passed; Next 16.4.1 generated `/deals` and dynamic `/deals/[id]` routes |
| `git diff --check` | Passed after removing the extra trailing blank lines. |

One existing warning remains: Starlette's `TestClient` deprecates its current
httpx integration. Full browser interaction was not run.

### Gate status and unresolved gaps

The backend's core manual create → review → confirm → queued evaluation → result
and stored series path is exercised, along with stale-edit and concurrent-edit
behavior. The P3 acceptance gate is **not yet fully passed**. The plan also calls
for basic audit/decision export and refresh/restart recovery evidence; no
decision-export/download implementation exists in this P3 diff, and a real
process restart/browser session was not tested. The minimal new-order UI currently
does not enter line-item costs or financing offers, so it must not be presented
as a complete cash projection for an order with material costs or financing.

There is also a result-contract correctness gap to resolve before promoting the
gate: P0 requires tolerance on every option, while P2 currently computes one
delay scan for the top option. The interrupted adapter fills other options with
a synthetic one-day tolerance. That value is not evidence-backed and must be
replaced with correctly budgeted per-option scans (or an explicitly versioned
contract decision) before displaying it as a financial result. Source revision
coverage for all input resources and mapping of engine sensitivity/alerts also
need review; the current adapter does not establish complete provenance for
every resource.

No OpenAI API key is required for the tested manual path (`llm_mode=off`). No live
OpenAI/provider call, browser, hosted Neon migration, hosted role, backup/restore
or deployment acceptance was performed. No P4 work was started. P4 requires
private upload/parsing and duplicate handling, immutable evidence candidates,
review projection, CSV preview/confirm and the bounded OpenAI Responses adapter
with off/recorded/live modes, provenance and refusal/timeout/rate-limit handling.

This completes the approved hosted connection/setup work, not full hosted P1
workflow acceptance. Hosted auth/multi-tenant business jobs, recovery/concurrency,
backup/restore, browser and live OpenAI remain unverified. P2 has not started.

## P2 — deterministic financial engine (15 October 2026)

### Reconciliation and preceding-phase verification

Started on `backend/initial` at `0727198`. Read root/backend instructions, the
implementation plan and this progress record; inspected the current contracts,
compute boundary, engine scaffolds, migrations, database fixtures and financial
reference. The only initial local edit was the user's `.gitignore` change; it is
preserved and excluded from this commit. No branch switch or cleanup was used.

P1 completion was checked against actual code and execution, not its historical
report: the pre-P2 full suite passed **108 tests in 22.27s** on a newly created
disposable PostgreSQL 17 database using actual restricted runtime LOGINs. The
final suite reruns that evidence: migration from empty and populated 0001,
original SQL suite, tenant isolation/no-context/pool reset, auth/revocation,
idempotency, operation claim/restart/fencing and private storage. Existing P0
contracts, generated types, strict startup and role-separated runtime launcher
remain in use. No configured Neon database was used for destructive tests or
contacted during this phase. Earlier hosted setup evidence is historical;
local acceptance does not establish all hosted workflows.

### Actual implementation and decisions

- Replaced the old trust/day-offset financial stubs in `backend/orderfit/engine/`
  with strict dated financial inputs, integer money, exact rounding, event
  generation, calendar sweeps, per-day baseline floors, incremental profit,
  deposit concessions, eligible supplier extensions, fixed-term financing,
  scenarios, hard-policy evaluation, lexicographic ranking and linear tolerance.
- Added pure `events`, `evaluation`, `diagnostics`, `horizon`, `utilities` and
  `validation` modules. VOI/sensitivity rerun the same internal calculator.
  No file/network/provider/database/environment/clock access is in the engine.
  Source text and prompt-injection heuristics are outside the calculator boundary.
- `agent/nodes/compute.py` now maps the complete P0 confirmed snapshot into engine
  inputs, retains the complete snapshot hash plus reference-style projection hash,
  and remains the sole application caller of `analyse`. It never infers trust,
  adds generated receipts/loans as costs or substitutes privileged DB access.
- Retained the complete candidate catalogue with canonical parameters, all three
  scenario metrics/daily series/events, eligible cost keys, hard failures and ranks.
  Added explicit inherited-baseline and order-caused breach intervals. Diagnostics
  retain reference reasons, alerts, VOI, sensitivity and shortlist comparisons.
  Finite scan success is `capped_scan`, never proof of nonpayment survival.
- Calculator version is **engine-0.2.0**. Corrected complete-horizon construction,
  existing-baseline loan-fee attribution, unresolved-anchor handling, missing
  as-offered comparator and invalid-strategy scan behavior. ADR 0010 documents
  these differences. A focused zero-financing-cap test failed before the fee
  correction and passed afterward. A direct reference probe on late funding
  demonstrates the horizon defect: reference horizon `2027-03-12` yields low
  cash `-20`; corrected horizon `2029-01-10` includes day-800 repayment and yields
  the independently expected `-110`. No golden outputs were rewritten.
- Bounded full horizon, expanded money, strategy/loan-grid combinations, output
  retention and estimated/actual work. Actual work is shared across nested reruns.
  Exhaustion returns `analysis_limit` with no recommendation/partial catalogue.
  Added a conservative **500,000 scenario/day point** output bound because storing
  all candidate series is material memory cost; individual maxima cannot all be
  combined. Invalid products/policies, enums, fields and sensitivity ranges fail
  explicitly. No automatic FX/APR conversion or unsupported financing is enabled.
- Added separate legacy fixture and application adapters, 22 golden comparisons,
  25 named canonical-strategy checks, 27 independent financial/resource tests and
  a confirmed-input adapter/provenance test. The differential projection excludes
  labels/version/hash/source-injection flags and unsupported prose, while checking
  all financial diagnostic values, ranks, decisions, reason codes, VOI and
  sensitivity. Named strategies are checked separately; full series get independent
  checks rather than being hidden from production output.
- Added the repeatable CPU/memory benchmark, ADR 0010 and
  `docs/evidence/reports/p2_engine_verification.md`; updated README/contract status. No SQL, migration,
  frontend, reference fixture, dependency or environment-file change is needed.

### Checks actually executed

Commands run from `backend/` unless otherwise stated. Provider mode stayed off;
tests required no OpenAI key.

| Check | Actual result |
|---|---|
| Final `uv run --frozen pytest -q -s --tb=short -x -p no:cacheprovider --basetemp <fresh local path>` | **183 passed**, 105.55s; one existing Starlette/TestClient `httpx` deprecation warning |
| SQL and migration evidence inside final suite | Fresh and populated-0001 upgrades; **296/296 original SQL checks before and after 0002**; both audit/optimistic-lock concurrency runs passed; rollback/role/tenant/operations tests passed |
| Golden comparisons in final suite | **22/22** financial diagnostic comparisons and **25/25** named strategies passed, unchanged expected files |
| Independent engine and adapter checks | **27 independent cases + 1 adapter case** passed; exact OF-02 deposit profit `132800000`, base/downside headroom `22120000`/`7120000`, loan profit `134800000`; OF-15 tolerance **16** |
| Reference CLI `reference_engine.py --check` | **22 cases, 0 problems**, unchanged `ref-0.1.0` |
| Reference `selftest.py` | **0 failures**, including independent sweeps/financial bounds and reference-only deferred-product checks (those products remain disabled in application) |
| `uv run --frozen ruff check .` | Passed on backend scope |
| `uv run --frozen python -m orderfit.contracts.export --check` | Passed, **101 operations**, no regenerated target DTO/type changes |
| TypeScript contract consumer | Passed with cached **TypeScript 5.9.3**: `node <workspace npm cache>/typescript/lib/tsc.js --strict --noEmit docs/contracts/frontend-api.d.ts docs/contracts/typecheck.ts` from repository root; no frontend install or edits |
| Architecture boundary checks | Passed in full suite: pure imports, only compute imports public analyse, only llm imports provider SDK |
| Additional inspection | Engine AST scan found no file/eval/implicit-clock calls; new documentation links resolve; `git diff --check` passed |

An export probe issued from repository root used the system Python and failed to
resolve the package; the correctly scoped frozen backend command passed. An
`npx --no-install` TypeScript probe found no frontend-local compiler and tried a
blocked registry lookup; direct execution of the existing workspace-cached 5.9.3
compiler passed without network access. An
accidental root-wide Ruff attempt touched six unrelated reference/skill files;
those exact clean-at-start paths were restored, and scoped Ruff passed. Final
diff verification confirms reference/expected files, migrations, frontend and
skills remain unchanged. No tests were skipped or assertions weakened to obtain
the passing gate.

### Measured resources and limits

Final `uv run --frozen python -m tests.engine.benchmark_engine`, local Windows,
locked Python 3.12:

| Case | Wall seconds | CPU seconds | Actual work units | Retained candidates / points |
|---|---:|---:|---:|---:|
| OF-02 | 15.887 | 15.438 | 8,093,975 | 45 / 46,440 |
| 10,000-combination boundary | 14.191 | 13.922 | 7,530,568 | 51 / 111,996 |
| Near work-admission ceiling, 900 baseline events | 36.776 | 35.750 | 16,704,863 | 51 / 111,996 |

OS-measured process lifetime peak working set: **342,982,656 bytes (327.1 MiB)**,
including imports and retained preceding results. This is process RSS, not an
isolated per-candidate allocation estimate. The 900-event case's conservative
estimate is 99,103,504 units, just below the 100,000,000 ceiling; caching and early
failure reduce actual charged work. Earlier runs and a repeat under concurrent
test load are retained in the verification document to show timing variation.
Deterministic work/candidate totals were stable.

These stress-envelope measurements do not prove a universal worst-case wall time
or memory bound for every admitted distribution. P3 must enforce subprocess
time/memory limits and turn exhaustion into a technical incomplete outcome before
enabling evaluation jobs. It must validate budgets on its deployment hardware;
P2 has not added an unbounded enabled worker compute path.

### Gate verdict and remaining work

**P2 acceptance gate passed locally.** Reference parity with documented versioned
corrections, independent financial/property/edge checks, exact anchors, full
horizon/late repayment/large scans, hard-versus-soft policy, explicit unsupported
outcomes, deterministic hashes, architectural purity and measured resource
admission are evidenced above. Existing database objects and contracts are
preserved. There are no known blocking P2 gaps.

Unverified/out of this phase: full hosted auth/business job recovery/concurrency,
browser journeys, live OpenAI, deployment resource enforcement, backup/restore,
and rotation of previously shared owner credentials. The existing TestClient
dependency deprecation remains. The output-point ceiling deliberately limits
large catalogues; callers must handle `analysis_limit` without presenting decline.

P3 requires persisted baseline/defaults/offers/customers/payees and manual deals,
review/confirmation into immutable snapshots, fenced bounded evaluation jobs,
atomic reuse of evaluation/option/series storage, stale-result/version handling,
authorized result/export APIs and corresponding real-session frontend flows.
Its gate must cover restart/refresh, stale edits, concurrent writers, tenant
isolation and API-key-free end-to-end operation. **No P3 route, handler, persistence
flow or frontend integration was implemented or enabled here.**

## P4 — documents and bounded OpenAI extraction (15 October 2026)

### Scope and changes

- Migration `0004_p4_documents` (`sql/0007_p4_extraction.sql`): immutable, tenant-RLS tables
  `document_parse`, `extraction_run`, `extraction_candidate`, `csv_preview`, `csv_confirmation`
  (SELECT/INSERT only plus an `OF010` immutability trigger); `extracted_field` gains
  `candidate_id`/`resolution_reason` and stays the reviewed projection; `operation.parameters`
  carries typed job parameters under the request hash. `operation_finish` is replaced so an
  extraction's own revision-bearing writes are not reported as staleness (`run_extract` checks
  freshness under the deal lock first). `0005_p3_p4_integration` joins this with the P3 exports branch.
- `agent/llm.py`: `off`/`recorded`/`live` modes. Recorded replays
  `<prompt_version>__<input_hash>.json` from `LLM_RECORDINGS_DIR`; a missing recording returns
  `RECORDING_NOT_FOUND` and never reaches the provider. Live uses OpenAI Responses typed parsing with
  timeout/output/concurrency bounds and maps refusal/incomplete/invalid/timeout/rate-limit/quota to
  `UnavailableLanguage`. The model comes from `OPENAI_MODEL`; none is hardcoded or evaluated.
- `services/documents.py`: MIME sniffing (bytes over declared type), PDF text layer via `pypdf`
  (no text -> `ocr_required`), quote-evidence checks (quote must appear on the page; amounts and dates
  must be supported by the quote; day/month-ambiguous dates -> `ambiguous`), CSV preview parsing.
- Worker: `extract` runs the provider outside any DB transaction; `csv_preview` is a normal handler.
  Candidates failing the quote check are dropped; injection flags force `ambiguous`; differing
  unreviewed values for one field across documents become `conflicting`.
- API: document upload (25 MiB, multipart), list/get/download (nosniff, attachment), extract (202),
  `GET /deals/{id}/fields` (new `deal_fields`), `fields/resolve` (human confirm/override/reject),
  CSV preview/get/confirm. Contracts regenerated. UI: `/deals/{id}/documents`.

### Evidence

- `uv run pytest -q` (backend, disposable PostgreSQL 17 via Docker, real runtime/worker logins):
  all prior suites plus `tests/db/test_p4_documents.py` and `tests/test_p4_pure.py` passed;
  `ruff check` clean; `tsc --noEmit` clean for `web/`.

### Not verified / remaining gaps

- No live OpenAI call was made; model selection/evaluation and a live benchmark are not done.
- The browser UI was typechecked only, not driven in a browser. Hosted PostgreSQL, restart/restore
  and concurrent-resolve races were not exercised beyond the deal-row lock.
- OCR, docx/xlsx and `reply` extraction (P5) are unsupported. Override of a field to a value
  not among the candidates is not supported (select another candidate with a reason).

## P3 — independent verification and blocker remediation (15 October 2026)

### Gate result

**P3 acceptance gate passed locally.** Three independent audits covered the
financial engine, backend persistence/security, and browser-facing workflow.
The concurrent P4 branch remains integrated through merge-only migration
`0005_p3_p4_integration`; it was not used as evidence that P3 is complete.

### Material corrections made during the audit

- Replaced fabricated tolerance values with bounded per-candidate scans and added
  child-process memory enforcement. Evaluation responses now retain diagnostics,
  uncertainty questions, ranked options, and the computed tolerance.
- Preserved cost obligation/evidence identities across edits and confirmation;
  retained lender/source provenance and persisted downside/severe policy terms.
- Added tenant-authorized immutable decision exports and auditable partial-chain
  exports, with tamper, expiry, role, and cross-tenant download checks.
- Joined the P3 and P4 Alembic branches without rewriting either history, then
  added `0006_p3_input_integrity` for the reviewed-cost persistence correction.
- Fixed concurrent-tab CSRF invalidation by keeping a session challenge stable
  within the authenticated session lifetime.
- Fixed a browser-discovered admission failure: manual orders source opening cash
  from the dated business baseline, and the repository now persists that reviewed
  value before the database permits the order to enter `computing`. A regression
  test confirms the snapshot and state transition.

### Evidence

| Check | Result |
|---|---|
| Backend full suite: `uv run --frozen python -m pytest -q --tb=short -x -p no:cacheprovider` | **222 passed** in 194.08s; one existing Starlette/TestClient deprecation warning |
| Engine reference, independent, adapter, and architecture checks | **83 passed** |
| Export and process-recovery checks, with real disposable API/worker processes | **4 passed** |
| Alembic migration graph | `0006_p3_input_integrity` is the sole head |
| Contracts export/check and backend Ruff | passed |
| Frontend API tests/type check | **6 passed**; passed |
| Frontend `npm run lint` and `npm run build` | build passed; lint has 183 pre-existing warnings and no errors |
| Browser walkthrough | disposable signup, baseline, lender, supported offer, policy, cost evidence, save/review, confirmation and evaluation-admission path exercised; the baseline admission defect above was found and covered by regression tests |

### Remaining scope

- Hosted deployment, backup/restore, live OpenAI use, and production resource
  calibration were not exercised locally.
- P5 negotiation/reply and P6 action sandbox work remain outside P3. The live
  navigation presents P5 routes as unavailable rather than implying support.
- P4 document extraction remains a concurrent scope and needs its own final
  acceptance review. The existing TestClient dependency deprecation remains.

### P4 review pass (same day)

Self-review fixes: rejected uploads no longer leave orphaned bytes; prompt text escapes `<` so
source text cannot close the `<document>` data tag; SDK finish-reason errors map to
`INCOMPLETE`/`REFUSAL`; "missing" candidates never store a model-invented quote; injection-flagged
quotes are stored as `ambiguous` consistently in evidence and projection; CSV import currency must
equal the business currency. Live-path error mapping is covered with a fake SDK client (no network).
Note: `extraction_candidate.confidence` is a fixed validation-outcome marker (0.8 passed all guards,
0.5 otherwise), not a model probability; the provider returns no confidence.

## Maintained agent development context — 16 October 2026

At the user's request, added the repository-local skill
`.agents/skills/orderfit-development-context/SKILL.md`, with standard name and
description frontmatter. It consolidates the product/working context, phase
status, code map, financial/security contracts, Neon/runtime boundaries,
migration graph, verification commands and remaining evidence gaps. Root
`AGENTS.md` routes development agents to it and requires updates after material
development changes; `docs/README.md` provides another discovery link. This is
maintenance during repository work, not a scheduled automation or global memory
change.

Reconciled against clean `main` at `184324e`, the latest progress entries,
README/scoped instructions, current runtime/schema constant, migration files,
result adapter, generated API consumer and test locations. The latest P3
remediation report supersedes its earlier partial report; P4 final acceptance
and live OpenAI remain unverified. The frontend is `web/`. Prior test counts
are explicitly historical; no application/DB/provider/browser checks were rerun
for this documentation-only task.

Validation: all local Markdown links resolve in the skill and both entrypoints;
direct frontmatter/name/description/placeholder checks passed; `git diff --check`
passed. The bundled `quick_validate.py` could not execute because the system
Python lacks PyYAML; no dependency was installed to validate documentation.

Subsequently optimized at the user's request: reduced the skill from 210 lines
to a concise status/decision/source handoff, removed repeated AGENTS rules and
detailed command/history inventories, and shortened its root entrypoint.
Maintenance now explicitly targets material context changes rather than routine
edits. Link/frontmatter checks and `git diff --check` passed again; application
behavior and phase evidence were unchanged.

## P5 — what-if and negotiation preparation (16 October 2026)

### Scope, prerequisite reconciliation and preservation

Started on `main` at `184324e`. Read root/backend/web instructions, the development
context skill, the entire implementation plan and progress file (including later
P3 remediation and P4 review entries), then current contracts, SQL, repositories,
worker, engine adapters, document services, generated clients and tests. Initial
changes were root `AGENTS.md`, `docs/README.md`, this file's context-maintenance
entry, and the untracked `.agents/` context. Preserved that work. No reset, branch
switch, configured Neon test, hosted migration, provider call or push was used.
The context skill receives a material P5 update; unrelated entrypoint edits and
the pre-existing progress entry are excluded from the P5 commit's staged changes.

The later **P3 local acceptance report supersedes its original incomplete report**.
P3's source pipeline, confirmations, durable operations, stored series and actual
runtime roles are reused. The full suite rechecks these prerequisites. P4's
focused prerequisite suite (`tests/test_p4_pure.py tests/db/test_p4_documents.py`)
passed **17 tests** against disposable PostgreSQL 17. P4 remains implemented with
its own final acceptance review pending; this is not a P4 completion declaration.
No live-model benchmark, hosted or provider quality acceptance is established.

Prerequisite defects addressed within P5:

- Generic flag resolution previously allowed clearing any blocker with a reason.
  P5 bank-change holds now fail closed in both the service and a forward SQL guard.
  Their scope/code/blocking state cannot be rewritten to bypass the hold. There
  is deliberately no P5 bank-verification/override route.
- The engine retained its full catalogue, but publication stored only ranked/as-is
  candidates. New evaluations persist every option and its three scenario series;
  legacy results expose only their actually retained candidates, without backfills
  or fabricated figures. Confirmation/evaluation still use the same engine.
- New-customer entry had no way to record known domains, making preparation review
  impossible for newly created customers. Added explicit human-entered domains;
  the AI never chooses a party, address or trusted domain.

### Implemented contracts, storage and behavior

- Added strict P5 DTOs and `docs/contracts/p5-preparation.md` before consumers.
  Replaced the old target-only P5 request/response shapes, added catalogue,
  explanation, preparation review/state and reply reads, and regenerated the
  target OpenAPI, ownership map and both TypeScript declarations: **108 operations**.
  The enabled P5 202 responses provide their durable poll `Location`. Updated
  the compile-only frontend consumer to use the actual fork/version contract.
- Forward revision `0007_p5_preparation` / `sql/0008_p5_preparation.sql` preserves
  the existing 0001–0006 migration history and records. Reuses `whatif_run`,
  `negotiation_message`, input snapshots, evaluation/options/series, deal flags,
  idempotency and PostgreSQL audit functions. Adds immutable `prepared_message`,
  `preparation_review`, `reply_candidate_set`, `reply_review`, `party_acceptance`
  evidence with tenant/deal composite references, FORCE RLS, indexes and narrow
  SELECT/INSERT grants. Existing preparation text is frozen even while its legacy
  message status is `draft`; all outgoing effects remain disabled.
- Fork admission is durable and idempotent, pins a confirmed snapshot/current
  revisions, and never changes canonical deal state, sources, approvals or live
  results. Bounded calculation/provider work occurs outside DB transactions;
  publication and fenced operation completion commit together. Saved results
  retain source comparison, fork snapshot, catalogue, all scenario series and
  language provenance/error category. Stale publication publishes no fork.
- Supported typed patches cover deposit grid, existing supplier-extension terms
  and eligible obligations, a valid draw on a supported offer, and explicit
  downside/severe customer/receivables-delay or cost-overrun assumptions. A new
  optional `strategy_space.financing_selection` narrows the engine's projected
  draw grid without changing original confirmed offer terms or database offers.
  Its absent value is excluded from serialization, preserving prior canonical
  snapshot fixtures. Ineligible costs, unknown offers and off-grid draws fail.
- Explicit apply reauthorizes current membership and all optimistic versions,
  rejects a stale/blocked fork, changes only reviewed `deal.analysis_changes`,
  and returns frozen states to confirmation before changing inputs. Existing
  revision triggers supersede the live result. Review reconstructs actual sources
  and reapplies typed settings; a fork is never promoted into a confirmed snapshot.
- Exact drafts use an evaluated feasible option and an explicitly selected
  customer/supplier/lender and recipient. Server hashes bind full content, subject,
  channel, party/version/address, snapshot/hash/revisions, option/terms, ancestry,
  creator/time, expiry and sandbox mode. Every edit inserts a new message revision;
  one successor per previous revision prevents concurrent branches. Old reviews
  and attestations remain historical and become stale. Preparation review is not
  an outgoing approval or an action bundle.
- Explanations render actual engine fact IDs, scenario/headroom/profit/tolerance
  and coverage qualifiers. Drafts render mandatory typed term lines, including
  loan interest, fees and dates where applicable, plus approved courtesy sentences.
  Numeric and semantic-slot guards reject invented digits, written-number claims,
  guarantees, missing/altered terms and reassigned real amounts. This is deliberately
  controlled editing, not unrestricted free-form prose. Templates remain useful
  without an API key and are labeled `template`.
- `agent/llm.py` remains the sole OpenAI boundary. What-if intents have off,
  recorded and bounded live modes. The deterministic fallback recognizes explicit
  requests such as `deposit 30%` and `customer delay 15 days`; unsupported prose
  stays a reviewable blocked proposal. Missing/invalid recordings never call live.
  Model/response/input/prompt provenance and safe failure categories are retained.
- Incoming text and ask/party identity persist atomically at admission; bank/account
  keywords raise a durable fraud hold before any worker work. Deterministic reply
  parsing retains immutable quote-grounded and potentially contradictory candidates.
  Explicit one-time human review selects candidate IDs and a reason, verifies party
  scope/current versions, and applies supported customer payment/revenue/deposit,
  supplier-extension or same-offer lender-draw terms for confirmation. It never
  records a cash receipt, funding arrival, negotiation round or commitment.
- Party attestations bind exact current reviewed preparation/terms/party, evidence,
  actor/time and expiry, with same-party supersession. Supporting replies must be
  same-party/same-ask and cannot contain parsed counterterms contradicting the ask.
  These are expressly human attestations, not independently authenticated agreement.
  Preparation expires within 24 hours and by the selected offer's inclusive final
  day in the business timezone. Archived parties leave readable, stale history.
- Real-session `web/` flows replace P5 UUID-page placeholders and the standalone
  mock sandbox calculation. The order page links to preparation; `/sandbox` asks
  for a saved order. Generated types, tenant-scoped reads, durable operation polling,
  saved operation recovery, exact revision/review controls, reply selection and
  acceptance evidence survive refresh/restart. The existing same-key uncertain-POST
  client remains in use; 409 refetches current state. History loads compact fork
  summaries, with full catalogue/series fetched only on explicit inspection. An explicit
  version-checked reset clears obsolete applied assumptions without requiring a fresh
  evaluation; this prevents archived offers/changed policy from trapping review. Reset
  preserves source records and fraud holds. Global policy rejects deal-only draw selections.

### Local acceptance evidence

All database runs used newly named loopback-only `orderfit-p1-test-*` PostgreSQL 17
containers and real restricted API/worker LOGINs. The harness verifies its disposable
label and database identity and cleans up only that container. No configured URL was
used. Exact temporary basetemp paths vary by run; uv used `--cache-dir 'D:\Kam 2\.uv-cache'`
because the default Windows cache was inaccessible.

| P5 condition | Executed evidence / result |
|---|---|
| Create/run fork changes no canonical inputs/source revisions/approvals/live evaluation | Integration compares the complete deal and live evaluation before/after, snapshot and approval counts; immutable source snapshot/hash retained; passed |
| Stale apply fails; apply reauthorizes and checks optimistic versions | Stale second apply, current membership and fresh row/input/business-version checks; competing edit during compute publishes no fork; passed |
| Reply never silently changes canonical inputs | Customer/supplier/lender intake compared against unchanged saved deal; only explicit reviewed candidates enter confirmation; customer reply is confirmed and reassessed through production evaluation; passed |
| Recipient/terms/amount changes invalidate preparation identity/review | New immutable subject/body/recipient revisions, unique ancestry under concurrent editors, stale old review/acceptance and renewed review; altered amounts/terms rejected; passed |
| Invented figures and unsupported terms caught | Digit, written-number guarantee and changed term-role tests; browser receives `UNSUPPORTED_MESSAGE_CONTENT`; passed |
| Useful no-key explanations/drafts | Actual engine-backed profit/headroom/tolerance qualifiers, exact-term template draft, deterministic language-intent fallback with explicit `AI_OFF`; passed |
| Bank-change reply blocks dispatch preparation | Hold written at intake, survives worker/refresh, appears in current preparation blockers, generic resolution denied; dispatch eligibility always false; passed |
| DEMO-ASK / DEMO-REPLY use production engine with expected results | `compute_review` in the sole compute module calls the same production engine. ASK returns needs_input/E-MISSING-ANCHOR, delivery/invoice alternatives recommend dep40 vs ext30+loan 50000000. REPLY caps deposits at 30%, recommends loan 130000000, exact profit 134800000; passed. Missing anchor is never fabricated to create a confirmed ASK snapshot. |
| Persistence, tenancy, concurrency, recovery and provider failures | Real API/worker kill after claim, expired lease/new fence/restart publishes one fork at attempt 2, same-key replay after API restart, draft history reload, cross-tenant/no-context access, immutable SQL, concurrent revision winner/loser, provider-failure fallbacks; passed |

### Commands and observed results

- `uv ... run --frozen ruff check .`: passed.
- `uv ... run --frozen python -m orderfit.contracts.export --check`: passed,
  108 operations; generated web and documentation declarations match.
- `uv ... run --frozen python -m alembic heads`: sole head `0007_p5_preparation`.
- Full `uv ... run --frozen python -m pytest -q --tb=short -x -p no:cacheprovider
  --basetemp 'D:\Kam 2\p5-final-full'`: **241 passed**, 232.30s, before the final
  two supplier/lender cases and current-membership-specific regression were added.
  The later final acceptance rerun is recorded below.
- `tests/contracts tests/test_architecture.py tests/test_p5_pure.py`: **90 passed**,
  42.55s after the party-term contract extension. Includes canonical snapshots,
  unchanged reference/production boundaries and fake-provider failures. No actual
  OpenAI client request was made.
- Focused supplier/lender reply integration: **2 passed**, 18.75s, with real
  immutable offer/cost/policy setup and quote selection into the same review pipeline.
- Migration fixture: fresh upgrade, populated-0001 preservation, **296/296** original
  SQL checks on 0001 and forward schema, and both original concurrency scripts
  (400-row audit chain plus optimistic loser). Applied migration components unchanged.
- `node web/node_modules/typescript/lib/tsc.js --strict --noEmit
  docs/contracts/frontend-api.d.ts docs/contracts/typecheck.ts`: passed.
- `web/ npm run typecheck`: passed. Changed-file ESLint: passed without diagnostics.
- `web/ npm run lint`: **0 errors, 178 existing warnings** in unrelated legacy/demo
  files. `npm run build`: passed, including P5 dynamic routes under Suspense.
- `git diff --check`: passed after normalizing mixed Windows line endings on changed
  implementation files and removing extra EOF whitespace.

Browser evidence used `tests.db.p3_browser_host` with explicit stop/restart files,
real API/worker subprocesses, disposable database, no-key mode and a real signed-in
synthetic owner. The existing P3 manual-evaluation HTTP helper created the evaluated
order fixture. An earlier attempt to fill native date controls in the P3 new-order
screen through browser automation did not create a valid order; it is not claimed
as a successful browser create journey. P5 was then exercised in the browser:

1. Load current options, engine-fact explanation and saved series; run a typed
   deposit fork, reload it, and prepare an exact customer draft.
2. Edit subject into revision 2; observe a new identity and stale revision 1.
   Attempt an unsupported written-number guarantee and observe guarded rejection.
3. Explicitly review revision 2 and record expiring human acceptance evidence.
4. Ingest a quoted counteroffer; observe unreviewed candidates and unchanged terms.
   Run the language fallback; reload all evidence.
5. Actually terminate/restart API and worker while retaining the same database,
   private-document directory and session secret. Reload the same session; reviewed
   draft, forks, reply and attestation survive.
6. Select reply candidates, explicitly apply, confirm and evaluate on the order
   page, and inspect the new dep30 catalogue. Run/apply a separate dep40 fork.
   Old forks/reviews/attestations become stale and apply controls are disabled.
7. Record a bank-change reply; observe the durable blocker after refresh. Restart
   the final source again and verify compact history loads stored full series on
   demand. Clear applied what-if assumptions through the browser and verify the bank
   hold remains. Browser error logs were empty. Screenshot:
   `docs/evidence/p5-preparation-browser.jpg` (synthetic data only).

Intermediate failures were corrected rather than relabeled: default uv cache
permissions, sandbox-denied dependency/network and Docker access (authorized
isolated reruns succeeded), initial SQL policy/search-path inventory mismatch,
Next cache-components requiring Suspense, updated generated-type consumer shape,
and setup assertions expecting 201 where existing P3 routes return 200.

### Boundaries and P6 handoff

**P5 local preparation acceptance gate passed.** No sending, payment, approval,
execution, round increment, commitment or compensation workflow was enabled.
The new preparation hash is intentionally not an action-bundle approval hash.

Unverified: live OpenAI quality/model benchmark and actual provider behavior,
hosted Neon schema/roles/pooling, remote CI execution, hosted deployment, restore
rehearsal, production resource calibration and historical owner-credential rotation.
No live/hosted changes were made merely to obtain a passing label. P4's independent
final acceptance review remains pending. Reply parsing has a bounded supported
English grammar; unsupported/ambiguous prose needs manual source review. Supplier
subsets and new lender pricing/fee terms cannot bypass the supported engine contract.
The conservative bank-keyword hold may require verification even for benign wording;
P5 intentionally has no generic resolution. This is not release/deployment acceptance.

P6 must implement exact immutable action bundles/items and batch-compatible SQL
approval/message/execution guards; session-bound single-use step-up; current T3
approval, revocation/expiry and separate send/commit permissions; required exact
party acceptances; a narrow bank-verification resolution; durable execution runs,
manifest membership and partial recovery; sandbox outbox/ledger/lender effects;
round semantics; business-serialized commitment admission and deduplicated baseline
projection; separately approved compensation. Replace the P5 message freeze only
with those exact authorized transitions. Keep real external effects disabled.
No P6 implementation was started.

### Final verification and commit preparation

- Final full backend command with basetemp `D:\Kam 2\p5-final-acceptance`:
  **244 passed**, 219.58s. This includes supplier/lender reply reviews and current
  membership authorization on apply, original schema/concurrency suites, migration
  preservation, engine fixtures, P3/P4 flows and actual P5 process recovery.
- After the final read-only option-explanation and obsolete-assumption-reset fixes,
  `tests/db/test_p5_preparation.py tests/test_p5_pure.py tests/contracts
  tests/test_architecture.py` passed **102 tests**, 91.40s on a newly created
  disposable PG17 target (`--basetemp 'D:\Kam 2\p5-final-focused'`). These focused
  checks cover every P5 write, reset/revision invalidation, all supported party
  replies, provider fallback, tenancy, idempotency, process recovery and contracts.
  A separate read-only/architecture check passed **9 tests**, 43.55s.
- Final generated contract check: **108 operations**. Final TypeScript checks,
  changed-file ESLint and production build passed after the reset UI was added.
  Full frontend lint remains 0 errors / 178 existing legacy/demo warnings.
- Final browser pass restarted the final API/worker source, loaded stored full
  series on demand, and cleared obsolete applied assumptions. The durable bank
  blocker remained in place. Screenshot was refreshed to show that actual result.
- No test was skipped or assertion weakened to obtain acceptance. The sole backend
  warning remains the existing Starlette/TestClient httpx deprecation.

## P6 — approval, sandbox execution and recovery (16 October 2026)

### Reconciliation and implementation status

Started from clean `main` at `f01d197` (P5 commit `dd81b32`). The recorded P5
acceptance is supported by the P5 code shape: preparation stores immutable
`prepared_message` rows and acceptance evidence; `p5_message_frozen` blocks edits;
the P5 API has no approval/send/commit routes, and `DEFAULT_HANDLERS` has no
execution handler. Real effects were disabled. P4 remains implemented but its
independent final acceptance review is still pending. No prerequisite defect
directly blocking P6 was found. The P5 database integration suite was rerun after
the P6 schema upgrade and passed.

P6 is **incomplete; acceptance gate not passed**. The scoped changes so far are:

- New Alembic revision `0008_p6_execution` and additive SQL component
  `0009_p6_execution.sql`. It adds immutable `action_bundle` / items, optional
  bundle and step-up references on legacy approvals, append-only revocations,
  one-run-per-bundle records, execution item links, a business commitment gate,
  projection/effect evidence, and a bank-verification evidence record. New tables
  use tenant RLS, FORCE RLS, scoped grants and immutable guards. New exact-bundle
  guards bind prepared message ID, body, subject, channel, party/version,
  recipient and term hash; verify required party acceptances at commit approval;
  reject unbundle-linked P6 action transitions; and recheck approval expiry,
  revocation, current T3 membership, session and financial freshness before
  bundle-linked effects. Existing unbundled approvals and action drafts remain
  accepted under their legacy checks.
- The P5 message freeze now permits a prepared outbound message to move to
  `sent` only with transaction-local execution run/item context matching an exact
  bundle action. The P5 bank-change flag remains fail-closed; clearing it requires
  a row tied to the exact bank-change reply, a verified account, matching
  fingerprint and written evidence. No generic override was added; the
  evidence-capture API remains unimplemented.
- Added session-bound password re-authentication for one bundle and purpose at
  `/api/v1/auth/step-up`. The grant is tied to the current user/session, exact
  bundle hash/purpose and five-minute/earlier bundle expiry, and is consumed in
  the approval insert trigger. Updated runtime schema validation to require
  `0008_p6_execution` and updated forward-schema RLS/PK counts in the SQL suite.

### Checks actually run

- `uv --cache-dir 'D:\Kam 2\.uv-cache' run --frozen ruff check .`: passed.
- `uv ... run --frozen python -m orderfit.contracts.export --check`: passed,
  108 operations.
- `uv ... run --frozen python -m alembic heads`: sole head
  `0008_p6_execution`.
- `tests/contracts tests/test_p5_pure.py tests/test_architecture.py` with
  explicit workspace `--basetemp`: **90 passed**. An earlier run using pytest's
  inaccessible default temp root stopped at 83 passed with `PermissionError`; the
  workspace-temp rerun passed.
- `tests/db/test_p5_preparation.py` on the harness's verified, labeled, loopback
  disposable PostgreSQL 17 container: **12 passed**. This exercised clean and
  populated migration upgrades, the existing 296/296 SQL assertions on both
  schema versions, runtime login validation and P5 integration. Intermediate
  migration attempts exposed and fixed invalid composite references, PL/pgSQL
  syntax, legacy guard compatibility and P6 test-inventory counts. No
  configured/shared Neon URL was used.
- Full backend pytest command was started on a separate verified disposable PG17
  harness, but its process did not yield a final result before this handoff. Do
  not count its partial progress output as a pass.

### Remaining P6 gaps and gate

Not implemented: server-owned bundle preparation/get, approval/rejection/revoke
API operations, durable execute admission and worker handler, operation/run
recovery/fencing, local outbox/ledger/lender effects, partial outcome read model,
negotiation round advancement, transactionally serialized commitment admission
and deduplicated baseline projection, and separately approved compensation with
inverse provenance/reconciliation. Although their tables/guards are present,
there is no service path that proves these workflows end to end. There are no P6
crash-boundary, concurrent-worker, concurrent-deal, role-revocation-after-approval,
compensation or browser acceptance tests yet. No real external adapter was added.
The narrow bank-resolution table/guard also has no user-facing evidence-capture
workflow and therefore remains unavailable in practice.

**P6 gate: NOT PASSED.** Exact-bundle approval, execution/recovery and commitment
requirements cannot be claimed from schema plus step-up issuance. P7 has not
started. Before P7, finish the P6 services/routes/worker and acceptance matrix
from plan V11–V13, including injected failures at each effect boundary and a
second deal rejected on an obsolete baseline. P4's independent final review and
all hosted/provider/browser/deployment claims remain separate and unverified.


## P0–P8 verification matrix, P6–P8 completion and audit loop (16 October 2026)

### Starting point (verified, not trusted)

`main` was already at `origin/main` (`ba51194`), tree clean. The development-context
skill and the P6 entry above recorded P6 as **partial** (schema/guards and step-up only)
and P7/P8 as not started, so the task premise "P1–P6 done" was not accurate: P6 services,
worker, projection and compensation did not exist. Baseline before any change: full
backend suite **244 passed** (disposable PG17 container).

### Matrix

Status key: Verified = gate evidence executed in this checkout (local environment).
Hosted gates need a disposable Neon branch and are **Unverified**.

| Phase | Gate (plan §14) | V-IDs | Evidence | Status |
|---|---|---|---|---|
| P0 | contracts/OpenAPI/TS sync; capability ownership | V01 | `contracts.export --check` (108 ops), tsc contract check, `tests/contracts` | Verified |
| P1 | migrate empty + from 0001, runtime-login isolation, idempotency, fencing, audit | V02–V04, V10, V12, V14 | `tests/db/test_foundation.py`, SQL suite 296/296 on 0001 and forward schema, concurrency script | Verified (PgBouncer pooling Unverified; see P8) |
| P2 | engine parity, 22 goldens, anchors, purity | V05, V06 | `tests/engine` (+ new edge/money tests), reference `--check`, selftest | Verified |
| P3 | persisted manual slice | V09 | `tests/db/test_p3_*` + live browser create→confirm→evaluate (hand-checked lowest balance 24,000,000) | Verified |
| P4 | documents + bounded extraction | V07, V08 | `test_p4_pure.py`, `tests/db/test_p4_documents.py`; live OpenAI not run | Partial (live provider and independent final review Unverified) |
| P5 | what-if, drafts, replies, acceptances | V08, V09, V11 | `test_p5_pure.py`, `tests/db/test_p5_preparation.py`, live browser what-if/draft/reply/acceptance | Verified (local) |
| P6 | exact-bundle approval, execution, commitment gate, compensation | V11–V13 | `tests/db/test_p6_approval.py`, `test_p6_execution.py` (crash at six boundaries, concurrent workers, revoked actor, second deal, compensation), live browser send→commit | Verified (local) |
| P7 | members, invitations, payee verification, notifications, exports, as-of history | V04, V14 | `tests/db/test_p7_*`, screens wired to real operations | Verified (local) |
| P8 | readiness, shutdown, deployment config, restart evidence | V16 | `/ready`, SIGTERM test + live container shutdown log, compose stack restart, `render.yaml`/runbooks | Partial: hosted gates Unverified |

### What was built (this round)

- **P6**: migrations `0009_p6_approval`, `0010_p6_execution_runtime`; bundle prepare/get, approval
  create/get/revoke, execute (202 + durable job), fenced worker handler, sandbox effects,
  commitment gate and engine-derived baseline projection (one revision bump), rounds,
  compensation. Defects in the earlier P6 SQL (actor check reading an unreadable table, run
  rows that could never leave `queued`, ambiguous plpgsql variable, per-row revision bumps)
  were fixed forward.
- **P7**: migration `0011_p7_operations`; 20 operations (membership, invitations with hashed
  single-use tokens, accounts + verification evidence, per-user notifications, audit list, cash
  export, customer history, invoices, profile). Keyset cursors for new lists only; older lists
  still page by offset with `next_cursor: null` (documented in `docs/contracts/README.md`).
- **P8 (code)**: `/ready`, graceful worker shutdown, request-id logging, explicit proxy trust
  (`TRUSTED_PROXY_IPS`, default none), Render Blueprint, Neon/Render runbooks, env examples.
- **Web**: demo screens removed or replaced by honest notices or real wiring; session guard,
  business switcher, shared session reset; approval/execution UI; P7 screens.
- Migration `0012_notification_writer` (audit follow-up). Alembic head: `0012_notification_writer`.

### Checks executed now (local)

| Environment | Command | Result |
|---|---|---|
| root | `reference_engine.py --check`, `selftest.py` | 22 cases, 0 problems; 0 failures |
| backend | `ruff check .` | clean |
| backend | `orderfit.contracts.export --check` | 108 operations, current |
| backend | `pytest -q` (docker PG17 disposable harness; migrator + restricted runtime logins) | 437 passed (after audit round 1) |
| web | `npm run typecheck` / `lint` / `test` / `build` | pass / 0 errors / 67 pass / pass |
| docker | `compose --env-file .env.example build` | api + web images built |
| running stack | separate compose project, generated local secrets, restricted non-superuser logins | `/ready` ok; API+worker restart recovers; worker logs graceful SIGTERM stop; no secrets/tracebacks in logs |
| browser (built-in) | V15 journey: sign-up → baseline/event → order → confirm → evaluate → what-if → draft/review → send bundle (wrong password refused, then approved) → sandbox execute → reply → acceptance → commit bundle → execute | order `committed`, round 1, baseline projection without double counting, gate released; cross-tenant reads 404, no-session 401, bad Origin 403 |

CI-reported results: none. Provider: no live OpenAI. Hosted: none.

### Findings register

Stage 1 independent audits (read-only) and repairs:

| # | Finding | Sev | Disposition |
|---|---|---|---|
| S1-1 | P6 services/worker/projection/compensation absent (task premise wrong) | high | Implemented |
| S1-2 | Unauthenticated errors wrote permanent `security_event` rows | med | Fixed (relevance filter) |
| S1-3 | Non-member could take a tenant row lock; review GET locked | med | Fixed (membership first, read-only mode, timeouts) |
| S1-4 | Revocation race published an evaluation under a failed operation | med | Fixed + test |
| S1-5 | `quote_supports` substring bypass; nested JSON/CSV crashes; silent page truncation | med | Fixed + tests |
| S1-6 | Number guard missed 13–19/60–90; loose whitelist; placeholder tests | med | Fixed + tests |
| S1-7 | Bank-change heuristic narrow; negated acceptance candidate | med | Fixed + tests |
| S1-8 | Engine: null anchor KeyError; baseline order-kind near horizon ValueError | med | Fixed + tests |
| S1-9 | Architecture test bypassable | low | Hardened |
| S1-10 | Provider errors all retryable; recording list crash; loop-global semaphores | low | Fixed |
| S1-11 | Demo/global-tenant screens, fake saves, unsupported options in navigation | high | Replaced/removed |
| S1-12 | Pagination contract (offset, `next_cursor` null) for P3–P6 lists | med | Open; documented |
| S1-13 | PgBouncer not exercised by any test | med | Open (unverified) |
| S1-14 | N+1 `get_prepared` per message (bounded) | low | Deferred |
| P6-A | Runtime role could not lock bundles / insert step-up grants (42501) | high | Fixed (0009) |
| P6-B | Execution SQL defects (see above) | high | Fixed (0010) |
| UI-1 | Bank-change hold unclearable (no flag id); `{}` body 422 on 3 operations | med | Fixed + tests |
| UI-2 | Raw code shown for non-exact acceptance reply | low | Fixed |

Haiku round 1 (five auditors; each finding reproduced before acting). Rejected: unverified signup
pre-claiming an email to hijack an invitation (acceptance also needs the 256-bit token stored only as
a digest). Deferred: `auth_lookup` hash readable by the runtime role (needs a sign-in-only split);
auth rate-limit bucket behind a proxy (conservative default, documented); compose direct proxy mode
(local, intentional). Fixed: worker lock order, post-reclaim effect fencing, settlement error routing,
notification write privilege (0012), unauthenticated body buffering, step-up rate limit,
parse-before-authorize, cash-flow contract drift, documents-page stale versions, invitation-accept
idempotency replay, cache reset consistency, deals-list truncation notice, what-if validation, error
wording, UI for cash-event correction/void, archives, password change, document download, audit-export
limits, stale docs.

### Unverified / blocked

- Hosted Neon acceptance (role/extension/function privileges, SSL, direct vs pooled URL, tenant
  context behind real PgBouncer, worker leases under Render, restore drill). Local PG17 container and
  compose runs are approximations, not Neon verification.
- Live OpenAI extraction/explanation quality; OCR/DOCX/XLSX remain unsupported.
- Render documents: the worker cannot read the API's disk (separate services); extraction jobs need
  shared object storage or a single-service mode before document workflows work there.
- Notification triggers/policy under a non-superuser migration owner (tests use a superuser).
- Automated browser tests (the V15 journey was driven manually in the built-in browser).
- Backup/restore rehearsal; Vercel upload size limits through the rewrite.

### Audit rounds 3–4 remediation (16 October 2026)

- Round 3 repairs are now reconciled with the working tree: fenced execution-item retries
  transient PostgreSQL lock/timeout/deadlock/serialization SQLSTATEs under the same lease;
  a cancellation after every item completed may settle, while earlier cancellation still stops
  remaining effects; authorized uploads acquire a per-principal slot only after session,
  membership and deal checks and release it on overall/idle body deadlines; API docs/OpenAPI
  endpoints are off unless `EXPOSE_API_DOCS=true`; `0014_settlement_retention` protects live
  idempotency rows from the runtime role and adds the settlement-only execute context.
- Alembic's sole current head is `0014_settlement_retention`; `SCHEMA_REVISION` and the
  forward-schema SECURITY DEFINER inventory were updated accordingly. Environment examples and
  the Render runbook now document upload deadline and docs-exposure settings.
- Independent round 4 static review found no new critical/high/medium issue. Its focused
  pure suite passed 16 tests. The accepted split Render document-storage limitation remains
  open (worker cannot read API-local disk).
- Verification in this checkout: ruff clean; contract export checked 108 operations; targeted
  round-3 DB suite 11 passed; lock-order regression rerun passed. The first full run found one
  stale test expectation: the production fence now locks `operation` by `id`, while the test
  expected the prior selected column. The assertion was corrected without weakening its
  business → deal → operation lock-order check; the subsequent full backend suite passed
  **465 tests**. Web typecheck, lint (0 errors), 75 tests and production build passed; root
  reference fixtures, selftest, Docker Compose image build and `git diff --check` passed.

## Shared document storage and browser E2E remediation (16 October 2026)

- The user selected a shared private S3-compatible bucket for Render API/worker documents. Added
  a common store factory and S3 adapter with generated UUID key scopes, create-only writes,
  server-side encryption, SHA-256 validation, bounded reads/writes, safe provider errors, and a
  readiness canary that verifies put/get/delete. API and worker consume the same interface.
  Botocore Stubber tests cover this contract without provider network access or private data.
- Render Blueprint now configures the same S3 bucket/region/credentials/endpoint for API and
  worker and no longer attaches a single-service disk. The deployment guide covers least
  privilege, privacy, object/DB transaction orphan risk, and joint restore requirements. Actual
  bucket provisioning, credential validation and restore remain unverified hosted gates.
- Compose keeps API, worker and Postgres on an internal network with no outbound route. Only the
  web service has a host-facing edge network; browser API calls use the built same-origin Next
  rewrite. API and DB are no longer published to the host. The browser test runner creates a
  unique disposable Compose project, provisions restricted logins, waits for API readiness via
  the web proxy, tests signup → baseline → order → evaluation → reload, then removes containers,
  networks and volumes.
- Verification in this checkout: full backend suite **471 passed** (one upstream Starlette/httpx
  deprecation warning); subsequent S3 + readiness focused suite **24 passed**; Ruff clean;
  contract export checked 108 operations; Alembic head `0014_settlement_retention`; reference
  fixture check and selftest passed. Browser E2E **1 passed** against built API/web/PG17 images
  with restricted runtime DB roles. Frontend typecheck and 75 unit tests passed; lint had 0
  errors with existing warnings; Docker production build passed; `npm audit --omit=dev` found 0
  vulnerabilities. Full `npm audit` still reports 9 high-severity development dependency paths
  through the unpatched `braces` 3.x dependency of Next ESLint and the shadcn build-time package;
  the offered fix requires a breaking package downgrade, so it was not forced.
- Local E2E and S3 adapter tests do not establish live S3, Render, Neon/PgBouncer, OpenAI,
  Vercel upload limits or database/object restore acceptance. Object creation plus DB row commit
  is not atomic; a process crash can leave an orphan, so no automatic object-deletion lifecycle
  should be enabled until reconciliation and retention policy are defined. P4 independent final
  acceptance review and live OpenAI evaluation remain open; P8 hosted acceptance remains open.

## Follow-up browser journey (16 October 2026)

- Reproduced and fixed a stale detail-page load when returning from negotiation after the route's
  `operationId` changed. The resolver now preserves loaded deal/evaluation state for the same
  deal/business and the loader observes operation-id changes. The added Playwright regression and
  disposable-stack E2E passed.
- Manually completed the local disposable-demo journey in the browser: signup, baseline, order,
  persisted evaluation, negotiation draft/review, password-bound sandbox send approval/execution,
  synthetic reply evidence, synthetic exact-term acceptance, and password-bound sandbox commit.
  Both execution runs succeeded (one completed sandbox action each, zero failures); commit projected
  one event and advanced financial revision 6→7. The UI states receipts remain expected, not
  received. The reply and acceptance are explicitly marked synthetic and are not customer evidence.
- Verification in this checkout: full backend suite 473 passed; targeted document extraction
  fallback/persistence 2 passed; frontend typecheck passed, 75 unit tests passed, lint passed with
  30 warnings and 0 errors; the rebuilt disposable-stack Playwright E2E passed; `git diff --check`
  passed. This browser stack uses disposable local PostgreSQL and local document storage, not hosted
  S3/Neon/Render services.
- Remaining release gates are unchanged: provision and validate the shared private S3 bucket; live
  Neon/PgBouncer, Render worker, restore, notification-owner and Vercel upload checks; live OpenAI
  evaluation (not enabled in this demo). The automated browser spec currently covers the core
  persisted order/negotiation route flow; the full send/reply/commit journey above is manual and
  synthetic, not yet encoded as an automated browser scenario.

## Spec, financial-UI and measured performance audit (16 October 2026)

Audited from `main` at `6ca0ec3`, preserving the existing checkout. Earlier repairs
are committed; the old context snapshot claiming they were uncommitted was stale.
Root/backend/web instructions, plan/gap/gate registers, requirements, architecture,
ADRs and financial contracts were reconciled with code through codebase-memory
architecture/search/call-path/snippet exploration and direct reads where the graph
did not cover recently merged UI. The complete feature matrix, evidence boundaries
and severity-ranked remainder are in [the audit report](evidence/reports/orderfit_audit_2026-10-16.md).
Other security/deployment work arrived concurrently; it was preserved rather than
overwritten or attributed to this audit. No real application secrets, shared
database, provider configuration or git history were changed.

### Reproduced and repaired

- Five new pipeline tests failed on incorrect financial descriptions and state
  classification: inherited baseline deficits were advertised as above-reserve,
  profit/other constraint failure as insufficient cash, changed terms as proof of
  an offered cash breach, stale evaluation races as current advice and computing
  as recommendation. Fixed `web/lib/pipeline-model.ts` and page summaries without
  changing any calculator, version or expected financial output. The default
  policy reserve is no longer inferred from an arbitrary loaded order, and
  single-order trough summaries explicitly do not establish portfolio affordability.
- Preparation history reproduced an N+1: **23/79 statements** for **1/8 messages**,
  median request times **64.0/236.5 ms** over three reads. Batched tenant-scoped
  snapshots/parties and shared immutable-view assembly now use **17/17 statements**,
  **31.8/30.3 ms** in the same synthetic benchmark. Mutation/approval locking is
  unchanged. Added list/single parity, review/revision, paging, empty and tenant
  regressions. The test enforces query growth, not a flaky timing target.
- Real browser tests reproduced inaccessible sign-in fields and **734 px content
  width at a 390 px viewport**. Persistent field labels, focus indicators, bounded
  header controls and the existing Radix drawer now fit **390/390 px**; Escape
  restores trigger focus and route selection closes the drawer. Existing visual
  identity is retained. Added 20-order paging, explicit page-only counts/filter
  scope, saved-state refresh and recoverable read-error retry.
- Removed unsupported usage statistics/zero-hallucination copy and labelled the
  marketing scenario as synthetic. Added historical/current status notes to plan,
  architecture and contracts; corrected the development-context handoff. P4/P8
  remain partial, not completed merely because implementation files exist.
- An additional browser regression preserved a real saved order/customer ID while
  simulating omission from the bounded customer list. It reproduced “No customer”;
  the row now says “Customer details not loaded” in that case. This fixes the
  misleading absence claim, not the underlying supporting-list pagination gap.

### Verification executed now

- Architecture/engine/contracts/agent subset: **214 passed**. P5 preparation:
  **13 passed**. P6 approval/execution subset: **26 passed**. Concurrently added
  database security regressions: **6 passed**. These overlap the full suite and
  must not be summed as unique test coverage.
- Ruff clean; contract export **108 operations current**; Alembic sole head
  `0014_settlement_retention`; generated TypeScript consumer examples pass.
- Disposable PG17 fixture verified original and forward SQL suites **296/296**
  each, upgrade preservation, clean migration and audit/optimistic-lock concurrency.
  These are not hosted Neon/PgBouncer or non-superuser migrator acceptance.
- Frontend latest rerun: **83 unit tests passed**, typecheck passed, lint **0
  errors / 10 existing warnings**. Production Docker web build passed (Next 16.4.1).
  Production npm dependency audit found **0 vulnerabilities**.
- Production web at `localhost:3000`, same-origin API and restricted local PG17:
  **3 Playwright tests passed in 25.6 s**. Signup → baseline → customer/order →
  confirm → queued evaluation → persisted reload → negotiation route round-trip;
  labelled sign-in/focus; 1280 px desktop capture, 390 px mobile drawer/Escape,
  valid-session/missing-CSRF recovery and injected read-503 → retry → real API.
  Built-in browser preview also verified the drawer/cash route at about 746 px.
- Reference engine `--check`: **22 cases / 0 problems**; selftest **0 failures**.
  No fixture output regeneration. Audit/handoff/contract links resolve and
  `git diff --check` passes. Mechanical UI detector returned no findings on changed
  files; that is not a substitute for browser or accessibility acceptance.
- First full-backend attempt stopped during collection on a concurrently written
  security-test syntax error. No test was skipped/weakened; the complete command
  was restarted once that write completed. Early browser failures also included
  two selector ambiguities (shell/page heading and Next route-announcer alert),
  resolved by scoping to page content while retaining functional assertions.
- The restarted backend run reached **459 passed / 1 failed**, then stopped on an
  old exact `Cache-Control: no-store` assertion after concurrent security work
  strengthened the header to `private, no-store`. That task updated the assertion
  to the exact stronger header, not a weaker cache policy. A full non-fail-fast
  rerun follows; this failed run is not reported as a full pass.
- Readiness/runtime/S3 follow-up after that assertion correction: **26 passed**.

### Open acceptance and next phase

P4 still needs independent final/live OpenAI quality and adversarial acceptance.
P8 still needs private S3 provisioning/least privilege, Neon/PgBouncer/Render and
joint DB/object restore evidence, plus other hosted gates already recorded above.
No live calls, real outgoing actions, shared-DB changes or secret inspection were
performed. Full browser send/reply/accept/commit/compensation automation, all-route
screen-reader/zoom/contrast/layout-shift checks and a production bundle analysis
were not run. Earlier full manual sandbox evidence is historical, not a fresh pass.

Remaining P2 engineering gaps: worker readiness is a queue-age check, not a
heartbeat; per-deal serialization/evaluation fetch fan-out and legacy pagination
remain despite bounded pipeline pages. The expanded connectivity overlay can
obscure mobile content until minimized/dismissed. Large persistence modules,
unused scaffolds and lint/development-dependency debt remain P3 follow-ups. Measure
realistic list workloads before a summary/batch contract change. See the audit
matrix before treating any phase or competition deliverable as fully accepted.


## Hostile-tenant/network security hardening (16 October 2026)

- Starting checkout: main at `6ca0ec3`; preserved concurrent preparation, UI, spec and
  performance changes. Audit findings, severity/exploit/fix/status, file:line evidence,
  rotation handoff and limitations are in `docs/security/security_audit_2026-10-16.md`;
  `docs/security/route_inventory.md` inventories 106 handlers plus two public probes.
- Repaired 13 local code/configuration issues: bounded PDF child parsing (384 MiB/10 s, at most two children, scrubbed environment, parser p4.2),
  API no-store/security headers, old-browser-session revocation on login, Secure-cookie
  and remote verified-TLS configuration, small-body deadlines, pending-operation caps
  (25/business, including execution), non-inherited owner-role detection, timeouts before
  session resolution, redacted startup/raw-access logging, browser headers, immutable CI
  action refs, S3 network deadlines, private build-context exclusions and shared Argon2
  work admission (two operations/process). Related fixes share findings where appropriate.
- No SQL migration or financial engine change. Runtime schema head remains
  `0014_settlement_retention`; contracts still check 108 operations. Runbooks/templates
  now require remote runtime URLs with `sslmode=verify-full` and trusted CA material
  (`sslrootcert=system` or a CA file). Real deployment values were not read or changed.
- Verification: final network/runtime/DB-security suites 26 passed (all 17 new backend
  security cases); additional parser/body/S3 suite 35 passed before the final password
  guard. Full backend run reached 459 passes then stopped on the readiness test's old
  exact `no-store` header expectation. Updated that assertion to the stricter
  `private, no-store`; all remaining P7/private-document/runtime/S3 files passed (29).
  Current collection is 491 cases; this is split-run evidence, not one final 491-pass run.
  The later parser/body/document DB suite passed 36 tests; a final upload regression
  verified retry-safe parser admission and persisted p4.2 provenance. Ruff clean; contract export current; reference 22 cases/zero problems and independent
  selftest zero failures. Frontend 83 unit tests, typecheck, build passed; lint zero
  errors/10 warnings. Final API image built; UID-10001, no-network, read-only disposable
  container passed bounded PDF and Argon2 checks. Diff/evidence-path checks passed.
- Python pip-audit reported no known vulnerabilities (unpublished local package skipped).
  npm production audit zero; full npm audit still has 9 high development paths through
  unpatched braces. CI action tags are pinned to upstream-resolved commits. No forced
  major dependency downgrade, advisory suppression or history rewrite was performed.
- Confirmed historical remote credentials in commit `eb5758b`, `.env:4-5` and
  `backend/.env:12-13` (DATABASE_URL/DATABASE_URL_DIRECT). Values were never printed.
  Rotate underlying credentials unless independent evidence establishes prior rotation;
  current env files remain untracked/ignored. Local diagnostic files were preserved.
- Remaining release work: hosted encryption/CA/role/S3/retention and joint restore evidence,
  strict script CSP, privilege-change session epoch, MFA/verified email and isolated auth
  DB credentials, edge quotas/readiness admission, container OS scanning and live provider
  adversarial acceptance. No hosted infrastructure, private source documents, real actions
  or live OpenAI calls were exercised. P4/P8 hosted gates remain open; sandbox-only scope
  is unchanged. See the security report before accepting sensitive-data deployment.

## Independent backend phase stress review — 16 October 2026

- Reviewed the implementation plan and progress first, reconciled actual code at
  clean `main` / `61aaff8a1a6f8abd06ca4c0eed7f5fddc07fd663`, and exercised all
  available phase suites. No application behavior, migrations, financial fixtures,
  provider configuration or real outgoing actions were changed.
- Existing full backend suite: **492 passed / 2 failed / 0 skipped**, 560.20 s.
  Current required/sole head is **`0015_session_authority`**, with 108 generated
  operations current. Original/forward SQL suites each passed **296/296**; clean
  upgrade, populated preservation and original/forward concurrency ran through
  the disposable PG17 fixture using actual restricted API/worker logins.
- Classified both failures independently: the P7 role-change test still expects
  the old session to read a profile, contrary to 0015; it fails alone. The three
  session-authority tests pass alone, but queue-cap followed by its worker-context
  test reproduces a different queued UUID being claimed. This is shared test-queue
  contamination, not evidence that the production worker should change ordering.
- Added seven reproducible DB/service probes: **5 passed / 2 strict xfails**.
  Covered 64 same-key requests, 64 distinct admissions (25 accepted, 39 capacity
  rejections), 128 alternating tenant reads, 24 editors (one save), 24 execute
  submissions and 8 workers (one sandbox effect/round). Strict xfails reproduce
  worker readiness without a worker and null customer continuation with 51 rows.
- Engine benchmark wall times: **18.804 / 15.890 / 52.851 s** for OF-02,
  10,000-combination and near-estimated-admission-ceiling cases; process lifetime
  peak working set **342,999,040 bytes**. This direct-engine Windows measurement
  does not establish hosted parent/child combined memory or sustained capacity.
- Ruff, contract export, strict TypeScript contract examples, reference 22-case
  check and independent selftest pass. Frontend **86 unit tests** pass; typecheck
  passes after regenerating stale ignored local Next route types; lint has zero
  errors / 10 existing warnings. No config include or assertion was relaxed.
- Current images built and an isolated Compose stack became ready. Initial full
  browser run: **3 passed / 1 failed**, 20.2 s. The CSP test expects a dynamically
  created script to be blocked under `strict-dynamic`; independent Chromium and
  the current W3C algorithm confirm that expectation is incorrect. Parser-inserted
  wrong/missing-nonce scripts were blocked; no XSS exploit was established.
- Final Playwright stack run after adding the HTTP case: **4 passed / 1 failed**,
  20.1 s; the same existing CSP expectation fails. Actual HTTP bursts passed:
  200 mixed-tenant profile reads at concurrency 16 (p95 229.79 ms), 32 same-key
  customer writes at concurrency 16 (one saved row, p95 253.73 ms), and 32 invalid
  writes at concurrency 8 (all 422, p95 23.19 ms). Changed-body replay returns 409.
  These are finite local measurements, not a sustained production capacity claim.
- Detailed per-phase/V01–V16 matrix, severity-ranked findings, exact reproductions,
  later HTTP-burst evidence, repair acceptance and unrun gates are in
  [the stress report](evidence/reports/backend_stress_test_report_2026-10-16.md); raw JUnit/console
  evidence is in `docs/stress-test-2026-10-16/`. The development-context handoff
  was reconciled. No local/hosted phase is newly declared complete from file presence.
- Live OpenAI/model quality, actual S3/Neon/PgBouncer/Render/Vercel acceptance,
  non-superuser hosted migrator behavior, joint DB/object restore and sustained
  deployment load remain unverified. Full browser send/reply/commit/compensate
  automation was not added. Preserve sandbox-only scope during later remediation.


## Backend stress remediation — 16 October 2026

- Preserved the audited `main` HEAD `61aaff8a1a6f8abd06ca4c0eed7f5fddc07fd663`
  and all uncommitted audit/progress/probe additions. No commit, reset, shared DB,
  live provider call, hosted deployment, credential rotation or outgoing real effect.
- Reproduced ST-03/ST-04 and both strict ST-01/ST-02 probes before behavior changes.
  P7 now asserts old-session rejection and signs in via HTTP after demotion and
  reinstatement; all later viewer/write/revocation/last-owner/self-escalation checks
  remain. Per-test disposable operation ownership removes queue contamination even
  after assertion failure, preserving history and production claim ordering.
- ST-05 now uses parser-inserted response controls for missing/wrong nonce and
  inline handlers, with a correctly authorized positive control. Fresh nonce,
  private/no-store, hydration and navigation remain. No reachable XSS sink was found.
- ST-01: new forward sole head `0016_worker_presence` / SQL
  `0017_worker_presence.sql`; global FORCE-RLS process evidence, worker-only narrow
  publisher, aggregate API boolean, DB-time expiry 60 seconds, pulse 10 seconds,
  separate one-connection pool, startup/graceful shutdown/death/restart. `/ready`
  requires live global worker capacity; `backlog_seconds` is independent.
- ST-02: eight legacy collections now return accurate scoped signed keyset
  continuation, unique tie-breakers and deliberate offset compatibility. Added
  default-only policy lookup and updated contracts/generated declarations/clients.
  Enabled selectors/screens have bounded load-more, partial/error/retry states;
  pipeline labels resolve only its bounded page's missing customer IDs. No fetch-all
  or limit increase. Original readiness/pagination strict xfails are ordinary tests.
- ST-09 reproduced prolonged pool-checkout starvation during sustained load.
  Kept pool size five/overflow zero, bounded checkout wait to three seconds, added
  typed retryable DATABASE_CAPACITY/503 and an actual saturated-pool HTTP recovery
  regression. Calculation/input/parser/password limits and financial goldens remain.
- Focused recovery/load: **5 passed**, 170.00 s. Measured 7,588 service workload
  cycles in 60.062 s, p95 110.418 ms; 935 queue-capacity and 57 DB-capacity rejects;
  28 deliberate parser/password capacity refusals. Worker killed/restarted during
  load; both pools returned to zero checkout and no owned child remained. Sampled
  simultaneous parent/child peak 532,848,640 B; parent retained about 19 MiB after
  recovery, which is an observation rather than a long-term no-leak claim.
- Built disposable Compose browser suite **6 passed**, including a 60-second actual
  HTTP run: 6,827 requests at concurrency eight, p95 139.369 ms, exact 5,119 200 /
  854 404 / 854 422 responses, zero 5xx. Older saved customer retrieved/selected
  through continuation after injected 503/retry; CSP controls pass. A preceding
  HTTP-harness foreign-target mistake was corrected; failed evidence is preserved.
- Supporting collection HTTP regression passed; session/stress/security order
  variation **17 passed**. Original/forward SQL suites each **296/296**, clean and
  populated upgrades and concurrent audit/optimistic-lock behavior passed. Ruff,
  108 generated operations and sole head checks pass. Strict TS examples/typecheck,
  **86 frontend tests**, production build and lint **0 errors / 10 existing warnings**
  pass. Reference **22 cases / 0 problems**; independent selftest **0 failures**;
  no engine/golden changes. Final complete non-fail-fast backend run: **507 passed,
  0 failed, 0 skipped**, 610.34 s (one Starlette/httpx and two SQLAlchemy DOMAIN
  deprecation warnings). Exact contamination pair **2 passed**. The provisional
  **504-pass** run is retained separately and is not substituted for final acceptance.
  Fresh standalone original stress probes: **7 passed / 0 xfails**, 15.58 s.
  Final source manifest hashes match; 52 local documentation links resolve and
  `git diff --check` passes. Remaining warnings are recorded rather than suppressed.
- ST-07/ST-08 remain **external blocked**: executable opt-in target/budget probes
  and full model/Neon/non-superuser/Render/S3/Vercel/joint-restore/rotation procedures
  prepared, CLI/dry path checked; no approved paid budget or disposable hosted
  target/restore pair/rotation evidence supplied. P4/P8 hosted acceptance remains open.
- Detailed finding matrix, source SHA-256 manifest, exact commands, raw evidence,
  thresholds, limitations and remaining prerequisites:
  [remediation report](evidence/reports/backend_stress_remediation_2026-10-16.md),
  [integration contract](contracts/stress-remediation.md),
  [external runbook](deployment/external-acceptance.md). Original audit evidence is intact.


## 16 October 2026 — remote frontend merge integration

- Integrated `origin/main` at `392c7fbb85c7caa84cad5240d630d61abeb57b4c`
  with local backend/stress-remediation commit
  `b5e7aab2c807869ab7681ab37a85ccb520ff5cba`, following the user's direction
  to retain the remote frontend and their committed backend. Local safety refs:
  `codex/merge-local-b5e7aab` and `codex/merge-remote-392c7fb`.
- Restored the complete backend and exported contract documents from the local
  commit; no incoming JWT/admin-role backend or divergent migration was retained.
  `git diff b5e7aab -- backend docs/contracts` is empty. Contract check reports
  108 operations and Alembic has sole head `0016_worker_presence`.
- Preserved incoming layouts, skeletons, landing session presentation and user
  management navigation. Resolved order/document conflicts while retaining local
  supporting-list pagination, retries and selected-default-policy handling.
  Generated frontend types match the retained backend. The API client keeps
  HttpOnly cookie sessions and clears legacy token storage. Platform-admin views
  are unavailable at the common admin layout because this backend provides no
  platform-admin authority; business ownership does not grant that authority.
- Repaired six incoming lint errors in initial admin loading effects by scheduling
  cancellable initial loads; removed incoming trailing whitespace. No financial
  engine, backend migration or golden fixture changed.
- Fresh verification: frontend typecheck, production build and **92 unit tests**
  pass; lint **0 errors / 71 warnings** (warnings retained). Contract export check
  and sole migration-head check pass. Fresh disposable Docker build/stack through
  `scripts/run-e2e.ps1`: **6 browser/HTTP tests passed**, covering persisted order
  creation/evaluation, pagination recovery, mobile navigation/viewport, CSRF
  recovery, accessible sign-in and strict nonce CSP. The HTTP test completed
  9,230 sustained requests at concurrency eight in 60.023 seconds, with exact
  200/404/422 outcomes and no 5xx. Disposable containers/volumes were removed.
  Raw local logs: `D:/Kam 2/merge-web-tests.txt`, `merge-web-lint.txt`,
  `merge-e2e.txt`. The historical 507-backend-test result was not rerun for this
  frontend merge; the backend tree remains identical to its tested commit.
- Hosted/provider acceptance and the previously recorded external blockers remain
  unverified. This merge establishes local integration, not production readiness.

## 17 October 2026 — resumed frontend/integration audit

- Reconciled `main` at `eca00c9` with prior audit/stress/merge records instead of
  resuming the interrupted verification against an old image. Earlier fixes are
  committed; new admin/RBAC changes arrived afterward. Graph-first discovery did
  not cover the new admin symbols; direct source reads filled that gap. Updated
  [the current matrix](evidence/reports/orderfit_audit_2026-10-17.md), preserving historical reports.
- The user explicitly assigned concurrent backend/admin remediation to the other
  task and frontend/integration checks here. No competing backend patch, shared DB
  mutation, real credential change or Git-history operation was performed. Initial
  backend lint/export issues and the `.env`-loading/live-write RBAC test were
  identified but left with that owner. Its new `0017_platform_authority` needs its
  own final migration/restricted-role acceptance; historical 507 passes are not
  a fresh pass of those changes.
- Reproduced and repaired server admin verification ignoring `API_INTERNAL_URL`;
  bounded its fetch to 10 seconds, retained no-store and strict boolean authority,
  and distinguished technical unavailability from an invalid-session 401. A
  recoverable server notice does not render protected child content. Raw fetch
  errors are no longer logged. Three new unit regressions passed after failing
  address/deadline and 503 checks before the repair.
- Restored the existing disabled-console capability at the common admin layout,
  after authoritative authentication and role checks. Existing views include
  local-only maintenance controls and unsupported schema/export success claims;
  they are preserved but not exposed as operational platform controls. Backend
  authority is not broadened to make those screens appear functional.
- Repaired five incoming frontend effect/lint errors with cancellable initial
  loads. No lint rule/assertion was disabled. Preserved teammates' dark auth design
  while repairing placeholder contrast **3.2877→6.0338:1** and explicit solid
  2-pixel keyboard outlines. The previous focus assertion accepted invisible ring-0
  shadows; the strengthened browser assertion now rejects that false positive.
- Fresh frontend verification: **95 unit tests passed**, typecheck passed, lint
  **0 errors / 68 retained warnings**. Production Next build and current API/web
  Docker builds passed. Initial fresh stack: six existing browser/HTTP tests
  passed; then the new contrast check independently reproduced the real failure.
  One focused attempt ran after its disposable stack cleanup and returned connection
  refused; this harness-lifetime failure is not an application pass.
- Final complete rebuilt disposable stack: **6 browser/HTTP tests passed in 1.5
  minutes**, with the strengthened contrast/focus check, persisted manual
  order/evaluation/reload/negotiation route, actual owner denial at `/admin` without
  false sign-out, continuation/retry, mobile 390/390 viewport, CSRF recovery and
  strict CSP. Browser preview visually inspected the dark sign-in page as well.
- Final HTTP p95: mixed-tenant reads **420.80 ms**, same-key writes **442.25 ms**,
  malformed writes **78.64 ms**. Sustained concurrency eight: **4,398 requests /
  60.04 s**, 3,298 expected 200s, 550 tenant-denial 404s and 550 validation 422s,
  **0 5xx**, p95 **241.49 ms**. Same-key writes retained one identity/row. These
  finite local figures are not production capacity or gains attributed to UI edits.
- Docker Desktop was initially stopped; started it with its supported CLI. Test
  runners generated independent secrets/databases and removed only their synthetic
  containers/volumes. No configured application `.env` or hosted DB/provider was used.
- P4/P8 live/hosted/independent quality, rotation and joint restore remain unverified.
  Full browser send/reply/accept/commit/compensation and all-route accessibility/
  layout-shift acceptance were not newly completed. See the current matrix for
  severity-ranked remaining gaps and the backend owner's separate report for its
  current admin acceptance. No claim that all phases or submission work is complete.


## 17 October 2026 — resumed security reconciliation and admin hardening

Reconciled tracked-clean HEAD `eca00c9` with teammate admin commits `e303ebd`,
`fb6d66f` and the earlier CSP/session/worker-remediation work. Graph admin discovery
was stale; inspected current commit paths/source. Preserved concurrent frontend
changes; did not switch/reset branches, load application environment files, run
provision_admin against any configured DB, or rewrite history.

- Removed undeclared JWT dependency/use and credential-bearing SessionView JSON.
  Retained authoritative server-derived platform flag and opaque HttpOnly sessions.
  Regenerated offline OpenAPI/TS artifacts (108 catalogued operations; six new admin
  routes are separately recorded in the source route inventory).
- Corrected missing app_user.is_platform_admin mapping. Admin data reads now use
  services/admin.py: current session plus locked current flag in one bounded
  transaction, preserving runtime RLS. Lists cap at 100/default50. Global private
  auth-event reads return explicit unavailable503; global cross-tenant admin data
  capability remains unfinished, with no runtime owner/admin-role grant added.
- Forward revision `0017_platform_authority` / SQL0018 revokes all sessions on actual
  platform-flag changes and records the event atomically. Provisioner relies on that
  trigger instead of swallowing audit errors. Required runtime head and current
  deployment checklists updated; historical remediation evidence retained.
- Replaced unsafe default live RBAC tests (dotenv/configured DB + committed privilege
  update + embedded account credentials) with synthetic disposable DB regressions.
  Rotation conditional on actual provisioning/reuse
  of those embedded credentials; prior historical remote DB rotation still pending.
- Retained runtime CycloneDX inventory in CI for14days via verified immutable
  upload-artifact v4 SHA; extended workflow security assertions to both workflows.

Executed now: backend non-DB pytest359passed (before final mapping addition), final
focused auth/network15passed; Ruff clean, generated contracts current, sole head
0017_platform_authority. Five new DB regression functions passed against an isolated
marked loopback PostgreSQL16.11 cluster, migrated from empty, using real separately
provisioned restricted runtime credentials and fresh synthetic users. Functions used
the repository config/accounts fixtures directly; this was not the PG17 pytest fixture.
Initial native process-output capture stalled; corrected launcher output handling,
reran failing positive test to expose/fix missing mapping, then all five passed.
Disposable server stopped and temporary cluster removed. Docker daemon unavailable;
full PG17/schema/concurrency/browser/container gates not freshly run here.

Frontend95unit tests and typecheck passed (including concurrent teammate work);
focused CI assertion rerun recorded with final handoff. Runtime hashed pip-audit
exit0:50SBOM components/0known vulnerabilities. npm production0; full graph9high
(dev dependency paths). No hosted CodeQL/CI execution, deployed TLS/RLS/at-rest,
retention/restore, provider or production security acceptance claimed. See
`docs/security/security_audit_2026-10-17.md` for findings, evidence, limitations and
rotation handoff. MFA/passkeys, global admin query contracts, distributed edge quotas
and the previously recorded external acceptance gates remain open. Next step: run
PG17/Docker acceptance when available, then separately authorized hosted gates.

Final focused checks: admin provisioner + RBAC6passed; workflow/header assertions3passed. The provisioner refuses databases without the enabled platform-authority guard before issuing any write. Ruff/contracts and diff whitespace checks pass.

## 17 October 2026 — remaining-phase integration continuation

See [phase closure evidence](evidence/reports/phase_closure_2026-10-17.md) for the reconciled phase
disposition, exact checks, five-round browser cap and limitations. Backend/MFA
changes remain with the security task; integration work preserves that ownership.

Extended the real browser journey through exact draft review, password-bound send,
incoming reply evidence, rejected non-exact acceptance, explicit exact acceptance,
separate commit approval, persisted settlement after reload and approved inverse
compensation. Six browser/HTTP tests passed in round 3 (2.2 minutes). Added a final
lost-execution-response recovery assertion. Reproduced concurrent image-tag and
Playwright artifact races; the E2E runner now pins private per-run images and
retains browser evidence in a unique temporary output directory. No financial
formula, expected golden or approval rule was weakened.

Fresh checks: engine/agent/architecture133passed; reference22cases/0problems;
independent selftest0failures; frontend97unit tests and typecheck passed;
Ruff clean; generated contracts112operations checked. Broad backend516passed /
2failed /3warnings on a moving 0017-to-0018 snapshot: global admin route boundary
and real-worker subprocess startup. Fresh current-head targeted checks and final
private-runner browser results are appended to the linked report when complete.

Main port3000 preview: synthetic signup500, API explicitly refuses stale schema.
No main account creation or main-database migration claimed. Per user request,
temporary credential-free freellmpool0.13.0 probes used only synthetic source text
through the existing LLM boundary: pollinations/openai four cases gave1timeout /
3provider-unavailable; llm7/default single compatibility probe timed out. No live
quality acceptance or production provider switch claimed; gateway removed.
P4/P8 remain partial, with hosted/restore/provider/rotation gates explicitly open.

Final integration evidence: round5 **7browser/HTTP tests passed in2.5minutes**,
including full sandbox lifecycle, lost-response single-effect recovery and the
other task's verified passkey enrollment/login journey. Fresh current-head targeted
PG17 checks **18passed /1deprecation warning in144.64seconds**, covering both broad-run
failures, admin security and signed passkey cases. No fresh full-current-head suite
claim is made by summing overlapping runs. Final production API/web image builds
passed; private-runner cleanup completed; browser evidence retained in the unique
temporary directory recorded in the closure report. Final sustained HTTP run:
2820requests/60.20s, no5xx, p95371.87ms at concurrency8 under concurrent test load.

## Main/Neon migration join — 17 October 2026

- Production Neon is at `0017_merge_heads` (worker presence joined with
  `0016_add_user_admin_roles` from `Ui-improve`). Main `7a5e378` had advanced to
  `0017_platform_authority` -> `0018_passkey_mfa` without that join, so it could not
  migrate Neon. Branch `fix/azure-backend-main-migrations` from `7a5e378` cherry-picks
  the tested join (`d451441`) and adds SQL-free `0019_merge_passkey_roles`
  (parents `0018_passkey_mfa`, `0017_merge_heads`). `SCHEMA_REVISION` follows it;
  sole Alembic head verified. No applied migration edited.
- Disposable PG17 focused run: migration merge (incl. Neon path with an existing
  user), passkeys, admin security, session authority, foundation, RBAC, provisioner
  and passkey configuration: **54 passed**. Ruff clean; contract check 112 operations.
- Disposable container rehearsal (`d451441` image at `0017_merge_heads` -> one
  `alembic upgrade head` -> branch image): applies exactly 0017_platform_authority,
  0018_passkey_mfa, 0019_merge_passkey_roles. Pre-upgrade session stays valid;
  password sign-in, wrong-password 401, sign-up, worker evaluation, `/health` and
  `/ready` pass. Owner promotion revokes the old session and `/auth/me` then reports
  `is_platform_admin=true`.
- By design on main, `/api/v1/admin/*` is not mounted and the web console is gated
  off (`platformAdminEnabled()` returns false); passkeys need HTTPS
  `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN`. Production Neon and Azure were not touched.

## 17 October 2026 — stress plan 2 execution, partial/blocked

Application snapshot `eef7bea2f7d622dc293f8667a120222666fa0d29`, execution branch
`backend/stress_test`, sole Alembic head `0019_merge_passkey_roles`. See the
[detailed report](evidence/reports/backend_stress_test_report_2.md) and
[raw evidence](backend-stress-2/2026-10-17-eef7bea/summary.json). SHA256 checks
confirmed all 170 manifest application/migration/lock files unchanged.

Fresh final full suite: **542 passed, 3 warnings, 658.69 s**, using disposable
PG17 and actual restricted runtime logins. Isolated affected recovery/race suite:
**23 passed**; signed 32-way passkey finish admitted exactly one session/event.
Reference22cases/0problems and independent selftest0failures. Fresh private
production-image browser/proxy suite: **7 passed**, including the sandbox
lifecycle, lost response and passkey journey; separate 60-second proxy probe
handled7,459requests with expected200/404/422 and zero5xx. These runs overlap;
their counts must not be summed.

Added opt-in disposable HTTP runner, raw sanitized request metrics, same-intent
abort reconciliation, explicit server limits, and actual Windows process liveness
checks. Nonzero retained working-set counters caused early false cleanup
failures; a direct probe showed zero live processes, correcting the premature
leak diagnosis. Existing application behavior and financial expectations stayed
unchanged. A five-second client/server idle-expiry comparison disconnected after
110 attempts; the two-second-client control completed120attempts/60s. This remains
an open transport compatibility finding, not a verified production fix.

Final ten-business/100-seed-deal arrival run completed2req/s and5req/s windows
of60seconds each without unexpected responses, before the disk gate stopped the
10req/s stage. Docker's physical C: storage had **7.147% free**, below the plan's
**15%** minimum; approximately13GB additional free space was needed. The deliberate
API stop caused one read error; reconciliation retained all50acknowledged creates,
1,050total deals and10valid audit chains, with no unknown writes or unscoped deal
visibility. The owned DB container was confirmed removed. Added pre-provisioning
disk guards; four new boundary/multi-volume cases plus the existing liveness test
passed separately (**5 passed**), after the542-test run. Actual low-space CLI
refused before provisioning. No full546-test result is claimed.

User explicitly selected **“Finish with the blocked-gate report.”** No further
load was run. Repeated five-minute ramps/warm-ups, capacity-knee confirmation,
two-hour/eight-hour soak, full workload families, D2 datasets, complete resource
telemetry and hosted Neon/Azure/Caddy/S3/provider/restore gates remain open.

## 17 October 2026 — hands-on app reliability testing and retry repair

User requested opening/testing the application and fixing reproduced issues.
Started from clean main `8a9d1c2`; used the development context and graph-first
discovery, falling back where the graph lacked current client symbols. See
[failure map and evidence](evidence/reports/app_reliability_2026-10-17.md).

- Opened the frontend and reproduced unhelpful sign-in failure during API outage.
  Restored the local Docker engine after stale runtime-socket startup failures,
  preserving uniquely named backups; no factory reset or shared DB migration.
- Fixed browser command-key deletion on HTTP5xx. A gateway failure after commit
  now retains the same exact-write identity across retry/reload, as a lost network
  response already did. Definitive 4xx still release keys. Null error bodies no
  longer cause TypeError, structured errors remain intact, and unstructured 5xx
  offer clear recovery feedback. Successful JSON null responses are preserved.
- Added transport regressions for500/502/503/504, null errors and successful null;
  extended the real browser lifecycle with post-save502 and same-key/same-draft
  assertions. Repaired the runner test's stale argument-string assertion.
- Fresh checks: **366 provider-free backend tests passed**, one Starlette/httpx
  deprecation warning; **100 frontend unit tests passed**; typecheck, changed-file
  ESLint, backend Ruff and generated contracts112operations passed. Full frontend
  lint:0errors/68existing warnings. No separate full DB regression-suite rerun.
- Four browser rounds: initial7passed; then6passed/1failed for an incorrect new
  test201expectation (route explicitly returns200); then6passed/1failed for an
  ambiguous alert locator. Final fresh production images: **7passed in1.8minutes**,
  including502recovery and full sandbox send/reply/commit/reload/compensation,
  passkeys, tenant isolation, continuation, CSP, focus/contrast and mobile/CSRF.
  Final sustained probe7,462requests/60.05seconds, no5xx. No production capacity
  inference. Evidence remains at
  `C:/Users/moham/AppData/Local/Temp/orderfit-e2e-a640bcc789-results/`.

All users, documents/terms and effects used were synthetic; restricted runtime
logins and fresh disposable PG17 were used by the browser runner, which cleaned
only its own resources. No live AI, actual outgoing action, hosted release,
restore, shared-schema acceptance, commit or push is claimed. P4/P8 external gates
remain open; next step is separately configured live-quality/hosted acceptance.

## 17 October 2026 — measured dashboard performance repair

User clarified that performance meant application speed. Preserved the existing
reliability working-tree edits. See [measurements and limits](evidence/reports/performance_review_2026-10-17.md).

- Reproduced the 20-row pipeline's serial missing-customer lookup waterfall with
  a controlled browser benchmark:20customers outside the first list,20live
  evaluations,150ms delay on each related response,3full reloads. Original median
  **4,235ms**, samples4235/4264/4228;40related reads and peak20.
- Extracted page-specific reads into `web/lib/pipeline-data.ts`. Missing customer
  labels now use four request slots. Retained first-page label reuse,20-row paging,
  parallel evaluation loading, error/missing-data distinctions and stale flags;
  deduplicate repeated resource IDs within a load. GETs accept an AbortSignal and
  the pipeline cancels obsolete work on navigation/failure. No financial cache,
  formula, tenant authority, mutation flow, API contract or DB pool change.
- Intermediate shared-four-slot implementation passed8browser tests and measured
  median2203ms; refined it to avoid extra evaluation waves on known-label pages.
  Final median **1,704ms**, samples1689/1708/1704: **59.8% lower elapsed time** in
  this controlled scenario, same40reads, customer concurrency4, overall peak20.
  This is client-scheduling evidence, not a whole-app or hosted speedup claim.
- Fresh final verification: **105frontend unit tests passed**; typecheck and
  changed-file ESLint passed; full lint0errors/68existing warnings. Fresh API/web
  production builds and **8browser tests passed in1.9minutes**, including the
  benchmark and full sandbox lifecycle, tenant isolation, continuation, passkeys,
  CSP, keyboard/contrast and mobile/CSRF. Final real HTTP probe7837requests/60.05s,
  concurrency8/no5xx/p9595.32ms; no backend performance attribution or capacity
  guarantee. No backend implementation changed or separate full DB suite rerun.

Evidence: `C:/Users/moham/AppData/Local/Temp/orderfit-e2e-5047c52a83-results/` and
`orderfit-performance-final.log` in the same Temp directory. Only fresh synthetic
users/data and a disposable PG17 stack were used; runner cleanup completed.
Remaining: full evaluation payloads and up-to20evaluation fan-out still warrant
a scoped server summary/batch contract after payload profiling. Engine/provider,
landing-page animation, hosted and large-tenant performance remain separate gates.
Updated the development context with the loader path and scheduling decision.

## 17 October 2026 — local MFA, Docker/PG17 and encrypted restore acceptance

Security follow-up advanced the sole runtime schema to `0018_passkey_mfa` with a
password-plus-passkey flow. Registration/login challenges are short-lived,
CSRF-bound and consumed before WebAuthn verification; completion atomically
rechecks current password/session state, updates the sign counter, rotates the
browser session and records evidence. Enrollment invalidates old sessions. The
new private auth tables are FORCE-RLS and only fixed-search-path helpers are
callable by the restricted runtime role. The legacy unsupported `mfa_enforced`
flag remains fail-closed.

Fresh final verification: `uv run --frozen pytest -q --tb=short -x` completed
with **540 passed** in 848.01 seconds (three upstream/dependency deprecation
warnings). Dedicated signed-passkey, tenant isolation, concurrency/replay and
password-change checks pass. Docker browser acceptance used isolated image tags,
stack resources and PG17; final browser/HTTP round passed seven tests. The
encrypted joint restore drill uses only fresh synthetic tenants/documents and a
real restic repository. It validates wrong-key and tamper rejection, document and
audit integrity, tenant isolation, session rejection and passkey-challenge
quarantine after restore; its measured local restore portion was 8.109 seconds.

No hosted acceptance is implied. A later read-only Neon preflight verified the
configured restricted pooled logins and `verify-full`, but no hosted migration,
synthetic tenant, destructive test, backup or restore ran. Render/Vercel controls,
bucket/KMS/retention controls, hosted joint restore and credential-rotation
confirmation remain open. The exact next procedure is
`docs/deployment/external-acceptance.md`; it requires a verified disposable target
and local secret channel. See `docs/security/security_acceptance_2026-10-17.md`
for source evidence and limits.

## 17 October 2026 — configured Neon connection and runtime reconciliation

User requested Neon-backed verification and restored the pooled API/worker URLs
in ignored `backend/.env`. Earlier checks had found only local PostgreSQL URLs.
Both Neon logins now connect and pass the application's complete restricted,
non-owner runtime checks using explicit read-only transactions.

- Neon already records0019_merge_passkey_roles; checkout expected0018_passkey_mfa.
  Recovered migration graph/role SQL/test files exactly from existing commit
  d9670a0, set the matching required sole head, and updated the original-data fixture
  assertion for the two known reference-role rows. No Neon migration/stamp ran.
- Fresh disposable PG17 compatibility suite: **4passed in15.69s**, including
  preservation of original schema-suite/concurrency evidence by the fixture and
  upgrades from each historical migration branch. Fresh focused runtime/network/
  passkey-configuration/architecture suite: **22passed /1deprecation warning**.
  Ruff/contracts112operations and the local production frontend build passed.
- Initial sslmode=require was encrypted but did not meet runtime certificate
  validation policy. Verified both connections with verify-full and the installed
  certifi bundle, then updated only ignored local runtime URLs. The CA path is
  host-specific and must not be copied unchanged into a container configuration.
- Started the local API with the isolating runtime launcher and local production
  frontend against that API. `/ready` returns200 with DB/schema/storage/worker true;
  the browser shows API ready. Existing shared worker presence is healthy; did not
  start a local worker or claim any shared jobs. Local frontend settings contain
  only the loopback API address in ignored `web/.env.local`.
- Real verified Neon query round trips178.65–186.53ms (five sequential SELECT1
  probes), connection+begin1886.46ms. Direct API readiness726–750ms; later local
  IPv4 frontend health proxies1877–2995ms. These separate observations are neither
  a controlled speedup comparison nor deployed Azure/Vercel latency acceptance.

See [performance follow-up](evidence/reports/performance_review_2026-10-17.md). User sign-in is
pending for authenticated dashboard measurements; no financial payload, synthetic
business/account creation, outgoing action, shared migration or destructive load
test was performed on Neon. Preserve all earlier reliability/performance changes.

## 17 October 2026 — local container/Neon runtime compatibility

- Reconciled the updated ignored runtime configuration without printing its
  values. Its direct target reports `neondb` at sole Alembic head
  `0019_merge_passkey_roles`; the older visible Docker preview instead used its
  separate local `orderfit` database at `0018_passkey_mfa`. No shared migration,
  stamp, provisioner run, or data mutation was performed.
- Reproduced two Compose-only startup blockers: the internal-only default network
  could not resolve a hosted Neon pooler, and a Windows-local `sslrootcert` path
  is not valid inside the Linux image. Added a private, non-published egress
  network for API/worker/migration jobs while retaining the local database on
  the internal network. The image entrypoint now maps only a Windows absolute
  CA path to its bundled certifi CA file before `exec`; it preserves
  `sslmode=verify-full` and leaves `sslrootcert=system` untouched.
- Evidence: the focused entrypoint regression passed, Ruff passed, Compose
  configuration validated, Alembic reports the single `0019_merge_passkey_roles`
  head, and a rebuilt production API/worker pair reached `/ready` with database,
  schema, storage and worker all true. The temporary duplicate pair was stopped
  after verification so the existing local host API/worker remains the only
  active shared-test runtime. The port-3000 production Next UI visibly reported
  `API ready`; host `/ready` remains healthy with zero backlog.

## 17 October 2026 — authorized Neon account and transaction round-trip repair

User explicitly requested creating an account/signing in, then continuing work.
Created one synthetic account/business labeled TEST ONLY — Neon Performance
through the app UI and verified its authenticated Owner dashboard/API ready.
No actual financial inputs, order or outgoing effect was added. The randomly
generated password was not printed or committed. This authorized signup persists
identity/business/session records on Neon; earlier preflight-only notes stay
historical and must not be interpreted as claiming zero writes after signup.

- Actual empty-dashboard automation reloads6478/5906/5877ms, median5906ms,
  including browser bridge/polling overhead; not Core Web Vitals or a20-order
  benchmark. Identified three serial timeout setup SQL requests in every identity/
  job transaction. `apply_timeouts` now sets the same three transaction-local
  values through one bound statement, retaining call sites/order and all security,
  lock, lease, audit and financial controls.
- Explicit read-only Neon microprobe before256.50/268.59/258.49ms (median258.49),
  after128.62/76.79/73.05ms (median76.79). Statements3to1; all three timeout values
  independently checked unchanged. No whole-dashboard speedup claim from this.
- Added a regression that failed before the repair (3statements instead of1).
  Fresh disposable PG17 checks: **22passed /1deprecation warning in35.09s**,
  covering commit/rollback timeout reset on pool reuse, the foundation suite and
  non-member/read-lock/lock-timeout behavior. Ruff/contracts112operations pass.
- Preserved concurrent Docker/entrypoint/security/handoff edits from the other
  task. After interruption the local API and web were restarted hidden on loopback
  ports8000/3000. Browser transport closed on both recovery attempts, preventing
  post-fix authenticated browser measurement. Sign-in screenshot remains in the
  artifact path recorded in [the performance report](evidence/reports/performance_review_2026-10-17.md).

Next step: restore the browser connection and repeat the three authenticated
reloads. No shared-schema migration, destructive Neon load, new privilege or
financial-data change was performed in this repair. The created test account
remains on Neon; its original successful sign-in is verified, not inferred.

## 17 October 2026 — audit continuation: production web launcher

- Reproduced the Next standalone-output warning from the local `npm start`
  command: `next start` is not the compatible runtime launcher when the build
  emits `.next/standalone`. Changed the `web` start script to run the generated
  standalone server, matching the production Docker image. This is an
  operational-only change; it does not alter API contracts, financial logic or
  browser code.
- Evidence: the standalone server served `/api/health` on an alternate loopback
  port with `connected`, `ready`, and `database` true; a fresh production build
  then completed successfully; the corrected port-3000 launcher served the
  sign-in page and browser inspection showed the explicit `API ready` status
  with no console warnings/errors. The backend `/ready` endpoint simultaneously
  reported database/schema/storage/worker true and zero backlog.
- This continuation also re-ran the non-DB contract and core suite earlier in
  the audit: contracts report 112 operations, Alembic reports sole head
  `0019_merge_passkey_roles`, 214 architecture/engine/agent/contract tests
  passed, 105 frontend unit tests passed, and frontend typecheck passed. ESLint
  reported zero errors and 68 existing warnings. The disposable database
  regression run remains blocked because Docker Desktop's Linux engine is not
  available; its 20 setup errors did not run test bodies. No hosted migration,
  shared-data mutation, real outgoing action, or provider acceptance run was
  performed.

## 17 October 2026 — authenticated Neon console audit

- Inspected the active Neon project through the owner's authenticated console,
  without viewing credentials, running SQL, changing branches, or modifying
  data. The default `production` branch is PostgreSQL 18 in Singapore with
  four branches total; the security-acceptance branch is temporary while two
  pre-merge branches remain available as recovery points. The production branch
  is never-expiring and not protected. Its branch-protection control is disabled
  in the current console session, so no misleading partial protection was
  attempted.
- Project access is restricted to one inherited organization Admin; no additional
  project members are listed. The Free plan exposes public Internet access to
  any source with valid credentials. IP allowlists and VPC connectivity are
  unavailable on that plan, and the console disables both controls. This is a
  concrete hosted security limitation: restrict runtime credentials, rotate
  them through the owner-controlled process, and upgrade/provision private
  networking before treating the hosted environment as production-ready.
- Compute is configured at the provider's Free-plan default range with five
  minute scale-to-zero and six-hour history retention. These are cost/recovery
  trade-offs, not a defect to change blindly: increasing compute, retention or
  networking capability requires a plan change and explicit owner approval.

## 17 October 2026 — Vercel public integration check

- The supplied HTTPS deployment served the landing page and public sign-in route
  successfully. Both browser views reported the explicit `API ready` state and
  produced no browser console warnings/errors during this check. This verifies
  the public web-to-API readiness path only; it is not authenticated workflow,
  hosted restore, or live-provider acceptance evidence.
- The live landing copy claimed OCR support, while the implemented document
  contract marks scanned documents as `ocr_required` and does not provide OCR.
  Corrected the source landing copy to describe supported PDF/text/CSV parsing
  and explicit scanned-document review. The correction needs the normal Vercel
  deployment workflow before it will appear at the supplied URL.

## 17 October 2026 — isolated Neon security acceptance and catalog-query optimization

User authorized provisioning/testing from the logged-in Neon console and deferred
credential rotation. Created Singapore branch orderfit-security-acceptance
(br-hidden-cell-aok23ia2), expiring18October18:56:39Bangladesh time, plus private
source/restore buckets. Verified console production endpoint matches the existing
configured main endpoint. All drill writes targeted the new branch; main schema,
credentials, compute settings and application configuration were unchanged.

- Real PostgreSQL18.6/revision0019 restricted API/worker logins pass.100 alternating
  tenant transactions with one local pool connection, no-context zero rows, foreign
  tenant404, API DDL/worker helper/table42501, worker helper and verified client TLS
  pass. Two concurrent client sockets reused one backend across six transactions.
- Private object put/read/hash, immutable create, readiness and anonymous GET/LIST403
  pass. The existing branch storage credential also allows a generated off-prefix
  write: credential prefix least privilege and separate API/worker keys remain open.
  S3 encryption API is unsupported and no enabled versioning was returned. Provider
  encryption statements do not independently establish bucket/KMS acceptance.
- Encrypted restic repository round-tripped through private cloud storage. Full
  source dump/all4document objects restored into new Neon DB
  orderfit_restore_cfa0532373f4 and second private bucket. Core row counts match,
  all17audit chains pass,25copied sessions revoked,2fresh sign-ins and foreign
  download404pass.65table RLS settings/owners,100policies and32security-definer
  owners/search paths match source. Successful hosted restore/verification portion
  50.954s; not a production RTO. Wrong key/tamper checks and a separate cloud-backed
  local PG18 restore also pass. Failed orderfit_restore_f0bd093d7ec6 is quarantined.
- Hosted restore needs a reviewed TOC excluding exactly2provider-owned cloud_admin
  default ACL records; retained app ACLs/policies and verified owners. No broad role
  grant or RLS weakening. Current provider history6hours; no paid plan/retention
  expansion or long-term backup policy was applied. Resources remain for review.
- Batched Database._runtime_checks role/inheritance/ownership/revision reads from3
  SQL statements to1without caching/removing predicates. Seven warm hosted samples
  median235ms before/125ms after (46.8% lower for this check only). Existing deal
  index used at0.559ms on the small snapshot; no speculative indexes/pool expansion.
- Fresh verification:24disposable-PG17DB tests (new query/role/schema tests, timeout
  reset, foundation),19runtime-hardening/passkeyDB tests,4architecture tests pass;
  changed-file Ruff passes. DB runs each have one existing Starlette deprecation.
  Full backend/browser/deployment suites were not rerun for this targeted change.

Actual files:backend/orderfit/store/db.py,
backend/tests/db/test_runtime_validation_roundtrips.py; updated external-acceptance
revision reference, security report, progress and development-context handoff.
See docs/security/neon_acceptance_2026-10-17.md and its sanitized JSON manifest for
samples/resources/counts/hashes and recovery limits. P8 remains partial pending
scoped storage keys, independent provider/KMS evidence, durable retention and
remaining deployed acceptance. No private config/key/backup was committed.

## 17 October 2026 — hackathon security evidence matrix

Added `docs/security/hackathon-security-matrix-2026-10-17.md`, linked from the
README, to map the complete sandbox financial workflow to the scoring criteria:
least-privilege roles/RLS, risk limits, exact human approval, audit-chain
verification, data protection and restore. It points to current source and
executed local/hosted evidence rather than asserting compliance by design alone.
It also contains a five-step live-demo sequence and names the remaining release
blockers: provider network/retention limits, prefix-scoped storage credentials,
independent KMS/version evidence, and required credential rotation. No runtime,
database or provider configuration changed in this documentation handoff.

## 17 October 2026 — AI-assisted website review against 40/30/30 rubric

User requested full website review/repairs, AI encouraged, FreeLLMPool tests
without paid OpenAI calls. Baseline main47289ad was clean. Full guidance,
criteria audit, contribution evidence protocol and calibration/conversation
scripts are in docs/ai_assisted_website_review_2026-10-17.md.

- Fixed uncaught JSONDecodeError in both live extraction and what-if provider
  paths: INVALID_OUTPUT preserves manual/template recovery. Two reproductions
  failed before the fix;82focused P4/P5/audit/architecture checks then passed.
- Corrected legacy /sandbox copy to describe approved saved-order sandbox
  commitments. Fixed 481px loading-skeleton overflow at390px by stacking the
  banner and wrapping placeholder tabs. Added15-route desktop/mobile sweep
  plus a held-real-read loading assertion; lifecycle remains a separate check.
- Fresh full backend run:553passed/1failed in743.94s. The failure expected3
  timeout queries before session resolution, although the prior optimization
  batches them into1. Test now asserts all3transaction-local settings precede
  resolution and verifies actual PG values.10focused security/runtime DB tests
  subsequently pass on another disposable PG17;changed-file Ruff passes.
  No runtime security guard was weakened;no second full backend pass claimed.
- Frontend105unit tests/typecheck pass;full lint0errors/68existing warnings.
  Production builds pass. Six post-repair browser checks pass: lifecycle with
  lost-response/send/reply/accept/commit/reload/compensation, passkeys, pagination,
  CSP, sign-in accessibility and mobile recovery. Route-sweep closure evidence
  is recorded in the linked review. Disposable stacks were removed by runner.
- FreeLLMPool0.13.0 was loopback-only with no mounted credentials/private data.
  Four synthetic probes (pollinations/openai-fast,llm7/default;extraction/whatif)
  yielded TIMEOUT,PROVIDER_UNAVAILABLE,INVALID_OUTPUT,INVALID_OUTPUT. No usable
  structured result;no paid OpenAI call;temporary gateway removed. Main provider
  configuration unchanged. Live AI quality acceptance remains open.

No hosted migration/deployment, shared database mutation or stress campaign.
Next gate: successful synthetic free-route structured output plus independent
quality review;main OpenAI acceptance remains separately opt-in. Existing hosted
security/provider limitations remain unchanged. No phase-completion claim added.

Final route-sweep closure: isolated production-image15-route desktop/mobile
sweep passes, including held-read skeleton assertions at1280px/390px and all30
route/width combinations. Runner identity orderfit-e2e-196d96e594;temporary
browser results retained outside Git. Updated concise development context.

## 18 October 2026 — local Docker configuration switched to existing Neon

User selected the existing Neon database and its data, without copying local
Postgres data. Ignored root `.env` now uses the pooled API/worker URLs and direct
migrator URL from the existing backend environment, with
`sslmode=verify-full&sslrootcert=system` for Linux containers. Session and account
fingerprint settings also match the existing Neon backend configuration. The
previous root environment is retained in an ignored local backup. No hosted SQL
migration, provisioning, application write or local-volume removal was performed.

Added `docker-compose.neon.yml`, selected by the ignored root `COMPOSE_FILE`,
to keep local Postgres behind `local-db` and migration/provisioning behind
`setup`. Default startup runs only API/worker/web; it does not automatically
migrate an existing shared database. Document storage settings/volume remain
as configured; availability of existing Neon's uploaded documents needs checking.
Added `docs/deployment/neon-local.md` and a pointer in `.env.example`.

Verification: live read-only API/worker probes passed the actual runtime role
and schema checks; client TLS was verified with `verify-full` and the installed
host CA bundle. `docker compose config --quiet` passes. Parsed Compose assertions
verify only API/worker/web are active, pooled URLs and verified TLS are configured,
owner credentials are excluded from runtime services, and private egress is
enabled. These checks do not prove container connectivity or browser acceptance.
`docker compose up --build -d` could not connect to the Docker engine named pipe;
Docker also reports its user config file is unreadable in this session. Container
startup, readiness, sign-in and persisted-data/document browser checks remain
unverified. Start Docker and rerun the runbook's startup and health commands.

Follow-up with Docker available: API and worker initially failed with
`SSL error: certificate verify failed` using `sslrootcert=system`. A temporary
container verified that the image's certifi CA bundle successfully connects to
Neon and passes API role/schema validation. Updated the three ignored root URLs
to explicitly use `/opt/venv/lib/python3.12/site-packages/certifi/cacert.pem`,
retaining `sslmode=verify-full`; no TLS validation was disabled. Updated the
local runbook accordingly. `docker compose up -d --wait --wait-timeout 90`
then succeeded. API and web report healthy, worker is running, and the web's
`/api/health` returned HTTP 200 with connected/ready/database all true, including
live worker readiness. Browser sign-in and document availability remain untested.

## 18 October 2026 — overview dashboard backend

Implemented `GET /api/v1/businesses/{business_id}/overview`, operation
`business_overview_get`, with timeframe/currency validation and existing verified
session/read scope through `Database.tenant`. No frontend source was modified;
pre-existing environment/Neon Compose/runbook changes were preserved.

Added overview DTOs in `contracts/resources.py`, a single-statement tenant-scoped
`store/overview_repository.py`, and `services/overview.py`. Aggregation uses stored
snapshot amounts, unique evaluated deals per volume window, latest live verdicts,
active review counts, five recent evaluations, default policy reserve and the
recorded dated opening cash. The delay projection calls a small compute-boundary
adapter around the canonical engine daily sweep. It includes baseline plus
committed cash projections once, excludes voided/raw uncommitted supplier costs,
preserves daily outflows before inflows, and rejects unsupported aggregate money
or complete delayed horizons instead of clipping events. No migration, FX, new
ledger, financial cache, provider call or shared Neon mutation was introduced.

Reconciled prompt assumptions explicitly: the schema has one business currency,
no historical balance/pending/headroom series, no actual payment settlement
evidence and no enabled split strategies. Required `data_warnings` carries these
limitations; unavailable comparison percentages remain neutral numeric placeholders
and must render as unavailable in the frontend. Declined/unclassified evaluations
are excluded from the four-strategy denominator rather than represented as an
invented financing requirement. The recent-result status enum adds `review` for
unsupported strategy buckets; supplier-extension results must not be mislabeled
as financial declines. Missing baseline produces zero financial metrics and
warning scenarios, retaining real operational counts. Negative opening cash
remains signed in the KPI and is omitted from the nonnegative allocation DTO.

Generated docs OpenAPI/types/inventory; added `contracts.export --backend-only`
to honor the user's prohibition on frontend edits. Browser generated types are
intentionally unchanged. Full export `--check` will therefore report browser drift
until the frontend developer synchronizes them. The backend-only check passes.
See [frontend handoff](contracts/overview-frontend-handoff.md) for exact files,
fields, money/date meanings, errors, warning states and browser acceptance gates;
an example payload is in `contracts/overview.example.json`.

Verification:
- Full default backend pytest completed: **634 passed**, three dependency
  deprecation warnings, 594.57 seconds. The final `review` badge/schema refinement
  was covered by a subsequent 99-test overview/architecture/contracts run; this
  was not a second full-suite run. Final combined overview/architecture/contracts
  and isolated PG17 recheck: **103 passed**, one dependency deprecation warning,
  20.23 seconds, after all code/DTO refinements.
- Four new integration tests passed on an isolated, labeled disposable PG17 using
  actual runtime/worker logins. Verified empty business, query validation, anonymous
  and foreign-tenant denial, direct repository RLS denial, financial values, live
  evaluations, committed projections once, one aggregation statement and unchanged
  business profile across repeated reads. Initial test-only assertion referenced
  reserve under the wrong policy field; corrected to existing top-level contract.
- Full backend Ruff and docs-only contract drift checks passed; Alembic sole head
  remains `0019_merge_passkey_roles`; `git diff --check` passed; no `web/` diff.
- Full contract export `--check` was executed and reports the expected
  `generated-api.d.ts` drift. Browser type synchronization is an explicit pending
  frontend integration gate, not a backend-only contract pass.

No hosted latency/capacity claim, frontend/browser acceptance or deployment is
established by these checks. Next integration gate belongs to the frontend owner
following the handoff; historical/account capabilities require separate contracts.
### 18 October 2026 — AI-role assessment and fresh FreeLLMPool probes

Reviewed `main` at `abf2c5fc85ff3c774e28268400db64aa958b3eac` for the user's
AI-scope analysis and live-provider status questions. Findings and proposed
capabilities are consolidated in [the AI workflow plan](AI_WORKFLOW_PLAN.md); no
architecture proposal was adopted and no application implementation changed.

The configured backend environment had `LLM_MODE=off` and no pool base URL.
The previous loopback gateway was unavailable, as was the Docker engine.
An isolated native FreeLLMPool 0.13.0 test sent only synthetic text and used no
provider credentials: `pollinations/openai-fast` returned the exact test marker
in 10.89 seconds; `llm7/default` timed out after 12.14 seconds. Four subsequent
calls through the actual OrderFit LLM boundary and temporary loopback proxies
produced no usable structured output. Two used a short timeout; two repeated
with the normal 30-second application budget returned TIMEOUT. What-if results
had template provenance. Instrumentation and installed-source inspection also
confirmed missing Responses `text.format` schema forwarding in the proxy shim;
that gap is separate from the observed upstream read timeouts.

Temporary proxies were shut down. Probe scripts remain outside Git in the
task-specific system temporary directory. No app configuration, database,
container deployment or paid-provider credentials were changed or used.
Documentation link/whitespace checks are appropriate; no application-suite
pass is claimed. Next gate remains usable structured output and independent
language/extraction quality evaluation. No phase-completion claim follows.

### 18 October 2026 — AI workflow Tier 0 boundary and local-provider guard

- Implemented the first three Tier 0 foundations only. `agent/llm.py` now has one
  private `_structured_call` live-provider boundary used by extraction and what-if
  proposals. It uses `responses.parse` with `store=False` and `max_retries=0` for
  OpenAI, delegates FreeLLMPool to the existing typed adapter, preserves provider
  model provenance, and maps missing parsed output to `INVALID_OUTPUT` rather than
  a refusal.
- Added identical provider-neutral system-prompt files for extraction and what-if.
  `workflow/extraction.py` now hashes both the task prompt and its system-prompt
  bytes. Prompt versions were intentionally not bumped: recordings are keyed by the
  existing version and no recording migration was performed.
- Configuration now rejects a live FreeLLMPool selection when any allowed origin is
  non-loopback or document storage is S3. There is no override. This preserves the
  adapter's synthetic/local-only role.
- Fresh focused verification: `uv run --frozen ruff check orderfit/agent/llm.py
  orderfit/contracts/configuration.py orderfit/workflow/extraction.py
  tests/test_freellmpool.py tests/contracts/test_contracts.py` passed; `uv run
  --frozen pytest tests/test_freellmpool.py tests/contracts/test_contracts.py -q`
  passed (**103 passed in 13.58s**). The P4/P5 combined focused invocation emitted
  progress before the execution window ended and has no final result to claim.

Remaining: F4 evaluation harness/cases, F5 UI provenance, all Tier 1 workflow
capabilities, DB-backed acceptance, frontend checks, recorded evaluation, and any
live OpenAI evaluation. No paid OpenAI call was made.

### 18 October 2026 — native FreeLLMPool workflow acceptance for local testing

User authorized making the free provider work for AI testing. Added pinned
FreeLLMPool0.13.0 and provider/model/state/pacing runtime settings, native typed
JSON handling inside agent/llm.py, credential/catalog isolation, one bounded
HTTP attempt, response/token limits and real provider provenance. OpenAI Responses
remains separate. Runtime launcher drops paid keys for free mode;worker/Compose
honor the provider instead of forcing it off. Added a repeatable synthetic smoke
command, sample upload, focused provider/DB regression assertions and deployment
contract/guide. Concurrent shared-call/system-prompt/local-only and multilingual
changes were preserved and included in the final recheck.

Final focused run:207passed in62.39seconds, one existing Starlette/httpx warning.
Ruff,uv lock --check,contracts112operations and whitespace checks pass;sole schema
head remains0019_merge_passkey_roles. Two paced smoke runs passed4/4live tasks.
Provider-free and real live persisted same-order assertions passed on verified
isolated native PG16.11;the live flow passed again on current shared source.
It covers upload/extract/human amount review/supply missing dates/confirm/evaluate/
what-if,six calculated series,saved live response identity and unchanged canonical
deal state after the fork. Exact IDs and distinctions are in
[the evidence report](evidence/reports/freellmpool_integration_2026-10-18.md).

Isolated API8000 and worker were refreshed from current source with ignored
backend/.env.freellmpool. Existing web3000 proxies to this separate test DB;
final readiness/storage/schema/worker and web health checks pass with zero backlog.
Native test data/manifests remain under backend/var/free-workflow-214868a0e8.
Main DB,existing.env,PostgreSQL5432 and web process were not changed. No paid
call/private document/hosted deployment/stress campaign was used. Optional combined
cleanup/helper generation was rejected by automatic review;old stopped setup
folders remain. Full-suite,PG17 image and complete browser-journey acceptance were
not rerun. General model-quality and remaining release gates stay open.

### 18 October 2026 — C6 deterministic multilingual safety primitives (partial)

- Added dependency-free conservative Unicode-script detection (`en`, `bn`, `hi`,
  `zh-Hans`, `other`, `unknown`) and native-decimal normalization for deterministic
  numeric quote grounding. Quote normalization now also applies NFKC and strips
  format/zero-width characters.
- Expanded fail-closed bank-change and injection signals with Bengali, Hindi and
  Simplified Chinese vocabulary. The generated-text number guard now rejects native
  Bengali/Devanagari numerals and CJK numeric characters/words.
- Fresh focused checks: Ruff passed; `tests/test_multilingual_pure.py` and
  `tests/test_architecture.py` passed (**7 passed**). The requested broad baseline
  did not finish within the execution window, so no baseline total is claimed.

This is not full C6: contracts/persistence/API provenance, language-specific payment
basis/date lexicons, reply holds, prompt revisions, evaluation cases/PDF tests, web
badges/fonts, and live/recorded multilingual qualification remain unimplemented.

### 18 October 2026 — F4 offline AI evaluation harness

- Added `data/ai_workflow/cases/cases.json`: four synthetic extraction layout/
  ambiguity/conflict cases, thirteen what-if paraphrase/unsupported cases, and six
  reply safety/baseline cases. Added committed synthetic recorded outputs keyed to
  the existing `llm.py` filename contracts under `data/ai_workflow/recordings/`.
- Added `scripts/ai_eval.py` and `docs/evaluation.md`. The harness never loads
  `.env`, invokes public extraction/what-if functions, evaluates quote grounding,
  expected fields/changes and safe unsupported changes, and reports per-case
  `pass_k`, model-pass count, fallback rate, latency and tokens. Template fallbacks
  can be a safe case outcome but never count as model passes. Reply remains an
  explicitly labelled deterministic baseline until C2 is wired.
- Added provider-free regression tests in `backend/tests/test_ai_eval.py`.
  Executed: `uv run --frozen python ../scripts/ai_eval.py --mode recorded` (**23
  cases, passed**), and `uv run --frozen pytest tests/test_ai_eval.py -q` (**2
  passed**). The OpenAI live evaluation was not run; C1–C6 integration and the
  multilingual/PDF corpus remain open.

### 18 October 2026 — C2 typed reply-reader integration (partial)

- Added `read_reply` at the sole provider boundary in `agent/llm.py`. It accepts
  only existing `ReplyTerm` fields, requires a normalized verbatim quote from the
  reply, bounds numeric terms, and refuses a model acceptance unless the existing
  deterministic exact-acceptance check also passes.
- `workflow/preparation.py` now invokes that reader before the publication
  transaction and merges unique valid proposals with the regex baseline. Bank-change
  and injection signals remain deterministic and cannot be cleared by model output.
  Reply provenance/model/input hash are persisted in the existing JSON payload;
  no schema migration is required.
- Updated generated API types and the preparation UI to show reply provenance,
  model and language where present, and render reply/quotes with `dir="auto"`.
  Focused reader test passed (**1 passed, 29 deselected**). Ruff and contract export
  checks passed. The complete P5 file exceeded the observation window, so its total
  result is not claimed. C3/C4/C5/full C6 and their acceptance gates remain open.

### 18 October 2026 — C4 deterministic combined-change fallback

- Extended `services/preparation.py` so an instruction containing multiple clear,
  supported changes joined by ordinary prose can produce a combined typed proposal.
  The parser consumes every non-scaffolding word; unknown wording, duplicate change
  kinds, out-of-range values and financing/recipient invention return no proposal.
- Focused provider-free check: two tests passed (`combined_whatif` and typed reply
  reader); Ruff passed after importing the validation type. Live/recorded quality
  comparison has not been run, so this is a safer fallback improvement rather than
  evidence that the model path beats it.

### 18 October 2026 — C6 reviewed payment-basis lexicon and reply hold (partial)

- Added reviewed English, Bengali, Hindi and Simplified-Chinese payment-basis
  lexicons under `data/ai_workflow/lexicon/`. `quote_supports` now requires a
  reviewed source-language term to ground the canonical basis enum; otherwise it
  returns `ambiguous`, never `ok`. Native decimal digits are normalized before
  date matching as well.
- Reply publication records detected language/support state and holds unknown,
  mixed or unsupported-language replies before candidate application. This hold is
  surfaced in the preparation UI and model output cannot remove it.
- Fresh focused checks: multilingual pure tests (**4 passed**), Ruff and API
  contract generation passed; frontend typecheck passed. PDFs, page provenance,
  glosses, per-language model recordings/evaluation and language qualification
  remain open, so no non-English language is marked fully supported.

### 18 October 2026 — Docker runtime lexicon packaging repair

- Reproduced successful API/web image builds followed by failed Compose startup:
  API and worker crashed importing `services/documents.py`, which tried to read
  `/data/ai_workflow/lexicon/payment_basis.json`. The repository-relative path
  was unavailable in the image; the worker also has no demo-data mount.
- Moved the unchanged reviewed lexicon into
  `backend/orderfit/services/payment_basis.json` and loaded it through
  `importlib.resources`. Hatch includes it in the existing wheel package;
  runtime validation no longer depends on repository layout or demo mounts.
- Added `tests/test_runtime_resources.py`, importing a copied package in an
  isolated Python process without the checkout data directory. Focused resource,
  multilingual, AI-workflow, document, audit-repair and architecture checks:
  **75 passed**. Ruff and `git diff --check` passed. The initial test invocation
  hit Windows temp-directory permissions; rerunning with a fresh workspace
  `--basetemp` passed.
- Rebuilt the backend image. A network-disabled container running Python `-I`
  from `/tmp` verified the lexicon and API/worker imports from the installed
  `/opt/venv` wheel, without repository mounts. Compose startup passed: API and
  web healthy, worker running; browser-facing `/api/health` returned
  `connected=true`, `ready=true`, `database=true`.
- Used the existing configured Neon overlay; no migrations or provisioning ran.
  No full browser workflow, model-quality evaluation or capacity test was run.

### 18 October 2026 — OpenAI boundary reliability hardening

- `orderfit/agent/llm.py` (still the only provider boundary): bounded in-call
  retries (`PROVIDER_MAX_ATTEMPTS`, default 2, max 3) for transient failures only
  (timeout, non-quota 429, 5xx/connection), exponential backoff with jitter,
  `Retry-After` honoured up to an 8 s cap (longer requests return retryable
  `RATE_LIMIT` to the durable job instead of sleeping), and a total in-call
  deadline of twice the per-attempt timeout. Quota, refusal, incomplete and
  invalid output are never retried.
- Process-wide provider slots (`threading.BoundedSemaphore`) replace the
  loop-scoped semaphore on the OpenAI path: workers call `asyncio.run()` per job,
  so the old limit did not bound threads. Slot starvation (20 s) fails as
  retryable `RATE_LIMIT` without a provider call and does not count as provider
  ill-health.
- Process-wide circuit breaker (5 consecutive transient failures, 30 s cooldown,
  half-open probe) fails fast as retryable `PROVIDER_UNAVAILABLE`. Invalid output,
  refusal and quota do not trip it. `tests/conftest.py` resets it per test.
- Prompt size cap (`MAX_PROMPT_CHARS`, 250k) applied to every live task before any
  client is created; previously only extraction had a source budget.
- Checks run now: `tests/agent` (new `test_provider_reliability.py`, mocked
  transport), architecture, FreeLLMPool, AI-eval, P4/P5/P6 pure, AI workflow/advisory
  pure, contracts and runtime suites: **261 passed** plus 109 in the first
  agent/architecture/eval run; Ruff passed.
- Not run: live OpenAI calls, DB-backed workflow suites, capacity/load tests.
- Limitations: the client is still created per call because each job uses its own
  event loop, so no HTTP connection reuse; limits and breaker are per process, not
  cluster-wide; no per-business token/cost budget yet; the FreeLLMPool path keeps
  its existing pacing and is not covered by the breaker.


### 18 October 2026 — Baseline duplicate integrity repair (backend only)

- Implemented the investigation's backend remediation atop `9ed213e`.
  `store/baseline_duplicates.py` owns one persisted-candidate policy for manual
  create/edit, CSV confirmation and canonical order review. Unknown counterparties
  match conservatively; same-kind/direction date+amount or normalized-invoice
  matches require an exact matching-ID set and an explicit distinct-obligation
  reason. Matching committed projections participate without loosening projection
  immutability. Reviewed entries remain separately counted.
- Added read-only duplicate inspection and finance-authorized, idempotent saved-pair
  review endpoints. Reviews bind both event versions, store actor/time/reason and
  bump financial revision. Existing unresolved pairs block canonical confirmation
  via `BASELINE_DUPLICATE_UNRESOLVED` and structured `related_event_ids`.
- CSV confirmation preflights saved-ledger and intra-file candidates before inserts;
  intra-file resolutions use earlier source row numbers, never IDs from rolled-back
  writes. Exact repeated parser keys are now blocking preview errors. Immutable
  file-hash/row claims reject repeated source imports even after voiding. Prior
  confirmed-preview history also protects legacy rows with edited/lost attribution.
- Added forward revision `0022_baseline_duplicates` (after `0021_admin_reads`):
  tenant-aware source/review tables, FORCE RLS, insert-only grants/immutability,
  source/pair keys, candidate/history indexes, legacy source backfill, and an
  audited one-time financial-revision cutover for businesses with live baseline
  data. All financial rows and historical evaluations are preserved. Runtime
  requires the new head; no schema autogeneration or application-only unique rule.
- Updated backend DTOs/catalogue and regenerated `docs/contracts/` using
  `contracts.export --backend-only`. No browser source declarations or frontend
  implementation changed. Replaced the pre-fix characterization probes with
  rejection/review regressions; updated schema-count/migration assertions and two
  collection/export fixtures that previously relied on unreviewed equal payments.
- Final focused checks on disposable PG17: **118 passed / 5 deprecation warnings /
  52.42 s**, including real concurrent writes, source uniqueness, history
  immutability, viewer permissions, tenant isolation, legitimate installments,
  known/unknown counterparties, seeded pre-migration backfill/cutover, CSV/doc flows,
  migration graph, contracts and architecture. Ruff and backend-only contract drift
  checks pass. Broader regression: **766 passed / 1 live deselected / 5 warnings /
  831.80 s**. That run began before the final legacy-confirmation fallback/index;
  the 118-test final focused run covers that delta. A final 82-contract-test run
  passes after aligning generated cash-event create success to the mounted HTTP
  200 response. No second whole-suite pass is claimed for those last deltas.
  Local evidence: `D:\Kam 2\baseline-fix-frozen-full.xml` and
  `D:\Kam 2\baseline-fix-acceptance.xml` (matching console logs retained).
- Handoffs: `docs/baseline_duplicates_backend_database_handoff.md` (includes the
  database owner's rollout) and `docs/baseline_duplicates_frontend_handoff.md`.
- **No Neon connection/migration, shared-data cleanup, deployment or hosted/browser
  acceptance was performed.** Database owner must verify target/graph/backup,
  rehearse/apply the migration, coordinate active runs and API/worker restart, and
  reconcile legacy candidates. Frontend owner must implement the review flow.
  Matching is a deterministic candidate policy, not universal semantic identity;
  synchronous row-iterative CSV validation bounds are not a capacity guarantee.


### 19 October 2026 — Docker startup schema mismatch (Neon migration deferred)

- Fresh Docker status/logs: API and worker repeatedly exited at
  `Database.validate_runtime` with `Database schema is not current`; web never
  started because the API health dependency could not pass.
- Read-only one-off API container verified Neon revision `0020_ai_workflow` versus
  image requirement `0022_baseline_duplicates`. Sanitized Compose inspection
  verified API/worker/direct migration URL target the same endpoint/database.
  The Neon overlay intentionally keeps migration behind the setup profile.
- Kept schema/role guards intact. Added a failure-only, secret-safe diagnostic
  naming required/deployed revisions and the database owner's migration action;
  healthy checks still use the existing single catalog round trip.
- Eight focused runtime/entrypoint/diagnostic tests and Ruff pass. Rebuilt the
  Docker API image and verified the clearer rejection against Neon using SELECTs
  only. Stopped the already-failing API/worker restart loops. No migration,
  provisioning, data cleanup or credential/configuration change was performed.
- Updated both duplicate handoffs and the local Neon deployment runbook.
  Deployment remains BLOCKED: database owner must review/apply `0021_admin_reads`
  and `0022_baseline_duplicates`, verify runtime grants, then recreate API,
  worker and web. No healthy hosted startup or full-suite rerun is claimed here.


### 19 October 2026 — Manual-test findings: password policy, closed offers, worker failures

- **Password policy** (`orderfit/services/password_policy.py`, wired into sign-up and
  password change in `services/identity.py`): refuses the account email or its local part,
  common/decorated/leetspeak base words, keyboard walks, sequences, repeated patterns and
  reuse of the current password (`422 WEAK_PASSWORD` / `PASSWORD_REUSED`). Also applied to
  password-reset confirmation and invitation registration (`services/account_access.py`,
  email-independent rules only, since the email is unknown until the token is redeemed).
  Length stays in the request contracts. The embedded word list is a compact screen, not a breach corpus.
- **Closed offers** (`store/repositories.py::_row_to_offer`): a closed offer is now
  `supported=false, unavailable_reason="Offer is closed."`. Previously `OfferView` rejected
  it, so archiving any offer returned `503 DEPENDENCY_UNAVAILABLE`, which stranded orders
  behind `STALE_LENDER_REFERENCE` after a lender edit. Closed offers were already excluded
  from reviews and snapshots.
- **Worker** (`workflow/worker.py::classify_unexpected_failure`): unexpected exceptions are
  logged (`job_failed operation_id kind error_type origin`, never the message); database
  connectivity errors (`OperationalError`) join `RetryableJobError` as retryable. The
  operation attempt budget still bounds retries.
- **Evidence:** 23 new pure tests plus a DB regression
  (`test_archiving_an_offer_returns_a_closed_view_and_removes_it_from_the_review`) that
  fails on the previous `repositories.py` and passes now. Non-database backend modules
  (271 tests) and the offer-related DB modules (18 tests) pass. Live local checks on a
  rebuilt image: weak passwords and sign-up refused with 422; a strong password changes and
  restores; the stale offer archives (200); the loan commit completes end to end.
- **Not done / caveats:** CI `tests`/`security` on main fail because GitHub refuses to start
  jobs (account payment/spending limit), not because of test results. Full DB suite, engine
  suite, web checks and the hosted deployment were not re-run. Frontend does not yet show
  the new `WEAK_PASSWORD` message specifically.

### 20 October 2026 — Approved repository cleanup and saved-workflow repairs

- Worked from local `main` at `97ec81b4c3c35189fed4e644143880af3a114277`
  on `codex/repository-cleanup`. The owner approved documentation/dead-stub cleanup,
  browser contract/workflow repairs, and the README; deployment repair and broad
  dependency/skill removal remain deferred. Existing unrelated untracked work was preserved.
- Consolidated current setup, workflow, architecture, financial and security guidance;
  shortened agent context; updated references before removing the approved 18 files.
  Preserved 18 dated reports plus one XML under `docs/evidence/reports/`. Consolidated
  the QA handoff into `docs/workflows.md`; preserved substantive ADRs, requirements,
  original implementation evidence, fixtures and raw experiment bundles.
- Inspected and reused specific frontend changes from `c7980cd` and `9e77161`,
  then reconciled them against this checkout. Intake now saves API resources; legacy
  validation/confirmation routes redirect; retired fake evaluation and confirmation
  components were removed. Failed reads remain errors, roles come from verified
  memberships, legacy browser drafts are purged on scope reset, and admin screens
  use existing capability-gated bounded reads. Synchronized browser declarations;
  clarified that generated ownership lists include proposed operations.
- Fixed the Windows PowerShell browser runner's handling of Docker stderr without
  masking exit status. Added saved-read 404/503 regressions and optional screenshot
  capture to the persisted sandbox lifecycle test. The README includes four genuine
  synthetic/provider-off captures and two locally rendered Mermaid diagrams; screenshot
  reproduction is documented. No application license was invented.
- Checks executed against this checkout: Ruff; generated contracts (**134 operations**);
  frontend lint/typecheck and strict contract examples; **128 frontend unit tests**;
  reference calculator/selftests; API/web Docker builds; and the focused persisted
  Playwright journey (**1 passed, 38.3 s**) through evaluation, review, approvals,
  dispatch, reply acceptance, commitment, compensation and lost-response recovery.
  The first browser run exposed a stale heading locator; corrected it to the actual
  page heading and reran successfully. **115 Markdown files** have no missing local
  link targets; README anchors resolve and three Mermaid diagrams render locally.
- Full backend run: **838 passed, 1 failed, 1 live deselected, 5 warnings, 1023.53 s**.
  The failure was the existing worker-log test after in-process Alembic `fileConfig`
  disabled its logger. Reproduced that cause without DB access; the same test passed
  alone. Its setup now temporarily enables/restores the logger via `monkeypatch`,
  preserving all error and secret-exclusion assertions. Subsequent migration-plus-
  regression run: **29 passed, 16.06 s** on disposable PG17. Separate deliberate-
  disabled-logger and P7 run: **41 passed, 4.95 s**, including state restoration.
  Ruff/contracts pass after the fix. No second full backend run is claimed.
- Follow-up Render Blueprint repair: both API and worker now select the existing
  S3 adapter with separate service keys and one external private bucket; per-service
  disks were removed. The API `dockerCommand` removes `DATABASE_URL_DIRECT` before
  starting Uvicorn; that migration-only secret remains on the API service so its
  separate pre-deploy command can run. YAML parsing and credential/storage invariant
  checks pass, as do the existing S3 adapter/configuration tests (**8 passed**).
  The Vercel and security indexes now describe these requirements accurately.
- Follow-up completion after the owner asked to implement the remaining safe
  cleanup: removed seven direct web dependencies with no source/configuration
  references and updated the npm lockfile. The first clean Linux image build
  exposed missing cross-platform optional `@emnapi` records; restored those
  records, then confirmed Linux `npm ci` and the production image build succeed.
  Hardened the E2E runner's partial-build cleanup so a missing image cannot skip
  temporary configuration cleanup.
- Final local verification: the complete backend suite passes (**839 passed,
  1 live-provider test deselected, 5 deprecation warnings, 1033.69 s**); Ruff and
  the generated API contract check pass (**134 operations**); frontend lint,
  TypeScript, strict generated declaration validation and **128 unit tests** pass;
  local and clean-container production builds pass; all **13 Playwright acceptance
  tests** pass. The deterministic reference set passes all 22 cases and its
  brute-force/boundary self-tests report **0 failures**. The bounded browser load
  test completed 5,746 requests in 60 seconds with p95 186.83 ms. Local Markdown
  links and Mermaid diagrams were checked after documentation edits.
- The 819 installed skills have unique `SKILL.md` content; no additional skill or
  component deletion met the evidence bar. No engine, migration, or schema change;
  no shared DB migration, live provider, real commercial effect, actual Render
  manifest submission, hosted/restore acceptance, commit, or push. Render CLI
  schema validation and real bucket-policy/credential/restore checks remain open.
  Local browser evidence is not a production-readiness claim.

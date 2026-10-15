# Backend implementation progress

Current phase status: **P2 acceptance passed locally** (15 October 2026).
Earlier entries are historical. The P2 entry below records verification of P1,
the completed pure engine, final test evidence and limits. P3 has not started.

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
  `docs/p1_backend_foundation.md` explain operation and phase boundaries.

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
`docs/neon_connection_review.md`. Approval is still needed for these hosted
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
  `docs/p2_engine_verification.md`; updated README/contract status. No SQL, migration,
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

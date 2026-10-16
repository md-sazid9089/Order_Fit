# Neon PostgreSQL runbook

Scope: the hosted database for the Vercel (web) + Render (API, worker) deployment. Companion documents: [render.md](render.md), [vercel.md](vercel.md), [../neon_connection_review.md](../neon_connection_review.md) (the historical record of the first Neon setup).

Everything here is a procedure to follow. **None of it has been executed against a hosted Neon branch by this change.** See "Unverified hosted gates" at the end. Passwords and URLs below are placeholders; never paste real values into a committed file, a chat or a log.

## 1. Project, branches and endpoints

1. Create (or reuse) a Neon project. Choose the region closest to the Render region of `orderfit-api`.
2. Keep three branches with distinct purposes:
   - `main`: production data.
   - `acceptance` (disposable): a copy used to rehearse migrations, role provisioning, PgBouncer behaviour and restore (section 8). Create it from `main` or empty. Delete it afterwards.
   - Per-change branches as needed. Never run the destructive SQL/concurrency test suites against `main`.
3. Every branch has two hostnames:
   - **Direct** (unpooled): `ep-<id>.<region>.aws.neon.tech`. Use for migrations, `provision`, `pg_dump`/`pg_restore`.
   - **Pooled** (PgBouncer, transaction mode): `ep-<id>-pooler.<region>.aws.neon.tech`. Use for the API and the worker.
4. Always append `sslmode=verify-full&sslrootcert=system` (Neon refuses plaintext). The application builds URLs for SQLAlchemy + psycopg 3, so the scheme must be `postgresql+psycopg://` (the runtime validator rejects anything else: `backend/orderfit/contracts/configuration.py:35`). `pg_dump`/`psql` need plain `postgresql://`.
5. URL-encode passwords (`%`, `@`, `:`, `/`, `#`). `migrations/env.py` already escapes `%` for Alembic.

URL templates (placeholders only):

```text
# Migrator (orderfit-migrate only)
DATABASE_URL_DIRECT=postgresql+psycopg://<owner>:<OWNER_PASSWORD>@ep-<id>.<region>.aws.neon.tech/<db>?sslmode=verify-full&sslrootcert=system
# API (orderfit-api)
DATABASE_URL=postgresql+psycopg://orderfit_runtime:<API_PASSWORD>@ep-<id>-pooler.<region>.aws.neon.tech/<db>?sslmode=verify-full&sslrootcert=system
# Worker (orderfit-worker); same variable NAME, different value
DATABASE_URL=postgresql+psycopg://orderfit_worker_login:<WORKER_PASSWORD>@ep-<id>-pooler.<region>.aws.neon.tech/<db>?sslmode=verify-full&sslrootcert=system
```

Do not add `options=-c ...` or other startup parameters to the pooled URL. A probe that did so failed on the pooled endpoint in the earlier review (`neon_connection_review.md`), and PgBouncer rejects most startup parameters. The runtime does not need them.

## 2. Roles

| Role | Kind | Purpose | Created by |
|---|---|---|---|
| Migration owner (the Neon project's default owner role, or one you create) | LOGIN, owns all tables and functions | `alembic upgrade head`, provisioning, backups. Direct URL only. Holds `CREATEROLE`, `BYPASSRLS` and `neon_superuser` membership on Neon. | Neon console |
| `orderfit_app` | NOLOGIN group | Privilege group for the API: table/column grants, `EXECUTE` on session and auth functions | Migration `0003_security.sql` (idempotent `CREATE ROLE`) |
| `orderfit_readonly`, `orderfit_admin` | NOLOGIN groups | Read-only reporting; cross-tenant console (member of `orderfit_app`) | Migration `0003_security.sql` |
| `orderfit_worker` | NOLOGIN group, member of `orderfit_app` | Adds `EXECUTE` on `operation_claim`, `operation_context`, `operation_heartbeat`, `operation_finish` | Migration `0005_backend_foundation.sql:134-136,393,434` |
| `orderfit_runtime` | LOGIN, member of `orderfit_app` only | **The API login** | `provision` (below) |
| `orderfit_worker_login` | LOGIN, member of `orderfit_worker` only | **The worker login** | `provision` (below) |

Do **not** create the two LOGIN roles in the Neon console or API: Neon grants roles created there membership in `neon_superuser`, which defeats the restricted runtime. Create them with SQL from a direct connection (this is what the repository's provisioner and the test harness do: `backend/orderfit/store/provision.py`, used by `backend/tests/db/conftest.py`).

The runtime refuses to start unless its login is non-superuser, `NOBYPASSRLS`, has no `CREATEROLE`/`CREATEDB`/`REPLICATION`, owns no public table, is not a member of `orderfit_admin`, is a member of `orderfit_app`, and (worker only) is also a member of `orderfit_worker` while the API login is not (`backend/orderfit/store/db.py:49-86`). It also requires `alembic_version` to equal the code's schema revision (`SCHEMA_REVISION`, `db.py:13`). So the order below matters: migrate first, provision after, deploy last.

### 2.1 Provision the logins

Preferred, from an operator shell with the direct URL, using the repository tool (generates nothing; you supply the passwords, at least 32 characters, from a password manager):

```bash
cd backend
export DATABASE_URL_DIRECT='postgresql+psycopg://<owner>:<OWNER_PASSWORD>@ep-<id>.<region>.aws.neon.tech/<db>?sslmode=verify-full&sslrootcert=system'
export RUNTIME_LOGIN=orderfit_runtime      RUNTIME_PASSWORD='<API_PASSWORD>'
export WORKER_LOGIN=orderfit_worker_login  WORKER_PASSWORD='<WORKER_PASSWORD>'
uv run --frozen python -m orderfit.store.provision
unset DATABASE_URL_DIRECT RUNTIME_PASSWORD WORKER_PASSWORD
```

It refuses to overwrite an existing role and refuses passwords shorter than 32 characters. Equivalent SQL (run as the migration owner after `alembic upgrade head`; the groups already exist):

```sql
CREATE ROLE orderfit_runtime      LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '<API_PASSWORD>';
GRANT orderfit_app    TO orderfit_runtime;
CREATE ROLE orderfit_worker_login LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '<WORKER_PASSWORD>';
GRANT orderfit_worker TO orderfit_worker_login;
```

Rotation is a reviewed manual procedure: `ALTER ROLE ... PASSWORD`, update the Render variable, redeploy. The provisioner intentionally will not do it.

## 3. Extensions, schemas and privileges

- **Extensions: none required.** The migrations use only built-ins (`gen_random_uuid()` is core since PostgreSQL 13, `sha256()` is core). Do not install `pgcrypto` or others "just in case".
- **Schemas:** `public` (all application objects) and `langgraph` (created by `0003_security.sql:171`; the application does not use it and `0005` revokes `CREATE` on it from `orderfit_app`).
- **Privileges** are all granted by the migrations themselves, which is why a new Neon branch needs no manual `GRANT`s:
  - `orderfit_app`: `USAGE` on `public`; `SELECT`/`INSERT`/`UPDATE` on tables with specific revokes on immutable tables (`0003_security.sql:121-148`); `USAGE, SELECT` on sequences; no `UPDATE` on `alembic_version`; table-specific `INSERT`/`SELECT` for each later phase (`0005` to `0009`).
  - `EXECUTE` on the `SECURITY DEFINER` functions: login/session/auth helpers to `orderfit_app` (`0003:117`, `0005:310,316`); queue functions to `orderfit_worker` only (`0005:393,434`).
  - Default privileges: `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO orderfit_app, orderfit_readonly` (`0003:174`).
- Owner-side requirement: the migrating login must be able to `CREATE ROLE` (for the NOLOGIN groups) and to create `SECURITY DEFINER` functions it owns. The Neon default owner can. If you use a different owner, grant it `CREATEROLE`.
- Verify after migrating and provisioning (as the owner):

```sql
SELECT version_num FROM alembic_version;                       -- expect the code's SCHEMA_REVISION
SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication, rolcanlogin
  FROM pg_roles WHERE rolname IN ('orderfit_runtime','orderfit_worker_login');   -- all false except rolcanlogin
SELECT pg_has_role('orderfit_runtime','orderfit_worker','USAGE');                -- false
SELECT has_function_privilege('orderfit_runtime','operation_claim(text)','EXECUTE');       -- false
SELECT has_function_privilege('orderfit_worker_login','operation_claim(text)','EXECUTE');  -- true
```

## 4. Direct versus pooled connections

| Use | Endpoint | Why |
|---|---|---|
| `alembic upgrade head`, `provision`, `pg_dump`, `pg_restore`, ad-hoc owner SQL | **Direct** | DDL, long transactions and session features are unsafe or unsupported through transaction pooling |
| API and worker (runtime) | **Pooled** | Many short transactions; avoids exhausting Neon connection limits |

Each process holds at most 5 connections (`Database(pool_size=5, max_overflow=0)`, `db.py:38-47`), so API + worker use at most 10 pooled client connections.

## 5. PgBouncer transaction-pooling safety analysis

Neon's pooler runs PgBouncer in **transaction** mode: a server connection is lent per transaction, so anything that persists on a session can leak to, or vanish for, the next client. Findings from reading the code (the driver is synchronous **SQLAlchemy 2 on psycopg 3**, not asyncpg):

1. **Tenant context is transaction-local.** `set_context` calls `set_config('app.user_id', ..., true)`, `app.session_id`, `app.business_id` with `is_local = true` (`backend/orderfit/store/db.py:29-34`), inside `engine.begin()` transactions (`db.py:87,125,146`). Transaction-local settings are discarded at COMMIT/ROLLBACK, so they cannot leak across clients under transaction pooling, and a connection with no context sees no tenant rows. This is safe in principle; it must still be proven on the real pooler (hosted gate 3).
2. **Prepared statements.** psycopg 3 auto-prepares a statement after `prepare_threshold` executions (default 5), which breaks on a pooler that does not track prepared statements ("prepared statement ... does not exist"). The application disables it: `connect_args={"prepare_threshold": None}` (`db.py:46`). **This setting is required on the pooled URL; do not remove it, and do not introduce asyncpg** (its statement cache needs `statement_cache_size=0` or `prepared_statement_cache_size=0` for SQLAlchemy). `hide_parameters=True` (`db.py:45`) only affects error text.
3. **No other session state.** A search of `backend/orderfit` finds no `pg_advisory_lock`, `LISTEN`/`NOTIFY`, `SET`/`SET LOCAL`, temporary tables, named cursors or `PREPARE`. Row locks (`FOR UPDATE`/`FOR SHARE`) are held only for the transaction.
4. **Pool hygiene.** `pool_pre_ping=True` and `pool_reset_on_return="rollback"` (`db.py:43-44`) cope with Neon compute auto-suspend and with the pooler recycling server connections.
5. **Startup parameters** are not used (no `options=`), which the pooler would reject.
6. **Worker long operations.** The worker runs each job's compute in a spawned subprocess and keeps DB transactions short (`worker.py:68-95,115-160`); no transaction is held across the compute or provider call. Heartbeats use separate short transactions.
7. **Cost note.** The worker polls `operation_claim` every second when idle (`worker.py:246`). That keeps a Neon compute from ever scaling to zero. Plan for continuous compute hours, or raise the sleep (backend change).

## 6. Neon-specific configuration

- Compute auto-suspend: when the compute is suspended the first query takes a cold start (typically a few hundred ms to seconds). The pool's pre-ping reconnects transparently, but the first API request after a quiet period is slower. With the worker's 1 s polling this rarely happens in production.
- PostgreSQL version: Neon is on a newer major (the first setup reported PostgreSQL 18). Local acceptance in this repository ran on PostgreSQL 17 (`backend/tests/db/conftest.py`: `postgres:17-bookworm`). Pick the Neon project version deliberately and treat any difference as unverified (gate 1).
- IP allow-list/Private networking are not used. Access control is the role model above plus TLS.

## 7. Migration procedure (every deploy that changes the schema)

1. Take a restore point first: note the timestamp, or create a Neon branch of `main` (instant, copy-on-write). This is the rollback path: **Alembic downgrades are not a supported production rollback** (`backend/migrations/sql/down_0001.sql` covers only revision 0001).
2. In Render, run the `orderfit-migrate` job (it holds `DATABASE_URL_DIRECT` and nothing else). It runs `alembic upgrade head` as the owner. Alternatively run the same command from an operator shell with the direct URL.
3. If it is a fresh database, provision the runtime logins (2.1) and run the verification SQL (section 3).
4. Deploy the API and the worker. Both validate the schema revision at startup and exit if it does not match.

Order for an upgrade that is not backward compatible with the old code: stop the worker first, migrate, then deploy API and worker. The runtime rejects a mismatched revision, so old code against a newer schema fails fast rather than silently.

## 8. Backup and restore

### 8.1 What needs backing up

1. **PostgreSQL**: all business, audit, snapshot and operation data.
2. **Private document storage** (`DOCUMENT_DIR`): the uploaded source documents. Database rows reference them by hash; a restore that has the rows but not the files breaks link integrity, and vice versa. They are separate stores with no shared snapshot. See [render.md](render.md) "Document storage".

### 8.2 Database: Neon point-in-time recovery and branches

- Neon keeps a restore window (history retention) set per project; the window depends on the plan. Confirm the configured window in the console and write it down here: `____`.
- **Restore in place:** console, Branches, Restore (choose a timestamp). Neon renames the old branch state aside; connection strings stay the same. Use after bad data or a bad migration.
- **Restore to a new branch (preferred for investigation and for the drill):** create a branch from `main` at a past timestamp, connect with the owner credential and inspect. Promote only after review.
- After any restore: re-run section 3 verification SQL, confirm `alembic_version`, restart API and worker (their pools hold connections to the old state), and expect running jobs to be recovered by lease expiry (60 s).

### 8.3 Database: logical dump (independent of Neon's retention)

Use the **direct** URL and the plain `postgresql://` scheme. Store dumps in encrypted storage; they contain tenant financial data. `.gitignore` already excludes `*.dump`.

```bash
# backup (custom format, no owner/ACL surprises on restore into another project)
pg_dump "postgresql://<owner>:<OWNER_PASSWORD>@ep-<id>.<region>.aws.neon.tech/<db>?sslmode=verify-full&sslrootcert=system" \
  --format=custom --no-owner --file=orderfit-$(date -u +%Y%m%dT%H%M%SZ).dump

# restore into a DISPOSABLE target (new Neon branch/project or local Postgres); never over production
pg_restore --no-owner --role=<target_owner> --dbname="<TARGET_DIRECT_URL>" orderfit-<ts>.dump
```

Notes: `pg_dump` must be the same or a newer major version than the server. Roles are cluster objects and are **not** in a database dump: on a new project recreate the NOLOGIN groups by running `alembic upgrade head` on an empty database *before* restoring data, or restore with the migration owner and then re-run provisioning (2.1). The restored database must carry the same `alembic_version`.

### 8.4 Restore drill (run before claiming recoverability; repeat each quarter)

1. Create a disposable Neon branch `restore-drill` (or a separate project). Do not point any service at it except the drill.
2. Restore the latest dump or a PITR branch there (8.2 or 8.3).
3. Run `alembic upgrade head` with that branch's direct URL (must be a no-op) and provision the logins if they are absent.
4. Start a local API with the restore branch's pooled URL and the API login (never the owner) and confirm startup (schema validation passes), sign-in for a known synthetic user, and that the audit chain and a sample evaluation read back.
5. Restore the matching document files and verify each sampled document's SHA-256 against the stored hash.
6. Record the date, source timestamp, elapsed time, row counts and pass/fail in `docs/backend_implementation_progress.md` (by the owner of that file). Delete the branch.

## 9. Secrets handling

- Database URLs, `SESSION_SECRET`, `ACCOUNT_FINGERPRINT_KEY`, `OPENAI_API_KEY` exist only in the Render and Neon dashboards (and the operator's password manager). No `.env` file is deployed.
- Never put the owner URL on `orderfit-api` or `orderfit-worker`; they refuse to start if `DATABASE_URL_DIRECT` is present.
- A Neon owner URL was committed in Git history in the past (commit `eb5758b`; see vercel.md). The owner password and the roles' passwords must be **rotated** before this deployment holds real data. History is not rewritten automatically.
- Account-fingerprint key rotation preserves/re-verifies affected records and is a planned procedure; changing `ACCOUNT_FINGERPRINT_KEY` casually invalidates stored fingerprints. Bump `ACCOUNT_FINGERPRINT_KEY_VERSION` only as part of that procedure.

## 10. Deployment checklist (database portion)

- [ ] Neon project/region chosen; `main` and a disposable `acceptance` branch exist.
- [ ] Owner password rotated since the history exposure; new owner URL stored only in the dashboard.
- [ ] `alembic upgrade head` ran on `acceptance` first, then `main`, via the direct URL.
- [ ] `orderfit_runtime` and `orderfit_worker_login` created with SQL (not the console), 32+ character distinct passwords.
- [ ] Section 3 verification SQL returned the expected values.
- [ ] URLs: API/worker use the pooled host, `postgresql+psycopg://`, `sslmode=verify-full&sslrootcert=system`; migrator uses the direct host.
- [ ] Retention window noted; first restore drill (8.4) done on a disposable branch.

## 11. Unverified hosted gates

These stay **unverified** until someone runs them against a disposable Neon branch. Local PostgreSQL 17 results and the earlier read-only Neon inspection do not establish them (plan section 13.3, `neon_connection_review.md`).

1. Migrations from empty and from the current Neon state to the latest revision on the Neon-selected PostgreSQL major, using the real owner (role/extension/function permissions: `CREATE ROLE` for groups, `SECURITY DEFINER` function ownership, default privileges).
2. SQL-created `orderfit_runtime` / `orderfit_worker_login` are accepted by the **pooled** endpoint, are not `neon_superuser` members, and pass `validate_runtime`.
3. Tenant context under the real PgBouncer: two tenants, concurrent requests, no leakage after commit/rollback, no-context reads return zero rows, `prepare_threshold=None` actually prevents prepared-statement errors.
4. SSL: client TLS enforced on direct and pooled hosts with `sslmode=require` (the earlier review confirmed client TLS in libpq only).
5. Direct vs pooled: migration succeeds on direct; runtime login rejected for DDL; owner URL absent from API/worker environments.
6. Worker claim/heartbeat/finish through the pooler, lease expiry and recovery after a worker kill and after a Neon compute suspend/resume.
7. Backup and restore: PITR restore to a branch, `pg_dump`/`pg_restore` into a disposable target, document-hash verification (8.4).
8. Cold-start behaviour and compute-hour cost with the 1 s worker poll.


## Stress remediation reconciliation — 16 October 2026

Current required sole revision is `0019_merge_passkey_roles`, which joins
`0018_passkey_mfa` and `0017_merge_heads` (the Neon role branch). `/ready` requires an
unexpired global worker heartbeat as well as restricted DB/schema/storage checks;
`backlog_seconds` is separate. Keep process liveness `/health` for service restart
monitoring so a worker outage does not restart a healthy API. Reserve one extra
restricted DB connection per worker for liveness; do not inject migration access.
See the [integration contract](../contracts/stress-remediation.md),
[current evidence](../backend_stress_remediation_2026-10-16.md) and
[executable external acceptance procedures](external-acceptance.md).
Hosted acceptance and historical credential rotation remain unverified.

# OrderFit database: audit and backend connection guide

> Use [Development](../development.md), [current contracts](../contracts/README.md), and `backend/orderfit/store/db.py` for current connection/session handling. The original-schema audit and illustrative code below are historical; do not copy their checkpoint or authorization examples into runtime code.

_Status as of 15 Oct 2026, branch `database` (migration `0001_core_schema`)._

Application examples below are historical guidance. For implementation, use the
[backend plan](../initial_backend_implementation_plan.md) and
[P0 contracts](../contracts/README.md), including the DB-01–DB-30 dispositions.
In particular, do not adopt checkpoint setup, the filtered 540-day view as the
complete input source, reply-driven round increments, bare approval-hash sends,
unconditional unique-error replay or raw DB error messages from these examples.
Reported database checks below have not been rerun by the P0 contract task.

This document has two parts:

- **Part A, audit:** what the database contains, how it was checked, what passed, and what is still open.
- **Part B, backend guide:** step by step, how to connect the FastAPI backend and agent to it correctly.

Related documents:
- [database.md](database.md): design and the frontend/engine mapping.
- [../database-verification-report.md](../evidence/reports/database-verification-report.md): the full independent review of the first version and the fixes made since.

---

## Part A. Audit

### A1. Verdict

The schema is **ready for the backend to use.** Every rule that belongs in the database is enforced and tested:
- tenant isolation;
- the deal workflow;
- approvals and execution;
- the audit chain;
- the engine input contract.

**The backend is not connected yet.** It has no database code: `store/db.py` is a docstring and the routes are empty. Part B describes exactly what to build.

### A2. What is in the database

| Area | Objects |
|---|---|
| Reference data (seeded by the migration, read-only to the app) | `currency` (USD, BDT, EUR, GBP), `app_role` (6 roles with tiers), `deal_status` (8), `deal_transition` (23 edges), `cash_event_kind` (20) |
| Tenants and users | `business`, `app_user`, `membership` (a user can belong to several businesses) |
| Counterparties | `customer`, `customer_invoice`, `payee`, `payee_bank_account` |
| Owner settings | `owner_constraints` (versioned, immutable), `financing_offer` |
| Deal workflow | `deal`, `document`, `extracted_field`, `cash_event`, `evaluation`, `evaluation_option`, `deal_flag`, `negotiation_message`, `approval`, `execution_action` |
| App support | `whatif_run`, `notification`, `idempotency_key` |
| Audit | `operation_log` (append-only, hash-chained per business) |
| Views | `engine_input_events`, `engine_input_coverage`, `deal_pipeline`, `customer_payment_stats`, `approval_staleness` |
| Functions for the app | `verify_operation_log(business_id)`, `auth_lookup(email)`, `user_businesses(user_id)` |
| Roles (NOLOGIN groups) | `orderfit_app` (API and agent), `orderfit_admin` (cross-tenant console), `orderfit_readonly` (reports) |
| Other | Domain `biz_date` (finite dates, 2000–2100); schema `langgraph` for the checkpointer |

**Totals:** 28 tables (plus `alembic_version`), 5 views, 19 functions, 36 triggers, 50 policies.

### A3. How it was checked

All checks ran on a throwaway PostgreSQL 16 container. No shared or real database was touched.

| Check | Result |
|---|---|
| Alembic `upgrade head` → `downgrade base` → `upgrade head` | Clean. After downgrade only `alembic_version` remains (no functions, triggers, policies or domain) |
| `alembic revision --autogenerate` | Refuses to run (`target_metadata = None`), so it can no longer emit `DROP TABLE` for the schema |
| `backend/migrations/tests/test_schema.sql` (runs as the real roles under RLS) | **296 / 296 pass** |
| `backend/migrations/tests/test_concurrency.sh` | **Pass:** 8 writers × 50 → 400 rows, seq 1..400, chain valid; optimistic lock blocks the second writer |
| Acceptance fixtures (`docs/architecture/orderfit/fixtures/cases/*.json`) | Every cash-event kind and payment anchor used by the 22 cases can be stored |
| Rina golden case from stored rows | R-01 lowest $13,000 on day 60, R-02 lowest $2,000 on day 30: exact |
| Scale (50 businesses, 100k deals, 1M cash events, 250k log rows) | All main queries use indexes under RLS. Warm timings: pipeline page 2.7 ms, engine input for one deal 3.8 ms, chain verification 0.18 s per 5,000 rows |
| Backend `ruff check .` and `pytest` after the `env.py` change | Clean; 3 / 3 pass |

### A4. What the database guarantees

These hold even if the API has a bug. Each is covered by `test_schema.sql`.

| Guarantee | How | Error raised |
|---|---|---|
| A tenant only sees and writes its own rows | RLS on every tenant table (enabled and forced), keyed on `app.business_id`. Nothing is visible when it is unset | — (rows hidden; writes `42501`) |
| No row can point at another tenant's data or another deal's | Composite foreign keys `(business_id, [deal_id,] id)` | `23503` |
| Deals follow the workflow | `deal_transition` table; new deals start in `ingesting`, round 0 | `OF001`, `OF008` |
| No computing on ambiguous or incomplete terms | CHECK `deal_terms_present_after_confirm` (customer, cash, value, delivery, payment days, basis and its anchor date) | `23514` |
| Blocking flags stop the deal | Trigger on status change | `OF002` |
| Engine inputs are frozen after confirmation | Trigger; move the deal back to `awaiting_confirm` to edit | `OF003` |
| Negotiation round only steps +1, max 3; evaluations match the round | Trigger + CHECK | `OF004` |
| One live evaluation per deal; results immutable | Partial unique index; only `superseded_at` may be set, once | `23505`, `23000` |
| Only an active, senior-enough member approves | Approval trigger: T2+ to confirm figures, T3+ to send, commit, compensate or override; step-up required for outgoing actions; evaluation must be live | `OF005`, `23514` |
| An approved message cannot be changed | Approval pins the body's SHA-256; the hash is always recomputed | `23503`, `OF006` |
| Nothing executes without a matching approval | `execution_action`: drafted → scheduled needs an approval with the same plan hash, unexpired and not stale; payload immutable | `OF007` |
| The audit log cannot be edited | No UPDATE, DELETE or TRUNCATE, even for superusers; hash chain checked by `verify_operation_log` | `23000` |
| Secrets stay secret | App and readonly roles cannot read `password_hash`; nobody in the app can set `is_platform_admin` or assign `superadmin` | `42501`, `OF009` |
| Triggers cannot be tricked | Every function pins `search_path`; TEMP tables revoked from PUBLIC | — |
| Money and dates are sane | `bigint` minor units, positive amounts; dates finite 2000–2100; deal currency = business currency | `23514`, `23503` |

### A5. Known limitations (by design; the backend must handle them)

1. **The app decides the tenant.** RLS protects against a forgotten `WHERE` clause, not against a compromised app session. Any session can call `set_config('app.business_id', …)`. Never build SQL from request input.
2. **The approver is trusted to be the caller.** The database checks the approver's tier and status. The API must pass the *authenticated* user's id as `approver_id`. The API must also check that only owners change roles.
3. **Deleting the newest audit rows is undetectable** by the chain alone. Export the head `(seq, row_hash)` periodically, outside the database. `verify_operation_log` returns `rows_checked = 0` when it saw nothing; show that as "nothing verified".
4. **Uploads.** The database checks only the declared size and MIME type. The API must check the real bytes, the 25 MB limit, and strip `\x00` from extracted text (PostgreSQL rejects NUL).
5. **The engine window is 0..540 days from `deal.start_date`.** Events outside it are not in `engine_input_events`. Read `engine_input_coverage` and raise W-BASELINE-COVERAGE.
6. **Isolation level.** Write `operation_log` under READ COMMITTED (the default). Under REPEATABLE READ, concurrent appends fail with `23505` and must be retried.

### A6. Open items

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Connect the backend (Part B) | Backend | Not started |
| 2 | `domain.py` ids are `str`; the database uses `uuid`. `current_business_id()` returns `"demo-rina"` | Backend | Not started |
| 3 | Real authentication (frontend sign-in is mocked) | Backend + frontend | Not started |
| 4 | Test the migration on Neon (role creation, pooled endpoint, `set_config` per transaction) | Infra | Not verified |
| 5 | Run on PostgreSQL 17 (compose and CI use 17; tested on 16) | Infra | Not verified; expected to work |
| 6 | Run `test_schema.sql` in CI (snippet in B10) | Infra | Not started |
| 7 | Decide whether to adopt the 15-state workflow from spec 03 §4.1. It needs only rows in `0004_reference_data.sql` | Team | Open |
| 8 | Retention policy for documents and audit records | Team | Open |

---

## Part B. Connecting the backend

### B1. Overview

```
Browser ──> Next.js ──> FastAPI (orderfit_api login, member of orderfit_app)
                           │  every request = one transaction:
                           │    set_config('app.business_id', …, true)
                           │    set_config('app.user_id', …, true)
                           ▼
                        PostgreSQL ── RLS + triggers enforce the rules
Alembic (migrator / table owner) ── DATABASE_URL_DIRECT
LangGraph checkpointer (orderfit_api) ── schema "langgraph"
```

Three rules matter more than anything else:

1. **The API must never connect as the table owner, the migrator or `postgres`.** Superusers bypass RLS. A forced-RLS owner sees nothing. Either way the app breaks or leaks.
2. **Every request runs inside one explicit transaction** that starts with `set_config(..., true)`. With autocommit the setting disappears after the first statement and every query returns zero rows.
3. **Use the transaction-local form** (`true` as the third argument). A session-level `SET` leaks one tenant's id to the next request on a pooled connection.

### B2. Create the login roles (once per environment)

Run this as the migrator (the role that owns the tables) after `alembic upgrade head`. Choose the passwords per environment and store them in the secret store, never in git.

```sql
-- API and agent
CREATE ROLE orderfit_api LOGIN PASSWORD '<strong password>';
GRANT orderfit_app TO orderfit_api;
-- LangGraph checkpointer tables live in schema "langgraph" (see B8)
ALTER ROLE orderfit_api SET search_path = "$user", public, langgraph;

-- optional: cross-tenant admin console
CREATE ROLE orderfit_console LOGIN PASSWORD '<strong password>';
GRANT orderfit_admin TO orderfit_console;

-- optional: reporting / support
CREATE ROLE orderfit_report LOGIN PASSWORD '<strong password>';
GRANT orderfit_readonly TO orderfit_report;
```

- **Local Docker:** compose creates `orderfit` as a **superuser**. Keep that role for migrations only, run the SQL above once, and point the API at `orderfit_api`.
- **Neon:** run it as `neondb_owner` on the direct endpoint. Creating roles through SQL there has not been verified yet (A6 #4). If it is refused, create the role in the Neon console and run only the `GRANT` and `ALTER ROLE` lines.

### B3. Environment variables (`backend/.env`, never committed)

| Variable | Value | Used by |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://orderfit_api:<pw>@<host>:5432/<db>` (on Neon: the **pooled** host, `-pooler`, with `?sslmode=require&channel_binding=require`) | API, agent, checkpointer |
| `DATABASE_URL_DIRECT` | Same database, **migrator** credentials, **direct** host (no `-pooler`) | Alembic only |

`settings.migration_url` already prefers `DATABASE_URL_DIRECT` (`orderfit/config.py`). `settings.psycopg_conninfo` gives the plain libpq form for psycopg and LangGraph.

### B4. Engine and session (`orderfit/store/db.py`)

```python
"""Postgres access: SQLAlchemy 2 async engine on psycopg 3. One transaction per request."""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from orderfit.config import settings

engine = create_async_engine(
    settings.database_url,          # orderfit_api, pooled endpoint on Neon
    pool_size=5,
    max_overflow=5,
    pool_pre_ping=True,
    # PgBouncer / Neon pooler in transaction mode: do not rely on server-side prepared statements
    connect_args={"prepare_threshold": None},
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

_SET_CONTEXT = text(
    "SELECT set_config('app.business_id', :business_id, true),"
    "       set_config('app.user_id', :user_id, true)"
)


@asynccontextmanager
async def tenant_session(business_id: UUID | None, user_id: UUID | None) -> AsyncIterator[AsyncSession]:
    """One transaction, scoped to one tenant. Commits on success, rolls back on error."""
    async with SessionLocal() as session, session.begin():
        await session.execute(_SET_CONTEXT, {
            "business_id": str(business_id) if business_id else "",
            "user_id": str(user_id) if user_id else "",
        })
        yield session
```

Notes:
- Use the raw-SQL style above (`text()` with bound parameters), or SQLAlchemy Core tables. **Do not** turn on Alembic autogenerate against them; `env.py` keeps it off on purpose.
- Money crosses the API as integers (minor units) or decimal strings, never floats.
- Windows development: psycopg's async mode needs a selector event loop, and the default Proactor loop fails. Run the API in Docker or WSL, or start the loop with `asyncio.SelectorEventLoop`.

### B5. FastAPI dependency (`orderfit/api/deps.py`)

Replace the hard-coded `"demo-rina"` with the authenticated user and the business they selected:

```python
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from orderfit.store.db import tenant_session


class Principal:            # filled by your auth layer from the session cookie
    user_id: UUID
    business_id: UUID       # the business chosen after login (see B6)


async def current_principal() -> Principal:
    ...                     # validate the session cookie; 401 if missing or expired
    raise HTTPException(401)


async def db(principal: Principal = Depends(current_principal)) -> AsyncIterator[AsyncSession]:
    async with tenant_session(principal.business_id, principal.user_id) as session:
        yield session
```

Every route then takes `session: AsyncSession = Depends(db)`. Also add an explicit `WHERE business_id = :business_id` to list queries. RLS already filters, but the explicit predicate lets the planner use the `(business_id, …)` indexes.

### B6. Login and choosing a business

The login steps run before any business is chosen, with an empty tenant:

```python
async with tenant_session(None, None) as s:
    row = (await s.execute(text("SELECT * FROM auth_lookup(:email)"), {"email": email})).one_or_none()
# verify row.password_hash with argon2/bcrypt; reject unless row.status == 'active'
async with tenant_session(None, row.user_id) as s:
    businesses = (await s.execute(text("SELECT * FROM user_businesses(:u)"), {"u": row.user_id})).all()
# one business → select it; several → let the user choose; store (user_id, business_id) in the session
```

- **Sign-up / invite:**
  1. Generate the user's UUID in Python.
  2. `set_config('app.user_id', <new id>, true)`.
  3. `INSERT INTO app_user (id, email, full_name, password_hash, status)`.
  4. Insert the `membership` row in the same transaction.
  `RETURNING` may name only readable columns; `password_hash` is not readable.
- **Platform admin console:** connect with the `orderfit_console` login (member of `orderfit_admin`) through a separate engine. That role sees all tenants without `app.business_id`.

### B7. The workflow in SQL (what each step must write)

| Step | What to do | DB rules you will meet |
|---|---|---|
| Create deal | `INSERT INTO deal (business_id, public_ref, customer_id, constraints_id, created_by)`. Status, round, reserve, currency and deposit discounts are defaulted | Must start `ingesting` (OF008) |
| Upload | `INSERT INTO document (…, content_hash = sha256 bytes, size_bytes, mime_type)` | Duplicate in the same deal → 23505 (show the dedupe prompt) |
| Extract | `INSERT INTO extracted_field (…, value jsonb, source_page, source_quote, confidence, status)`. Use `status = 'missing'` with `value = 'null'` for absent fields | Empty-string values rejected |
| Validate | `deal_flag` rows (`blocking = true` for ambiguity, fraud, injection) | — |
| Confirm (checkpoint 1) | Write the confirmed values onto `deal` (`opening_cash_minor`, `order_value_minor`, dates, `payment_days`, `payment_basis`), set `extracted_field.status = 'confirmed'`, then `status: ingesting → awaiting_confirm → computing` | Missing term → 23514; open blocking flag → OF002 |
| Compute | Read `SELECT * FROM engine_input_events WHERE deal_id = :d ORDER BY day, apply_order, event_id` and `engine_input_coverage`. In one transaction: supersede the live evaluation (`UPDATE evaluation SET superseded_at = now() WHERE deal_id = :d AND superseded_at IS NULL`), insert `evaluation` (`round = deal.negotiation_round`, `input_hash = bytes.fromhex(result.input_hash)`), insert its `evaluation_option` rows, then `computing → awaiting_approval` | Only while `computing` (OF008); round must match (OF004) |
| Draft | `INSERT INTO negotiation_message (direction 'outbound', status 'draft', body)` | Hash computed by the DB |
| Approve (checkpoint 2) | After the step-up passes: `INSERT INTO approval (action 'send_message', evaluation_id, option_key, action_plan_hash, message_id, message_sha256 = the message's body_sha256, approver_id = the logged-in user, decision, idempotency_key, step_up_verified_at = now())` | Tier, active user, live evaluation, step-up (OF005, 23514); same key twice → 23505 → replay the stored response |
| Send | `negotiation_message.status: draft → approved → sent` (`sent_at`), then deal `awaiting_approval → awaiting_reply` | Needs the matching approval (OF006) |
| Reply | `INSERT INTO negotiation_message (direction 'inbound', status 'received', extracted_terms)`. If the terms change: `awaiting_reply → awaiting_confirm`, edit, re-confirm, recompute with `negotiation_round + 1` | Inputs frozen outside `awaiting_confirm` (OF003) |
| Commit / execute | `commit_plan` approval, then `INSERT INTO execution_action (status 'drafted', plan_hash, payload, idempotency_key)`, then `UPDATE … SET status = 'scheduled', approval_id = …`, then `'posted'` / `'sent'` / `'accepted'`. Finally deal → `committed` | Approval plan hash must match, not stale or expired (OF007) |
| Audit | `INSERT INTO operation_log (business_id, deal_id, actor, actor_user_id, tier, action, entity, outcome, payload)`. Never pass `seq`, hashes or `created_at`; the DB assigns them | Append-only (23000) |

**Optimistic locking:** read `deal.version`, then `UPDATE deal SET … WHERE id = :id AND version = :v`. **0 rows updated = someone else changed it** → 409. The trigger bumps `version`; it does not compare it for you.

### B8. LangGraph checkpointer (only if the agent uses LangGraph)

The checkpointer's tables go in schema `langgraph`. `orderfit_api` can create tables there, and its `search_path` (B2) finds them. Use the same login:

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

pool = AsyncConnectionPool(settings.psycopg_conninfo, open=False,
                           kwargs={"autocommit": True, "prepare_threshold": None})
await pool.open()
checkpointer = AsyncPostgresSaver(pool)
await checkpointer.setup()          # creates langgraph.checkpoints, … on first run
```

Checkpoint tables are not row-secured. Use the deal id as `thread_id`, and load a deal (through RLS) before resuming its thread.

### B9. Error mapping (one FastAPI exception handler)

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError

STATUS = {
    "OF001": (409, "ILLEGAL_TRANSITION"), "OF002": (409, "NEEDS_INPUT"),
    "OF003": (409, "STALE_INPUT_VERSION"), "OF004": (409, "ROUND_RULE"),
    "OF005": (403, "APPROVAL_INVALID"),   "OF006": (409, "APPROVAL_REQUIRED"),
    "OF007": (409, "APPROVAL_INVALID"),   "OF008": (409, "WORKFLOW_RULE"),
    "OF009": (403, "FORBIDDEN"),          "23000": (409, "IMMUTABLE"),
    "23503": (409, "INVALID_REFERENCE"),  "23505": (409, "DUPLICATE"),
    "23514": (400, "VALIDATION_FAILED"),  "22P02": (400, "VALIDATION_FAILED"),
    "22008": (400, "VALIDATION_FAILED"),  "22003": (400, "VALIDATION_FAILED"),
    "54000": (400, "VALIDATION_FAILED"),  "22P05": (400, "VALIDATION_FAILED"),
    "42501": (404, "NOT_FOUND"),          # never reveal another tenant's rows
}

async def db_error_handler(request: Request, exc: DBAPIError) -> JSONResponse:
    state = getattr(exc.orig, "sqlstate", None)
    constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
    if state == "23505" and constraint in ("approval_business_id_idempotency_key_key", "idempotency_key_pkey"):
        ...  # return the stored response for this idempotency key instead of an error
    status, code = STATUS.get(state, (500, "INTERNAL"))
    message = str(exc.orig).splitlines()[0] if status < 500 else "something went wrong"
    return JSONResponse({"error": {"code": code, "message": message, "constraint": constraint}}, status_code=status)

# app.add_exception_handler(DBAPIError, db_error_handler)
```

Use the **constraint name** (`exc.orig.diag.constraint_name`), not the message text, when you need to tell two errors with the same SQLSTATE apart. Examples: `evaluation_one_live_per_deal` → `STALE_EVALUATION`, `document_deal_id_content_hash_key` → `DUPLICATE_DOCUMENT`.

### B10. Migrations and tests

```bash
# from backend/ (uses DATABASE_URL_DIRECT = migrator)
alembic upgrade head
alembic downgrade base        # dev only: drops everything

# schema regression test (superuser, THROWAWAY database; rolled back; exits non-zero on failure)
psql -v ON_ERROR_STOP=1 -d orderfit_test -f migrations/tests/test_schema.sql
PGDATABASE=orderfit_test bash migrations/tests/test_concurrency.sh
```

New migrations are written by hand: `alembic revision -m "…"`, then raw SQL in `migrations/sql/` run the same way as `0001`. Autogenerate is disabled.

To run the schema test in CI, add this to the `backend` job in `.github/workflows/tests.yml`, after `alembic upgrade head`. The service user `orderfit` is a superuser there:

```yaml
      - run: psql -v ON_ERROR_STOP=1 -f migrations/tests/test_schema.sql
        env:
          PGHOST: localhost
          PGUSER: orderfit
          PGPASSWORD: orderfit
          PGDATABASE: orderfit
```

### B11. Checklist before the first end-to-end demo

- [ ] `alembic upgrade head` on the target database, run as the migrator.
- [ ] `orderfit_api` login created (B2); `DATABASE_URL` uses it, and it is **not** a superuser (`SELECT rolsuper FROM pg_roles WHERE rolname = current_user` → `f`).
- [ ] `store/db.py` and `api/deps.py` implemented (B4, B5); every request sets `app.business_id` and `app.user_id`.
- [ ] Ids in `domain.py` are `UUID`; a demo business is seeded with a real UUID.
- [ ] Error handler installed (B9).
- [ ] Smoke test: with no tenant set, `SELECT count(*) FROM deal` returns 0. With the demo tenant it returns that tenant's deals only.
- [ ] `test_schema.sql` passes on a throwaway copy, and in CI.

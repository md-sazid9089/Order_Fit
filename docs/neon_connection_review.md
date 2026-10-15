# Supplied Neon connection review

Current status: **approved P1 setup completed on the existing Neon database**.
Both restricted runtime connections and real API startup have been verified.
The initial inspection below is historical; the completion record follows it.

Inspection date: 15 October 2026. Scope: authorized read-only inspection of the
teammate-supplied connections in the ignored root/backend environment files.
No credentials, URLs or business payloads are included in this report.

## Verified against Neon

- Both supplied direct and pooled endpoints connect successfully. Client libpq
  confirms TLS is in use on both; PostgreSQL's backend `pg_stat_ssl` reports false
  behind the service proxy and was not used to infer unencrypted client traffic.
- All inspection transactions explicitly used read-only mode and were rolled back.
- Server reports PostgreSQL `18.6 (c021049)`. Existing local P1 acceptance was on
  PostgreSQL 17, so it does not establish hosted PostgreSQL 18 acceptance.
- Alembic records `0001_core_schema`. P1 revision `0002_backend_foundation` is
  absent. Its auth-session, operation, snapshot and other foundation tables are
  absent. The expected original core table names, 19 public functions and 22
  tenant-isolation policies are present; this inventory is not a complete schema
  drift comparison.
- The supplied login has table-owner privileges, BYPASSRLS, CREATEROLE, CREATEDB,
  replication and membership in `neon_superuser` and `orderfit_admin`. It is
  appropriate only for the migration/provisioning path, subject to owner review.
  P1's API/worker startup correctly rejects this login as a runtime credential.
- Existing `orderfit_app`, `orderfit_readonly` and `orderfit_admin` roles are
  NOLOGIN privilege groups. No dedicated `orderfit_runtime` or
  `orderfit_worker_login` roles exist. No ordinary login inheriting
  `orderfit_app` was found; the only matching login has elevated platform access.
- `business` and `deal` currently contain no rows. Other business table payloads
  were not read. Existing public checkpoint tables were observed and left alone;
  their presence does not authorize dropping or adopting them.
- The first probe, which supplied additional startup `options`, failed on the
  pooled endpoint. A second probe without those startup options connected and
  ran read-only catalog queries successfully. No blanket pooled-endpoint failure
  is inferred from the first probe. P1 runtime does not inject those extra options.
- Read-only migration preflight confirmed the required original tables, named
  priorities constraint, app-user update policy, LangGraph schema, CREATE access,
  composite referenced keys and unchanged `user_businesses` return signature.
  No proposed table names or checked foundation column names conflict with
  existing objects. This reduces known migration risks but is not a full schema
  equivalence proof or an actual hosted migration pass.

## Setup plan approved by the user

Use the same Neon database; do not reset, recreate or stamp it blindly.

1. Following the completed read-only catalog preflight, run the existing reviewed
   `alembic upgrade head` with `DATABASE_URL_DIRECT`
   injected only into that process. It must advance 0001 to
   `0002_backend_foundation`, not replay initial schema creation. Preserve existing
   checkpoint and immutable history objects. The migration is in
   `backend/migrations/versions/0002_backend_foundation.py` and
   `backend/migrations/sql/0005_backend_foundation.sql`.
2. Generate independent API/worker passwords and application secrets locally.
   Run the existing migrator-only `python -m orderfit.store.provision` utility to
   create SQL LOGIN roles `orderfit_runtime` and `orderfit_worker_login`, granting
   only `orderfit_app` and `orderfit_worker` respectively. No existing owner
   password is rotated implicitly. Do not create runtime logins through Neon
   interfaces that automatically grant `neon_superuser` membership.
3. Keep the supplied owner connection as migration-only `DATABASE_URL_DIRECT`.
   Set `DATABASE_URL` to the same pooled database with API credentials and
   `WORKER_DATABASE_URL` to the same pooled database with worker credentials.
   Preserve TLS requirements and URL-encode passwords correctly.
4. Add distinct generated `SESSION_SECRET` and `ACCOUNT_FINGERPRINT_KEY` values
   of at least 32 characters; set `ACCOUNT_FINGERPRINT_KEY_VERSION=1`,
   `DOCUMENT_DIR`, exact `ALLOWED_ORIGINS`, development `COOKIE_SECURE=false` and
   `LLM_MODE=off`. Keep OpenAI credentials server-only; no provider call is needed.
5. Supply a Neon-specific startup configuration: current default Compose starts
   local PostgreSQL, while ordinary application commands do not auto-load `.env`.
   Each process must receive only its designated settings. Never inject the
   direct owner URL into API/worker processes.
6. Verify real runtime logins and schema through startup checks, then read-only
   no-context/tenant pool reset checks. Any signup, worker admission or other
   hosted test writes need explicit scope and synthetic evidence; do not run the
   destructive local regression suite against this core database.

At the initial review, no migration, provisioning, credential rotation, local
environment edit or test-row creation had occurred. The user subsequently
explicitly approved the schema/role changes and local configuration update.

Historical credentials previously committed to Git still require coordinated
owner rotation. This inspection does not confirm that rotation occurred.

## Completion record — 15 October 2026

- Applied the existing forward Alembic migration to the supplied direct endpoint:
  `0001_core_schema -> 0002_backend_foundation`. No initial migration replay or
  database recreation/stamping. Bounded lock/statement timeouts were used for
  this migration connection.
- All pre-existing public table row counts were compared before/after migration:
  unchanged except the exact additional `computing -> awaiting_confirm` reference
  transition. Existing public checkpoint tables were preserved. No business test
  data, authentication sessions or operations were created by setup verification.
- Created SQL logins `orderfit_runtime` and `orderfit_worker_login` with independent
  generated passwords and only the respective app/worker privilege groups. The
  owner login/password was not replaced or rotated.
- Updated ignored root and backend `.env` files. The supplied direct owner URL
  stays in the root migration configuration; the backend runtime file no longer
  contains it. Both files use restricted API/worker URLs to the same pooled Neon
  database, with generated independent session/fingerprint secrets and explicit
  development origins, storage, cookie security and `LLM_MODE=off`.
- Original environment files were retained as ignored private
  `.env.before-neon-*` backups. No secrets were printed or staged. The temporary
  setup recovery file was deleted after successful verification.
- Both files pass `RuntimeConfiguration`. Both real runtime logins pass schema,
  non-owner/no-admin/no-BYPASSRLS validation. Client TLS is active. Neither login
  belongs to `neon_superuser`. No-context reads return zero tenant rows, tenant
  GUCs clear after commit through pooled connections, and only the worker has
  queue-claim function permission.
- Started an actual local API process through the explicit launcher with Neon
  runtime credentials. Startup checks, HTTP `/health` and OpenAPI all passed;
  the temporary process was stopped afterwards. No signup or provider call ran.

From `backend/`, start the API and worker in separate terminals:

```text
uv run --frozen python -m orderfit.runtime api
uv run --frozen python -m orderfit.runtime worker
```

The launcher explicitly reads `.env`, selects the role-specific database URL and
filters out owner/provisioning credentials and unrelated inherited secrets before
starting the child process. The application itself still does not implicitly
load `.env`. The default local-PostgreSQL Compose stack is not needed for these
Neon commands. The backend environment template includes the worker URL.

Hosted multi-user business/auth/job workflows, crash recovery, transaction-pool
behavior under concurrency, backup/restore and browser/provider acceptance remain
unverified. No destructive SQL regression suite was run against Neon. Local P1
evidence and the smaller hosted setup checks remain distinct. P2 is unstarted.

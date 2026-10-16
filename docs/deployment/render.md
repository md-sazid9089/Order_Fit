# Render runbook (API, worker, migrations)

Scope: the FastAPI API, the durable worker and the one-shot migration job, defined in [`render.yaml`](../../render.yaml). The web app is on Vercel ([vercel.md](vercel.md)); the database is on Neon ([neon.md](neon.md)). Nothing here has been deployed or exercised on Render by this change; see "Unverified hosted gates".

## 1. What the Blueprint creates

| Service | Type | Command | Database variable and login | Notes |
|---|---|---|---|---|
| `orderfit-api` | web (docker) | image `CMD`: `python -m orderfit.api.serve` (uvicorn on `0.0.0.0:$PORT`, proxy trust from `TRUSTED_PROXY_IPS`) | `DATABASE_URL` = Neon **pooled**, `orderfit_runtime` | `healthCheckPath: /ready`; persistent disk at `/app/var` |
| `orderfit-worker` | worker (docker) | `python -m orderfit.workflow.worker` | `DATABASE_URL` = Neon **pooled**, `orderfit_worker_login` | no HTTP port; always-on paid plan |
| `orderfit-migrate` | cron (docker), run manually | `alembic upgrade head` | `DATABASE_URL_DIRECT` = Neon **direct**, migration owner | the only service that holds the owner credential |

Shared group `orderfit-shared`: `SESSION_SECRET`, `ACCOUNT_FINGERPRINT_KEY` (both generated once by Render, distinct), `ACCOUNT_FINGERPRINT_KEY_VERSION=1`, `COOKIE_SECURE=true`, `LLM_MODE=off`. Prompted per service (`sync: false`): `DATABASE_URL`, `ALLOWED_ORIGINS`, and `DATABASE_URL_DIRECT` on the job.

### Decisions and why

- **Worker command is `python -m orderfit.workflow.worker`, not `python -m orderfit.runtime worker`.** `runtime.py` is a local launcher: it requires a `.env` file, filters the environment and spawns a child (`backend/orderfit/runtime.py:35-91`). On Render the platform injects the environment, so the worker module is started directly (`workflow/worker.py:210`).
- **Both runtime services use the variable name `DATABASE_URL`** with different values. `WORKER_DATABASE_URL` is only meaningful to the local launcher (`runtime.py:44-46`) and is not set on Render.
- **Migrations run as a separate manual job, not as `preDeployCommand`.** A `preDeployCommand` executes with the web service's own environment, so the owner URL would have to be set on `orderfit-api`. Besides defeating the "runtime must not hold migration credentials" rule, the API refuses to start when `DATABASE_URL_DIRECT` is present (startup guard in `backend/orderfit/api/main.py`; `backend/orderfit/workflow/worker.py` has the same guard). Renaming the variable to dodge the guard would only hide the exposure. If you accept that trade-off anyway, use `preDeployCommand: sh -c 'DATABASE_URL_DIRECT="$MIGRATION_URL" alembic upgrade head'` and set `MIGRATION_URL` on the API; this is **not** recommended.
- **Autodeploy is off** (`autoDeploy: false`) so a push cannot start code that expects a schema nobody has migrated. The runtime also verifies `alembic_version` at startup and exits on a mismatch (`db.py:13,80-83`).

## 2. Dockerfile properties (`backend/Dockerfile`)

| Requirement | Status |
|---|---|
| Honours `$PORT` | Yes: `ENV PORT=8000` default; `CMD` is `python -m orderfit.api.serve`, which reads `PORT`. Render's injected `PORT` overrides it |
| Non-root | Yes: `USER app` (uid 10001) |
| Health command | Yes: `HEALTHCHECK` polls `/ready` on `$PORT` (Docker/Compose only; Render uses `healthCheckPath`) |
| SIGTERM: API | uvicorn handles SIGTERM and drains in-flight requests (`--timeout-graceful-shutdown 20`), then the lifespan closes the DB pool (`api/main.py:72-85`) |
| SIGTERM: worker | `workflow/worker.py` installs SIGTERM/SIGINT handlers: it stops claiming, lets the in-flight job reach its normal fenced finish, closes the DB pool and exits 0 (`run_worker`, `tests/test_p7_pure.py`). If the platform kills the process before the job ends, the job's 60 s lease expires and another worker reclaims it; publication stays fenced |
| Reproducible | `uv sync --frozen --no-dev`, pinned uv |

## 3. Setup runbook

Prerequisites: Neon prepared per [neon.md](neon.md) sections 1-3 (project, owner rotated, direct and pooled URLs known).

1. Push the branch containing `render.yaml`. In Render: New, Blueprint, select the repository. Render lists the three services and the group. Do not paste secrets into the repository.
2. When prompted for `sync: false` values on the Blueprint, enter in the dashboard only:
   - `orderfit-migrate` `DATABASE_URL_DIRECT`: Neon direct URL, owner login, `postgresql+psycopg://...?sslmode=require`.
   - `orderfit-api` `DATABASE_URL`: pooled URL, `orderfit_runtime`. If the logins do not exist yet, enter a temporary valid-looking placeholder and correct it after step 4.
   - `orderfit-worker` `DATABASE_URL`: pooled URL, `orderfit_worker_login`.
   - `orderfit-api` and `orderfit-worker` `ALLOWED_ORIGINS`: JSON list of the exact Vercel origins, e.g. `["https://<app>.vercel.app"]`. No wildcards, no paths (the validator rejects them: `configuration.py:44-53`).
3. Let the first sync finish. The API and worker will fail to start until the schema and logins exist; that is expected.
4. Run the migration job: `orderfit-migrate`, Trigger Run. Then provision the logins ([neon.md](neon.md) 2.1) and run the verification SQL.
5. Restart/redeploy `orderfit-api`, then `orderfit-worker`. Confirm `GET https://<api-host>/health` returns `{"status":"ok"}` and the worker log shows no startup exception.
6. Set `API_INTERNAL_URL` in Vercel to the API's `https://<service>.onrender.com` URL and deploy the web app ([vercel.md](vercel.md) section 4). Add the Vercel origin to `ALLOWED_ORIGINS` first.
7. Smoke test per vercel.md section 4, including a durable evaluation to prove the worker claims and finishes a job.

Optional live LLM: set `LLM_MODE=live` plus `OPENAI_API_KEY` and `OPENAI_MODEL` on the services that need it, in the dashboard only. The worker runs provider-backed extraction, so it needs them too. Startup fails clearly if `live` lacks either value.

Routine release: run `orderfit-migrate` (if there are new revisions), then deploy API and worker manually. For a non-backward-compatible schema change, stop the worker, migrate, then deploy both.

## 4. Free tier, sleep and the worker lease

| Aspect | Effect |
|---|---|
| Render **free web service** | Spins down after about 15 minutes without inbound traffic; the next request has a cold start of tens of seconds. The Vercel proxy request may time out or the first page may fail while the API wakes. Disk is **ephemeral** (see section 5). Not suitable for the persistent-disk configuration in `render.yaml`. |
| Render **worker** | There is no free worker type. A worker must run on a paid plan. |
| Lease timing (plan 9.2) | Lease 60 s, heartbeat every 15 s (`worker.py:108`, `configuration.py` fixes `lease_seconds=60`, `heartbeat_seconds=15`). A worker that stops (sleep, deploy, crash) leaves its running job with an unexpired lease; another worker reclaims it only after the lease expires (`operation_claim` selects `running` rows whose `lease_expires_at` has passed). So each interruption delays that job by up to ~60 s, and fenced completion prevents a resumed stale worker from publishing. |
| Sleep implications | A sleeping worker never claims queued jobs, so evaluations stay `queued` indefinitely and the UI keeps polling. A technical delay is not a financial verdict, but the user sees no progress. |

Recommendation: run `orderfit-api` and `orderfit-worker` on an always-on paid plan (`starter` or higher) for any real use. Use the free web tier only for a demo where you accept cold starts, and then still run a paid always-on worker, or accept that nothing runs between visits. Keep a single worker instance: the lease/fencing design supports more, but that has not been tested hosted.

## 5. Document storage

The API stores uploaded documents on local disk under `DOCUMENT_DIR` and database rows hold their hashes (`backend/orderfit/store/documents.py`). The plan assumes a persistent volume shared by API and worker on one host (plan 12.3, 13.2); object storage is a later migration.

On Render:

- **Free web services have an ephemeral filesystem.** Every restart, redeploy or sleep/wake discards files written after build. Uploaded documents would be lost while their database rows (and hashes) survive, which breaks link integrity: downloads fail and stored evidence cannot be re-verified. Do not use the free tier with real uploads.
- **A persistent disk** (paid, `disk:` in `render.yaml`, mounted at `/app/var`, `DOCUMENT_DIR=/app/var/documents`) survives restarts and deploys. Consequences: it attaches to **one** service instance, so the web service cannot scale beyond one instance and deploys of a service with a disk stop the old instance before starting the new one (brief downtime); Render snapshots it daily, with restores replacing the disk contents (check the plan's snapshot behaviour).
- **The worker cannot read the API's disk.** Render disks cannot be shared between services. Jobs that read uploaded files (`extract` via `run_extract`, `csv_preview` via `handle_csv_preview`, `workflow/worker.py:170-191`) will fail on the worker with its own empty `DOCUMENT_DIR`. Jobs that use only database rows (evaluate, what-if, draft, reply per `worker.py:115-166`) are unaffected. This is a **blocker for document-driven workflows** in the split topology until the backend gains shared storage (object storage) or a single-service mode. Until then run with `LLM_MODE=off` and manual input, or accept that extraction is unavailable.
- **Non-root versus disk ownership (unverified).** The image runs as uid 10001 and creates `/app/var/documents` at build time, but mounting a disk over `/app/var` replaces that directory. If the mount is root-owned, `PrivateDocuments` fails at startup (`documents.py:15`) and the API exits. Fix if observed: an entrypoint that `chown`s the mount and then drops privileges, or `RUN`-time user alignment; do not simply run the app as root.
- **Backups.** Render's disk snapshots are not coordinated with Neon PITR, so a restore can mismatch DB rows and files. Additionally copy the directory off-host (for example `tar` over SSH to encrypted storage) at the same time as the database dump ([neon.md](neon.md) 8). A restore drill must verify document SHA-256 values against the database.

## 6. Observability and readiness

- Health: `/health` is liveness only. `healthCheckPath` is `/ready`, which returns 200 only when the API's database login is restricted (non-owner, non-superuser), the schema revision matches the code and the document directory is writable; otherwise 503 with booleans only. Its `worker` field reports whether the job queue is being drained (no claimable job older than five minutes); it is informational and does not gate readiness, because the worker is a separate service. A green check is still not proof of a complete business workflow.
- Logs: Render captures stdout/stderr. Do not enable request-body logging; never log tokens or URLs.
- Rate limiting sees proxy addresses (vercel.md section 5). Proxy trust is explicit: `TRUSTED_PROXY_IPS` (JSON list, default `[]`) is the only source of trusted forwarders; with the default, forwarded headers are ignored (uvicorn's implicit loopback trust is disabled) and the source address is Render's load balancer, shared by all users. Auth throttles are split: per account `AUTH_ACCOUNT_LIMIT` (default 15 per 15 minutes) and per source `AUTH_SOURCE_LIMIT` (default 300 per 15 minutes); successful verifications are not counted. To make the source the address that connected to Render (the Vercel edge for proxied traffic), set `TRUSTED_PROXY_IPS` to the CIDR range Render's proxy connects from, taken from Render's current documentation or the peer address seen in the service's logs; do not use `*`, because the public `onrender.com` URL is directly reachable and `X-Forwarded-For` could then be chosen by any client. The browser's own address behind Vercel is not available without trusting Vercel's non-fixed egress ranges; that residual is accepted.
- Upload concurrency: `UPLOAD_CONCURRENCY` (default 4) and `UPLOAD_SOURCE_CONCURRENCY` (default 2) bound concurrent large (above 1 MiB, up to 26 MiB) upload bodies per API process; they are admitted only after a database check of session, membership and deal (vercel.md section 5).
- Upload deadlines: an admitted upload has `UPLOAD_BODY_TIMEOUT_SECONDS` (default 120) overall and `UPLOAD_IDLE_TIMEOUT_SECONDS` (default 30) between body chunks. A deadline returns a safe 408 and releases its process-local slot. Set explicit bounded values on the API service rather than relying on a platform request timeout.
- API documentation: `EXPOSE_API_DOCS=false` is the deployed default; it disables `/docs`, `/redoc` and `/openapi.json`. The application can still build its in-process OpenAPI schema for contract export and tests. Enable it only on an authenticated/private diagnostic environment, never as a substitute for API authorization.

## 7. Secrets

All secrets live only in the Render and Neon dashboards. `render.yaml`, `.env.example` files and docs carry variable names only. `SESSION_SECRET` and `ACCOUNT_FINGERPRINT_KEY` are generated by Render on first creation and are not regenerated on later syncs; if `generateValue` in the group is not honoured, set two distinct 32+ character values by hand in the group. The previously committed Neon owner credential must be rotated before real data is hosted (neon.md section 9).

## 8. Deployment checklist

- [ ] Neon checklist ([neon.md](neon.md) section 10) complete.
- [ ] `render.yaml` Blueprint synced; `orderfit-api` and `orderfit-worker` on paid always-on plans; autoDeploy off.
- [ ] `DATABASE_URL_DIRECT` exists only on `orderfit-migrate`; neither runtime service has it.
- [ ] Migration job succeeded; logins provisioned; verification SQL clean.
- [ ] API `ALLOWED_ORIGINS` equals the exact Vercel production origin; `COOKIE_SECURE=true`.
- [ ] `/health` OK; worker log clean; a durable evaluation completes end to end.
- [ ] Document storage decision recorded (persistent disk and its limits, or uploads disabled/unsupported).
- [ ] Vercel `API_INTERNAL_URL` set; `NEXT_PUBLIC_API_URL` unset; smoke tests passed.
- [ ] Restore drill performed ([neon.md](neon.md) 8.4) before claiming recoverability.
- [ ] `/ready` returns 200 on the deployed API (it is the configured health check).

## 9. Unverified hosted gates

Unverified until run on Render and a disposable Neon branch (plan 13.3, 14 P8):

1. The Blueprint syncs as written (field names such as `dockerContext`, group `generateValue`, `type: cron` with `dockerCommand`, disk on a docker web service) against the current Render schema.
2. The image builds on Render (apt `tini` install, `uv sync --frozen`) and the API binds the injected `PORT`.
3. Disk mount ownership with the non-root user (section 5).
4. Role, extension and function permissions, SSL, direct versus pooled URLs, and tenant context under the real PgBouncer ([neon.md](neon.md) section 11, gates 1-5).
5. Worker lease behaviour through deploys, restarts and sleeps; the worker's graceful `SIGTERM` path under Render's actual shutdown grace period (section 2).
6. Same-origin proxy of large uploads (25 MB) through Vercel to Render (vercel.md section 5).
7. Backup and restore of both the database and the documents (section 5; neon.md 8.4).
8. `/ready` against the hosted Neon pooled login and the mounted disk.

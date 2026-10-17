# Deploying the backend on Render

This guide covers the FastAPI API and background worker in `backend/`.
The frontend runs on Vercel (`web/`), the database on Neon.
See [Vercel deployment](vercel.md) for the frontend side and
[Neon connection review](../neon_connection_review.md) for database setup.

## 1. How requests flow

```
Browser ──https──> https://<app>.vercel.app
                      └─ /api/v1/* ──rewrite──> https://orderfit-api.onrender.com/api/v1/*

Render (API web service)                     Neon (PostgreSQL)
  ├─ uvicorn  ──DATABASE_URL──────────────> pooled runtime login
  └─ pre-deploy: alembic ──DATABASE_URL_DIRECT──> direct migrator login

Render (background worker)
  └─ orderfit.workflow.worker ──DATABASE_URL──> pooled worker login
```

The browser only ever talks to the Vercel origin. Vercel's server-side rewrite
proxies `/api/v1/*` to the Render API, keeping the session cookie first-party.

## 2. Architecture on Render

OrderFit requires **two processes** from a single Docker image:

| Render service type | Process | Database login |
|---|---|---|
| **Web Service** (`orderfit-api`) | `uvicorn orderfit.api.main:app` | `orderfit_runtime` via `DATABASE_URL` |
| **Background Worker** (`orderfit-worker`) | `python -m orderfit.workflow.worker` | `orderfit_worker_login` via `DATABASE_URL` |

Both share the same `backend/Dockerfile`. The worker overrides the image's CMD
via `dockerCommand` in `render.yaml`.

### Persistent storage

Phase 4 document ingestion stores uploaded files on disk by content hash.
Render's container filesystem is **ephemeral** — files are lost on every deploy.
Both services mount a [Render Persistent Disk](https://docs.render.com/disks)
at `/var/data/orderfit` (1 GB default, adjustable in `render.yaml`).

> [!IMPORTANT]
> If the API and worker need to read each other's uploaded files (e.g. the worker
> extracts a document the API accepted), they must share the same disk. Render
> does not support sharing a disk between two services. The current design works
> because uploads are written by the API and read by the worker through
> PostgreSQL metadata — the actual file bytes are stored in Neon-backed
> `document_content` rows for cross-service access, with the local disk used
> as a staging area. If this changes, consider an object storage service instead.

## 3. Prerequisites

Before deploying to Render, ensure:

1. **Neon database is set up** with migrations applied through at least
   `0008_p6_execution` and runtime logins provisioned
   (see [Neon connection review](../neon_connection_review.md)).
2. **Neon owner password is rotated** if previously committed to Git
   (commit `eb5758b`).
3. **Vercel frontend is deployed** with `API_INTERNAL_URL` ready to point at
   the Render API URL.

## 4. Deploy with the Render Blueprint

The repository includes [`render.yaml`](../../render.yaml), a
[Render Blueprint](https://docs.render.com/blueprint-spec) that declares both
services, their environment variables, disks and the pre-deploy migration command.

### Step 1: Create the Blueprint Instance

1. Go to the [Render Dashboard](https://dashboard.render.com/).
2. Click **New** → **Blueprint Instance**.
3. Connect the `md-sazid9089/Order_Fit` repository, branch `deployment`.
4. Render detects `render.yaml` and shows the two services.

### Step 2: Set secret environment variables

Variables marked `sync: false` in `render.yaml` must be set manually in the
Render dashboard for each service. **Never commit these values.**

#### API service (`orderfit-api`)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://<runtime_user>:<password>@<neon-pooler-host>/<db>?sslmode=verify-full&sslrootcert=system` | Restricted runtime login |
| `DATABASE_URL_DIRECT` | `postgresql+psycopg://<migrator>:<password>@<neon-direct-host>/<db>?sslmode=verify-full&sslrootcert=system` | Owner login; used only during pre-deploy migration |
| `SESSION_SECRET` | ≥ 32 random chars | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `ACCOUNT_FINGERPRINT_KEY` | ≥ 32 random chars, different from SESSION_SECRET | Same generation command |
| `ALLOWED_ORIGINS` | `["https://orderfit.vercel.app"]` | Exact Vercel production origin |
| `OPENAI_API_KEY` | (empty or your key) | Only needed when `LLM_MODE=live` |

#### Worker service (`orderfit-worker`)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://<worker_user>:<password>@<neon-pooler-host>/<db>?sslmode=verify-full&sslrootcert=system` | Worker login (not the API runtime login) |
| `SESSION_SECRET` | Same value as API | Shared for token validation |
| `ACCOUNT_FINGERPRINT_KEY` | Same value as API | Shared for fingerprint checks |
| `ALLOWED_ORIGINS` | Same value as API | Worker validates configuration at startup |
| `OPENAI_API_KEY` | (empty or your key) | Only when `LLM_MODE=live` |

### Step 3: Deploy

Click **Apply** in the Blueprint Instance. Render will:

1. Build the Docker image from `backend/Dockerfile`.
2. Run `alembic upgrade head` (pre-deploy command) with `DATABASE_URL_DIRECT`.
3. Start the API web service on port 8000.
4. Build and start the worker service.

### Step 4: Update Vercel

In the Vercel project settings, set:

```
API_INTERNAL_URL = https://orderfit-api.onrender.com
```

(Use the actual URL shown in the Render dashboard for the `orderfit-api` service.)

### Step 5: Smoke test

- [ ] `https://orderfit-api.onrender.com/health` returns `{"status": "ok"}`.
- [ ] Vercel app at `https://<app>.vercel.app` shows the connection indicator as connected.
- [ ] Sign up and sign in work; the session cookie survives a page reload.
- [ ] Creating an order and running an evaluation completes (worker processes the job).
- [ ] A direct cross-origin `POST` to the Render URL is rejected (`403 CSRF_REJECTED`).

## 5. Manual deploy (without Blueprint)

If you prefer to create services manually instead of using the Blueprint:

### API Web Service

| Setting | Value |
|---|---|
| Name | `orderfit-api` |
| Environment | Docker |
| Repo | `md-sazid9089/Order_Fit` |
| Branch | `deployment` |
| Dockerfile Path | `./backend/Dockerfile` |
| Docker Context | `./backend` |
| Pre-Deploy Command | `alembic upgrade head` |
| Health Check Path | `/health` |
| Plan | Starter ($7/mo) or higher |
| Disk | Mount `/var/data/orderfit`, 1 GB |

Set environment variables as listed in Step 2 above.

### Background Worker

| Setting | Value |
|---|---|
| Name | `orderfit-worker` |
| Environment | Docker |
| Repo | `md-sazid9089/Order_Fit` |
| Branch | `deployment` |
| Dockerfile Path | `./backend/Dockerfile` |
| Docker Context | `./backend` |
| Docker Command | `python -m orderfit.workflow.worker` |
| Plan | Starter ($7/mo) or higher |
| Disk | Mount `/var/data/orderfit`, 1 GB |

Set environment variables as listed in Step 2 above.

## 6. Known limits and operational notes

- **Rate limiting sees Render internal IPs.** Sign-in throttling keys on
  `request.client.host`, which behind Render's proxy is an internal address.
  Configure uvicorn with `--proxy-headers` and `--forwarded-allow-ips` set to
  Render's proxy ranges only (the Dockerfile already includes `--proxy-headers`).
- **Render free tier is unsuitable.** Free web services spin down after 15
  minutes, causing 50+ second cold starts that will time out Vercel's proxy
  rewrite. The worker also needs to run continuously. Use at least the Starter
  plan.
- **Persistent disk is per-service.** Render does not share disks between
  services. If the worker needs direct filesystem access to API-uploaded files,
  use a shared object storage service (e.g. Cloudflare R2 or AWS S3) instead.
- **Preview environments.** Render Blueprint supports
  [preview environments](https://docs.render.com/preview-environments) for pull
  requests. Each preview gets its own URL. Add preview API URLs to Vercel
  preview deployments' `API_INTERNAL_URL` and to the API's `ALLOWED_ORIGINS`.
- **Log drain.** Render supports log drains to external services. Enable this
  for production monitoring. Never log credentials, session tokens or financial
  payloads.
- **Credential rotation.** Rotate `SESSION_SECRET` and
  `ACCOUNT_FINGERPRINT_KEY` by setting new values in the Render dashboard and
  redeploying. Existing sessions will be invalidated. Rotate Neon passwords
  through Neon's console and update the Render environment variables.
- **Demo pages.** The same caveat from [Vercel deployment](vercel.md#5-known-limits-and-follow-ups)
  applies: several frontend pages show hard-coded demo data. Do not present
  them as working features.


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

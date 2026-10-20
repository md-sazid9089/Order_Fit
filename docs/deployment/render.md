# Deploying the backend on Render

The Blueprint runs migrations before the API starts. Render keeps the migration
secret on the API service so its pre-deploy command can use it; the custom API
command removes it before starting the long-running server process. API and worker
use separate restricted database logins.
Documents use one private external S3-compatible bucket with separate API and worker
credentials. Render disks are not shared between services. The Blueprint does not
provision the bucket or its access policies, and hosted acceptance remains required.

This guide covers the FastAPI API and background worker in `backend/`.
The frontend runs on Vercel (`web/`), the database on Neon.
See [Vercel deployment](vercel.md) for the frontend side and
[Neon connection review](../evidence/reports/neon_connection_review.md) for database setup.

## 1. How requests flow

```
Browser ──https──> https://<app>.vercel.app
                      └─ /api/v1/* ──rewrite──> https://orderfit-api.onrender.com/api/v1/*

Render (API web service)                     Neon (PostgreSQL)
  ├─ API process ──DATABASE_URL────────────> pooled API runtime login
  └─ pre-deploy: alembic ──DATABASE_URL_DIRECT──> direct migrator login

Render (background worker)
  └─ worker process ──DATABASE_URL─────────> pooled worker login

API and worker ──private S3-compatible store──> source document bytes
```

The browser only ever talks to the Vercel origin. Vercel's server-side rewrite
proxies `/api/v1/*` to the Render API, keeping the session cookie first-party.

## 2. Architecture on Render

OrderFit requires **two processes** from a single Docker image:

| Render service type | Process | Database login |
|---|---|---|
| **Web Service** (`orderfit-api`) | `python -m orderfit.api.serve` after removing `DATABASE_URL_DIRECT` | `orderfit_runtime` via `DATABASE_URL` |
| **Background Worker** (`orderfit-worker`) | `python -m orderfit.workflow.worker` | `orderfit_worker_login` via `DATABASE_URL` |

Both share the same `backend/Dockerfile`. The worker overrides the image's CMD
via `dockerCommand` in `render.yaml`.

### Private document storage

Render disks are private to one service and cannot back this API/worker pair.
The Blueprint therefore selects the backend's existing S3-compatible adapter.
Configure one private bucket and distinct API and worker credentials in Render.
Both processes must access the same generated business/deal/document keys.
Their policies also need the `_orderfit/readiness/*` canary path for storage
readiness checks. Grant `PutObject`, `GetObject`, and `DeleteObject` only for
`_orderfit/readiness/*` and the three-UUID-deep document keys. Bucket listing,
public ACLs and public access are unnecessary. Block public access and require
TLS; do not put document bytes in PostgreSQL.

For a provider other than AWS, set the same HTTPS `DOCUMENT_S3_ENDPOINT_URL`
on both services. The endpoint path, query and embedded credentials are rejected
by runtime validation. The repository's adapter tests verify request behavior;
they do not verify a provider's bucket policy or restore procedure.

## 3. Prerequisites

Before deploying to Render, ensure:

1. **Neon database and logins are prepared.** The current source schema head is
   `0023_account_access`; the pre-deploy migration advances the selected database.
   Use separate non-owner API/worker logins and a migration-only direct login.
   (see [Neon connection review](../evidence/reports/neon_connection_review.md)).
2. **Neon owner password is rotated** if previously committed to Git
   (commit `eb5758b`).
3. **Vercel frontend is deployed** with `API_INTERNAL_URL` ready to point at
   the Render API URL.
4. **Private object storage is ready.** Create the bucket outside this Blueprint,
   block public access, enable encryption, and issue separate API/worker keys with
   the required restricted object permissions. Verify a synthetic cross-service
   write/read/delete and the configured retention/backup plan before production.

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
| `DATABASE_URL_DIRECT` | `postgresql+psycopg://<migrator>:<password>@<neon-direct-host>/<db>?sslmode=verify-full&sslrootcert=system` | Migration-only login; configured on API service for pre-deploy, removed before Uvicorn starts |
| `SESSION_SECRET` | ≥ 32 random chars | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `ACCOUNT_FINGERPRINT_KEY` | ≥ 32 random chars, different from SESSION_SECRET | Same generation command |
| `ALLOWED_ORIGINS` | `["https://orderfit.vercel.app"]` | Exact Vercel production origin |
| `OPENAI_API_KEY` | (empty or your key) | Only needed when `LLM_MODE=live` |
| `DOCUMENT_S3_BUCKET`, `DOCUMENT_S3_REGION` | Same private bucket and region used by worker | Required for S3 storage |
| `DOCUMENT_S3_ENDPOINT_URL` | Empty for AWS; otherwise the provider's HTTPS endpoint | Same value on API and worker |
| `DOCUMENT_S3_ACCESS_KEY_ID`, `DOCUMENT_S3_SECRET_ACCESS_KEY` | API-specific credentials | Keep private; grant only required object actions and key paths |

#### Worker service (`orderfit-worker`)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://<worker_user>:<password>@<neon-pooler-host>/<db>?sslmode=verify-full&sslrootcert=system` | Worker login (not the API runtime login) |
| `SESSION_SECRET` | Same value as API | Shared for token validation |
| `ACCOUNT_FINGERPRINT_KEY` | Same value as API | Shared for fingerprint checks |
| `ALLOWED_ORIGINS` | Same value as API | Worker validates configuration at startup |
| `OPENAI_API_KEY` | (empty or your key) | Only when `LLM_MODE=live` |
| `DOCUMENT_S3_BUCKET`, `DOCUMENT_S3_REGION` | Same private bucket and region used by API | Required for S3 storage |
| `DOCUMENT_S3_ENDPOINT_URL` | Empty for AWS; otherwise the provider's HTTPS endpoint | Same value on API and worker |
| `DOCUMENT_S3_ACCESS_KEY_ID`, `DOCUMENT_S3_SECRET_ACCESS_KEY` | Worker-specific credentials | Keep separate from API credentials; grant only required object actions and key paths |

### Step 3: Deploy

Click **Apply** in the Blueprint Instance. Render will:

1. Build the Docker image from `backend/Dockerfile`.
2. Run `alembic upgrade head` (pre-deploy command) with `DATABASE_URL_DIRECT`.
3. Start the API web service on Render's `PORT`; the health check uses `/health`.
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
| Docker Command | `/bin/sh -ec 'unset DATABASE_URL_DIRECT; exec python -m orderfit.api.serve'` |
| Health Check Path | `/health` (liveness; use `/ready` for acceptance checks) |
| Plan | Starter ($7/mo) or higher |
| Document storage | Private external S3-compatible bucket; no Render disk |

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
| Document storage | Same private external bucket, with separate worker credentials; no Render disk |

Set environment variables as listed in Step 2 above.

## 6. Known limits and operational notes

- **Proxy trust requires the actual network path.** The API honors forwarded
  addresses only from entries in `TRUSTED_PROXY_IPS`; it never trusts all peers.
  Verify the real proxy addresses on the selected Render/Vercel route before
  configuring this setting. Without verified proxy ranges, source-based throttling
  sees the direct peer and hosted rate-limit acceptance remains open.
- **Render free tier is unsuitable.** Free web services spin down after 15
  minutes, causing 50+ second cold starts that will time out Vercel's proxy
  rewrite. The worker also needs to run continuously. Use at least the Starter
  plan.
- **Object storage is external.** Render disks are per-service. The S3 adapter
  uses separate process credentials, but this manifest cannot establish the
  provider's private bucket policy, versioning, backup retention, or restore.
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
- **Demo views.** The landing-page simulator is illustrative; use saved orders for
  persisted evaluation and sandbox workflows.


## Stress remediation reconciliation — 16 October 2026

Current required sole revision is `0019_merge_passkey_roles`, which joins
`0018_passkey_mfa` and `0017_merge_heads` (the Neon role branch). `/ready` requires an
unexpired global worker heartbeat as well as restricted DB/schema/storage checks;
`backlog_seconds` is separate. Keep process liveness `/health` for service restart
monitoring so a worker outage does not restart a healthy API. Reserve one extra
restricted DB connection per worker for liveness; do not inject migration access.
See the [integration contract](../contracts/stress-remediation.md),
[current evidence](../evidence/reports/backend_stress_remediation_2026-10-16.md) and
[executable external acceptance procedures](external-acceptance.md).
Hosted acceptance and historical credential rotation remain unverified.

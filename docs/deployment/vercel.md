# Deploying the web app to Vercel

This guide covers the Next.js frontend in `web/`. The FastAPI API, the background worker and PostgreSQL are **not** deployed to Vercel. Host them separately (container platform plus Neon or another PostgreSQL) and give Vercel the API's public HTTPS URL.

## 1. How requests flow

```
Browser ──https──> https://<app>.vercel.app
                      ├─ pages, static assets             (Vercel)
                      ├─ /api/health                       (Next route → API /health, server-side)
                      └─ /api/v1/*  ──rewrite (proxy)──>  https://<api-host>/api/v1/*   (FastAPI)
```

The browser only ever talks to the Vercel origin, which is deliberate. The API's session cookie is `HttpOnly`, `SameSite=Lax`, with no `Domain`. A browser would not send it on a cross-site `fetch` from `*.vercel.app` to a different API domain. The rewrite in `web/next.config.ts` keeps the cookie first-party with no change to the backend's cookie policy.

## 2. Vercel project settings

| Setting | Value |
|---|---|
| Git repository | this repo, branch `deployment` (or `main` once merged) |
| **Root Directory** | `web` |
| Framework preset | Next.js, pinned by `web/vercel.json`. A project created with `vercel project add` defaults to "Other" and then serves 404 for every page |
| Install / Build command | defaults (`npm ci` from `package-lock.json`, `next build`) |
| Node.js version | 22.x |

### Environment variables (Production and Preview)

| Name | Value | Notes |
|---|---|---|
| `API_INTERNAL_URL` | `https://<api-host>` (no trailing slash) | **Required.** The build fails with a clear error if it is missing on Vercel. It is used as the proxy target and by `/api/health`. It is server-only and not exposed to the browser |
| `NEXT_PUBLIC_API_URL` | **leave unset** | Setting it makes the browser call the API directly, cross-site, and sign-in then breaks |

`output: "standalone"` is applied only outside Vercel (for `web/Dockerfile`). On Vercel the platform's own Next.js adapter is used.

## 3. Backend settings required for this deployment

These are set on the API (and worker) host, not on Vercel:

| Variable | Value | Why |
|---|---|---|
| `ALLOWED_ORIGINS` | JSON list of the **exact** browser origins, e.g. `["https://orderfit.vercel.app"]` | The API checks `Origin` and the CSRF token on every write and on `/auth/csrf`. Any origin not listed gets `403 CSRF_REJECTED` |
| `COOKIE_SECURE` | `true` | Cookies over HTTPS only |
| `DATABASE_URL` | restricted runtime login (never the migration owner). On Render, the API and the worker each set their own `DATABASE_URL`; `WORKER_DATABASE_URL` is only read by the local `orderfit.runtime` launcher | See `docs/deployment/render.md` and `docs/evidence/reports/neon_connection_review.md` |

**Preview deployments.** Every preview gets its own URL. A preview can only sign in if its origin is in `ALLOWED_ORIGINS`. Options:
- assign a stable preview domain and list it; or
- accept that previews show public pages only.

Never use a wildcard origin.

## 4. Deploy steps

1. Deploy and migrate the backend first, following [render.md](render.md) and [neon.md](neon.md). The Render Blueprint's pre-deploy command runs `alembic upgrade head`; a manual deployment needs an equivalent migration step using the migration-only credential, outside the API/worker process. Configure private shared object storage and restricted API/worker logins. Confirm `https://<api-host>/health` responds.
2. Set `ALLOWED_ORIGINS` to include the production Vercel domain, and set `COOKIE_SECURE=true`.
3. In Vercel, import the repository, set Root Directory `web`, add `API_INTERNAL_URL`, and deploy.
4. Smoke test on the Vercel URL:
   - [ ] The connection indicator shows the API reachable (`/api/health` returns `{"connected": true}`).
   - [ ] Sign up or sign in works, and the session survives a page reload (cookie set on the Vercel domain).
   - [ ] On `/deals`: create an order, confirm it, and run an evaluation. The result appears after polling and survives a reload.
   - [ ] A write sent with a different `Origin` is rejected (403).
   - [ ] Sign out clears the session.

## 5. Known limits and follow-ups

- **Sign-in rate limiting and proxy addresses.** Authentication throttles (`backend/orderfit/services/identity.py`) use separate keys, each per 15 minutes and counted before the password is verified: the account (`AUTH_ACCOUNT_LIMIT`, default and maximum 15), the step-up session (same limit) and the source address (`AUTH_SOURCE_LIMIT`, default 300, range 15-100000). A verified sign-in, password change or step-up is refunded, so only failed guesses (and sign-ups) count. The account key stops password guessing for one account from any number of addresses; the source key is only a coarse ceiling. The source is uvicorn's client address, which honours `X-Forwarded-For` only from proxies listed in `TRUSTED_PROXY_IPS` (JSON list of IPs/CIDRs, default `[]`; uvicorn uses the right-most address that is not a listed proxy).
  - With the default `[]` the source is the direct peer: behind the Vercel rewrite (and the hosting platform's own load balancer) that is a small set of shared addresses. One client making `AUTH_SOURCE_LIMIT` failed attempts within 15 minutes therefore blocks sign-in for everyone arriving through the same address until the window ends; it cannot lock out other accounts below that ceiling. Raise `AUTH_SOURCE_LIMIT` if legitimate traffic approaches it.
  - To key on a more specific address, list the platform proxies that connect to the API, for example the API host's own load-balancer range (see render.md section 6). The source then becomes the address that connected to that load balancer: the Vercel edge egress address for proxied requests, or the real client for direct requests. Getting the browser's address through Vercel would also require trusting Vercel's egress addresses, which are not a fixed published list; do not list `*` or broad ranges, because anyone who can reach the API directly could then choose their source key by sending `X-Forwarded-For` (that weakens only the coarse source ceiling, not the account limit).
  - Residual: behind Vercel, per-source throttling stays per edge address rather than per browser. Verify the platform's current proxy addresses in its documentation and request logs before setting `TRUSTED_PROXY_IPS`; this guide does not assert specific ranges.
- **Upload size.** Documents can be up to 25 MB, and they pass through the Vercel rewrite. Verify a large upload on the deployed app before relying on it. If the platform's proxy body limit is lower, route uploads to the API on a same-site subdomain (e.g. `api.<your-domain>` with the app on `<your-domain>`) instead.
- **Upload admission.** The API receives an upload body above 1 MiB only after its body-limit middleware has verified the session, the caller's current `prepare` membership of that business and the deal from the database, and obtained an upload slot: at most `UPLOAD_CONCURRENCY` (default 4) large uploads per API process and `UPLOAD_SOURCE_CONCURRENCY` (default 2) per source address; excess requests get `429 UPLOAD_CAPACITY` (retryable) before any body is read. Unauthenticated or non-member requests keep the 1 MiB limit. Residual: FastAPI still spools an authorized member's multipart body before the route's CSRF and version checks, and behind a shared proxy address the per-source slot count is shared by everyone using that address.
- **Screens and what backs them.** Signed-in screens read and write the real API through the same-origin proxy and need a session:
  - Persisted workflow: `/deals`, `/deals/new`, `/deals/[id]` (review, confirm, evaluate, decision export), `/deals/[id]/documents` (upload, extraction, field resolution, baseline CSV import), `/deals/[id]/negotiate` and `/deals/[id]/reply` (negotiation preparation, approval bundles and sandbox execution), `/deals/customers`, `/deals/sources` and the legacy redirects `/deals/[id]/confirm` and `/deals/new/validate`.
  - Business administration: `/cash-flow`, `/financing`, `/risk-constraints`, `/payees`, `/audit-log`, `/users`, `/settings` and `/admin` (a tenant-scoped capabilities and runtime view; there is no cross-tenant administration). Their availability depends on the signed-in member's role, which the API enforces.
  - Public: `/` (landing page, which includes a browser-only order simulator whose figures are illustrative and are not produced by the OrderFit engine), `/auth/signin`, `/auth/signup`, `/auth/invitations/accept` and `/api/health`.
  - Not available: `/orders` and `/sandbox` are signed-in placeholders that state the feature is not available in this release and link to saved orders. The former demo routes (`/admin/*` sub-pages and `/ui-showcase`) are removed.

  Execution is sandbox-only: no email, bank, payment or lender is contacted.
- **Session expiry.** Any API response of 401 (other than a wrong password at sign-in) clears cached data and pending commands and sends the user to `/auth/signin` with a "session expired" notice. Switching business clears cached data but keeps pending retry keys, which are bound to the business through the request path.
- **Security headers.** Every response carries `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` (`web/next.config.ts`). There is deliberately no script CSP: Next.js inline bootstrap scripts need per-request nonces, which has not been verified for this build.
- **Credentials.** A Neon owner URL was committed in Git history (commit `eb5758b`; files removed later). Rotate the owner password before any hosted deployment uses that database. See `docs/evidence/reports/neon_connection_review.md`.

## 6. Local development is unchanged

- **Default:** with `web/.env.local` unset or `API_INTERNAL_URL=http://localhost:8000`, `npm run dev` proxies `/api/v1` to the local API. Add `http://localhost:3000` to the API's `ALLOWED_ORIGINS`.
- **Docker Compose:** `NEXT_PUBLIC_API_URL` is empty and `API_INTERNAL_URL=http://api:8000` is baked into the Next rewrite. The browser uses the host-facing web origin, while the web proxy reaches the API over the internal Compose network. API, worker and database are not published to the host and have no outbound route by default.


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

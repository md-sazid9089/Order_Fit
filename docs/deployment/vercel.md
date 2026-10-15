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
| Framework preset | Next.js (auto-detected) |
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
| `DATABASE_URL` / `WORKER_DATABASE_URL` | runtime logins (never the migration owner) | See `docs/neon_connection_review.md` |

**Preview deployments.** Every preview gets its own URL. A preview can only sign in if its origin is in `ALLOWED_ORIGINS`. Options:
- assign a stable preview domain and list it; or
- accept that previews show public pages only.

Never use a wildcard origin.

## 4. Deploy steps

1. Deploy and migrate the backend first: `alembic upgrade head` as the migrator. Then start the API and the worker with runtime credentials, and confirm `https://<api-host>/health` responds.
2. Set `ALLOWED_ORIGINS` to include the production Vercel domain, and set `COOKIE_SECURE=true`.
3. In Vercel, import the repository, set Root Directory `web`, add `API_INTERNAL_URL`, and deploy.
4. Smoke test on the Vercel URL:
   - [ ] The connection indicator shows the API reachable (`/api/health` returns `{"connected": true}`).
   - [ ] Sign up or sign in works, and the session survives a page reload (cookie set on the Vercel domain).
   - [ ] On `/deals`: create an order, confirm it, and run an evaluation. The result appears after polling and survives a reload.
   - [ ] A write sent with a different `Origin` is rejected (403).
   - [ ] Sign out clears the session.

## 5. Known limits and follow-ups

- **Sign-in rate limiting sees proxy IPs.** The API keys sign-in throttling on email plus `request.client.host`. Behind the Vercel proxy that host is a Vercel edge address, so the per-source part of the limit is shared by many users. Fixing this is a backend change. Run uvicorn with `--proxy-headers` and `--forwarded-allow-ips` set to trusted proxy addresses only, and only if the API cannot be reached except through trusted proxies. Otherwise `X-Forwarded-For` can be spoofed.
- **Upload size.** Documents can be up to 25 MB, and they pass through the Vercel rewrite. Verify a large upload on the deployed app before relying on it. If the platform's proxy body limit is lower, route uploads to the API on a same-site subdomain (e.g. `api.<your-domain>` with the app on `<your-domain>`) instead.
- **Demo pages are still in the build.** Only the `/deals` workflow, sign-in/sign-up, `/deals/sources` and `/deals/[id]/documents` use the real API. These pages show hard-coded data and simulated results:
  - `/audit-log`, `/admin/*`, `/orders`, `/users`, `/settings`, `/risk-constraints`, `/financing`, `/payees` and `/cash-flow` show hard-coded data. `/audit-log` and `/admin/*` also show simulated "verified" security results.
  - `/sandbox` and the landing-page simulator compute figures in the browser.
  - `/ui-showcase` is a component demo.

  Do not present them as working features. The negotiate and reply routes now always show "requires P5": their demo clients faked a step-up approval and were removed in this branch.
- **Credentials.** A Neon owner URL was committed in Git history (commit `eb5758b`; files removed later). Rotate the owner password before any hosted deployment uses that database. See `docs/neon_connection_review.md`.

## 6. Local development is unchanged

- **Default:** with `web/.env.local` unset or `API_INTERNAL_URL=http://localhost:8000`, `npm run dev` proxies `/api/v1` to the local API. Add `http://localhost:3000` to the API's `ALLOWED_ORIGINS`.
- **Docker Compose:** it still builds `web/` with `NEXT_PUBLIC_API_URL=http://localhost:8000`. That is direct mode, which works because both run on `localhost` (same site).

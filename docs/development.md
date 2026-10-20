# Development

OrderFit uses Python 3.12, PostgreSQL, and Node.js 22. The backend and worker
share a package; the Next.js application is in `web/`. Commit both lockfiles
when intentionally changing dependencies. Ordinary development uses frozen installs.

## Local setup

For an isolated local database, copy the root `.env.example` to an ignored `.env`.
Supply distinct API and worker runtime passwords, matching URL-encoded runtime
URLs, and distinct session and account-fingerprint secrets of at least 32 characters.
The migration credential belongs only to provisioning/migration processes.

```sh
docker compose build api
docker compose --profile setup run --rm provision
docker compose up --build
```

Provisioning migrates and creates restricted logins; it refuses existing roles.
Run it only for a new local database. Ordinary restarts omit provisioning. The
web defaults to `http://localhost:3000`; API and PostgreSQL stay internal.
`docker compose down` stops this stack while retaining its volumes.

For host development:

```sh
cd backend
uv sync --frozen --extra dev
uv run --frozen python -m orderfit.runtime api
# Separate terminal, also in backend/:
uv run --frozen python -m orderfit.runtime worker
```

The explicit launcher reads the selected ignored backend environment and forwards
only the selected process's settings. Never use a configured/shared database for
destructive tests. See [existing-Neon local setup](deployment/neon-local.md) when
that environment is intentionally selected; the commands above do not authorize a migration.

```sh
cd web
npm ci
# Copy web/.env.example to web/.env.local and set the local API target.
npm run dev
```

## Configuration

| Setting | Meaning |
|---|---|
| `DATABASE_URL` | Restricted API runtime URL; remote connections require verified TLS |
| `WORKER_DATABASE_URL` | Distinct restricted worker URL, selected by the launcher |
| `DATABASE_URL_DIRECT` | Migration process only; forbidden in API/worker environments |
| `SESSION_SECRET` | Session/CSRF secret, distinct from the account fingerprint key |
| `ACCOUNT_FINGERPRINT_KEY`, `ACCOUNT_FINGERPRINT_KEY_VERSION` | Stable, versioned account fingerprint identity |
| `ALLOWED_ORIGINS`, `COOKIE_SECURE` | Exact allowed origins; HTTPS requires secure cookies |
| `API_INTERNAL_URL` | Next.js server-side API/rewrite target; rebuild images after changing |
| `NEXT_PUBLIC_API_URL` | Leave empty for same-origin deployments |
| `LLM_MODE` | `off`, `recorded`, or explicitly configured `live`; no automatic live fallback |
| `LLM_PROVIDER` | OpenAI; FreeLLMPool is restricted to local testing |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Server-only live OpenAI settings |

The complete settings contract is [RuntimeConfiguration](../backend/orderfit/contracts/configuration.py).
Use the sanitized root, backend, and web environment templates. Never copy secrets
into documentation, browser bundles, screenshots, or test output. Account mail and
admin reads have independent default-off rollout requirements in [Deployment](deployment/README.md).

## Verification

From `backend/`:

```sh
uv run --frozen ruff check .
uv run --frozen python -m orderfit.contracts.export --check
uv run --frozen python -m alembic heads
uv run --frozen pytest -q
```

The DB fixture creates labeled disposable PostgreSQL containers and real restricted
runtime logins. It does not use application database URLs. The default suite excludes
opt-in live-provider tests; it does not run browser acceptance.

From `web/`:

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npx --no-install tsc --strict --noEmit ../docs/contracts/frontend-api.d.ts ../docs/contracts/typecheck.ts
```

From the repository root:

```sh
python docs/architecture/orderfit/fixtures/reference_engine.py --check
python docs/architecture/orderfit/fixtures/selftest.py
```

```powershell
./scripts/run-e2e.ps1
```

The browser runner creates a separate Compose project with random synthetic credentials,
isolated image tags, and external temporary evidence, then removes only that stack's
containers and volumes. `-TestPattern` selects a focused journey. Builds, DB acceptance,
browser acceptance, hosted operation, and live-model quality are separate checks.
See [AI evaluation](evaluation.md) and [external acceptance](deployment/external-acceptance.md).

To reproduce the README's four synthetic screenshots, set an absolute output path
and run the persisted sandbox journey:

```powershell
$env:E2E_SCREENSHOT_DIRECTORY = Join-Path (Get-Location) 'docs/assets/screenshots'
./scripts/run-e2e.ps1 -TestPattern 'an owner evaluates, approves, commits and compensates'
Remove-Item Env:E2E_SCREENSHOT_DIRECTORY
```

The screenshots are taken only after the relevant saved state is visible. Review
them for synthetic-only content before publishing; do not substitute a real account.

## Contributing

Work on a branch and use a reviewed pull request. CI must pass before merging.
Preserve current changes, source documents, migrations, and immutable financial evidence.
Keep one confirmed-input pipeline and one deterministic calculation boundary.
Changes that alter financial output require an engine version decision, independent
regression checks, and an explanation; never rewrite goldens merely to pass.
Record material design decisions in the existing ADR sets, with explicit supersession
links rather than renumbering records. Current source and SQL establish implementation;
historical reports establish only what was checked at their recorded snapshot.

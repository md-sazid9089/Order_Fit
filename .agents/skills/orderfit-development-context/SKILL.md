# OrderFit development context

Read root and scoped AGENTS instructions. Check the current branch, HEAD, and worktree before relying on historical reports or recovering work from another branch.

## Current implementation

- Frontend: `web/`, Next.js 16.4.1 and React 19.3.0; read the installed Next.js docs before frontend edits.
- Backend: Python 3.12, FastAPI/Pydantic, SQLAlchemy/Core, psycopg, PostgreSQL and manual Alembic/SQL migrations.
- Required source schema head: `0025_admin_read_isolation`. This describes repository migrations, not the current state of any hosted database.
- One confirmed-input pipeline and one pure deterministic financial engine serve evaluation, what-if and reply reassessment. `agent/nodes/compute.py` is the application boundary to engine analysis.
- `agent/llm.py` is the only provider boundary. OpenAI is the supported live provider; off and recorded modes never silently fall through to live calls.
- API and worker are separate processes using PostgreSQL-backed jobs, restricted runtime roles, idempotency, leases, fencing and transaction-local tenant context.
- Commercial dispatch, commitments and compensation are sandbox-only and separately approved. Account email is an independent default-off capability.
- Admin summaries use verified platform authority and bounded capability-gated reads; business details require membership. Global log access and platform mutations are unavailable.

## Navigation

| Task | Source |
|---|---|
| Setup, checks, contributions | [Development](../../../docs/development.md) |
| User journey | [Workflows](../../../docs/workflows.md) |
| Financial meaning | [Specification](../../../docs/architecture/orderfit/04-decision-engine-and-data-contracts.md) |
| API and types | [Contracts](../../../docs/contracts/README.md), `backend/orderfit/contracts/`, `web/lib/generated-api.d.ts` |
| Persistence | `backend/orderfit/store/`, `backend/migrations/sql/`, `backend/migrations/versions/` |
| Approval and recovery | `backend/orderfit/services/bundles.py`, `services/execution.py`, `workflow/execution.py` |
| Security and release limits | [Security](../../../docs/security/README.md) |
| Deployment choices | [Deployment](../../../docs/deployment/README.md) |
| Implementation evidence | [Progress record](../../../docs/backend_implementation_progress.md), [dated reports](../../../docs/evidence/reports/) |

## Evidence limits

Use the committed locks and Development commands. Database tests must use disposable targets and restricted logins; browser acceptance uses `scripts/run-e2e.ps1`. A health response, mock, timer or local storage value does not establish a persisted business operation. Hosted/provider quality, scoped object-storage credentials, durable restore/retention, historical credential rotation and account-mail rollout require separate acceptance. Never infer hosted state from local repository evidence or select a shared database just because a URL is available.

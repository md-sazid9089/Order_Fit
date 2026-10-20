---
name: orderfit-development-context
description: Resume OrderFit using current contracts, source locations, safety boundaries, and verification pointers.
---

# OrderFit development context

Read root and scoped AGENTS instructions. Check branch, HEAD, and changes before
relying on historical evidence or recovering work from another branch.

## Implementation

- Frontend: `web/`, Next.js 16.4.1/React 19.3.0; consult installed Next docs.
- Backend: Python 3.12, FastAPI/Pydantic, SQLAlchemy/Core, psycopg, manual SQL/Alembic.
- Required source schema head: `0023_account_access`; this is not a deployed-DB claim.
- Saved review feeds immutable confirmed snapshots. Evaluation, what-if, and reply
  reassessment share `agent/nodes/compute.py` and the pure deterministic engine.
- API/worker are separate processes with PostgreSQL jobs, restricted runtime roles,
  idempotency, leases, fencing, and transaction-local tenant context.
- Only `agent/llm.py` invokes providers. OpenAI is the hosted path; FreeLLMPool is
  local-loopback/filesystem testing only. Off/recorded never silently call live.
- Commercial dispatch/commit/compensation are sandbox-only and separately approved.
  Account mail is an independent default-off backend capability; its frontend,
  provider, and operational rollout remain separate from commercial execution.
- Admin summaries require verified platform authority and backend capabilities;
  business details still require membership. Global logs/mutations are unavailable.

## Navigation

| Task | Source |
|---|---|
| Setup, checks, contributions | [Development](../../../docs/development.md) |
| Current user journey | [Workflows](../../../docs/workflows.md) |
| Financial meaning | [Specification](../../../docs/architecture/orderfit/04-decision-engine-and-data-contracts.md) |
| API/types | [Contracts](../../../docs/contracts/README.md), `backend/orderfit/contracts/`, `web/lib/generated-api.d.ts` |
| Persistence | `backend/orderfit/store/`, `backend/migrations/sql/`, `backend/migrations/versions/` |
| Approval/recovery | `services/bundles.py`, `services/execution.py`, `workflow/execution.py` |
| Security and release limits | [Security](../../../docs/security/README.md) |
| Deployment choices | [Deployment](../../../docs/deployment/README.md) |

## Evidence

Use the committed locks and Development commands. DB tests verify disposable
targets and restricted logins; browser acceptance uses `scripts/run-e2e.ps1`.
Never infer business success from health, timers, localStorage, mocks, or build success.

[Implementation evidence](../../../docs/backend_implementation_progress.md) and
[dated reports](../../../docs/evidence/reports/) establish only their executed scope.
Hosted/provider quality, scoped object credentials, durable restore/retention,
historical credential rotation, and account-mail rollout need separate acceptance.
Render Blueprint config uses private S3-compatible document storage and removes the
migration URL from the API process. Provider policy, hosted acceptance and joint
restore still require operator verification. Never select a shared DB just because a URL exists.

Keep this context short. Update material schema/path/decision/blocker changes;
put detailed evidence in the existing implementation record. Do not append session
narratives or duplicate backend financial/security instructions.

---
name: orderfit-development-context
description: Resume OrderFit development with current phase status, decisions, code locations and evidence pointers. Maintain this handoff when material development context changes.
---

# OrderFit development context

Snapshot: **16 October 2026**, P0–P8 implementation is on `main` at `8e7d0ed`; round-3/4 audit repairs and shared-storage/E2E remediation remain uncommitted. Check today's branch/diff
before relying on this snapshot. Repository root relative to this file: `../../..`.

## Read only what the task needs

- Follow [root instructions](../../../AGENTS.md) and the applicable
  [backend](../../../backend/AGENTS.md) or [web](../../../web/AGENTS.md) instructions.
- For phase work, read the [plan](../../../docs/initial_backend_implementation_plan.md)
  and latest relevant [progress entries](../../../docs/backend_implementation_progress.md).
  Progress is not strictly chronological; later remediation supersedes old gaps.
- Code/SQL establishes implementation; contracts/plan establish intent; progress
  records evidence. Investigate disagreements instead of trusting a completion label.

## Current status

OrderFit assesses whether an SME can afford an order, comparing deposits,
supplier extensions and term loans. The deterministic engine owns financial
figures; OpenAI proposes evidence-backed facts/language; humans approve actions.

| Phase | Recorded state |
|---|---|
| P0–P2 | Contracts, foundation and deterministic engine gates passed locally. |
| P3 | Latest remediation records **local gate passed**, superseding partial commit `c03b2eb`. Per-option scans, provenance, exports, process recovery and persisted UI were added afterward. |
| P4 | Documents, guarded extraction, field review and CSV import are integrated. A shared S3 adapter now supports split API/worker storage; only provider-stub tests ran. Independent final acceptance and live OpenAI/model evaluation remain pending. |
| P5 | Local preparation gate passed: isolated forks, exact reviewed drafts, human-reviewed customer/supplier/lender replies, attestations and persisted session UI. All outgoing effects remain disabled. |
| P6 | Local gate passed: exact-bundle approval, session-bound step-up, fenced durable execution, sandbox effects, serialized commitment gate with engine-derived baseline projection, rounds, compensation. Real adapters do not exist. |
| P7 | Members/invitations (hashed single-use tokens), payee verification evidence, per-user notifications, audit/cash exports, as-of history; web screens wired. Older lists still use offset paging with null `next_cursor`. |
| P8 | `/ready`, graceful worker shutdown, same-origin proxy, Render/Neon runbooks and disposable browser E2E are verified locally. **Hosted acceptance, live OpenAI, S3 provisioning/restore drill and PgBouncer-under-Neon are unverified.** |

Current local verification: **471 backend tests passed**, then 23 focused storage/readiness
tests; 75 frontend tests and a browser signup→baseline→order→evaluation→reload journey passed.
The full checks and explicit hosted limitations are recorded in the progress file; results do
not establish external provider or deployment acceptance.

## Decisions easy to miss

- The current frontend is **`web/`**, not historical `frontend/`.
- Target OpenAPI/contracts contain future endpoints; inspect registered routes
  and capability markers before treating a feature as enabled.
- One confirmed-input pipeline and one calculation boundary:
  `agent/nodes/compute.py`. Only `agent/llm.py` invokes the OpenAI provider.
- Money is integer minor-unit text over HTTP; dates/balances need explicit evidence.
  Detailed financial, concurrency, RLS and idempotency rules are in backend AGENTS.
- Neon is the intended existing core database. API uses restricted `DATABASE_URL`;
  worker uses `WORKER_DATABASE_URL`; `DATABASE_URL_DIRECT` is migrator-only.
  Use `orderfit.runtime api|worker --env-file .env` from `backend/` to select settings.
- Code requires `0014_settlement_retention` (head). Two `0004` branches join through
  `0005_p3_p4_integration`; preserve that migration history.
- [Neon setup evidence](../../../docs/neon_connection_review.md) establishes P1
  setup only, not today's hosted schema. Verify before another hosted migration.
  Destructive tests use disposable PostgreSQL fixtures, never configured Neon URLs.
- No live OpenAI, hosted deployment, restore or production resource-calibration
  acceptance is established. Historical owner-credential rotation remains unverified.
- OCR and docx/xlsx remain unsupported. P5 parses bounded quoted reply terms;
  arbitrary supplier/lender offers and unsupported prose require manual source review.
- P5 reuses `whatif_run`/`negotiation_message`. Additive preparation/reply/acceptance
  evidence is immutable. `deal.analysis_changes` contains only reviewed exploration
  settings and participates in existing input-revision invalidation. Loan selection
  narrows a grid without changing stored offer terms. Fork history loads summaries.
- Preparation hashes/reviews are not action bundles or outgoing approvals. Only an exact,
  step-up-approved bundle (`services/bundles.py`, `services/execution.py`,
  `workflow/execution.py`) can produce sandbox effects; a P5 bank-change hold clears only
  through `flag_resolve` with exact reply + verified account + evidence + current T3.
- Commit settlement projects engine events (`agent/nodes/compute.py` mapping, stored per
  option) once and bumps the revision once; the per-business commitment gate stays held until
  settlement or full compensation. Sandbox only: no real adapter exists.
- Deployment: Compose keeps API/worker/database internal and only web host-facing; browser API
  calls use a same-origin Next rewrite. Render API/worker use a shared S3-compatible store once the
  bucket and matching secrets are provisioned. Migrations remain a separate manual Render job;
  API/worker refuse `DATABASE_URL_DIRECT`. See `docs/deployment/`.
- Audit repairs: execution retries transient PostgreSQL conflicts under its existing lease;
  late cancellation after all effects may settle; live idempotency keys cannot be deleted by
  the runtime role; uploads are authorized before slot admission and have overall/idle limits;
  `/docs`, `/redoc`, and `/openapi.json` require `EXPOSE_API_DOCS=true`.

## Find the relevant implementation

| Area | Entry points |
|---|---|
| Contracts/client | [contracts](../../../backend/orderfit/contracts/), [generated web types](../../../web/lib/generated-api.d.ts), [API client](../../../web/lib/orderfit-api.ts) |
| Use cases/jobs | [API](../../../backend/orderfit/api/), [services](../../../backend/orderfit/services/), [workflow](../../../backend/orderfit/workflow/) |
| P5 preparation | [contract](../../../docs/contracts/p5-preparation.md), `services/preparation.py`, `store/preparation_repository.py`, `workflow/preparation.py`; UI `web/components/preparation-workspace.tsx` |
| Database | [store](../../../backend/orderfit/store/), [SQL](../../../backend/migrations/sql/), [revisions](../../../backend/migrations/versions/) |
| Financial semantics | [engine](../../../backend/orderfit/engine/), [architecture/ADRs](../../../docs/architecture/orderfit/), [reference fixtures](../../../docs/architecture/orderfit/fixtures/) |
| Verification | [tests](../../../backend/tests/): `tests/db/test_p3_*`, `test_p4_documents.py`, `tests/test_p4_pure.py`, `tests/engine/`, `tests/contracts/` |

## Verify proportionately

From `backend/`: `uv run --frozen ruff check .`,
`uv run --frozen python -m orderfit.contracts.export --check`,
`uv run --frozen python -m alembic heads`, and relevant tests using
`uv run --frozen python -m pytest -q --tb=short -x -p no:cacheprovider`.
DB tests need Docker; default pytest excludes opt-in `e2e`/`live` markers.
From `web/`: `npm run typecheck`, `npm run lint`, `npm run build`.
See [README](../../../README.md) for setup/runtime commands. Documentation-only
edits need link/format checks and `git diff --check`, not the application suite.

## Keep this handoff small

Update affected sections and snapshot metadata when phase status, a material
decision, schema/path or verified blocker changes. Put detailed evidence in the
progress file and design rationale in ADRs. Remove superseded context; do not
append a transcript, duplicate AGENTS rules or update this file for routine edits.
This maintenance request creates no background automation or hosted-action authority.

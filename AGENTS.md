# OrderFit repository instructions

These instructions apply throughout the repository. Read additional `AGENTS.md` files in the directories you change: `backend/AGENTS.md` supplements this file for backend work; `web/AGENTS.md` contains the frontend's version-specific instructions. Follow the user's current request over repository guidance when they conflict.

## Purpose and working style

OrderFit helps a small business assess whether it can afford an order, compare revised terms and financing, and record human-approved sandbox actions. AI proposes extracted facts and language; a deterministic engine owns financial calculations; an authorized person approves outgoing actions.

Act as an architectural peer reviewer. Before changing behavior, examine the assumptions about data flow, persistence, concurrency, authorization, performance and failure recovery. Explain material trade-offs and recommend a simpler or safer pattern when evidence supports it. Fix the underlying cause rather than layering exceptions over broken contracts. Keep momentum: resolve routine reversible implementation choices yourself within the authorized task.

Prefer small, cohesive modules and explicit interfaces. Avoid speculative abstractions, unrelated rewrites and new infrastructure without a concrete requirement. Do not turn every change into a redesign or impose new approval steps for ordinary development work.

## Read before backend implementation

1. Inspect the current branch, HEAD, working-tree changes and applicable scoped instructions. Preserve existing user changes; do not switch branches, reset, clean or overwrite work to match a document.
2. Read [the backend implementation plan](docs/initial_backend_implementation_plan.md), especially its source map, database gap register, contracts, phases and acceptance gates.
3. Read `docs/backend_implementation_progress.md` if it exists. Create/update it when implementing backend phases, recording actual files, decisions, checks, limitations and next steps. Do not create a fictional history of completed work.
4. Inspect the current files for the capability you are changing, including its producers, consumers, database rules and tests. Historical documentation is evidence to reconcile, not proof of current implementation.

The plan's audited commit, branch, test results and statements about missing files describe its preparation-time snapshot. Verify them against the current checkout. Reuse recovered work only after inspecting and testing it. The plan defines proposed implementation decisions; do not describe its proposed tables, endpoints or modules as already present.

When sources disagree, separate the current implementation from the intended behavior. Use the plan's explicit resolutions, revised architecture and reference fixtures to establish intent; use current SQL/code for actual constraints. Resolve discrepancies with a documented decision, forward migration and tests where needed. Never silently change financial meaning to fit a column or UI mock.

## Repository map

- `backend/`: Python application, PostgreSQL migrations and backend tests.
- `web/`: Next.js application; this is the current frontend directory.
- `docs/initial_backend_implementation_plan.md`: backend implementation handoff and phase gates.
- `docs/architecture/orderfit/`: revised requirements, architecture, ADRs and financial contracts.
- `docs/architecture/orderfit/fixtures/`: executable reference calculator, cases and expected results.
- `docs/database/` and `docs/database-verification-report.md`: database design and historical verification evidence.
- `data/` and `scripts/`: synthetic/demo inputs and helper scripts; inspect for stubs before relying on them.
- `docker-compose.yml` and `.github/workflows/`: runtime/build/CI integration.

## Shared development rules

- Define integration contracts before implementing their producers and consumers: types, units, IDs, dates, nulls, enums, permissions, errors, versions, idempotency and representative valid/invalid examples.
- Keep one confirmed-input pipeline and one deterministic financial engine across initial assessment, what-if, negotiation and reply reassessment. Do not create browser or API copies of financial formulas.
- Separate business workflow state, numerical verdict, review flags and background-operation state. A technical timeout is not a financial rejection.
- Preserve original documents and immutable decision/approval evidence. Corrections create reviewed revisions with provenance.
- Do not invent missing dates, cash receipts, offer approvals or account verification. Represent missing, conflicting, unsupported and stale data explicitly.
- Execution is sandbox-only under the current plan. Real email, bank, payment or lender integrations require separately authorized scope and contracts.
- Authentication, tenant isolation, human approval, stale-input rejection and audit requirements are system invariants. They cannot be disabled by a UI toggle, AI instruction or generic override.
- Keep frontend types and API contracts aligned. Clear authenticated caches on logout/business change. A demo timer, localStorage flag or health response is not proof of a persisted business operation.
- Follow `web/AGENTS.md` before frontend edits and consult the installed framework documentation it identifies. Do not modify its generated guidance as part of unrelated backend work.

## Secrets, data and infrastructure

Do not print or commit credentials, cookies, raw account secrets or private financial documents. Prefer sanitized examples. Inspect configuration names/defaults without dumping environment files. If tracked secret files are found, preserve local contents while correcting tracking/ignore rules within scope; report confirmed exposure and required rotation without revealing values. Do not rewrite Git history automatically.

Use isolated disposable databases for destructive SQL, migration rollback and concurrency tests. Verify the actual target before execution. Never use a configured/shared application database merely because its URL is available. Runtime services must not use migration-owner, superuser or cross-tenant admin credentials.

Do not claim local database, hosted database, provider, Docker, browser or restore acceptance based on another environment's report. When infrastructure is unavailable, complete independent work and identify the exact check that remains unverified.

## Verification and handoff

Run checks appropriate to the changed behavior. Preserve meaningful existing tests; do not weaken assertions, skip failures or regenerate expected financial outputs just to pass. Add focused regression tests for material bugs, authorization boundaries, financial semantics and recovery behavior. Documentation-only changes need link/path/consistency checks rather than unrelated application test runs.

Keep checks proportionate. A reference-calculator pass does not establish API/database integration; image build success does not establish a running deployment. Distinguish checks executed now, repository-reported results and checks not run.

At implementation handoff, state what changed and why, relevant checks/results, remaining risks or blockers, and the next phase. Update the progress file with actual evidence. Mark a phase complete only when its acceptance gate is met; do not claim production readiness while required gates remain unverified.

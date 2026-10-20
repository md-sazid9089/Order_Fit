# OrderFit backend instructions

Applies to `backend/` and its descendants, together with the repository-root `AGENTS.md`. Start with [Development](../docs/development.md) and current contracts. Read [the implementation plan](../docs/initial_backend_implementation_plan.md) for phase-contract changes or unresolved requirements. Use its DB-01–DB-30 gap register and V01–V16 verification matrix as implementation checklists; verify the current source rather than assuming the plan's historical snapshot is current.

## Stack and architecture

- Python 3.12 is the initial tested target; FastAPI, Pydantic v2, SQLAlchemy 2/Core mappings, psycopg 3, PostgreSQL and manual Alembic migrations form the backend stack. Check `pyproject.toml` and the current lockfile for actual installed constraints.
- Use `uv` and the existing committed `uv.lock` for frozen installs in development, containers and CI. Keep settings, dependency changes and deployment examples consistent.
- Follow the plan's plain durable workflow runner with PostgreSQL-backed jobs and separate API/worker processes. Existing LangGraph dependency declarations/stubs are not evidence that it was adopted. Do not initialize checkpoint storage or add a second queue/framework as an incidental change.
- Routes validate HTTP contracts, obtain a verified principal and call services. Services own use cases and transactions; repositories own persistence; typed adapters map DB, API and engine contracts. Avoid generic table-CRUD routes and business logic hidden in serializers.
- `orderfit/engine/` stays pure: standard library/Pydantic/engine imports only; no network, DB, files, environment reads, provider calls or implicit current time.
- Keep `orderfit/agent/nodes/compute.py` as the sole application boundary directly calling engine `analyse`. All canonical and exploratory computations use it. Preserve the architecture tests, including their existing internal engine allowances.
- Only `orderfit/agent/llm.py` imports the OpenAI SDK or invokes the provider. Existing nodes/guards must not introduce a second provider path.

## Contracts and financial semantics

Complete DTOs and mappings before implementing the corresponding route/repository/UI consumer. Use strict validation, reject unknown fields and distinguish absent data from zero or unlimited values.

- HTTP money is a decimal string of integer minor units; Python/SQL use integer/BIGINT. No floating-point financial arithmetic. Specify rounding and validate aggregate/scenario-expanded bounds as well as individual values.
- Preserve actual identifier types: UUID resources use UUID strings; BIGINT identities use digit strings externally. Human order references and strategy display labels are not authorization identifiers.
- Financial dates are explicit ISO calendar dates within the SQL `biz_date` domain. System timestamps are UTC; expiry uses real server time. Do not replace financial as-of with today's date.
- Preserve declared currency/exponent and source units. No automatic FX, APR-to-flat-interest conversion, asset-to-cash conversion or inferred FDR returns.
- Distinguish `deal.version` row concurrency from financial input revisions and business-data revisions. Return fresh versions after writes; require expected versions on mutating commands.
- Initial supported engine scope and disabled policies/products are defined in the plan. SQL enum/column support or a frontend control does not establish calculation support.

Port the reference semantics from `../docs/architecture/orderfit/fixtures/reference_engine.py` and its fixtures. Keep the reference test adapter distinct from production storage adapters. Add independent expected-value checks so shared bugs cannot hide behind differential parity.

Preserve daily outflows-before-inflows and daily troughs, baseline-relative reserve checks **on each date**, incremental-profit accounting without duplicate obligations, exact rounding, supported deposit concessions, eligible supplier extensions and explicit fixed-term-loan fee timing. Keep hard feasibility distinct from soft ranking targets. Tolerance uses a linear scan; surviving a finite scan does not prove survival without payment.

Compute a full analysis horizon including shifted receipts, baseline obligations and financing repayments. The existing `engine_input_events` view's 540-day filter is not a complete source of truth. Reject unsupported analysis bounds instead of silently clipping. Version a deliberate calculator correction and explain its regression test; never rewrite goldens solely to match a new result.

## Existing database and migration discipline

Read actual schema, guards, reference data, views, policies and grants before writing persistence code. Reuse the existing business/user/membership, cash-event, evaluation/option, approval, message, action, idempotency and audit objects. Proposed additions in the plan need real migrations; do not create parallel financial/identity systems.

`migrations/versions/0001_core_schema.py` is one Alembic revision executing four SQL component files. Preserve applied revision/component behavior; extend with new forward revisions. Do not treat the four SQL filenames as four Alembic revisions.

Manual SQL is authoritative for DDL. `migrations/env.py` intentionally has `target_metadata=None`: do not enable autogenerate or run `metadata.create_all()` to reconcile the schema. Mappings must match SQL; they are not a second schema authority. Preserve the raw execution rationale in the initial migration; offline SQL emission is not established merely because an offline entry point exists.

Every new tenant table needs tenant-aware foreign keys, FORCE RLS where applicable, explicit grants, indexes and appropriate immutability guards. Existing default privileges do not supply all required writes. Preserve UUID versus BIGINT types and exact SQLSTATE/constraint names; translate errors centrally without returning raw SQL or exception text.

Preserve the eight database deal states unless an explicit decision migrates their hardcoded rules as well as reference rows. Use operation subphases for extraction/drafting/execution. Required new edges, batch approvals and stricter action guards are forward migrations, not application-only assumptions.

## Identity, transactions and freshness

- Derive actor/user/business from a verified session and current membership, then establish transaction-local `app.user_id`/`app.business_id` settings. Never use a client-supplied ID or the scaffold's demo identity as authentication.
- Use a restricted non-owner app login. API and workers must not inherit the direct migration URL, superuser privileges or `orderfit_admin` membership. Test with actual runtime login credentials.
- Transaction context must clear on commit/rollback and pooled connection reuse. No verified context means no tenant access. Global auth/provisioning/queue helpers require narrowly scoped privileges and tests, not blanket RLS bypass.
- Use one lock order: business, deal, related rows in deterministic order. Do not hold DB transactions/locks across provider calls or expensive calculations.
- Financial/source child writes must participate in revision invalidation. Check baseline, offer, payee/account and source revisions, not only the parent deal row.
- Confirm reviewed inputs into immutable snapshots. Recheck hash/revisions at confirmation, evaluation publication, bundle approval and execution. Reject stale jobs using both input freshness and worker fencing tokens.
- Respect existing OLD-state input-freeze behavior: transition to an editable state, then update inputs in a separate UPDATE inside the same transaction. Do not silently loosen the guard to make a combined update pass.
- Supersede the previous live evaluation before inserting its replacement, atomically with options and required state changes. Honor deferred recommended-option references and one-live-result uniqueness.

## OpenAI and source handling

OpenAI is the initial LLM provider. Use its server-side Responses API with typed structured results through `llm.py`; verify the selected SDK/model against official documentation at implementation time. Configure the model; do not invent a fixed model ID or provider price.

Implement explicit `off`, `recorded` and `live` modes. Recorded/off tests make no provider calls; an unknown recorded fixture fails visibly rather than falling through to live. Live mode uses server-only secrets, bounded time/output/concurrency/attempts and recorded model/prompt/schema/input provenance. Handle refusal, incomplete/invalid output, rate limits and timeouts explicitly. Manual deterministic operation must remain available.

Source text/replies are untrusted data. Extraction proposes evidence-backed candidates; authenticated review confirms canonical values. Preserve original bytes, parse/extraction versions, quotes/pages, conflicting candidates and override reasons. Validate uploads, generated private storage paths, parser limits and authorized downloads. Do not execute document content or fetch arbitrary embedded URLs.

AI cannot calculate authoritative figures, alter confirmed inputs, choose trusted recipients, approve plans or execute effects. Render financial figures from engine-backed fact references/placeholders and validate term slots. Prompt-injection heuristics are defense in depth; typed permissions and effect separation remain mandatory. Never log provider keys or private financial payloads by default.

## Jobs, approvals and effects

Persist operation admission/idempotency/state changes atomically before returning 202. Use durable job IDs, leases, heartbeats, fencing and bounded retry policies. Calculation/provider work occurs outside short claim/publication transactions. A lost HTTP response is resolved through the same operation/key; do not retry an effect under a new identity.

Bind immutable action bundles to exact inputs/revisions, evaluation/option, counterparties/accounts, content, terms, amounts/dates, expiry and sandbox mode. Editing any approved content creates a new bundle and requires renewed approval. Server-generated hashes are evidence of exact content, not authority by themselves.

Use current role/membership, required party acceptances, session-bound step-up, expiry/revocation and kind-specific manifest membership checks. T2 confirmation is distinct from T3 outgoing approval; send approval is distinct from commitment approval. Password step-up is not MFA. Do not use generic overrides to bypass hard constraints or stale/recipient/tenant checks.

Current SQL send approvals bind one message: multi-message bundles require the plan's explicit CHECK/FK/guard migration. Do not reuse the first message's approval for other recipients. One execution run authorizes only its exact approved batch; do not add extra action rows under a matching plan hash.

Sandbox effect and local action outcome commit together with audit evidence. Persist partial completion and recover the same run without duplicate effects. Serialize unresolved commitments per business through a durable admission gate; a short-lived row lock alone is insufficient. Project completed commitments into baseline with attribution/deduplication before releasing that gate, making other evaluations stale.

Compensation requires its own approved manifest and inverse records referencing original actions. It does not erase immutable history or mutate a committed order into a new commercial agreement. A hold/revocation stops remaining effects but cannot undo completed effects.

## Audit and verification

Use PostgreSQL's existing audit canonicalization, sequencing and hash functions. Do not create a competing Python chain format. Successful mutation and audit row commit together; a denied operation rolled back in its transaction needs separate durable denial recording. Exports/verifiers must use exact canonical bytes and state partial-range/empty-range/anchoring limitations.

Choose focused positive, invalid-input, cross-tenant, stale-data, concurrent-write and crash-recovery tests for the behavior changed. Preserve the plan's acceptance gates. New test directories mentioned in the plan are proposals until created; do not report nonexistent suites as passing.

From repository root, reference checks:

```text
python docs/architecture/orderfit/fixtures/reference_engine.py --check
python docs/architecture/orderfit/fixtures/selftest.py
```

From `backend/`, using the committed lockfile:

```text
uv sync --frozen --extra dev
uv run ruff check .
uv run pytest tests/test_architecture.py tests/engine tests/agent -q
```

Run relevant API/DB/workflow/contract suites as implemented. Default pytest excludes opt-in `live` provider tests. Browser E2E runs separately; never claim that default pytest exercised it. Keep ordinary full-flow tests provider-free; opt-in live-provider tests must be identified separately.

Before SQL tests or migrations, verify a disposable target and separate migrator/runtime logins. Run existing schema/concurrency suites plus applicable new non-owner isolation/recovery tests. Never run destructive downgrade/CASCADE against a configured/shared database. If Docker, PostgreSQL or a provider is unavailable, report the unrun gate and continue independent work without fabricating a pass.

Update `../docs/backend_implementation_progress.md` during implementation with phase scope, actual changes, test evidence and remaining gaps. Make no claim of backend completion from reference fixtures, schema reports, stub-free imports or `/health` alone.

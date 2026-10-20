# FreeLLMPool integration evidence — 18 October 2026

FreeLLMPool now has a native, credential-free testing integration. The default
OpenAI provider remains separate. This addresses provider integration; the broader
capabilities in [the AI workflow plan](../../AI_WORKFLOW_PLAN.md) have their own status.

## Implementation

- Pinned `freellmpool==0.13.0` in the backend dependency graph.
- Provider I/O stays in `agent/llm.py`. FreeLLMPool uses its native async library,
  a pinned packaged keyless route, JSON mode and the task schema. Returned JSON
  must pass typed validation and existing source/eligibility/review controls.
  The broken Responses proxy schema path is bypassed.
- Added explicit provider/model/state/pacing runtime settings. Worker settings
  and Compose now honor the provider selection instead of forcing the worker off.
  The explicit launcher removes an OpenAI key from free-provider children.
- User provider catalogs, inherited provider keys, aliases, implicit route changes
  and paid OpenAI fallback are excluded. Runtime configuration also restricts live
  FreeLLMPool to loopback origins and filesystem document storage.
- Calls have one HTTP attempt, no redirects, the configured network deadline
  (maximum 30 seconds), a two-MiB reply cap, output-token limits and concurrency
  admission. SDK reasoning-token floors are clamped to the application's budget.
- Request starts default to 35-second spacing across event-loop restarts in one
  worker. This addresses observed anonymous rate limits, not distributed quotas
  or guaranteed availability. Existing durable extraction retries remain separate.
- Real model, response ID and available token usage retain provenance. A missing
  provider ID uses an explicitly labelled local response digest. Failures and
  deterministic fallback remain visibly distinct from live-model success.

Concurrent AI-workflow work also unified the provider-neutral structured-call
boundary and system prompts, added the local-only configuration restriction and
included the extraction system prompt in its hash. Those changes are preserved.

## Executed evidence

Before the shared-boundary follow-up, **148 focused tests** passed in 65.58 seconds
and **54 worker/audit regressions** passed in 5.94 seconds (202 total). Ruff,
contract export (112 operations) and the unchanged sole schema head
`0019_merge_passkey_roles` passed. After reconciling the concurrent shared-boundary,
local-only and multilingual changes, the combined focused run passed **207 tests
in 62.39 seconds**, with one existing Starlette/httpx deprecation warning. Fresh
Ruff, `uv lock --check`, contract export and whitespace checks also passed.

Two paced smoke runs passed **4/4 live tasks** on
`ovh/Mistral-Small-3.2-24B-Instruct-2506`. Extraction required all six expected
values to match source quotes. What-if required the exact twelve-day customer
delay from a paraphrase outside the fallback grammar, with live provenance.
Response IDs were `chatcmpl-bc12a6b15caccc91`, `chatcmpl-a3db335a16a4b71e`,
`chatcmpl-bc9fc8a893f453e3` and `chatcmpl-992202b47e6829e3`.

An isolated native PostgreSQL 16.11 run passed both fake-upstream and real-provider
persisted workflows on the same sourced order: upload, extraction, human amount
review, manually supply missing dates, confirm, evaluate and run what-if. The
assertions checked live provenance, a saved response ID, six engine-produced
scenario series and unchanged canonical deal state after the fork. Initial live
operation IDs were `2e45fd21-4ebf-4d1a-a3f1-4c84bf1d8000` (extraction) and
`c10593a2-ec1c-4cac-9325-3d0dd1c9e9ab` (what-if), with upstream what-if response
`chatcmpl-b22a1446d48393df`.

Shared assertions live in `backend/tests/db/test_freellmpool_workflow.py`. Docker
was unavailable, so a separate harness created a fresh native PG16 cluster,
verified its database name/data directory, applied current migrations and
provisioned distinct restricted logins. It did not override repository fixtures
or establish PG17/container acceptance. Initial harness setup failures are
excluded from the passing results.

The live persisted assertions were repeated successfully against the current
shared source. Final saved operation IDs are
`df65cc82-ea86-401f-ab78-6d9cf8c65e3f` (extraction) and
`5c47ef3f-96d4-4005-8819-def8cce29794` (what-if). The latter retained
`provenance=live`, upstream response `chatcmpl-974316e3b6935904` and six calculated
series. This final recheck used the same verified isolated target, not a shared DB.

## Local test target

- Browser: `http://localhost:3000/auth/signup` for a synthetic test account.
- API: `http://127.0.0.1:8000`; separate worker process.
- Ignored private configuration: `backend/.env.freellmpool`.
- Isolated test database: `127.0.0.1:63833/orderfit_free_test`, PostgreSQL 16.11.
- Ignored native data, logs, process/target manifests and synthetic evidence:
  `backend/var/free-workflow-214868a0e8/`.

The cluster is intentionally retained for user testing. The main database,
existing `.env`, existing PostgreSQL service on port 5432 and web process were
not changed. Main-account credentials do not belong to this separate database;
create a synthetic test account there. API/worker start commands use the explicit
test file described in [the guide](../../deployment/freellmpool.md).

Initial `/health`, `/ready` and web `/api/health` checks passed, including schema,
storage and worker readiness with zero backlog. The browser entry and sign-in
page displayed API ready. Both services were then restarted on current shared
source. Final `/ready` returned all checks true with zero backlog; the web proxy
again returned connected/ready. The browser was left on the synthetic signup page.

An automatic review rejected a combined optional command to generate lifecycle
helpers and remove old stopped setup folders, stating only “blocked by policy.”
That command did not execute. The stopped folders remain and do not affect the
test target.

## Limits

No paid call, private document, shared-data mutation, hosted deployment or stress
campaign was used. The full backend suite, PG17 image checks and a complete
browser-driven financial journey were not run. Synthetic transport/schema success
does not establish general extraction quality, privacy/retention acceptance or
ongoing upstream availability. Explanations, drafting and reply parsing retain
their existing template/parser behavior.

See the [contract](../../contracts/freellmpool-testing.md),
[synthetic input](../../../data/ai_workflow/synthetic_order.txt) and
[live smoke command](../../../scripts/test_freellmpool.py).

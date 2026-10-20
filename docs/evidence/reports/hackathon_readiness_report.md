# Hackathon readiness campaign — 17 October 2026

Status: verification and repair in progress. No score or production certification is claimed.
The supplied rubric is task completion 40%, security and compliance 30%, innovation
and interaction 30%. Evidence below is limited to the environments actually tested.

## Scope and source truth

Started clean on `main`, HEAD `ebaa8f9b97562a824ff72ede1c728e4daa966591`.
Frontend source, dependencies, configuration and generated files are excluded from
repairs. Existing frontend checks and production-image builds are permitted.
No configured Neon database, existing application account, real communication,
paid/live AI, hosted mutation or deployment is part of this campaign.

Source identities are recorded with `python scripts/hackathon_snapshot.py --output
<path>`. Its manifest covers current bytes, including nonignored new code; docs
are excluded from source identity to avoid a report hashing itself. A separate
tracked-diff hash and status record explain dirty work. The frontend tree digest
before application repairs is `811a05e3624a400aea50dcaf3d36af0d84742b38693f3af62459c6b9adda1e20`.

## Architecture and source map

| Journey boundary | Actual source and durable contract |
|---|---|
| Browser and same-origin proxy | `web/app/`, existing typed `web/lib/orderfit-api.ts`, Next production rewrite to private API; opaque HttpOnly session and CSRF |
| Route authorization | `backend/orderfit/api/routes/`, `api/deps.py`, `auth/`; fresh verified session/membership/action permission on each request |
| Tenant transaction | `store/db.py`; restricted API/worker LOGINs, transaction-local actor/business, business-before-deal locks, no privileged runtime fallback |
| Financial input | `services/deals.py`, confirmed-input adapters/contracts, immutable snapshots, business/input/source revisions |
| Durable admission | `store/repositories.py`, `workflow/operations.py`; atomic idempotency/admission/audit, leases, heartbeats and publication fencing |
| Financial calculation | Sole application boundary `agent/nodes/compute.py` to pure `engine/`; integer minor units, dated troughs, baseline-relative reserve and full horizon |
| Source and language | `services/documents.py`, private `store/documents.py`, `workflow/extraction.py`, sole provider boundary `agent/llm.py`; original bytes, quote/page candidates, human review |
| Exploration/replies | `services/preparation.py`, `store/preparation_repository.py`, `workflow/preparation.py`; isolated forks, exact reviewed templates and owner-recorded party attestations |
| Approval/effects | `services/bundles.py`, `services/execution.py`, `workflow/execution.py`; exact manifest, current permission, session-bound step-up, separate send/commit, sandbox-only effects |
| Settlement/audit | Immutable actions/outbox/ledger, serialized business commitment gate, attributed baseline projection, approved compensation; PostgreSQL canonical audit chain |
| Database authority | Manual SQL in `backend/migrations/sql/`, Alembic sole head `0019_merge_passkey_roles`; no autogenerate/create_all repair |

Implemented does not mean independently accepted: target OpenAPI/ownership docs
retain preparation-time wording and future capabilities. Runtime routes and tests
establish actual support. OCR/DOCX/XLSX, FX/accounting/portfolio optimization,
revolving/factoring products and real external financial adapters remain unsupported.
Live AI applies to extraction and natural-language what-if; existing drafts,
explanations and reply parsing use deterministic guarded templates/parsers.

## Initial independent gap register

All three initial reviewers examined the same starting backend without exchanging
conclusions. Findings below are reproduced unless explicitly labeled otherwise.

| ID | Priority/type | Reproduction and practical impact | Planned disposition |
|---|---|---|---|
| A1 | P1 defect | Full/rounded-full deposit creates a zero final receipt; positive-only commitment DTO rejects even an unselected option and fails publication | Omit exact zero no-op movements at mapping boundary; preserve engine/goldens and reject negatives |
| A2 | P2 defect | Opening plus receipts can exceed HTTP money bound although BIGINT admission succeeds; series mapping later fails | Conservative scenario-expanded admission bound before publication; no clipping or wire widening |
| A3 | P2 defect | Sunk deferrable inventory wrongly included in full supplier-extension selection | Align fork/reply eligibility with incremental engine costs |
| B1 | P2 defect under reproduction | Upload discards command key; changed bytes can reuse a key | Reuse existing atomic idempotency contract while retaining content dedupe |
| B2 | P2 integrity gap under reproduction | Download returns bytes without comparison to immutable stored content hash | Verify immutable source hash before returning any bytes |
| C1 | P1 defect | Suffix/later conditional language creates exact acceptance candidate | Conservative whole-reply qualification; persist no acceptance for conditional evidence |
| C2 | P2 defect | Negative source amount can ground a positive proposal | Preserve/reject negative sign and accounting notation with positive controls |
| C3 | P2 resource defect | 2 million text characters reach provider although document budget is 100,000 | Aggregate budget before provider, explicit manual/split path, preserve source/CSV support |
| C4 | P2 fallback defect | Final provider-to-DTO validation escapes INVALID_OUTPUT for oversized candidate list | Normalize final validation to existing unavailable/manual fallback |
| E1 | External prerequisite | Live OpenAI quality/latency has no authorized target/budget; prior free-route attempts yielded no usable structured output | Remain blocked; recorded/off integration is separate evidence |
| E2 | Resource prerequisite | C: ~7 GB free (~3%), below existing 15% stress gate; host ~1.1 GB free memory initially | No load/spike/stress/soak; ordinary tests sequential where feasible |
| E3 | Historical/external | Provider retention, independent KMS/scope evidence and historical credential rotation remain unresolved | Preserve prior reports, no new hosted/control acceptance claim |

## Execution plan and decision evidence

1. Freeze independent findings and reproduce contract failures.
2. Assign disjoint backend repair ownership; preserve frontend/API compatibility.
3. Add failing focused regressions and verify durable no-effect outcomes.
4. Run final provider-free backend/PG17 suite, reference fixtures, locked checks,
   dependency audits, production images and real browser journeys.
5. Reconcile financial/effect/audit state and process restart; review final common
   source identity with all reviewers. Record remaining frontend/external gaps.

Keep positive DTO/SQL constraints: PostgreSQL 17 documents enforcement on invalid
inserts and the limits of cross-row CHECKs. A zero movement need not become a
financial row. Changing public positive-money types/SQL constraints would widen
the supported contract unnecessarily. [PostgreSQL 17 constraints](https://www.postgresql.org/docs/17/ddl-constraints.html).

Structured output must still handle refusal/incomplete/validation failures; schema
conformance alone does not establish semantic grounding. Typed review and effect
separation remain the boundary for untrusted source text. [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[OWASP prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/).
These sources support design choices; executed regressions establish local behavior.

## Evidence ledger

See [risk/test matrix](../../hackathon_test_matrix.md) for requirements, actual checks,
targets, outcomes and exclusions; [demo runbook](../../hackathon_demo_runbook.md) for a
reproducible supported workflow. Final results and reviewer dispositions are
pending integration. Historical evidence remains in the existing security,
stress, performance and AI-assisted-review reports and is not relabeled fresh.

## Rubric and recommendation

| Supplied criterion | Required demonstration | Current campaign gate |
|---|---|---|
| Task completion — 40% | Saved confirmed order → useful independent financial outcome → approved sandbox effects → reload/recovery | Repairs and integrated verification pending |
| Security and compliance — 30% | Restricted tenant logins, risk limits, exact approval, stale/role rejection, immutable audit | Fresh focused checks underway; external controls remain conditional |
| Innovation and interaction — 30% | Grounded proposals, reviewable changes, smooth desktop/mobile demo and honest fallback | Recorded/off paths in scope; live model quality blocked |

Final recommendation pending; do not present this in-progress report as sign-off.

# P0 contract freeze — 15 October 2026

These are target contracts, not a claim of working business endpoints. The deployed
API still exposes liveness only. No mock success handlers are mounted. The original
SQL revision and its four component files remain unchanged.

The code authority is `backend/orderfit/contracts/`: primitives, financial inputs,
resources, workflow/results, language proposals, protocol predicates, configuration,
endpoint catalogue and deterministic export. `openapi.json`, `frontend-api.d.ts`
and `capability-ownership.md` are generated; edit models/catalogue, then regenerate.
`typecheck.ts` exercises a frontend consumer including intentional invalid examples.
The generated types are kept here until P3 introduces a real frontend API client.

From `backend/`:

```text
uv sync --frozen --extra dev
uv run --frozen python -m orderfit.contracts.export
uv run --frozen python -m orderfit.contracts.export --check
uv run --frozen pytest tests/contracts tests/test_architecture.py -q
uv run --frozen ruff check .
```

From `frontend/` after `npm ci`:

```text
npx --no-install tsc --strict --noEmit ../docs/contracts/frontend-api.d.ts ../docs/contracts/typecheck.ts
```

## Source and decision matrix

| Source | Observed or intended | P0 resolution |
|---|---|---|
| Current checkout | `backend/initial`, starting HEAD `d71f546`; three untracked user instruction/plan files; no progress/contracts/lock | Preserve branch and supplied files, commit with this P0; do not restore historical work by assumption |
| Plan audit | `a0608e6` is an ancestor of current HEAD | Subsequent committed changes are environment files/ignore rules and database guides; SQL/application files are unchanged since audit. Audit test claims remain historical |
| SQL 0001 revision + four SQL components | Existing schema/keys/guards/RLS are authoritative for storage | Reuse all existing objects; P1+ forward revisions only; no create_all/autogenerate |
| Plan sections 4, 6–12, 14–16 | Intended release behavior and phase gates | Explicit financial/approval/type resolutions below supersede scaffold and UI mocks |
| Revised architecture and 22 reference fixtures | Intended financial baseline, reference limitations acknowledged | P2 port through compute boundary with independent checks; P0 does not implement engine |
| Old domain/engine/API/graph/checkpoint modules | Trust/day-offset types, stubs, demo identity | Leave consumer replacement to P1–P3; target DTOs deliberately do not alias incorrect old shapes |
| Frontend | Demo interactions and health proxy | Generated target types only; no claims of persisted/authenticated journey |
| OpenAI official structured-output guide | Responses typed parsing contract | SDK 2.54.0 locked, no fixed model; P4 re-verifies model/SDK and evaluates quality |

OpenAI documentation checked: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
No provider requests, key validation, model-access or live quality tests were performed.

## Supported and deferred capabilities

The target release supports manual entry; text PDF/text/quoted CSV/typed JSON
proposals; evidence review; a complete confirmed snapshot; deterministic dated
cash-flow/deposits/extensions/flat term loans/decline; three scenarios; isolated
what-if; reviewed replies/party attestations; exact human-approved sandbox effects;
durable jobs; tenant audit/export; bounded password sessions and step-up. Each
operation's owner, storage, phase and V-test gate appears in the generated inventory.
In P0 these business capabilities have status `planned`, never `implemented`.

Disabled: FX, taxes/VAT calculation, holidays/business days, OCR, DOCX/XLSX,
factoring/revolving/PO-finance calculation, stage/defer strategies, automatic
credit scoring, active concentration/minimum-delay/percentage-finance caps,
late-penalty calculation, asset valuation/FDR return inference, portfolio optimizer,
MFA/SSO/verified-email onboarding, real messages/bank/lender effects, external audit
anchoring and cross-tenant admin console. Admin UI must hide these controls until
its relevant phase implements honest capability status. `/orders` reuses deals;
`/risk-constraints` and settings share immutable constraints; no parallel tables.
Landing illustrations and `/ui-showcase` have no authoritative backend requirement.

## Wire, permissions and transport

Money is a canonical signed decimal minor-unit string, individually bounded by
9,000,000,000,000,000. Events/revenue/draw grids are positive; reserve/caps are
nonnegative; balances/profit may be negative. No float, exponent notation, plus,
padding, separators or negative zero. Python/SQL money is integer/BIGINT. UUIDs
remain UUIDs; BIGINT identities are positive digit strings through 2^63−1.
Currencies are BDT/USD/EUR/GBP with exponent 2; no implicit relabeling or FX.

Financial dates are calendar-only ISO 2000–2100; timestamps must have timezone and
normalize to UTC. Missing draft values are null, never fabricated zero. A confirmed
snapshot requires complete anchors/evidence/coverage or explicit coverage-gap
acknowledgement. Arrays retain order; unknown fields and numeric coercion fail.
Field-specific Python validators add cross-field bounds beyond structural OpenAPI.
`frozen=True` prevents DTO attribute replacement; callers revalidate serialized
payloads before storage/hash rather than relying on Python container immutability.

All business IDs are authorized against session/current membership. Cross-tenant
and missing resources return 404; same-tenant known forbidden is 403. Read all:
viewer/auditor/commercial_lead/risk_officer/owner; audit: auditor/risk/owner;
prepare/confirm/evaluate/draft/what-if: commercial/risk/owner; execute and finance
management: risk/owner; membership/business profile: owner. Own global profile is
self-only. No `superadmin` input. `protocol.PERMISSIONS` is executable.

Collections use stable `(created_at,id)` keyset order, default 50/max 100. Audit
uses sequence order; opaque cursors bind business/user/filter/order and are checked
on each request (encoding is base64url canonical cursor JSON plus HMAC using a
dedicated derived cursor key; never authority). List filters and required as-of,
range and series option/scenario parameters are in OpenAPI. Invoices/import and
CSV confirmation return only a bounded first page when over 100 rows; next cursor
loads the remainder, never silently discards inserted rows.

Every POST/PATCH uses `Idempotency-Key` (1–200 nonblank chars) and authenticated
commands also `X-CSRF-Token`. Tenant-global `(business_id,key)` storage is preserved.
Request hash covers typed canonical body, authenticated actor, uppercase method
and concrete normalized path including IDs. Reject query-bearing mutation URLs;
no ignored query may alter command meaning. For upload the body hash includes
typed metadata and actual file byte hash. Same key/same scope/hash replays original
status/body/Location; same key/different request is 409. Reserve key + command +
audit in one transaction; after unique failure roll back before lookup and compare.
General replay lasts 24h; execution uniqueness/evidence never expires with it.
Lost response: retrieve/retry the same key/operation, never generate a new effect ID.
Pre-business auth uses a narrow identity/source-scoped idempotency store (P1
addition, not a fake tenant); never replay a session token to another principal.

Secret-bearing requests use `protocol.request_body_digest` with a server-only
HMAC key, never Pydantic's redacted JSON (different passwords otherwise hash
identically). Derive the key with standard HMAC domain separation from
SESSION_SECRET (`HMAC-SHA256(secret, "orderfit:idempotency-body:v1")`). Retain its
key version for the 24-hour replay window when rotating session secrets; persist
only the keyed digest. Snapshot/bundle canonicalization rejects SecretStr rather
than hashing a mask. No raw password/account/session token enters response cache
or audit. P1 stores the digest key version with each request record.

Auth-specific replay: signup/signin persist only resulting user/session IDs and
safe outcome. A retry with the issued valid session cookie returns its current
SessionView; never reconstruct a bearer token from cached JSON. If that cookie was
lost, return 401 `AUTH_SESSION_RECOVERY_REQUIRED` and require explicit fresh sign-in
with password and a new challenge/key. Do not repeat signup or fabricate an
authenticated success. This authentication recovery exception does not apply to
business commands/effects, whose exact original outcome is replayed.

Commands use expected row/input/business revisions as applicable; stale is 409.
Always return committed fresh versions. T2 confirmation is distinct from T3 send
and separate commit approval. Operation status is independent of deal state and
numeric verdict. 202 has Location/poll URL; completion may be a typed blocked
result. Partial execution lives in execution-run state. Cancellation is a request
at safe boundaries and cannot erase completed effects. See ADRs 0007–0009.

Safe error envelope is `error(code,message,request_id,details,retryable)` with
allowlisted optional field/reason/expected-current versions. 400 syntax; 401
session; 403 role/CSRF/step-up; 404 invisible/missing; 409 state/stale/key conflicts;
413 size; 415 media; 422 field/financial constraints; 429 admission; 503 dependency.
`protocol.SQL_ERRORS` freezes SQLSTATE translations including OF001–OF009 and
23000/23505/23503/23514/22xxx/42501. Do not infer replay from 23505. Prechecked
permission failures are 403; approval coherence is safe 409. Unknown faults return
a generic dependency/internal error with request ID; never raw DB/provider text.

## Storage to snapshot to engine mapping

P1 creates mappings matching SQL, not a second DDL authority. P2 owns production
storage-to-engine adapters; a separate reference fixture adapter preserves original
fixture IDs. Exact mappings are frozen here before those producers/consumers exist.

| Existing storage / proposed addition | ConfirmedInputV1 | Pure/reference engine input |
|---|---|---|
| business UUID/currency + proposed financial_revision | business_id/currency/exponent/financial_revision | explicit currency/exponent; no conversion |
| deal UUID/start_date/input_version | deal_id/start_date/input_version | as_of, deterministic deal identifier; no current clock |
| deal.opening_cash_minor/reserve_minor | string money | integer opening_balance/reserve |
| business proposed typed baseline_settings (opening date/cash/coverage/evidence), versioned by financial_revision | explicit deal-as-of confirmed balance/evidence | reconcile dated events from declared opening date; never relabel an old balance as today's cash |
| cash_event WHERE deal_id IS NULL, full relevant dates | baseline_events, revision, coverage/evidence | baseline_events: id=string identity, date, amount=int, direction, kind, certainty, invoice_ref |
| deal.customer_id + customer version, PO and confirmed scalars | order | id=PO label (not auth), customer=resolved display, revenue=int, anchor_dates order/invoice/delivery, terms anchor/days/calendar |
| cash_event WHERE deal_id=target AND eligible order costs | order.costs | id=cost_key (stable source ID), date/amount/kind/deferrable/incremental/invoice_ref |
| financing_offer + immutable confirmed term evidence | offers | offer_id=UUID string, shape=term_loan, min/max/step=int, fee_flat_minor->fee_flat, interest_bps/fee_bps/lead_days/term_days/available_from/valid_until |
| owner_constraints pinned ID/version | owner + strategy_space + scenarios | min_order_profit/max_financing_cost integer or explicit no-cap null; ordered priorities/target/close-call, exact deposit/extension grid |
| SQL downside/severe_* fields; JSON strategy data | typed Stress/StrategySpace | deposit_follows_delay -> deposit_follows_customer_delay; haircut bps -> order_receipt_haircut_bps; stages -> [1] |
| proposed source revisions/parse/candidate/manual evidence | source_revisions/balance_evidence/cost evidence/conflict resolutions/assumptions | financial values only after review; retain full app provenance outside narrow reference input |
| pinned analysis/config | scan_days/sensitivity/work budget | explicit scan, expanded complete horizon, allowlisted sensitivity paths |

Never use the 540-day `engine_input_events` view as sole source. Reconcile past
events into opening balance with evidence, then exclude them from future events.
Never pass stored generated order receipts or loan draws/repayments into costs.
Deduplicate original obligations and completed commitment projections. An existing
cost already in baseline is nonincremental in the order, linked by obligation ID
and explained; it is not charged twice. Sunk inventory has no invented new cash
outflow. Nonincremental cost annotations are excluded from generated order costs.

Snapshot `max_minor` is the human-confirmed drawable maximum, bounded by the
stored offer max and any finite limit minus drawn amount. `available_minor` alone
never means lender acceptance. Reject a non-flat/contradictory interest_method,
zero minimum, missing dates, expired/closed offer, or empty effective grid rather
than guessing. Preserve original limit/drawn/raw terms in immutable source
provenance/revision evidence. Offer UUID is deterministic engine identity;
never parse a displayed strategy key to obtain authorization or amounts.

`fee_at=draw` means percentage+flat fee deducted on draw date; `repayment` means
both on repayment date. Interest is a single flat term rate, half-up integer
rounding, charged at draw+term_days. Funding date is max(as-of+lead, available_from)
and must be within validity. No APR conversion or revolving/factoring interpretation.
The offer catalogue does not establish party acceptance or cash receipt.

Source role is mandatory metadata: only customer_order/customer_sales_quote totals
describe sales revenue; supplier_cost_quote describes costs. Different supplier
cost and sales totals are not a conflict. Same-role contradictory candidates are
preserved and block confirmation until reviewed. `document.kind=quote` alone is
insufficient; add source_role through a forward migration. Original bytes/hash,
page/quote, parser/extraction/candidate versions and manual override reasons remain.

## Financial decisions and bounds

P2 ports reference semantics with explicit corrections/versioning for horizon.
Outflows occur before same-day inflows and trough is separate from closing cash.
Each day's candidate floor is min(reserve, same-day same-scenario baseline trough).
Incremental profit subtracts incremental order cost, concessions, surcharge and
financing once; pre-existing obligations affect baseline cash, not profit twice.
Hard minimum profit preserves reference strict comparison; soft ranking priorities
never override hard cash feasibility. Deposit concession is flat bps plus the
integer per-10-percent schedule, applied to revenue; deposit uses net revenue and
the final receipt takes residual. Only deferrable order costs shift; do not move
baseline payroll/rent. Half-up rounding and exact residuals are mandatory.

Scenarios shift only eligible unconfirmed customer/AR receipts. Deposit delay uses
its explicit flag. Haircut applies only reference HAIRCUT_KINDS final/stage receipts,
never deposit; overrun applies only reference eligible order outflows. Confirmed
cash is not shifted. Sensitivity requests are bounded and cannot activate an
unsupported field. Late-penalty calculation is rejected in confirmed inputs;
cancellation prose is retained as evidence/context, not priced by the engine.

Bounds: total 2000 events, 20 offers, 200 grid points/offer, 10,000 combinations,
540 scan days, 1095 horizon days and biz_date endpoints. Work admission uses
combinations × (scan+3) × max(1,event count,horizon days) × (1+sum sensitivity points), maximum
100,000,000 units. This is a conservative contract admission count, not a measured
timeout guarantee; P2 must measure actual daily-sweep CPU/memory and tighten its
worker timeout/budget before enabling compute. Expanded monetary bounds account
for 100% extension surcharge + 100% stress overrun and fees/interest. Full horizon
includes late offer funding/repayment, extended costs, shifted receipts/deposits,
baseline AR and scan endpoints. No clipped best-plan or false nonpayment claim.
Finite scan success is `capped_scan`, with explicit cap/observed safe days; proof of
nonpayment survival is separate and cannot be inferred from null or capped scan.

Numeric result mapping: accept_as_is -> feasible_as_offered; accept_with_changes ->
plan_recommended; decline_or_renegotiate -> no_feasible_plan and null recommendation.
Summary is recommendation base when available, otherwise computed as-is base.
needs_input/unsupported/conflict -> typed operation result and review flags, no
numeric SQL evaluation. Store inputs/output immutable; supersede old live result
before parent+options insert, satisfying deferred recommendation FK atomically.
Future migration must add explicit tolerance status; never encode capped as infinity.

## Upload, import and language contracts

Multipart is `metadata` JSON (DocumentUpload) plus binary `file`; no remote URL.
Allow text PDF, UTF-8 text, quoted CSV, TypedJSONImportV1 only. Limit 25 MiB, 50
pages, 100,000 extracted chars, 20 docs/deal. Private generated storage keys are
business/deal/document scoped, not filenames. Hash actual bytes, atomic durable
file before DB metadata, then parse in bounded worker. Reconcile aged orphan
files; downloads require current membership/deal authorization. Duplicate bytes
in same deal return existing authorized metadata without cross-tenant disclosure.

CSV exact headers: event_date,amount_minor,direction,kind,certainty,invoice_ref,
description. UTF-8, RFC4180 quoting, YYYY-MM-DD, canonical positive minor-unit
strings, explicit request currency (must match business), no locale/decimal guessing.
Optional invoice_ref/description blank -> null; all other headers/cells required.
Preview only; row errors/duplicate invoice+source keys; confirmation checks preview
hash and business revision/idempotency. Typed JSON import is also preview-only;
order values use DraftInputs and baseline uses CashEventInput. Escape formula-
leading CSV export cells. No arbitrary spreadsheet execution or embedded URL fetch.

Only `agent/llm.py` may import OpenAI. P4 uses Responses typed parsing,
store=false, task/schema/prompt/input/source provenance, 30-second request bound,
two simultaneous calls/worker, bounded output and combined three-attempt job/SDK
budget. `off` never calls provider; `recorded` matches exact fixture key and missing
fixture fails visibly; `live` requires explicit server-only key/model. No chosen
model or claimed price/quality in P0. LanguageRequest/LanguageResult, source
candidates, typed what-if proposals and FactSentence placeholders are generated.
Unknown/private source text cannot write canonical inputs, approve or execute.
Prose figures render from engine fact IDs; reject unbound numeric/term claims.
Fallback is labeled deterministic template; provider refusal/incomplete/invalid/
timeout/rate-limit/unavailable remain explicit outcomes. Manual flow remains usable.

## File ownership and phase handoff

Routes validate HTTP/principal -> named catalogue services own transactions ->
repositories match current SQL -> typed adapters create snapshots/engine input.
`contracts/` owns wire schemas, `services/identity` and `workflow/operations` P1,
`store/` scoped factory/mappings/audit/storage P1, `engine/` pure P2,
`agent/nodes/compute.py` sole calculation boundary, `agent/llm.py` provider P4,
negotiation/bundles/execution services P5/P6, read models/export/settings P7.
Do not divide a future phase across shared mutable files without coordination.
No replacement financial, identity, approval, action or Python audit-chain system.

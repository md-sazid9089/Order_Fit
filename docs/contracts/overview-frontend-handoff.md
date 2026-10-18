# Overview endpoint: frontend handoff

Backend implementation: 18 October 2026. **No files under `web/` were changed.**

## Request and ownership

`GET /api/v1/businesses/{business_id}/overview?timeframe=30d`

Operation ID: `business_overview_get`. Requires the existing session cookie and
current business `read` permission, enforced through `Database.tenant` and RLS.
No CSRF header or idempotency key is needed for this GET. Use the existing
same-origin API client and active `useScope().businessId`.

`timeframe`: `30d` (default), `90d`, `6m`, `1y`.
Optional `currency`: `BDT`, `USD`, `EUR`, `GBP`; omit it for the business currency.
Another valid currency returns HTTP 422 / `OVERVIEW_CURRENCY_UNSUPPORTED`.
There is no FX conversion or cross-currency account ledger in the current model.

Contract sources: `backend/orderfit/contracts/resources.py`, generated
`docs/contracts/openapi.json` and `docs/contracts/frontend-api.d.ts`.
Example: `docs/contracts/overview.example.json`.

## Frontend work required

| Current file / behavior | Required change |
|---|---|
| `web/app/overview/page.tsx`: calls `loadPipeline` and derives totals from its first page | Fetch the overview endpoint directly. It aggregates all business orders; do not mix its totals with a paginated pipeline. |
| `web/lib/orderfit-api.ts` | Add a typed overview GET with `businessId`, `timeframe`, optional currency, and abort signal. Preserve existing session/error handling. |
| `web/lib/generated-api.d.ts` | Update from `docs/contracts/frontend-api.d.ts` using the contract generator once frontend integration is authorized. Backend export deliberately left this browser file unchanged. |
| Page `CASHFLOW_DATA`, fabricated delay points, KPI changes, currency allocations | Replace with response fields below; remove hardcoded customer/settlement/financial values. |
| Page timeframe state | Include timeframe in the request key and effect dependencies. Abort superseded requests and clear previous-business data immediately. |
| Page selection indices (currently May/index 4 and delay/index 1) | Reset/clamp selection against returned arrays; weeks and partial months are supported. |
| Currency control / fallback to USD | Use `primary_currency`; do not relabel BDT minor units as another currency. Disable unsupported currency conversion. |
| Chart data currently uses thousands as JavaScript numbers | Preserve API minor-unit strings. Use existing exact money formatting and bigint/decimal arithmetic; convert only bounded/scaled chart coordinates. Never compute financial totals from floating point chart values. |

The backend generator now supports `--backend-only` for docs-only contract
exports/checks. From `backend/`, the frontend developer can run the existing full
`uv run --frozen python -m orderfit.contracts.export` to synchronize the browser
declaration. Until that is done, the full generator's `--check` will correctly
report browser declaration drift; do not suppress that gate in CI.

## Response mapping and exact meaning

All money fields are signed/nonnegative **integer minor-unit strings**, never
major-unit numbers. Dates are ISO calendar dates; evaluation timestamps are UTC.
`schema_version` is `overview.v1`. `data_warnings` is an additive required field
that must be respected; an empty graph is different from missing financial data.

| Response | UI mapping / semantics |
|---|---|
| `primary_currency`, `as_of`, `reserve_floor_minor` | Show the recorded opening-balance date and default policy reserve. This balance is not a verified bank balance today. |
| `kpis.total_balance_minor` | Current recorded business opening cash; it may be negative. Label **Opening cash balance**. |
| `kpis.volume_30d_minor` | Latest evaluated snapshot amount per distinct deal evaluated in the last rolling 30 days, compared with the preceding 30 days. Re-evaluations in one period count once. Each period may include the same order. Independent of selected graph timeframe. |
| `kpis.total_orders_tested` | All-time distinct deals with an evaluation, including superseded history. |
| `kpis.pending_reviews_count` | Active nonterminal, uncommitted orders with no live evaluation, stale input/revision, changed/no feasible terms, evaluation alerts, or unresolved flags. |
| `kpis.protected_headroom_minor` | Absolute daily projected cash trough of the business baseline plus posted commitments, minus the default reserve. Includes all dated obligations in the complete supported horizon. This is not the minimum of independent deal evaluations, which would duplicate the baseline. |
| `cashflow` | Forward scheduled cash events from `as_of`, not historical bank settlements. Baseline plus committed projections only; uncommitted hypothetical orders are excluded. Totals match buckets exactly. |
| `cashflow.timeline` | Dense seven-day buckets for 30d/90d; calendar-month buckets for 6m/1y. Windows are exactly 30/90/183/365 calendar days inclusive of `as_of`. Month edges may be partial, and 1y may contain 13 month labels. ISO period keys and `start/end` date ranges; nullable `highlight_note`. |
| `delay_sensitivity` | 0/15/30/45/60-day shifts of posted order receipt kinds, keeping deposit/loan receipts and baseline AR unchanged. Reuses canonical engine outflows-before-inflows daily sweep. Includes shifted receipts beyond the displayed chart window; no clipping. |
| Scenario/headroom `status` | Below reserve: breach; equal: warning; above: safe, unless baseline gaps require warning. This is absolute liquidity health, not a replacement order feasibility verdict with the engine's baseline-relative reserve rule. |
| `verdict_distribution` | Current live evaluations classified by recommended strategy: borrowing first, deposit next, then feasible-as-offered. Declines and unsupported extension-only results are excluded and flagged, not mislabeled as financing. Percent denominator is the classified subset; empty subset yields zero percentages. Split remains zero because split strategies are disabled. |
| `recent_settlements` | Five newest live evaluations with stable timestamp/UUID ordering, stored evaluation amount/terms, and customer label. Label **Recent evaluations**. They are not proof of funds received. `id` is the evaluation UUID string; use `deal_id` for order navigation. |
| Recent `status` | safe/deposit/financing/declined are strategy badges, not payment states. The contract deliberately adds `review` for results outside the four requested strategy buckets (for example supplier extension only). Render it as a neutral/amber **Review revised terms** badge, never as a financial decline. Honor `status_label`. |
| `currency_balances` | Only the primary-currency recorded nonnegative opening balance. Allocation is 100% for positive balance and 0% for zero; no separate operating/reserve accounts exist. Negative balance yields an empty allocation list and warning while KPI retains the negative amount. |

## Missing data and warning handling

Three historical comparison fields are numeric `0.0` placeholders because the
schema stores no baseline/pending/headroom time series. With
`BALANCE_HISTORY_UNAVAILABLE`, `PENDING_HISTORY_UNAVAILABLE`, or
`HEADROOM_HISTORY_UNAVAILABLE`, show an em dash / **History unavailable** instead
of a flat-growth arrow. With `VOLUME_CHANGE_UNDEFINED_FROM_ZERO`, do the same for
volume percentage; there is no finite growth percentage from zero to positive.

With `BASELINE_NOT_CONFIGURED`, show a baseline setup state. Balance/headroom and
cashflow are zero, currency allocation empty, scenario status warning; never
display a verified-safe financial verdict. Actual order counts/evaluations still
appear. `as_of` then uses the database statement's calendar date in business timezone.

With `BASELINE_COVERAGE_INCOMPLETE` or `PAST_EVENTS_REQUIRE_RECONCILIATION`, show a
data-quality notice; reserve-safe scenarios are downgraded to warning. Past
scheduled events are not silently replayed into the dated opening balance.

Other warning codes explain capability limits:
`SINGLE_CURRENCY_BASELINE_ONLY`, `SPLIT_MILESTONES_UNSUPPORTED`,
`RECENT_SETTLEMENTS_ARE_EVALUATIONS`, `PROJECTIONS_ARE_SANDBOX`,
`VERDICT_DISTRIBUTION_EXCLUDES_DECLINED_AND_UNCLASSIFIED`,
`RECENT_STATUS_REQUIRES_REVIEW`,
`NEGATIVE_BALANCE_NOT_REPRESENTABLE_IN_CURRENCY_ALLOCATION`.
Unknown future warnings should remain visible in a generic data-quality notice.

## Errors and frontend acceptance

- 401: follow existing sign-in/session handling. Foreign/invisible business: 404.
  Permission or changed session authority can return 403.
- Invalid query: 422 in the existing error envelope. Unrepresentable aggregate:
  422 / `OVERVIEW_MONEY_BOUND`. Complete projection beyond 540 days or SQL date
  bounds: 422 / `OVERVIEW_HORIZON_UNSUPPORTED`. Show an actionable error, not mocks.
- Use the existing loading skeleton, retry handling, and cancellation; never leave
  previous-business financial data visible after scope change or failed reload.
- Verify all four timeframes, empty/fresh business, missing baseline, zero and
  negative balance, loading/error/retry, business switching, and a result set larger
  than one pipeline page. All money labels/totals must agree with the API strings.
- Verify exactly one overview data request per settled business/timeframe state,
  no pipeline/customer/evaluation waterfall, and no old request overwriting a newer
  timeframe/business. Check small viewports, dark theme and chart selection bounds.
- Browser acceptance, hosted latency/capacity and frontend build/typecheck remain
  frontend integration gates. Backend query-count checks are not capacity evidence.

## Backend scope not implemented by this endpoint

Real bank settlements, multiple currency accounts, FX valuation, historical
balance/review/headroom comparisons and split milestones require separately
designed persisted data/contracts. This read-only endpoint adds no account ledger,
migrations, provider calls, caching or real payment effects. It does not alter
the existing calculator's financial decisions.

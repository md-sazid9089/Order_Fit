# Frontend handoff: admin consistency and review recovery

> The frontend now consumes the existing capability-gated admin read DTOs with bounded continuation, exact currency totals, explicit errors, and real signout. This checkout still requires schema head `0023_account_access`; the backend enablement/deployment gates below remain separate.

Prepared 18 October 2026 from `4578538`. **Backend implemented; deployment and frontend integration pending.** Schema head: `0021_admin_reads`. Reads default disabled via `ADMIN_READS_ENABLED=false`. Companion: [backend fix plan](../admin_backend_fix_plan_2026-10-18.md), [deployment runbook](../deployment/admin-reads.md), [synthetic response fixtures](admin.example.json). Verification evidence is recorded in the backend progress file.

Local evidence: 757 full backend tests passed (1 live test deselected; 3 deprecation
warnings), plus 131 final focused admin/runtime/contract tests passed. These used
disposable PG17 with separate migrator/API/worker credentials. Hosted and browser
acceptance are pending; local evidence does not authorize using a migration-owner
credential in the deployed API or enabling the old membership-derived UI.

## Message to the frontend developer

The current admin screens aggregate the logged-in administrator's business memberships. They cannot represent platform totals. The backend now mounts a restricted, read-only global admin API. Its typed snake_case responses replace the old unmounted camelCase prototypes; integrate the new generated declarations below.

Platform administration will permit summary reads without tenant membership. It will not automatically authorize tenant membership changes, invitations, order details, documents or business audit reads. Keep those workflows subject to their existing tenant permissions.

You can implement labels, warning gating, polling recovery, logout and fixture-backed capability states now. Backend DTOs and docs-only generated declarations are published. Real global reads also require the deployment migration, API caller-role grant, explicit enablement and restricted-role acceptance in that deployment. No `web/` files were changed by the backend implementation.

## Implemented shared API

All paths below include `/api/v1`; the existing `get`/`mutate` client already prefixes it. For example call `get('/admin/overview')`, not `get('/api/v1/admin/overview')`. Use same-origin session credentials and existing expired-session handling. Admin GETs need no CSRF/idempotency header. Signout remains a mutation with existing protections. Admin responses and client query caches contain personal/financial data: no shared public caching; clear them on signout or authorization loss.

| GET endpoint | Target response / meaning |
|---|---|
| `/admin/capabilities` | `schema_version: 'admin-capabilities.v1'`, `read_enabled: boolean`, `global_logs: false`, `platform_mutations: false`, `reason: string or null`. Available to authenticated platform admins even while reads are disabled. `reason` is safe display text; never parse it as an enum. |
| `/admin/overview` | `schema_version: 'admin-overview.v1'`, `as_of: UTC timestamp`, `total_users: integer`, `total_tenants: integer`, `active_tenants: integer`, `total_orders: integer`, `order_value_by_currency: CurrencyTotal[]`, `orders_without_value: integer`. Totals cover all recorded rows, not the currently loaded list page. |
| `/admin/users?limit=50&cursor=...` | `{items: AdminUser[], next_cursor: string or null}`; one record per account. Fields: `id`, `email`, `full_name`, `is_platform_admin`, `version`. Names use underlying schema nullability; do not fabricate names. No tenant-role/status/membership fields in this release. |
| `/admin/tenants?limit=50&cursor=...` | `{items: AdminTenant[], next_cursor: string or null}`. Fields: `id`, `name`, `currency`, `timezone`, `status`, `created_at`. Includes inactive businesses; use actual status. |
| `/admin/orders?limit=50&cursor=...` | `{items: AdminOrder[], next_cursor: string or null}`. Fields: `id`, `business_id`, `status`, `currency`, `order_value_minor` (nullable minor-unit string), `created_at`. Summary metadata only; no claimed numerical verdict, customer, risk hold or recommended option unless a later DTO explicitly adds it. |
| `/admin/system` | `schema_version: 'admin-system.v1'`, `checked_at: UTC timestamp`, `status: 'ready' or 'degraded' or 'unavailable'`, `checks: {database, schema_current, storage_writable, worker_active}`; each check is `boolean or null`. Null means unknown, never false or healthy. All true -> ready; any false -> degraded; no false but at least one unknown -> unavailable. |
| `/admin/logs` | HTTP 503 `ADMIN_TELEMETRY_UNAVAILABLE`; no global log feed in this release. |

`CurrencyTotal` fields: `currency` (supported currency code), `amount_minor` (exact nonnegative integer decimal string), `orders_with_value` (integer). Currency groups include all orders with recorded values, including draft/closed/committed orders; they are not cash or revenue. `orders_without_value` counts null values. Currency groups sorted by currency code. No orders -> empty groups and zero counts. No single total currency and no FX.

All current supported currencies BDT/USD/EUR/GBP have exponent 2. Use exact existing minor-unit formatting, preserve zero, and never convert totals through JavaScript Number for arithmetic. Aggregate values can exceed individual-order bounds and JavaScript safe integer limits; the aggregate wire bound is 40 decimal digits. IDs retain their existing UUID/digit-string types; versions are existing integer concurrency versions. Current `AdminUser.full_name`, email and tenant name/timezone are required non-null strings. Only the explicitly nullable fields above accept null. Generated DTOs are authoritative; do not cast away mismatches or hand-edit generated declarations. Current SQL disallows a zero-valued order: render zero monetary totals correctly, but do not submit a zero order value.

Example overview fixture (synthetic):

```json
{
  "schema_version": "admin-overview.v1",
  "as_of": "2026-10-18T10:00:00Z",
  "total_users": 3,
  "total_tenants": 2,
  "active_tenants": 2,
  "total_orders": 4,
  "order_value_by_currency": [
    {"currency": "BDT", "amount_minor": "12000000", "orders_with_value": 2},
    {"currency": "USD", "amount_minor": "250000", "orders_with_value": 1}
  ],
  "orders_without_value": 1
}
```

Lists: limit 1–100, default 50. Treat cursors as opaque; URL-encode and send only to the same endpoint/session. Reset list/cursor on refresh, signout or role change. Tenants/orders sort descending `(created_at,id)`; users ascending `id`. Lists are live, not snapshot exports. No server search/filter in this release: label any client filter **loaded results**. Do not present CSV of loaded rows as a full platform export. Do not load every page merely to derive counters.

## Files and changes

| Frontend area | Required change |
|---|---|
| `web/app/admin/layout.tsx`, `web/lib/platform-admin.ts`, `web/lib/auth-server.ts` | Retain server-side session/role verification. Replace constant frontend availability assumptions with backend capability handling. Disable/unavailable view when capabilities fail or reads are false; no fallback to membership-derived global metrics. Platform flag verifies identity, capability verifies availability. |
| `web/app/admin/page.tsx` | Fetch capabilities then overview; fetch system separately if health cards are shown. Remove membership loops and page-derived global counts. Render one monetary figure per currency, labelled Recorded order value. Display missing-value coverage. |
| `web/app/admin/users/page.tsx` | Use global users Page response. Separate platform-admin badge from tenant roles. Remove unsupported tenant/status columns and tenant filter from the global list. Hide global provision/edit/revoke controls; current handlers call tenant APIs and cannot manage arbitrary platform accounts. A separately labelled business-membership workflow may retain existing controls only after existing tenant permission checks. |
| `web/app/admin/tenants/page.tsx` | Use global tenant list and cursor continuation. Do not synthesize tenant order/member counts from first-page tenant reads. Only contracted fields can be represented as complete. |
| `web/app/admin/orders/page.tsx` | Use global order summaries with continuation. A listed order does not grant detail access. Do not automatically call ordinary business detail/evaluation APIs for each global row. Show detail navigation only when independently authorized, and keep normal 404/403 handling. |
| `web/app/admin/logs/page.tsx` | Show Global security logs unavailable. Business audit records may be shown only in a clearly separate tenant-scoped view with existing membership/audit permission. |
| `web/app/admin/system/page.tsx` | Use timestamped system fields. Remove hardcoded verified-invariant claims and synthetic activity. Unknown checks must display Unknown. |
| `web/components/layout/app-sidebar.tsx`, admin consumers | Add a real signout action in admin mode and wire the existing authenticated signout flow. Exit to Business App remains navigation. Check desktop/mobile and collapsed/expanded states. |
| `web/app/deals/[id]/page.tsx` | Disable Confirm and evaluate when any nonblocking finding's code is missing from acknowledgements, in addition to existing blocking/busy/permission/hash gates. Validate again in the submit handler. Deduplicate warning codes. Continue resetting acknowledgements on fresh review/input revision. |
| Same order page | Retry transient operation status GET failures with bounded backoff; expose Retry status after budget exhaustion. Resume against the same operation ID. Stop on terminal status, unmount, business change, or auth loss. Never resubmit confirm/evaluate because a poll failed. |
| `web/lib/pipeline-data.ts`, `web/lib/pipeline-model.ts`, `web/app/deals/page.tsx` | Preserve current network/5xx failure propagation. Represent failed/missing/conflicted reads separately from no evaluation when a deal references an evaluation ID. Current optional helper suppresses 404/409; do not silently display Not evaluated for those referenced results. Backend status codes remain authoritative; 409 may require refetching the deal, not retrying the old evaluation forever. |
| `web/components/settings/passkey-panel.tsx`, `web/lib/passkeys.ts` | Map backend error codes and known browser authenticator exceptions to actionable messages. Preserve the distinction between cancellation, unsupported browser, bad password, expired challenge, reauthentication and service outage. Never display raw exception text as the only guidance. |
| `web/app/deals/[id]/documents/page.tsx` | Keep API values unchanged; map display labels, e.g. `po` -> Purchase order, `customer_order` -> Customer order. Map all existing keys, not just those two. Continue submitting original enum values. |
| `web/lib/generated-api.d.ts`, typed admin client | Sync from backend exporter once DTOs are published. Use shared types and standard error/session logic, abort obsolete reads, and invalidate admin data on auth loss. Do not hand-author a second conflicting contract. |

## Errors and user-visible behavior

Use the existing `{error: {code, message, ...existing fields}}` envelope. Do not depend on uncontracted details.

| Response | Frontend behavior |
|---|---|
| 401 or existing session-reauth rejection | Clear authenticated caches; use existing sign-in recovery. |
| 403 `FORBIDDEN` | Clear admin data and deny admin access; do not retry as a business query. |
| 503 `ADMIN_TELEMETRY_UNAVAILABLE` | Explicit unavailable state; do not display zeros. `/logs` deliberately stays here. |
| 503 `DATABASE_CAPACITY` / transient network or 5xx | Show temporary failure; bounded GET retry/manual retry. Preserve valid data only with an explicit stale marker and no cross-session reuse. |
| 422 `INVALID_CURSOR` | Tampered, expired, wrong-session or wrong-list cursor; clear continuation and offer refresh. Cursor lifetime is 15 minutes from the first page, preserved across continuation. |
| 422 `INVALID_INPUT` | Invalid limit/query shape; limits are 1–100. |
| 503 `ADMIN_DATA_UNSUPPORTED` | Stored data violates supported financial/currency/DTO bounds; show unavailable financial data rather than substituting zero or a different currency. |
| Confirmation 422 `UNACKNOWLEDGED_WARNINGS` | Show Acknowledge all review warnings before confirming; refetch current review if necessary. Server protection already exists. No automatic checkbox selection. |
| Evaluation GET 404/409 | Show missing/conflicted referenced result or refresh order metadata; do not invent a financial verdict. Current `get_evaluation` returns 404 `NOT_FOUND` when absent and returns 200 with `is_stale`/`stale_reasons` when superseded or revisions changed. It does not normally use 409 to mean stale. Preserve other explicit conflict responses if encountered. |

Successful empty lists are empty data; failed reads are errors; disabled capabilities are unavailable. These must have distinct UI states. Global overview can succeed while system health fails: render independent panels rather than turning one failure into fabricated global counts.

## Joint acceptance and delivery order

1. Backend freezes DTOs/examples/error codes and provides backend-only generated contracts. Frontend can work against clearly labelled fixtures meanwhile.
2. Frontend runs the full contract exporter to sync browser declarations, then typecheck/lint and focused tests. Final full contract parity must pass; backend-only parity does not prove browser consistency.
3. Backend supplies restricted-runtime DB evidence: admin without memberships can read both synthetic businesses; normal tenant APIs/direct SQL still deny unrelated tenant access; revocation invalidates the session; mixed-currency totals and >100-row continuation pass.
4. Joint browser checks: authorized global reads; unauthorized/expired/disabled/empty/error states; separate currency totals; continuation; no unauthorized detail links or global mutation controls; actual logout; warnings block premature submit and backend still rejects bypass; transient poll failure recovers the same operation; missing evaluation is not labelled unevaluated; readable upload/passkey messages.
5. Deploy with admin reads disabled, apply the reviewed forward migration through the normal deployment process, verify restricted deployed credentials, then enable and smoke-test. No main/shared DB mutation is authorized by this handoff alone.

Done means both implementations agree with generated types and pass the joint journey. Backend implementation and disposable-DB acceptance do not establish hosted deployment or frontend/browser acceptance. Full browser declaration synchronization remains with the frontend owner.

# Backend admin remediation plan

Date: 18 October 2026. Baseline inspected: `4578538`, clean working tree before these documents. Status: backend implemented; full regression 757 passed / 1 live deselected and final focused 131 passed on disposable PG17. Exact evidence is in the latest backend progress entry. Shared database migration, frontend integration and deployment enablement remain pending.

Implementation: `0021_admin_reads`; typed admin DTOs/routes/repository/service;
default-disabled configuration; updated exact privileged-function inventory;
131 final focused tests passed. The two new roles are both NOLOGIN/NOBYPASSRLS:
only the private function owner has table-specific read policies and column grants.
The API caller role has only function execution. This avoids the bypass-role option
considered in B1. No existing tenant policy was loosened and no frontend file was edited.

The phases below retain the intended scope/checklist. Their deployment/browser
steps are release gates, not completed by local implementation. Consult the
[runbook](deployment/admin-reads.md) before enabling reads.

Companion: [frontend handoff](contracts/admin-frontend-handoff.md). Both documents describe the same proposed contract. Existing prototype responses are not the target contract.

## Objective and bounded decisions

Provide honest, authenticated, platform-wide **read-only** oversight without weakening ordinary tenant isolation. Support overview, paginated users/businesses/orders, and measured system status. Keep global security logs explicitly unavailable. Platform role assignment, cross-business membership mutations, account suspension, impersonation and unrestricted order details are outside this release.

Recommended decisions for implementation:

- Platform administrator and tenant member are separate authorities. A platform read must work without membership in the target business; ordinary tenant APIs must continue to reject that same administrator without membership.
- Use narrow database functions for specific administrative reads, not a runtime owner login, blanket BYPASSRLS, broad admin-role membership or global runtime SELECT policies.
- Report monetary totals by currency with decimal minor-unit strings; no FX and no default USD. Label these totals **recorded order value**, not cash, revenue, settled volume or evaluated pipeline value.
- Count distinct account rows, business rows and deal rows; never derive totals from membership lists or a page of results.
- Preserve server-side warning acknowledgement enforcement. Improve its error message and add focused regression coverage; no new confirmation policy is needed.
- Keep frontend recovery/presentation fixes with the frontend owner. Backend supplies predictable status/error contracts and regression evidence.

This changes the existing intentional no-global-admin boundary. The security gate below is a requirement for enabling that new capability, not evidence that it already exists.

## Confirmed current implementation

| Area | Source and finding |
|---|---|
| Registration | `backend/orderfit/api/main.py` does not mount the admin router. |
| Prototype routes | `backend/orderfit/api/routes/admin.py` has untyped/inconsistent prototype responses, unpaginated bounded arrays, mixed-currency SUM labelled USD, and static invariant assertions in `/system`. |
| Authority | `api/deps.py::require_admin` and `services/admin.py::admin_connection` verify the current flag; the latter deliberately retains runtime RLS. This does not grant global financial reads. |
| Existing tests | `tests/db/test_admin_security.py` asserts no mounted admin routes and no tenant/order rows for the prototype under runtime permissions. Those are deliberate old-boundary tests, not tests to silently delete. |
| Sessions | `store/db.py::Database.identity` resolves the session digest and establishes scoped transaction context. Platform flag changes revoke sessions through `migrations/sql/0018_platform_authority.sql`. |
| Confirmation | `store/repositories.py::DealRepository.confirm` rebuilds review and returns 422 `UNACKNOWLEDGED_WARNINGS` before snapshot insertion. |
| Frontend | `web/lib/platform-admin.ts` currently returns true; admin pages render membership-scoped results. An enabled UI flag is not evidence of backend capability. |

## Phase B0: freeze shared contracts

Add strict Pydantic DTOs in `backend/orderfit/contracts/admin.py`; use them as route response models. Extend `contracts/catalogue.py` and the exporter as necessary for admin query parameters and capability status. Inspect the current generator first: adding catalogue entries alone must not produce inaccurate query schemas or claim disabled endpoints are live.

Adopt the endpoint/field semantics in the companion handoff. Publish synthetic examples and the supported error matrix before frontend integration. Use snake_case, existing UTC/UUID/BIGINT conventions, existing ErrorEnvelope and `Page` style. Do not preserve prototype camelCase merely because it exists in an unmounted file.

No public search/filter contract in the first release: cursor and limit only. Client-side searching must be labelled as searching loaded results. Add a later bounded server search contract if full-platform search is required.

Gate: reviewed DTOs, examples, catalogue and runtime/target-schema tests agree; frontend can implement against fixtures marked proposed.

## Phase B1: narrowly authorize global reads

1. Inspect actual table owners, FORCE RLS, grants, session resolver, authority invalidation, signed cursor implementation and migration graph. Determine the next free revision identifier at implementation time; do not assume `0021` remains free. Identify the actual deployment DB/roles without displaying secrets or mutating it.
2. Add one forward Alembic/SQL migration for explicit admin overview/users/tenants/orders reads. Resolve how each function owner can read the required tables under FORCE RLS: table ownership alone does not bypass FORCE RLS. Prefer a dedicated NOLOGIN owner with only necessary table privileges and a narrowly reviewed bypass where required. Never grant membership in that owner role to API, worker or PUBLIC. Existing broad owner functions should not become the default pattern.
3. Every privileged entry point must independently validate a server-derived session digest against live session expiry/revocation/current platform authority. Never trust a supplied user ID, a boolean parameter, or editable `app.*` settings as the sole authorization proof. Do not log session digests. Reuse resolver semantics without introducing authority-renewal differences.
4. Resolve and lock session/current authority within the bounded read transaction. Inspect the existing session/authority-trigger lock order and adopt it consistently. A completed revocation must reject subsequent reads; overlapping reads/revocations must serialize without deadlock. Locks cannot span external health probes.
5. Use schema-qualified objects, fixed safe search_path, parameterized static SQL, explicit projection, bounded limits and statement/lock timeouts. Revoke PUBLIC EXECUTE; grant only exact functions to the API runtime. The function-owning role must have no schema CREATE privilege; PUBLIC/untrusted roles must not be able to replace referenced objects.
6. Return only contracted account/business/order summary fields. No passwords, sessions, account evidence, source documents, document paths, private replies or arbitrary SQL. No tenant writes, platform-role writes or global security-event reads.
7. Keep the existing ordinary RLS policies unchanged. Verify direct SQL and normal tenant HTTP routes still deny cross-business reads to a platform administrator.

Trade-off: SECURITY DEFINER is a privileged attack surface and needs adversarial DB tests. It is smaller than granting the whole runtime global table access. If a safe minimal ownership/grant arrangement cannot be demonstrated on a disposable DB, keep the capability unavailable and report that gate.

Gate: actual restricted runtime credentials pass positive global reads and negative direct-access/spoofing tests. Migrator-only success does not count.

## Phase B2: implement summaries and continuation

- Add a focused `store/admin_repository.py`; keep transaction orchestration in `services/admin.py` and HTTP validation in `api/routes/admin.py`. Reuse existing cursor signing and error translation; do not grow the general repository with unrelated admin logic.
- Compute overview totals from the entire authorized platform dataset, preferably one statement/snapshot so counts and currency groups agree. SQL SUM may exceed BIGINT; serialize exact numeric/integer sums to decimal strings without truncation or floating point. Inspect DTO bounds: a valid aggregate can exceed a per-order Money bound. Reject unsupported overflow explicitly rather than wrap or round.
- `total_users`: all account rows once each. `total_tenants`: all businesses. `active_tenants`: businesses with status `active`. `total_orders`: all deals, including closed/committed/draft. Currency groups include each deal with recorded non-null order value exactly once; count missing values separately. Empty data produces zero counts and an empty currency array.
- Validate currency/value integrity; unsupported or inconsistent stored currency must fail explicitly with a safe data-integrity response, not be silently relabelled or discarded. Preserve zero values. Never fill missing values from mock data.
- Paginate deterministic descending `(created_at, id)` keysets for tenants/orders and ascending `id` for users. Cursor includes version, endpoint, requesting admin/session, ordering key and expiry; no raw token/digest. Validate signature, expiry, scope and limit bounds. Revalidate current authority on every page.
- Lists are live views, not a snapshot export: inserts before the cursor may require refresh; no duplicate/omitted stable rows on an unchanged dataset. Do not claim stable exports during concurrent changes.
- System response reports timestamped readiness booleans or null/unknown and overall ready/degraded/unavailable. Derive individual checks from actual backend probes; never copy one aggregate ready flag into every check or claim live verification of deterministic math/audit immutability.

Gate: exact mixed-currency totals, aggregate bounds, missing/zero values, stable pagination beyond 100 rows, bounded query counts and measured system-state tests pass.

## Phase B3: mount honestly and preserve error contracts

- Introduce an explicit backend admin-read enablement setting, default disabled. Publish authenticated `GET /api/v1/admin/capabilities` even when reads are disabled. Ordinary users receive 403, absent/expired sessions 401. A disabled read responds 503 `ADMIN_TELEMETRY_UNAVAILABLE`, never fabricated empty results. Split the capability route if necessary to avoid router-wide feature checks blocking discovery.
- Mount the read API only through a deliberate code change and controlled enablement after B1/B2 pass. The schema-readiness check must cover the new migration; a true feature setting cannot bypass a missing schema or privilege prerequisite. Capabilities report false on unmet prerequisites; reads fail safely if a prerequisite later disappears. No startup grants or migrations.
- Replace the old no-global-route regression with explicit disabled-state tests and enabled restricted-role security tests in the same change. Keep prototype security lessons and all ordinary tenant-denial tests.
- `/logs` stays 503 `ADMIN_TELEMETRY_UNAVAILABLE`; capability `global_logs=false`. A business audit list must never be labelled global security logs.
- Improve `UNACKNOWLEDGED_WARNINGS` message to “Acknowledge all review warnings before confirming.” Preserve status/code and recomputation of findings. Do not add arbitrary exception details to ErrorEnvelope.
- Confirm existing signout, passkey errors, operation GET states and evaluation GET errors remain stable. Add curated server messages for backend-owned passkey error codes if currently generic; authenticator DOMExceptions remain frontend-owned. Do not change operation/evaluation DTOs merely to implement UI retry.

Gate: real app runtime schema and registered routes match capability state; capability availability and authentication cannot be bypassed through alternate routes.

## Phase B4: verification and release order

Use isolated synthetic PostgreSQL with separate migrator, API and worker roles. Do not migrate the configured/shared DB as part of tests.

| Gate | Required evidence |
|---|---|
| Auth | Anonymous/forged/expired/revoked sessions denied; tenant owner without platform flag denied; promoted admin without memberships reads summaries from two unrelated tenants. Promotion/demotion invalidates old sessions. |
| DB isolation | Runtime cannot SELECT global tables directly, become function owner, mutate platform authority, read documents/auth secrets, forge context, or invoke privileged reads using a non-admin digest. Worker cannot execute admin functions. Function ACL/search_path ownership inspected. |
| Races | Revocation/read overlap serializes under established lock order; revoked authority fails next request and next cursor page. No lock survives commit/rollback or pooled reuse. |
| Financial | BDT+USD remain separate; account shared by businesses counted once; null/zero values and totals above JS safe integer work; no page-derived count. |
| Pagination | More than 100 records; final empty cursor; tampered/expired/cross-session/cross-endpoint cursors; invalid limits; bounded projection and query count. |
| Confirmation | Unacknowledged warning returns 422 with no snapshot/state transition; all required warning codes allow normal confirmation; changed review cannot reuse stale acknowledgements/hash. Extra codes do not substitute for required ones. |
| Recovery | Operation GET remains readable after an injected transient read failure; retry creates no second evaluation. Existing evaluation missing/conflict/server-error behavior is documented from actual handlers. |
| Integration | Authenticated admin with no tenant memberships sees both synthetic tenants; ordinary tenant URLs still deny access; UI disabled/unavailable/error/empty states match fixtures; signout invalidates session. |

Run focused suites, existing admin/session/tenant/confirmation regressions, full backend suite, Ruff and contract parity checks. Use backend-only export during backend ownership; frontend owner then runs full export to sync `web/lib/generated-api.d.ts`. Final joint check must include full contract parity. Run joint browser acceptance after both implementations land. Reuse existing tests where meaningful; no test-count-based acceptance claim.

Release sequence: contract fixtures -> DB migration/role review on disposable target -> backend code with reads disabled -> frontend fixtures and capability handling -> controlled deployment migration -> restricted-role deployed smoke -> enable reads -> joint browser smoke. If a release gate fails, keep/return reads to disabled; keep forward migration in place rather than destructive rollback. Clear frontend admin caches on disabling/signout/role rejection. Local evidence does not establish deployment readiness.

At implementation completion update `docs/backend_implementation_progress.md`, the development-context skill, contracts and this handoff with actual revision, exact tests, enabled capabilities and any unrun gates. Local completion does not mark deployment or frontend integration complete.

# Security audit continuation — 17 October 2026

This reconciles the resumed checkout at `eca00c9` with the earlier
[area-by-area audit](security_audit_2026-10-16.md). That report remains historical
evidence; the status corrections below supersede its unfinished-work list. The
later [local acceptance update](security_acceptance_2026-10-17.md) supersedes this
document's pre-MFA and pre-Docker status statements.
The working tree was clean for tracked files at resumption. Subsequent concurrent
frontend edits were preserved. Graph discovery missed the new admin routes, so
their committed paths and current source were inspected directly.

Only synthetic local environments were exercised. No application environment file
was loaded by the replacement tests, no configured/shared database was contacted,
and no migration, provisioner or provider was run against a hosted environment.
There is no new Critical finding. This is not production acceptance.

## Findings from reconciliation

| ID / severity | Evidence (`file:line`) | Exploit or failure scenario | Fix | Status |
|---|---|---|---|---|
| R01 High — session credential exposure | Prior `7333d07`, `backend/orderfit/services/identity.py:204`; current `backend/orderfit/contracts/resources.py:98`, `backend/orderfit/services/identity.py:161`, `:246` | A same-origin script reads the login/session JSON credential despite the cookie being HttpOnly. JWT also introduced an undeclared import that prevented application/test startup. | Return identity/CSRF metadata only; restore cryptographically random opaque session credentials, keep database revocation/expiry authoritative. Retain server-derived admin status. | Fixed; regression `backend/tests/test_admin_security_rbac.py:160`; collection and focused tests pass. |
| R02 High — platform elevation retains old sessions | `backend/migrations/sql/0018_platform_authority.sql:5`, `:9`, `:12`; `scripts/provision_admin.py:62` | A stolen pre-promotion session acquires platform authority when its owner is promoted; demotion has no atomic session invalidation/audit contract. | Forward revision `0017_platform_authority` revokes all existing sessions on actual flag changes and records the privilege event in the same transaction. No runtime privilege or RLS bypass was added. Provisioner no longer swallows audit failures. | Fixed locally; promotion, fresh sign-in and demotion regression `backend/tests/db/test_admin_security.py:78` passes on isolated PG16. Deployment migration pending. |
| R03 High — unsafe test target and embedded credentials | Removed `e303ebd:backend/tests/test_live_rbac_suite.py:13`, `:181`, `:190` | Default pytest loads application environment files and attempts a committed platform privilege update on the configured database. It also embeds login credentials for named accounts. | Replace with synthetic fixtures, actual restricted runtime credentials, and a verified disposable migrator. The runtime update test must raise permission denied; unexpected success fails. | Fixed; replacement `backend/tests/db/test_admin_security.py:94`. Rotate embedded account passwords and revoke sessions **if those credentials were ever provisioned/reused**. Source inspection surfaced those credential-bearing lines; values are not reproduced in this report. |
| R04 Medium — stale/unbounded admin reads | `backend/orderfit/services/admin.py:12`; `backend/orderfit/api/routes/admin.py:50`, `:77`, `:106` | Role/session revoked after the dependency check but before a new raw transaction; repeated unbounded list reads exhaust memory/connections and bypass shared query deadlines. | Recheck session and lock current platform authority within the bounded read transaction; use the shared pool/timeout handling. Lists default to 50, maximum 100, with deterministic ordering. | Fixed; revocation-gap, limit validation and foreign-business denial regressions at `backend/tests/db/test_admin_security.py:41`, `:63` pass on isolated PG16. These small admin lists do not yet expose continuation cursors. |
| R05 Medium — untested admin persistence boundary | `backend/orderfit/store/tables.py:45`; `backend/orderfit/api/routes/admin.py:135`; `backend/migrations/sql/0005_backend_foundation.sql:57` | Mocked tests report working admin access while the real mapping omits the flag and always denies admins. A global security-event read fails because runtime credentials correctly lack SELECT privileges. | Map the existing SQL flag. Preserve all tenant RLS and private auth-table grants. Return explicit `503 ADMIN_TELEMETRY_UNAVAILABLE` for global logs pending a reviewed privileged interface. | Mapping/error fixed. Cross-tenant console telemetry remains unavailable; do not grant `orderfit_admin` or owner rights to make it work. |
| R06 Low — SBOM not retained | `.github/workflows/security.yml:58` | The dependency inventory disappears with the ephemeral CI runner, preventing review of exactly what was scanned. | Retain the generated CycloneDX inventory for 14 days using an immutable action SHA, without credentials or application data. | Configured; exact hashed runtime audit/SBOM verified locally. Hosted workflow execution remains unverified; `web/tests/security-headers.test.mjs:7` checks immutable references, hashed audit, fixed SBOM path and retention. |

The dependency check and read transaction intentionally both verify authority. The
second check is essential because dependency completion is not a durable capability.
The row lock lasts only through a bounded database read, not storage/provider work.
Concurrent provisioning can block or cause a transaction retry; failed transactions
must fail closed, and callers must not substitute owner credentials.

## Current status by requested area

| Area | Reconciled implementation / evidence | Remaining boundary |
|---|---|---|
| AUTHN / SESSION | Argon2id, shared password admission, DB-backed throttles, CSRF/origin/session binding, secure cookie configuration and logout revocation remain. R01 restores the cookie credential boundary. Membership cutoff is `backend/migrations/sql/0016_session_authority.sql`; platform changes now have R02. Password-plus-passkey MFA is now implemented and locally verified; see the acceptance update. | Exact deployment RP/origin configuration and hosted browser acceptance remain open. Verified email is not implemented. |
| AUTHZ / TENANCY | Existing RLS/runtime-role checks remain in `backend/orderfit/store/db.py:36`; R04/R05 add real admin tests. A platform boolean does not grant cross-tenant SQL access. Foreign business access remains 404; users endpoint sees the actor only without tenant context. | Admin console is not a functioning global tenant/order explorer. New privileged query contracts, pagination and explicit grants would need separate implementation. |
| INPUT / UPLOADS | Existing strict DTOs, authorized upload admission, immutable private paths and bounded isolated PDF parsing remain: `backend/orderfit/services/documents.py:49`, `backend/orderfit/services/pdf_parser.py:11`. | No new document formats or unsafe URL fetching were enabled. Container parser isolation was not repeated in this continuation. |
| AI / LLM | Structured proposals, escaped source text, no action tools, job-tenant document scope and human approval remain: `backend/orderfit/agent/llm.py:61`, `backend/orderfit/workflow/extraction.py:89`. | Live provider retention and adversarial model evaluation remain unverified; no live provider was called. |
| APPROVAL / AUDIT | Immutable exact-input bundles, stale-input rejection and replay/fencing controls remain: `backend/orderfit/services/bundles.py:392`, `backend/migrations/sql/0010_p6_approval.sql:67`. R02 adds atomic platform-authority audit evidence. | Full frozen local regression later passed with 540 tests. External audit anchoring remains operational work. |
| DATA PROTECTION | Verified remote DB TLS, safe errors and account fingerprints remain. A synthetic encrypted local DB/document restore drill now verifies wrong-key/tamper rejection, audit/hash integrity, tenant isolation and authentication quarantine; see the acceptance update. | No hosted TLS, volume/DB/object encryption, encrypted backup retention or hosted restore evidence was collected. Historical DB credential rotation remains required unless independently verified. |
| WEB | Nonce strict-script CSP and dynamic rendering are present in `web/lib/security-policy.ts:2`, `web/proxy.ts`, `web/app/layout.tsx`; shared session/business cache reset remains in `web/lib/session-reset.ts`. Server-side admin verification is retained. | Browser/production build were not rerun in this continuation; concurrent frontend work continues. Styles retain the documented inline allowance. |
| SUPPLY CHAIN / INFRA | Locked dependencies, SHA-pinned security-extended CodeQL, Dependabot, hashed pip-audit and retained CycloneDX inventory are present in `.github/workflows/security.yml`, `.github/dependabot.yml`. | npm full graph still has 9 high development dependency paths; production audit has zero. Hosted CodeQL/Actions, image/OS CVEs and deployment secrets remain unverified. |
| ABUSE / AVAILABILITY | Worker heartbeat readiness, three-second DB checkout, bounded supporting-list continuation and prior parser/queue/body/worker bounds survive reconciliation: `backend/orderfit/store/db.py`, `backend/orderfit/store/collection_page.py`. R04 bounds the new admin lists. | Edge/distributed quotas, readiness admission and hostile-network deployment acceptance remain open. |

## Checks executed now

- Non-database backend pytest: **359 passed**, one upstream Starlette/httpx
  deprecation warning. This excludes `tests/db` and live-provider tests.
- Five new database regression functions executed successfully against a newly
  initialized, marked, loopback-only **PostgreSQL 16.11** cluster with synthetic
  accounts and a separately provisioned non-owner runtime login. All migrations
  from empty through `0017_platform_authority` applied. Assertions cover every
  admin route's unauthenticated/forged/non-admin denial, real positive admin reads,
  cross-tenant denial, bounded lists, revocation between checks, elevation/demotion
  invalidation, and runtime self-promotion refusal. These were direct function
  invocations with the repository fixtures, not the Docker PG17 pytest harness.
  An initial native launcher stalled capturing child handles; the corrected run
  used detached output handles. The isolated server was stopped afterward.
- Focused auth/network suite: **15 passed** before the final mapping addition;
  final focused rerun recorded in the progress log. Ruff and generated-contract
  checks pass. Final focused rerun after the mapping addition: **15 passed**.
  Provisioner/RBAC checks: **6 passed**, including refusal before any write when
  the authority trigger is missing (`backend/tests/test_admin_provisioner.py:11`).
  Workflow/header assertions: **3 passed** after extending them to security CI.
  The 359-test run preceded that addition; the five DB checks include it.
  Sole migration head: `0017_platform_authority`.
- Frontend: **95 unit tests passed**, typecheck passed. These include concurrent
  teammate fixes and do not establish browser acceptance.
- Exact hashed runtime `pip-audit`: exit 0, **50 SBOM components, 0 known
  vulnerabilities**. npm production: **0**; full dependency graph: **9 high**.
- Docker daemon unavailable. No current PG17 full-suite, Docker build/runtime,
  browser, hosted deployment or CI-host acceptance is claimed. Earlier 507-test
  evidence remains historical for its earlier checkout.

## Rotation and release handoff

Rotate the historically committed `DATABASE_URL` and `DATABASE_URL_DIRECT`
credentials identified in earlier S01 unless independent evidence proves that
already happened. Also rotate/revoke the account credentials embedded in the
removed live RBAC suite if ever provisioned or reused. No secret values are
included, and Git history was not rewritten.

Deploy the forward migration before starting this runtime. Global admin data
access, MFA, encrypted retention/restore, external audit anchoring and hosted
security acceptance remain explicit unfinished work. Do not weaken TLS, RLS,
session freshness or approval requirements to satisfy those gates.

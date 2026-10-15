# ADR 0009: Restricted runtime credentials and session-derived tenant context

Status: accepted contract in P0, 2026-10-15. Database/auth implementation P1.

Reuse `business`, `app_user`, `membership`, existing RLS/reference roles and audit
functions. No second tenant/user system. API/worker use a non-owner LOGIN member
of `orderfit_app`, with neither BYPASSRLS, superuser nor `orderfit_admin` membership.
Only the migration process receives `DATABASE_URL_DIRECT`; no fallback to
`DATABASE_URL`. Compose no longer injects direct credentials or an entire developer
environment file into API. Explicit settings never automatically read `.env`.

Opaque random session tokens are stored only as digests. Argon2id is supplied by
locked `argon2-cffi`: memory 65536 KiB, time cost 3, parallelism 4, hash 32 bytes,
salt 16 bytes. The contract suite verifies parameters, correct/wrong password and
random salt behavior. P1 benchmarks login admission/rate limits on its host; do
not replace the vetted library with custom crypto. Sessions have eight-hour
absolute/30-minute idle expiry. Logout/password changes/revocation invalidate
sessions. Unsupported MFA-enforced accounts fail closed; new sandbox password
accounts explicitly set `mfa_enforced=false`.

Obtain user identity from a verified server session, select business only after
checking current membership, then set transaction-local parameterized
`app.user_id`/`app.business_id`. Context must disappear on commit/rollback and pool
reuse. Never trust the scaffold's `demo-rina` or caller-supplied actor. Narrow
SECURITY DEFINER auth/provisioning/queue helpers need fixed search_path, no PUBLIC
execution and dedicated privilege tests. Tenant owners may manage membership but
cannot change another global user's password/status. Protect the last owner.

Same-origin deployment is preferred. Cookie name `orderfit_session`, HttpOnly,
SameSite=Lax, Secure over deployed HTTPS; all authenticated mutations require
`X-CSRF-Token` plus exact allowed-origin verification. Signup/signin validate Origin
and use a pre-auth CSRF cookie/header challenge from `GET /api/v1/auth/csrf`
(P1 must implement it before enabling signup/signin).
Do not log credentials or exception request bodies. Do not trust arbitrary
forwarded headers. Generic login failure prevents email enumeration. Step-up is
bound to user/session/business/purpose/bundle, consumed with approval.

Trade-off: server sessions and restricted helper functions require DB work before
business endpoints, but make revocation and queued actor checks explicit. SQL's
coarse tier is narrowed by `contracts.protocol.PERMISSIONS`. Public APIs never
assign platform administrator roles. Actual LOGIN-role negative tests, including
no-context/pool reuse, are mandatory in P1; SET ROLE alone is insufficient.

Tracked database credentials were removed from the index in P0 with local bytes
preserved. Owner rotation of historical credentials remains required; no history
rewrite or configured/shared database access is authorized by this decision.

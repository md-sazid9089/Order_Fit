# Backend implementation plan: account recovery and invitations

Date: 19 October 2026. Status: planning only; no feature, migration or live send
implemented by this document. Scope authorized here is account email, recovery
and invitations; commercial execution remains sandbox-only.

Read the [shared account-access.v1 contract](contracts/account-access-v1.md) first.
Give the [frontend handout](account_access_frontend_handoff.md) to the frontend
developer and the [database handout](account_access_database_handoff.md) to the
database handler. Database changes are required. They share one contract, not
three independently designed implementations.

## Current evidence and architectural decisions

Source snapshot: HEAD `8a4e8b8`. The working tree was clean before these planning
files; required
schema in `backend/orderfit/store/db.py` is `0022_baseline_duplicates`, whose
predecessor is `0021_admin_reads`. Recheck HEAD/branch/status and Alembic graph at
implementation start. The development-context handoff reports a prior deployed
Neon at `0020_ai_workflow` and a startup block pending 0021/0022; that is historical
deployment evidence, not a current database inspection. Do not migrate any
configured/shared database based on this plan.

| Area | Actual source / consequence |
|---|---|
| Identity | `backend/orderfit/services/identity.py`, `api/routes/identity.py`: password change exists; no reset/verification commands |
| DTOs | `contracts/resources.py`: `email_verified: Literal[False]`; invitation response has optional one-time URL |
| Invitations | `services/membership.py`, `store/membership_repository.py`, `api/routes/members.py`: 72-hour tokens, SHA-256 digest, owner create/revoke; no list/reissue/mail transport |
| Invitation DB | `migrations/sql/0012_p7_operations.sql`: FORCE RLS, unique open business/email, immutable identity, matching signed-in acceptance |
| Passkeys | `services/passkeys.py`, `migrations/sql/0019_passkey_mfa.sql`: password + passkey login, `passkey_required` distinct from unsupported `mfa_enforced` |
| Auth locks | `migrations/sql/0014_runtime_hardening.sql`: sessions-before-user password-change repair; new reset must reconcile all current lock paths |
| Worker | `workflow/worker.py`, `workflow/operations.py`: tenant/session-authorized business jobs; unsuitable as-is for public reset mail |
| Runtime | `contracts/configuration.py` and `runtime.py` are active; `config.py` is legacy scaffold |
| Frontend | forgot-password notice; fragment-based explicit invite acceptance; `/useraccess` uses `components/users/users-screen.tsx` |
| Signup | `SignUp` requires business name/currency/timezone and calls owner provisioning; reusing it for invitees creates an unwanted business |

The simplest safe extension is a small account-access service, narrow DB helpers
and a dedicated mail outbox processed by the existing worker. Do not migrate to
a new authentication provider or queue framework for this bounded feature.
Encrypted outbox storage adds key-management and retention work, but durable
delivery cannot recover an exact secret link from its digest alone.

## B0 — Freeze contracts and test examples

1. Read root/backend AGENTS, development-context skill, current identity/security
   migrations and original plan V01/V04/V11/V12/V13. Preserve other owners' work.
2. Implement strict proposed DTOs in `contracts/account_access.py` (new), extend
   existing SessionView/InvitationView and catalogue without duplicating Role,
   SecretStr, pagination, error or acknowledgement definitions. Share route/body
   fixtures for all endpoints in the contract, including invalid examples.
3. Extend `contracts/export.py`/capability inventory and route registrations.
   Export backend-only while frontend owns `web/lib/generated-api.d.ts`; agree
   generated fixtures before enabling UI. Final integrated export/check covers
   browser declarations too. Reconcile existing idempotency error names now.
4. Publish route availability through public account-access capabilities. Feature
   flags default off, including invitation registration when mail is unavailable.
   Existing copied invitation acceptance and signed-in password change continue.

Gate: DTO tests enforce unknown-field rejection, SecretStr redaction, exact
schemas, nullable timestamps, boolean verification and role restrictions. Both
handoff owners receive the SAME final fixtures. No feature is claimed live.

## B1 — Database foundation (database handler owns migration)

Implement the database handout before application writes. Reserve next revision
`0023_account_access` after actual single head 0022, unless another task advances
the graph. Add verified-email state, dedicated credential generation, token
registry, encrypted mail outbox and minimal webhook event/suppression storage.
Preserve existing invitations and runtime privilege boundaries.

Define narrow global auth helpers rather than direct table grants. Auth request
replay, token issue/confirm and outbox enqueue must commit atomically. Existing
`auth_request` helpers may be extended with purpose-bound HMAC scope/expiry;
do not fork an unrestricted public idempotency table accidentally.

Inventory ALL SQL credential/session issuers and locks: `session_issue`,
`session_password`, `passkey_begin/take/enrolled/authenticated`, `session_resolve`,
owner provisioning and new confirmation helpers. Require a reviewed lock graph
and DB race tests before selecting a serialization change. A possible shared
per-user transaction advisory lock must be acquired before conflicting row locks
in every participating credential-changing/session-issuing path, including Python
transaction entry points; acquiring it after `session_resolve` locks is unsafe.
Do not assume adding `FOR UPDATE` to reset alone solves sign-in races.

Gate: fresh and upgraded disposable PostgreSQL; restricted API/worker credentials;
no direct secret reads; atomic reset; reset/login/password-change/passkey/profile
concurrency passes without stale sessions or deadlock. Existing authorization,
last-owner, session-authority and financial revision behavior remains intact.

## B2 — Account-email delivery adapter and worker

Proposed modules: `services/account_mail.py`, `store/account_access_repository.py`,
`providers/resend.py`, `workflow/account_mail.py` (new cohesive files; use existing
package conventions). Existing `httpx` can send API requests; add vetted Svix
verification and AEAD library dependencies through uv/lockfile. No hand-rolled
cryptography or global SDK key mutation. Hide provider behind a small typed
send/verification boundary; ordinary tests inject a recorded/fake transport.

Add explicit RuntimeConfiguration fields and matching `.env.example`, Compose,
runtime launch, deployment documentation and secret mounting:

| Setting | Contract |
|---|---|
| `ACCOUNT_EMAIL_MODE` | `off|recorded|resend`, default off; recorded forbidden in hosted production |
| `EMAIL_VERIFICATION_ENABLED`, `PASSWORD_RECOVERY_ENABLED`, `INVITATION_EMAIL_ENABLED` | boolean default false; recovery requires verification infrastructure |
| `PUBLIC_APP_ORIGIN` | exact trusted HTTPS origin, no path/query/credentials; explicit loopback-only development exception |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` | SecretStr; role-scoped deployment secrets; never browser-visible |
| `ACCOUNT_EMAIL_FROM` | fixed verified sender; no posted sender/recipient override |
| `ACCOUNT_EMAIL_ACTIVE_KEY_ID`, `ACCOUNT_EMAIL_ENCRYPTION_KEYS` | separate versioned AEAD keyring; no reuse of session secret; keys outside DB |
| `ACCOUNT_EMAIL_SOURCE_LIMIT` | 300/15 min initial, respect trusted proxy configuration |

API needs encryption and webhook verification; worker needs decryption and send
key. Prefer send key only in worker; validation must support split API/worker
configuration. Invalid enabled configuration fails startup; disabled mode may
start honestly without provider credentials. Do not let ordinary business
readiness lie because an optional account-email feature is off. Expose separate
mail readiness/backlog diagnostics without recipient data.

Worker admission/claims and publication follow contract leases, stable provider
keys, safe retry window and token expiry. Poll in existing process with a fair
bounded mail batch; preserve independent worker heartbeat. Persist immutable
template version, recipient, link/payload digest and provider key. Encrypt canonical
render-ready payload with AEAD and AAD binding outbox ID/purpose/template version.
Disable click/open tracking for these emails. Plain-text plus escaped HTML; do
not include financial data, credentials, business-sensitive attachments or posted
HTML. Freeze branding/sender changes per job so a retry remains identical.

Implement signed `/webhooks/resend` with raw-body limit before parsing, durable
event dedupe, early-event reconciliation and non-regressing delivery projection.
Bounce/complaint facts suppress new mail; public reset continues generic 202.
Sanitized metrics: queue age, attempts, outcomes, unknowns, signature failures;
never log recipients, body, link, token, password, API key or raw provider error.

Gate: provider-free crash/reclaim/lease and unknown-outcome tests; duplicate sends
reuse payload/key; expiry cancels sends; webhook replay/out-of-order tests pass.
No actual email or provider account configuration is part of planning delivery.

## B3 — Email verification and password recovery

Implement new `api/routes/account_access.py` and `services/account_access.py`;
mount through `api/main.py`. Reuse identity service password capacity limiter,
Argon2id hashing and CSRF validation. Password verification/hashing and AEAD
rendering occur outside DB row locks; confirmation transaction rechecks expected
credential generation and eligibility before applying prepared password hash.
Do not take a SQL transaction across a provider HTTP request.

Verification request requires fresh authenticated credentials; derive email from
server session, never client input. Token confirm checks exact current account
email and user, not only digest. Signup stays unverified and verification does
not grant a business role. Password changes invalidate previously issued resets.

For reset request: common admission/throttling/idempotency path, generic 202 for
all address-specific outcomes, bounded background mail enqueue, no synchronous
provider or account-specific success fields. Exercise timing distributions and
ensure source-wide overload responses are independent of account existence.

For reset confirm: atomic consume/hash update/credential-generation advance,
session and grant revocation, challenge invalidation, event and notice enqueue.
Sessions and session-bound pending worker authority are fenced after reset;
already completed sandbox effects remain historical evidence. Recheck queued
business execution cannot continue under revoked approval authority. Preserve
passkeys and require them at next login. Return acknowledgement, not SessionView.

Gate: happy path plus unknown/unverified/disabled accounts; expired/wrong-purpose/
reused tokens; two concurrent confirmations; retry after lost success response;
same key changed password conflict; old-password login race; passkey retained;
no recovery/session/step-up can be resurrected. No real delivery claim yet.

## B4 — Invitations and invitee onboarding

Extend existing membership services/routes/repository rather than replacing them:

1. Create invitation + digest + encrypted mail + tenant audit in one transaction.
   Email-mode response URL is null even on initial create. Transport failure later
   changes delivery status, not the existence of the invitation.
2. Owner-only signed-cursor list persists across reload. Delivery projection is
   joined/scoped without granting runtime access to encrypted payload columns.
3. Reissue is revoke-old + create-new + enqueue + audit, one business transaction
   with expected version and financial revision. Preserve the issuer FK/history;
   new issuer is the current owner requesting reissue. Old links fail immediately.
   Replay returns the same new invitation ID and never sends another email job.
4. Revoke cancels pending delivery; acceptance still rechecks database token state
   if mail was already in flight. Check original issuer remains active owner and
   business active at dispatch, registration and acceptance; otherwise require
   current owner to revoke/recreate. Acceptance must not auto-upgrade an already
   active member's role.
5. Invitation registration validates token and derives exact email, creates only
   an active local-password `app_user` with default profile, unverified email,
   `mfa_enforced=false`, `passkey_required=false`, no platform privileges/business/
   membership. Validate current issuer/business; record auth event and replay.
   Do not consume invitation or create a session here. Existing-email conflict is
   disclosed only after a valid invitation token. Then normal sign-in and explicit
   acceptance add the invited membership. Acceptance retains existing last-owner,
   reinstatement and authority-fencing rules; does not verify account email.

Gate: owner/non-owner/cross-tenant cases, last-owner preserved; list pagination;
two creates/reissues/accept-vs-revoke races; safe existing-user registration;
new invitee has zero businesses until acceptance; replay/reload does not lose
invitation management; legacy copied-link compatibility passes.

## B5 — Integration, release and evidence

Ownership: backend owns routes/DTO/export/worker/provider; DB handler owns manual
SQL/Alembic/roles/migration tests; frontend owns browser declarations/API client/UI.
Review SQL helper signatures before B1; finish B0 exports before frontend API work.
Frontend may build contract fixtures while DB/B2 work proceeds. Enable features
only after backend + DB + frontend acceptance converge on account-access.v1.

Required checks: Ruff; focused pure/API/contracts/architecture tests; new disposable
DB security/concurrency suites plus existing auth/passkey/P7/session-authority/
execution regressions; final appropriate full backend suite; frontend lint/type/
unit/build and browser acceptance. Consult existing pytest marker defaults: default
pytest does not prove E2E. Document actual commands/counts when run, not estimates.

Staging gate: verify actual DB target/revision and migrator identity; backup/restore
readiness; owner-managed migrations in order; restricted API/worker role probes;
sender-domain DNS and provider access; public HTTPS webhook endpoint; dedicated
test inboxes. Then explicit opt-in synthetic live send, mailbox link, real callback,
reset/sign-in/passkey and invitation signup/accept/reload tests. Prove secrets do
not appear in logs, analytics, tracking links, browser storage or exports.

Use additive migration before new binaries. Account-email flags stay off until
all gates pass. Existing runtime requires exact schema revision, so coordinate
API/worker restart with migration; old binaries may reject a newer revision.
Disabling flags stops new requests; separately pause/cancel outbox processing
and provider key to stop sends. Do not downgrade security history to roll back.

Final report must list changed files, deployed schema/roles, executed checks,
provider-free versus live evidence, frontend contract sync, known limitations
(unverified locked-out accounts and lost passkeys), blocked gates and next action.
Planning status today: source review and document consistency only; all runtime,
migration, browser and provider acceptance remains NOT RUN.

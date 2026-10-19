# Database handout: account recovery and invitation delivery

Date: 19 October 2026. Status: migration `0023_account_access` is now written and
tested on disposable PostgreSQL; no Neon/shared migration has been applied.
Review and deploy the provided migration rather than creating a second one.
Coordinate with [backend plan](account_access_backend_plan.md) and
[shared account-access.v1 contract](contracts/account-access-v1.md). The shared
contract owns policy/expiry/API semantics; this document owns persistence and
privilege requirements. Exact helper signatures must be agreed with backend
before any follow-up SQL changes. Actual files:
`backend/migrations/versions/0023_account_access.py` and
`backend/migrations/sql/0023_account_access.sql`. Use the
[release runbook](deployment/account-access.md) for role/configuration/cleanup
steps and the [implementation report](account_access_implementation_2026-10-19.md)
for verified gates. The design below is retained for review; the manual SQL is
authoritative for exact helper signatures and grants.

Implemented resolutions: reset/session issuance serialize through the user row;
credential-change trigger takes dependent row locks with NOWAIT and returns a
retryable 55P03 on a conflicting session/profile/passkey transaction. Session
generation is checked on resolution. A reset does not delete step-up rows because
approvals reference them: it marks grants consumed and revokes sessions. The new
helper owner is `orderfit_account_owner`; API/worker startup rejects membership
in that role. The 15-second bounded transport fits a 60-second lease without an
extra heartbeat thread. Global cleanup remains migrator-only and must be arranged
separately before hosted enablement. Recipient fingerprint-key rotation is not
implemented; keep that existing secret stable until a reviewed suppression
migration. These are the actual choices superseding alternative patterns below.

## Preflight and migration ownership

Work from the actual Alembic graph and manual SQL. Current source requires
`0022_baseline_duplicates` after `0021_admin_reads`; use proposed next revision
`0023_account_access`, down_revision `0022_baseline_duplicates`, only if that is
still the single head when work starts. Never modify applied SQL/revisions or
enable autogenerate (`migrations/env.py` has `target_metadata=None`). Name conflicts
or another new head require coordination and a reviewed forward/merge revision.

Historical development context reports a Neon target at `0020_ai_workflow` needing
0021 and 0022. It is NOT a fresh inspection. First identify local vs Neon, database
and branch, server version, installed revision, API/worker logins and actual role
memberships using sanitized read-only evidence. Never dump connection secrets.
Use `DATABASE_URL_DIRECT` only for the migrator; API/worker use restricted pooled
credentials. Apply/test on a disposable DB or isolated development branch first.
No shared-data migration, downgrade, role grant or live rollout is authorized
merely by this planning handout.

Read current 0005 foundation, 0012 P7, 0014 hardening, 0016 session authority,
0017 platform authority, 0019 passkeys and 0021 admin-read privilege patterns.
Revision names and SQL component filenames differ in places; inspect Alembic
wrappers rather than inferring order from SQL numbers.

## Proposed relational changes

All new names below are proposed; preserve their semantics and publish final
SQL signatures with backend fixtures. No replacement identity/invitation tables.

| Object | Required columns and constraints |
|---|---|
| `app_user` extension | `email_verified_at timestamptz NULL`, `verified_email text NULL`, `credential_generation bigint NOT NULL DEFAULT 1 CHECK (>0)`; verification timestamp/email are both NULL or both present; verified email equals current normalized email. Existing users remain NULL/unverified. |
| `account_access_token` | UUID PK; user FK; purpose `verify_email|reset_password`; unique 32-byte token digest; exact normalized email; credential generation at issue; created/expiry; consumed/revoked timestamps; expiry > creation and purpose max lifetime; no raw token or password. Partial unique `(user_id,purpose)` for unconsumed/unrevoked rows; revoke expired live row before issuing another. |
| `account_mail_outbox` | UUID PK; kind `verify_email|reset_password|password_changed|invitation`; user FK and/or invitation reference as appropriate; nullable business UUID; exact encrypted canonical payload + key ID + nonce; immutable template version/payload digest/provider dedupe key; link expiry; queued/attempt/lease timestamps and lease token; status, attempt count, provider email ID, safe failure code, provider acceptance/delivery timestamps; permanent uniqueness on semantic mail identity. |
| `account_mail_event` | provider + unique event ID (Svix delivery ID), provider email ID, event type/time, received time, minimal processing state; optional outbox reference for events arriving before publication; no raw body or recipient list. |
| `account_mail_suppression` | 32-byte keyed normalized-recipient fingerprint PK (same derivation and stable key in API/worker), cause `bounce|complaint`, created time; private helper access only. No online fingerprint rotation or generic suppression-clear endpoint in this release. |

Outbox invitation references must be composite `(business_id,invitation_id)` to
existing invitation `(business_id,id)`. Account-email rows have no tenant; never
assign an arbitrary business. Add kind-specific CHECKs: invitation requires its
business/invitation reference; account mail requires user, no invitation; token
mail requires token reference and expiry. Purpose/type references cannot allow
a verification token to authorize reset. Prefer explicit FK + unique pairs or
narrow helper checks where a cross-table CHECK is impossible.

Frozen payload must be reconstructable identically across retries. AEAD encryption
is performed by application using independent versioned keyring outside DB;
DB stores ciphertext/nonce/key ID/AAD metadata, never decryption keys. Digests
are not a substitute for encryption. Only restricted claim helper returns one
leased payload to worker. Owners get a safe delivery projection, not ciphertext.

Indexes: token digest unique; token user/purpose/live state; invitation paging
already exists; outbox runnable `(next_attempt_at,id)` partial on retryable states;
lease expiry partial on sending; provider ID lookup (unique when non-null);
unique `(kind,token_id)` for token mails, `(kind,invitation_id)` for invite mails,
and password-change notice `(kind,user_id,credential_generation)`; event provider
ID + processing state; suppression fingerprint. Enforce nonnegative attempts,
valid state/lease combinations and immutable recipient/template/provider key.

Payload may become NULL only via controlled purge after no further retry is
permitted. Proposed retention: purge ciphertext immediately after definitive
provider acceptance or terminal cancellation/failure; retain unknown-outcome
payload only until safe retry deadline then purge; purge unused token payloads
at expiry. Retain token digests and sanitized outbox/event metadata 90 days after
expiry/closure, then delete via narrow maintenance helpers; suppression remains
until reviewed clearance. Existing immutable
`security_event` retention stays unchanged. Cleanup must not revive tokens/jobs,
delete invitation/audit history or violate surviving foreign keys. Agree explicit
FK cleanup order before implementing maintenance: expire/purge secret payloads
first; detach event-to-outbox references while retaining minimal event dedupe
tombstones until their retention ends; delete eligible terminal outbox rows;
then delete unreferenced expired/closed token rows. Invitation/audit references
are retained, never cascaded away. Retention is a minimum for still-referenced
records, not permission to delete a live token or retryable job.

## Helpers, privileges and audit

FORCE RLS on new auth-global tables, no broad runtime policies or direct runtime
table access. Use dedicated private NOLOGIN/NOBYPASSRLS helper owner roles and
explicit narrow owner policies, following current security conventions. Tenant
invitation reads retain business isolation and owner checks. Runtime login may
not own tables/functions or inherit admin/helper-owner authority. Audit default
privileges: older blanket grants must not expose new objects or sensitive columns.

SECURITY DEFINER helpers must pin search_path, qualify objects, validate sizes,
purpose/status/expiry, and revoke PUBLIC EXECUTE. API grants only necessary
request/confirm/projection helpers; worker grants only claim/heartbeat/publish/
suppression helpers; maintenance privileges separate. No arbitrary SQL, status,
user/tenant authority, sender, recipient or payload substitution through helpers.
The API is a trusted service boundary for prepared Argon2id hashes/encrypted
payloads, but caller-posted identity must never become DB authority.

Backend and DB owners must freeze these helper families before writing callers:

- Issue/supersede a purpose-bound token and enqueue its encrypted email atomically;
  replay must not enqueue another. Public lookup helpers reveal only minimal
  eligibility data to trusted API and never raw auth-table rows to SQL callers.
- Confirm verification under matching current session and email; confirm reset
  under token digest + expected credential generation. Invalid token states share
  one false/no-row outcome. Password hashing occurs outside lock transaction.
- Reset consumption + password update + generation increment + session revocation
  + outstanding token/challenge/step-up invalidation + security event + one notice
  enqueue + replay success commit together. Never reset passkey flags/public keys.
- Authenticated password change advances generation and invalidates reset grants
  too; no account email-change path may preserve old verification. If email editing
  is unsupported, keep it unsupported rather than creating a hidden bypass.
- Invitee-only user provisioning from a validated current invitation creates no
  business, membership, verification or session; no caller-controlled email/role/
  platform status. Existing-email result is returned only after token validation.
- Invitation list/projection does not expose digest/ciphertext; reissue revokes
  old invitation, cancels unsent mail, inserts new invitation+mail+audit atomically.
  Registration/acceptance require active business and current original issuer-owner
  authority, as dispatch does. Preserve last-owner/membership-authority triggers.
- Outbox claim uses short `SKIP LOCKED` transaction, fresh UUID fence and bounded
  lease; heartbeat/publish require exact unexpired fence. Use DB time. Never keep
  transaction open across provider HTTP. Job expiry/revocation checked at claim
  and before send; publish preserves facts from late callbacks.
- Webhook persistence dedupes event ID and reconciles unknown/early provider IDs;
  monotone delivery projection handles bounce/complaint without losing facts or
  restoring a suppressed recipient. Callback is delivery evidence, not membership.

Existing global `security_event` records recovery/verification/registration codes
without tokens/passwords/links. It currently takes only user/code/time evidence;
do not assume it can store arbitrary JSON. Extend narrowly if request/outbox
correlation is required, or use protected outbox metadata. Tenant invitation
commands use existing canonical audit functions and commit audit with mutation.
Do not create a competing hash-chain implementation.

## Concurrency gate: do not skip

Read the existing sessions-before-user repair in 0014 and the challenge/user/
session locks in 0019. Resetting with only a user row lock can race session
issuance; bulk revocation can deadlock with profile or passkey enrollment.
Before implementation, publish an explicit lock graph shared by ALL affected
entry points, including Python-held session context. A credential generation and
shared per-user serialization boundary are recommended; adding an advisory lock
after another conflicting row lock does not establish that boundary.

Prove reset vs password login, passkey login/enrollment, password change and
profile update. A session admitted before reset must be revoked; one admitted
after must validate the new credentials. Old challenges cannot publish afterward.
Concurrent same-token reset: exactly one mutation/notice; same-key retry success;
different-key reuse invalid. Token renewal vs confirm also serializes. Invitation
accept/revoke/reissue/create race on existing business/invitation locks; exactly
one open invitation per business/email, no duplicate memberships or lost audit.
Exercise pooled connections and rollback; no leaked tenant/session context.

## Verification and release handback

1. Fresh disposable upgrade through new head; upgrade seeded 0022 with legacy
   invitations/users; data unchanged except additive defaults. No verification
   backfill; original legacy tokens still validate within original constraints.
2. Actual restricted API/worker LOGIN probes, not owner-only tests: no secret
   SELECT/UPDATE, RLS cross-tenant denial, helper execute boundaries, no runtime
   role escalation, no direct reset/password write capability.
3. Purpose/expiry/reuse/stale-generation/replay tests; credential/passkey retention;
   disabled account rejection; transaction rollback leaves no consumed-only token
   or password-only mutation; unique outbox and notice invariants.
4. Claim/reclaim/crash-before-send/crash-after-provider-acceptance, expired fences,
   duplicate callbacks, early callbacks and replay-window cutoff; cleanup does not
   resurrect work. Ciphertext unreadable without correct versioned key; tamper,
   wrong AAD and wrong key fail closed without logging plaintext.
5. Existing membership/P7/session-authority/passkey/approval/worker regressions;
   required schema constant and readiness/role checks agree with migration.

Before shared rollout provide sanitized target/revision evidence, reviewed SQL,
role-grant script, backup/restore posture, estimated lock/backfill cost, disposable
test commands/results and application compatibility matrix. Existing exact-head
startup checks mean additive SQL alone does not guarantee old binaries run;
coordinate bounded maintenance/restart for API AND worker.

Keep account-mail flags off through migration, deploy compatible code, verify
restricted roles and schema, then stage provider/HTTPS/browser gates before
enabling traffic. Separate disabling new requests from stopping existing queued
sends. Rollback is feature disable + reviewed forward repair; no destructive
downgrade of token, audit or invitation history. Final handback lists PASS/FAIL/
BLOCKED/NOT RUN per gate and explicitly states whether any shared DB changed.

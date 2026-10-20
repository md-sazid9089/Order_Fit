# Account recovery and invitations: implementation evidence

19 October 2026. Backend implementation completed locally from checkout
`42e9bc2`; changes are uncommitted. Account-email features and mail-worker sending
default OFF. No configured/shared database, Neon migration, provider configuration,
live email, frontend implementation, or deployment was changed by this work.

## Delivered backend

- Strict account-access.v1 DTOs and mounted verification/reset/registration/
  capabilities/webhook routes; required verified-email/recovery-eligibility session
  fields and required safe invitation-delivery fields. Public reset responses use
  the actual two-field acknowledgement; no account/token/job details are exposed.
- Forward migration `0023_account_access` after 0022. Verified email starts NULL;
  existing users, memberships and invitation tokens are retained. New private
  token/outbox/event/suppression tables use FORCE RLS, a NOLOGIN/NOBYPASSRLS helper
  owner and narrow API/worker execution grants. Startup rejects helper-owner
  inheritance as well as existing owner/admin restrictions.
- Credential generation advances on password/email writes. Reset consumes one
  token atomically, changes password, revokes sessions/challenges/step-ups,
  preserves passkeys and approval history, queues one notice and records a
  security event. Same-key lost-response replay returns the same acknowledgement.
  Ordinary authenticated password changes invalidate issued recovery tokens and
  notify verified addresses when account email is enabled.
- Durable encrypted mail payloads (AES-GCM, versioned external keyring, frozen
  template/recipient/provider key), processed one per existing worker tick. There
  is no dummy business/session, Redis, second worker service or commercial effect.
  HTTP transport has a 15-second overall deadline, 5-second connect limit and
  bounded response. Expired/reclaimed leases are fenced; retries retain payload
  and provider key and stop before Resend's 24-hour dedupe window expires.
- Signed raw-byte Svix callbacks with body/timestamp/signature validation,
  persistent duplicate detection, early-event reconciliation and monotone
  complaint/bounce/delivery/acceptance precedence. Complaints/bounces suppress
  later sends; raw callbacks and provider errors are not logged or returned.
- Existing owner invitation create/revoke extended with atomic email admission;
  signed-cursor history, reissue with a new token/ID and version checks, current
  issuer/business checks, cancellation and safe delivery projection. Listing uses
  one SQL round trip rather than one mail-status round trip per invitation.
- Invitation registration creates only an unverified local-password account;
  no business, membership, platform privilege or session. Normal sign-in and
  explicit matching-email invitation acceptance remain separate.
- Runtime, Compose, root/backend example settings and default-off hosted settings;
  API launcher strips send key/worker switch. Migrator-only sanitized status and
  explicit retention-maintenance CLI. Backend OpenAPI/TypeScript exports and
  validated synthetic examples are current; browser declarations were not edited.

Key files: `backend/orderfit/{contracts,services,store,workflow}/account_access*`,
`services/account_mail.py`, `services/mail_crypto.py`, `services/resend.py`,
`workflow/account_mail.py`, `api/routes/account_access.py`, existing identity/
membership/worker boundaries, and `backend/migrations/{versions,sql}/0023_account_access.*`.
See Git diff for exact paths; these are module groups, not a claim that every
group has an identically named file.

## Deliberate resolutions during implementation

The current `Acknowledgement` has only `request_id` and `completed`; the planning
example's CSV-specific fields were stale. The shared contract/examples now match
the actual backend. New output fields are required in exported schemas as well
as present in API JSON. Existing admin capability metadata is retained; provider
callbacks have signed-header metadata and arbitrary raw JSON, not browser CSRF.

Reset locking uses authoritative user-row serialization plus NOWAIT on dependent
session/token/challenge/grant rows. A conflicting session/profile/passkey lock
returns retryable SQLSTATE 55P03 without a partial write or deadlock cycle.
Existing session issuers validate expected password hashes and serialize on the
same user row; inserted sessions carry the generation checked at resolution.
Approval FKs require retaining step-up rows, so grants are marked consumed rather
than deleted. A dedicated regression resets an approved queued execution and
proves no sandbox effect occurs while approval history remains readable.

Manual copied invitations remain compatible when email mode is off. Email-mode
create/reissue/list/replay expose no bearer URL. A password reset never removes
passkey requirements. Unverified locked-out users and lost passkeys have no new
override. Email verification remains an explicit signed-in enrollment step.

No send heartbeat thread is needed for the bounded 15-second attempt inside a
60-second lease; publication still requires the exact current fence. Retention
is deliberately a separate privileged operation, not broad worker DELETE grants.
The deployment owner must arrange ongoing cleanup even when sending is paused.
Online recipient-fingerprint key rotation and generic suppression clearing are
not implemented; retain that existing secret until a reviewed migration.

## Verification

All database tests use newly labeled loopback disposable PostgreSQL 17 containers
with distinct restricted API and worker logins. The fixture runs the original
296-check SQL suite before and after upgrade, legacy concurrency checks, a fresh
database upgrade, and legacy-row preservation. No application environment URL is
used as a destructive test target.

| Gate | Result / scope |
|---|---|
| Ruff | PASS on backend sources/tests/migration wrapper |
| Backend contract export/check | PASS, 134 operation IDs; browser declaration sync intentionally remains with frontend owner |
| First complete focused run | PASS: 187 tests, 1 existing Starlette deprecation warning |
| Final frozen-source focused run | PASS: 187 tests in 69.97 seconds; 1 existing Starlette deprecation warning; final locked dependencies and source |
| Broad default backend regression | 806 passed, 1 deselected, 1 stale schema-head assertion failed, 5 existing dependency deprecation warnings |
| Schema-head correction | Expected 0023 and predecessor 0022 now asserted explicitly; the corrected test is included in the passing focused run |
| Compose example configuration | PASS (`docker compose --env-file .env.example config --quiet`); no service started |
| Documentation links / whitespace | PASS at final handoff |
| Hosted migration / live delivery / frontend browser | NOT RUN; rollout gates remain open |

The broad run was not repeated wholesale after correcting its sole outdated
assertion and finishing the targeted contract/security deltas. Do not describe
it as a clean all-tests-pass full run. The frozen focused run includes all changed
account-access behavior, contracts, migration graph, foundation auth, signed
passkeys, P7 membership, session authority and execution recovery.

Focused command, from `backend/` (task-specific base/cache paths omitted):

```text
uv run pytest tests/test_account_access.py tests/test_runtime.py tests/test_runtime_resources.py tests/test_architecture.py tests/contracts tests/db/test_account_access.py tests/db/test_foundation.py tests/db/test_passkeys.py tests/db/test_p7_operations.py tests/db/test_session_authority.py tests/db/test_execution_recovery.py tests/db/test_migration_merge.py -q --tb=short
uv run ruff check .
uv run python -m orderfit.contracts.export --backend-only --check
```

Evidence logs are local task artifacts at `D:/Kam 2/account-access-full.log`,
`account-access-final.log` (first 187-test pass), and `account-access-frozen.log`
(final source); no real credentials/inbox content are used by these tests.
The lockfile retains the prior cryptography 50.0.2 and adds explicit AEAD/Svix/
HTTP runtime dependencies; final focus uses that locked environment.

## Handoff and remaining gates

1. [Database teammate](../../account_access_database_handoff.md): review/apply the supplied
   migration in the correct target; preserve owner/runtime separation, backup/
   restore posture and exact-head API/worker cutover. Do not independently recreate
   0023. Earlier 0021/0022 rollout still needs reconciliation against actual DB.
2. [Frontend teammate](../../account_access_frontend_handoff.md): synchronize declarations,
   build verification/reset/invitation flows, handle signed-in users with zero
   memberships, and perform real desktop/mobile/theme/accessibility checks.
3. [Deployment owner](../../deployment/account-access.md): configure HTTPS origin, sender
   DNS, tracking-disabled security links, worker-only send key, signing secret,
   keyring backup/restore, privileged cleanup and real mailbox/callback tests.

Default-off feature switches are intentional until these gates converge. This is
backend acceptance evidence, not production or complete end-to-end acceptance.

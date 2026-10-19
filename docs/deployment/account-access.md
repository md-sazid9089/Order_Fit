# Account-access.v1 deployment and operations

19 October 2026. Backend implementation is local; this is an operator runbook,
not evidence of a hosted migration, sender configuration or mailbox delivery.
Use the [shared contract](../contracts/account-access-v1.md) and
[implementation evidence](../account_access_implementation_2026-10-19.md).

## Release order

1. Database teammate identifies the actual database/Neon branch and deployed
   Alembic revision using read-only inspection. Verify backup/restore readiness
   and migrator versus API/worker credentials. No migration to Neon was performed
   by this implementation task. Do not create a second account-access migration.
2. Review `backend/migrations/versions/0023_account_access.py` and its manual SQL.
   This revision follows `0022_baseline_duplicates`. If deployed at 0020, apply
   0021 and 0022 before 0023, with their own earlier handoffs/backfill review.
   Reconcile any newer deployed graph before using these instructions.
3. In the reviewed migration-only environment, apply through
   `uv run alembic upgrade 0023_account_access`. Runtime credentials must not
   receive `DATABASE_URL_DIRECT`, migration-owner membership, or the new
   `orderfit_account_owner` role. The migration grants helper EXECUTE privileges
   to existing `orderfit_app` / `orderfit_worker` group roles; no new login is needed.
4. Deploy compatible API AND worker; both require exact schema head 0023. Old
   binaries may refuse the new head even though the data migration is additive.
   Keep account-mail feature switches and worker processing off during cutover.
5. Frontend teammate integrates generated declarations and new flows. Backend
   exports are in `docs/contracts/frontend-api.d.ts` and `openapi.json`;
   `web/lib/generated-api.d.ts` remains owned by the frontend teammate. Do not
   enable account recovery until the real reset and verification pages exist.
6. Configure Resend and a dedicated synthetic staging mailbox; execute the live
   acceptance checklist below. Enable invitation email and verification first.
   Ask existing signed-in users to verify their addresses before relying on
   recovery; locked-out unverified accounts have no bootstrap override.

The existing Render blueprint includes a pre-deploy migration command and owner
credential settings. Do not blindly trigger that deployment in a database-owner
managed rollout: the owner must review that pre-existing migration/credential
handling and ensure the runtime rejects/does not receive owner credentials.
This change adds default-off account-mail switches; it does not deploy Render.

## Configuration

| Setting | API | Worker |
|---|---|---|
| `ACCOUNT_EMAIL_MODE` | `off` until ready, then `resend` | same |
| `ACCOUNT_EMAIL_ENVIRONMENT` | `staging` or `production` for hosted | same |
| `EMAIL_VERIFICATION_ENABLED` | opt-in `true` | same configuration |
| `PASSWORD_RECOVERY_ENABLED` | opt-in `true`; verification must be enabled | same |
| `INVITATION_EMAIL_ENABLED` | opt-in `true` | same |
| `ACCOUNT_EMAIL_WORKER_ENABLED` | absent/false | explicit `true` to send |
| `PUBLIC_APP_ORIGIN` | exact trusted HTTPS browser origin, also in ALLOWED_ORIGINS | same |
| `ACCOUNT_EMAIL_FROM` | fixed verified sender | same |
| `ACCOUNT_EMAIL_ACTIVE_KEY_ID` | active AEAD key version | same |
| `ACCOUNT_EMAIL_ENCRYPTION_KEYS` | JSON object mapping key ID to base64 32-byte secret | same keyring |
| `RESEND_WEBHOOK_SECRET` | endpoint signing secret | required by shared configuration validation |
| `RESEND_API_KEY` | never needed; local launcher strips it | send-only/domain-restricted key |
| `ACCOUNT_FINGERPRINT_KEY` | existing stable secret for recipient suppression fingerprints | same |
| `ACCOUNT_EMAIL_SOURCE_LIMIT` | 300 requests/source/15 min default | same/default |

`ACCOUNT_EMAIL_MODE=recorded` is only for development and makes no provider calls.
It records simulated acceptance in PostgreSQL, not an inbox. `off` requires no
mail credentials. For hosted settings, set environment explicitly; recorded mode
is rejected outside development, and trusted HTTPS is required outside the
development loopback exception. Never copy example placeholders into a live key.

Generate independent AEAD secrets with a cryptographic generator, save in the
secret manager, and inject without committing/printing the values. Do not reuse
the session secret. Keep old AEAD key versions until their queued/unknown payloads
are reconciled/expired; changing the active key affects new mail only. Back up
the keyring separately from DB data and test restore/decryption of synthetic
payloads. Do not rotate the existing recipient fingerprint key casually: doing
so changes suppression fingerprints. A separately reviewed suppression migration
is required before that key changes; online fingerprint-key rotation is not
implemented in this release.

Local launcher forwards only each role's settings and strips the send key and
worker enable switch from API. Compose uses the same common settings, with send
key/switch only on worker. The worker processes at most one mail per business-job
tick; it has a separate presence connection. No Redis or second worker service.

Configure the sending domain's DNS and verify it in Resend. Disable click/open
tracking for account emails at the provider/domain level and verify the actual
received links are intact; the sending API does not configure your domain.
Register HTTPS callback `/api/v1/webhooks/resend` on the backend-reachable origin.
It verifies raw bytes with Svix; normal browser cookies/CSRF are not used there.
Keep the endpoint signing secret synchronized. Browser pages use no-referrer,
no-store/noindex and exclude third-party analytics, as the frontend handoff requires.

## Recovery and delivery operations

Password reset changes only the password. Passkey-enabled users still need their
passkey to log in; lost-passkey recovery is not supplied. Verification/signup/
invitation are separate evidence. Manual copied invitation creation remains
compatible when email mode is off; in email mode all returned invitation URLs
are null. List/reissue/revoke give owners durable management after reload.

Public requests return generic acknowledgement; provider outage after admission
does not reveal account state or roll back the durable request. Monitor sanitized
worker events `account_mail_result` and `account_mail_tick_unavailable`. Outbox
state `accepted` means provider acceptance, `delivered` means delivery callback;
neither means read or membership accepted. HTTP 429 responses include Retry-After.

Transport has a 15-second overall AnyIO deadline, 5-second connection limit and
64-KiB response cap. Lease is 60 seconds; one bounded send needs no renewal thread.
Reclaimed work keeps exactly the same provider key and frozen encrypted payload.
Retries respect provider backoff and stop at eight attempts, token expiry or
23 hours since first attempt. Unknown outcomes must not be resent with a new
key. A revoked invitation's in-flight email can still arrive, but acceptance
always rechecks database authority and token state.

Bounce/complaint events suppress future sends under the stable recipient
fingerprint. There is no owner-facing suppression override or public recovery
delivery lookup. Review the provider and protected DB evidence before an operator
clears suppression; this release intentionally provides no generic clear endpoint.

Migrator-only diagnostics, from `backend/` with a separately reviewed target:

```text
uv run python -m orderfit.store.account_mail_maintenance status
uv run python -m orderfit.store.account_mail_maintenance cleanup --apply
```

These use `DATABASE_URL_DIRECT`, never a runtime service. Status outputs only
state/count/age, not recipients/tokens/payloads. Arrange a separate privileged
maintenance job before enabling hosted mail (at least once per minute for expired
ciphertext, daily retention is insufficient for secret expiry). It must continue
even if mail processing is disabled. The task did not create a scheduled job.
Successful sends/rejections/cancellation purge ciphertext immediately; runnable
expired work is also cleared on claim. Maintenance clears remaining expired
payloads and 90-day terminal token/outbox/event records without touching existing
invitation/audit history or suppression. No runtime gets broad cleanup privileges.

## Live acceptance gate

Keep evidence PASS/FAIL/BLOCKED/NOT RUN separately for each item:

- Migrated isolated target and restricted-role readiness; no private helper-owner
  inheritance, direct secret reads or cross-tenant invitation management.
- Verified sender, fixed recipient test inbox, no tracking/link rewriting, actual
  receipt of verification/reset/invitation/password-change emails.
- Real signed callbacks, duplicate and early callback handling; bad signatures
  rejected and no raw bodies/secrets in logs or dashboard error output.
- Settings verification; generic reset request; single-use reset; old sessions/
  approval step-ups rejected; new password sign-in; retained passkey requirement.
- New invitee registration has no business or membership until explicit acceptance;
  existing invitee matching identity; owner reload/reissue/revoke and stale errors.
- Maintenance/keyring backup/restore and old-key readability; ciphertext expiry;
  provider timeout/unknown recovery; disable switches and queue pause exercised.
- Frontend generated declarations synchronized, desktop/mobile/theme/accessibility
  checked against real APIs. Local fake transport tests do not pass this gate.

Rollback: stop new requests using feature flags; separately disable worker sending
and, when necessary, revoke the worker send key. Existing emailed tokens continue
to require enabled confirmation endpoints and DB validity. Re-enable only after
reconciliation. Use reviewed forward repair for schema problems, not destructive
downgrade of token, invitation, approval or audit history.

# Account recovery and emailed invitations: shared contract

Date: 19 October 2026. Status: backend implemented locally; deployment and frontend
integration pending. [Evidence](../account_access_implementation_2026-10-19.md).
Contract name: `account-access.v1`. This file is the shared source of truth for
[backend](../account_access_backend_plan.md),
[frontend](../account_access_frontend_handoff.md), and
[database](../account_access_database_handoff.md) work. Changes to routes, fields,
errors, policy or expiry must update all affected handoffs before implementation.

Validated synthetic payloads are in [account-access-examples.json](account-access-examples.json).
Generated backend declarations are [frontend-api.d.ts](frontend-api.d.ts).
The frontend owner must synchronize the browser declaration and implement the
pages before deployment enables account-email features.

## 1. Scope and policy decisions

- Deliver account-email verification, password-reset links, password-change
  notifications, and tenant invitations through Resend. Commercial negotiation,
  bank, payment and lender actions remain sandbox-only. Account mail is a separate
  allowlisted effect; it does not use commercial action bundles or T3 approval.
- Existing users start unverified. No migration backfill declares email ownership.
  Verification is initiated while signed in, with current password and a recent
  session (authenticated within five minutes; MFA session when passkeys required).
  Completion requires that same user to be signed in and click an explicit button.
  Receiving or opening an email, signup, and invitation acceptance do not by
  themselves mark the account email verified.
- Reset eligibility: active local-password account with the current account email
  verified; `mfa_enforced=true` unsupported accounts remain ineligible. Unverified,
  nonexistent and ineligible accounts get the same public request response.
- Email resets the password, never a passkey. Preserve `passkey_required`, all
  registered public keys, role assignments, platform authority and memberships.
  After reset, login still requires the enrolled passkey if one is required.
  Lost-passkey recovery and administrator password overrides are out of scope.
- Verification is opt-in from Settings in this release. Existing unverified users
  who are already locked out cannot bootstrap email recovery; show this limitation
  publicly without revealing a submitted address's state. Do not claim that a
  business owner has an account-recovery override. Plan verification enrollment
  before inviting existing users to rely on recovery.
- Invitations remain owner-only, exact-email-bound, explicitly accepted, 72 hours
  from issue. Reissue revokes the old invitation and creates a new ID/token/expiry;
  never edits an old recipient, role or token. Preserve existing revision checks.
- New invitees use invitation registration, without `owner_provision`, personal
  business creation, auto-login or automatic membership acceptance. Existing
  accounts sign in normally. Both reopen the email link and explicitly accept.
- No public token-inspection GET and no token consumption on GET, page load, link
  preview or webhook. A delivered invitation is not an accepted invitation.

## 2. Wire rules

API prefix `/api/v1`; browser calls follow the existing same-origin API client.
UUIDs are strings; versions are positive JSON integers; timestamps are ISO UTC.
Use existing strict DTOs (`extra=forbid`), Email validation and allowed Role values:
`viewer`, `auditor`, `commercial_lead`, `risk_officer`, `owner`.
Normalize account/invitation email consistently with existing lower/trim semantics;
do not apply provider-specific dot/plus rewriting.

All browser POSTs require `Idempotency-Key` (1–200 nonblank characters), trusted
`Origin`, cookie `orderfit_csrf`, and matching `X-CSRF-Token`. Obtain a challenge
through existing `GET /auth/csrf`. Public commands use the existing unauthenticated
mutation checks; verification commands require a current session. Never require
the forgotten password to request or complete a reset. Headers and query strings
must never contain a recovery/invitation token. Cookies remain HttpOnly/Secure.

Successful empty responses use existing `Acknowledgement`:
`{"request_id":"<opaque request reference>","completed":true}`.
For 202, `completed` acknowledges durable request handling, not email delivery.
No account, eligibility, token, mail-job ID or recipient information is returned
from public reset request. Frontend displays the generic text locally.

### Routes and operation IDs

| Method and path after `/api/v1` | Operation ID | Body / query | Success |
|---|---|---|---|
| GET `/auth/account-access` | `account_access_capabilities` | none, public | `AccountAccessCapabilities` |
| POST `/auth/email-verification/request` | `email_verification_request` | `{current_password}`; authenticated | 202 acknowledgement |
| POST `/auth/email-verification/confirm` | `email_verification_confirm` | `{token}`; authenticated matching user | 200 acknowledgement |
| POST `/auth/password-reset/request` | `password_reset_request` | `{email}`; public | 202 acknowledgement |
| POST `/auth/password-reset/confirm` | `password_reset_confirm` | `{token,new_password}`; public | 200 acknowledgement; clear browser auth cookies |
| POST `/auth/invitations/register` | `invitation_register` | `{token,full_name,password}`; public | 201 acknowledgement; no session |
| GET `/businesses/{business_id}/invitations` | `invitations` | signed cursor, limit 1–100 (default 50) | `Page[InvitationView]`; owner only |
| POST `/businesses/{business_id}/invitations` | existing `invitation_create` | existing `{email,role,expected_financial_revision}` | 201 `InvitationView`; owner only |
| POST `/businesses/{business_id}/invitations/{invitation_id}/reissue` | `invitation_reissue` | `{expected_version,expected_financial_revision,reason}` | 201 new `InvitationView`; owner only |
| POST `/businesses/{business_id}/invitations/{invitation_id}/revoke` | existing `invitation_revoke` | existing revision/reason DTO | 200 `InvitationView`; owner only |
| POST `/auth/invitations/accept` | existing `invitation_accept` | existing `{token}`; authenticated | existing fresh `SessionView` |
| POST `/webhooks/resend` | `resend_webhook` | bounded raw body + signed Svix headers | 200 acknowledgement after persistence |

`current_password`: SecretStr 1–1024 chars; new password and registration password:
SecretStr 12–1024 chars, existing Argon2id policy. `full_name`: existing Text.
Token: SecretStr 32–512 chars, generated from at least 32 random bytes. No email,
user ID, tenant ID, role or redirect is accepted in reset-confirm/registration.
Identity and destination come only from the validated stored token.

`AccountAccessCapabilities` fields (all required):

```json
{
  "contract_version": "account-access.v1",
  "email_verification": "available",
  "password_recovery": "available",
  "invitation_email": "available",
  "invitation_registration": "available"
}
```

Each capability is `available|disabled|unavailable`, independent of submitted
addresses. No secrets or account-specific policy in this public response. GET is
`Cache-Control: no-store`; flags reflect configuration/dependencies known to the
application, not proof that an individual email will arrive. The authenticated
business capability catalogue must expose the new invitation operations too.

Change `SessionView.email_verified` from `Literal[False]` to boolean derived from
verification of the current exact account email. Add required
`password_recovery_eligible: boolean`, derived from account state and verification
(not provider uptime). Public reset requests never return this field.

Retain all existing `InvitationView` fields and add required `delivery`:

```json
{
  "status": "queued",
  "attempts": 0,
  "last_attempt_at": null,
  "accepted_at": null,
  "delivered_at": null,
  "failure_code": null
}
```

Status: `not_requested|queued|sending|accepted|delivered|failed|bounced|complained|unknown|cancelled`.
Attempts: nonnegative integer. Timestamps nullable UTC.
`failure_code`: null or `DELIVERY_REJECTED|DELIVERY_RETRY_EXHAUSTED|DELIVERY_OUTCOME_UNKNOWN|DELIVERY_SUPPRESSED|DELIVERY_CANCELLED`.
`accepted_at` inside delivery means provider acceptance; top-level
`InvitationView.accepted_at` means membership acceptance. Never conflate them.
Provider email IDs, internal leases, token digests and raw provider errors are
never returned to owners. Legacy invitations use `not_requested` and zero attempts.

`invitation_url` remains nullable for compatibility, but NEW email-mode create,
list, reissue, revoke and replay responses always return null. Existing manually
issued links continue to validate until their original expiry/revocation.
Owner listing sorts `(created_at,id)` descending, uses existing signed cursor
bound to business, user, listing and position. Include closed history; UI derives
pending/expired/accepted/revoked from timestamps separately from delivery state.

Reissue permits pending/expired unaccepted invitations, including a lost-response
case; requires expected version and reason. Accepted/revoked rows return
`INVITATION_CLOSED`. A revoked invitation is replaced through ordinary create.
Reissue preserves recipient and role. Replayed reissue returns the SAME new ID.

### Errors

Use existing `ErrorEnvelope` (`error.code,message,request_id,details,retryable`).

| HTTP / code | Meaning / frontend behavior |
|---|---|
| 400 `RECOVERY_LINK_INVALID` | Invalid, expired, superseded, consumed, wrong-purpose or now-ineligible reset; one message; request another link |
| 400 `VERIFICATION_LINK_INVALID` | Invalid/expired/used/wrong-account verification; no email or token detail |
| 401 `INVALID_SESSION` / `INVALID_CREDENTIALS` | Existing session/password behavior; never expose reset eligibility |
| 403 `REAUTHENTICATION_REQUIRED` | Verification request requires recent login (including MFA where configured) |
| 403 `CSRF_REJECTED` | Refresh challenge and retry same logical request/key once through established client behavior |
| 403 `FORBIDDEN` | Current user lacks owner permission |
| 404 `INVITATION_UNAVAILABLE` | Invalid/expired/revoked/wrong-account invite, including registration; generic |
| 409 `ACCOUNT_EXISTS` | Only after proving a valid invitation token in registration; sign in, then reopen link; no account details |
| 409 `IDEMPOTENCY_CONFLICT` | Same key with different request material; preserve existing conflict code |
| 409 existing `STALE_VERSION`, `STALE_FINANCIAL_REVISION`, `ALREADY_MEMBER`, `INVITATION_PENDING`, `INVITATION_CLOSED` | Refresh affected resources; do not silently repeat under a new key |
| 422 `INVALID_INPUT` | Invalid fields, lengths, unexpected fields; no echoed secrets |
| 422 existing `INVALID_IDEMPOTENCY_KEY` | Missing, empty or oversized mutation key; correct client request construction |
| 429 existing `AUTH_RATE_LIMIT` | Coarse source-wide limit; bounded `Retry-After`; do not auto-loop |
| 503 `ACCOUNT_EMAIL_UNAVAILABLE` | Feature disabled or globally unavailable; retain form input; never use account eligibility to choose this response |

Per-address reset suppression/cooldown still returns generic 202. Public response
timing and shape must not distinguish valid, missing, unverified or disabled users.
Do not make provider calls inline. On request infrastructure failure, fail 503
consistently before account lookup or through a common admission path.

## 3. Lifetimes, retry and replay

- Reset link 30 minutes; verification link 24 hours; invitation 72 hours. Server DB
  time is authoritative. Links use `PUBLIC_APP_ORIGIN` validated against trusted
  origins, never request Host/forwarded headers or user-supplied return URLs.
- Links: `/auth/reset-password#token=...`, `/auth/verify-email#token=...`, and
  existing `/auth/invitations/accept#token=...`. Disable provider click/open
  tracking for security emails and verify resulting raw link behavior live.
- One current token per user/purpose. A genuinely new admitted request supersedes
  older tokens; same-key retries never mint another token. Request cooldown 60 s,
  max 3 actual mails per normalized-address/purpose per 15 minutes; source ceiling
  300 requests per 15 minutes initially, configurable. Per-address suppression
  is invisible; do not refund request-send limits on success. Confirmation attempts
  use token-fingerprint and trusted-source budgets (15/token, 300/source per 15 min).
- Invitation creates/reissues also have persistent abuse budgets: 20 mail jobs per
  owner and 100 per business per 15 minutes, plus 3 per business/recipient per
  15 minutes. Budget exhaustion returns owner-visible 429 `AUTH_RATE_LIMIT` before
  any invitation change. Idempotent replays do not consume another mail budget.
  This limits invite spam/reissue churn without changing token validity.
- Maintain public auth replay state for 24 hours, scoped to route + keyed normalized
  email or token fingerprint, not anonymous CSRF alone. Fingerprint secret bodies
  using keyed HMAC; never store plaintext passwords/tokens or plain password hashes
  as replay fingerprints. Preserve key/body semantics after CSRF refresh.
- Reset-confirm consumes the token, changes password, increments an account
  credential generation, revokes sessions/step-ups and outstanding auth challenges,
  invalidates other reset/verification tokens, records a security event, and queues
  password-change notice in one transaction. Idempotent retry can return success
  without running any of these again, even after token consumption. A different
  key cannot reuse a consumed token. Do not auto-login.
- Verification completion updates only the verified-email state, consumes its
  token, invalidates outstanding reset tokens, and records security evidence.
  Profile-only edits must not invalidate reset tokens; bind resets to a dedicated
  credential generation, not general `app_user.version`.
- Reset generation must also advance on authenticated password change. Challenge
  and session issuance/publication paths must recheck current credential state;
  an old-password login racing reset cannot leave a usable session afterward.

## 4. Delivery and webhooks

Persist token digest plus encrypted delivery payload atomically with the request
or invitation. Hash-only token storage is insufficient for a durable mail worker
that must reconstruct the exact link after a crash. The decryptable copy exists
only in a restricted, short-lived encrypted outbox; never in browser responses,
generic operation payloads, audit, idempotency cache or logs.

Use a dedicated PostgreSQL account-mail outbox in the EXISTING worker process.
Existing business operations require a session/business; do not invent a dummy
tenant/session for public recovery. Reuse lease/fencing principles, not commercial
operation rows, Redis or another queue service. Separate per-tick mail budget
prevents starving financial jobs or the worker heartbeat.

Stable provider idempotency key: `account-mail/<outbox UUID>`; frozen exact payload
across retries. Resend currently retains these keys for 24 hours. Stop blind
automatic retries after 23 hours from first attempt, or earlier when the link
expires. Unknown outcomes beyond the safe retry window become `unknown`, with
no automatic new key. Keep permanent local identity/dedup evidence. Retry only
transient transport/429/5xx outcomes; respect Retry-After and capped jittered
backoff, max 8 sends. Suggested connect 5 s / total 15 s, one mail at a time per
worker and a separate 60 s lease; fence every publication. Provider acceptance is
not mailbox delivery. Definitive provider rejection is terminal.

Recheck invitation revocation/expiry/business and current issuer authority before
dispatch. Revocation cancels queued unsent mail. A send already in flight can still
arrive; authorization always rechecks token state at acceptance. No distributed
transaction can retract an accepted email. Registration and acceptance recheck
business active and original inviter still an active owner; otherwise unavailable.

Webhook route is the ONLY exception here to browser CSRF/idempotency-cookie rules.
Verify the original bounded raw bytes with Svix signature + timestamp, use unique
`svix-id` for replay dedupe, reject forged/stale requests, persist valid events
before 200. Use signature-verified provider message IDs; no tenant IDs from bodies
authorize a tenant write. Handle duplicate, out-of-order, early-before-response
and unknown-email events without creating users/memberships or regressing states.
Store minimal event fields, not full recipient/content bodies. Map delivery,
bounce and complaint facts separately; derive visible status with precedence
`complained > bounced > delivered > accepted` once provider facts exist. A late
queued/sending/cancelled publication cannot overwrite these facts. Keep local
cancellation metadata separately when a send was already in flight.
Complaint/bounce suppress further sends
until reviewed. Return generic 400 for bad signature, 413 oversized (>256 KiB),
503 persistence failure, 200 for persisted duplicates/unsupported event types.

## 5. References and acceptance authority

- [OWASP password recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): generic responses, bounded tokens and abuse protection.
- [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys): stable payload/key, 24-hour provider window.
- [Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests): raw bytes and signed Svix headers.

References checked 19 October 2026. Chosen durations, limits, schema and account
policy above are project decisions, not provider guarantees. Backend exports
final DTO/OpenAPI fixtures; frontend consumes those exports. Every owner reports
PASS/FAIL/BLOCKED/NOT RUN with environment and evidence. A stubbed send or local
build never establishes real delivery or hosted recovery acceptance.

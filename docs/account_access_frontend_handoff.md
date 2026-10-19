# Frontend handout: account recovery and emailed invitations

Date: 19 October 2026. Status: implementation handoff; backend APIs described here
are proposed, not available today. Read the
[shared account-access.v1 contract](contracts/account-access-v1.md) first.
[Backend owner plan](account_access_backend_plan.md) and
[database owner handout](account_access_database_handoff.md) use that same contract.

## Assignment and boundaries

Implement recovery, email verification, email invitation management and invitation
registration using real backend state. Keep commercial actions sandbox-only.
Read `web/AGENTS.md` and relevant installed Next documentation before coding.
Preserve the current visual language and unrelated changes. Do not add a browser
Resend SDK, provider secrets, client-side token validation, fake delivery timers,
localStorage authentication or duplicate backend role rules.

Build against supplied contract fixtures until APIs land. Keep controls disabled
with an honest explanation when capabilities are disabled/unavailable or the
endpoint is absent. A public capabilities request failure means unavailable;
it does not mean the entered email is invalid. Do not ship fixture mode as live.

## Current files and proposed surfaces

| Surface | Existing file(s) | Required change |
|---|---|---|
| Forgot password | `web/app/auth/forgot-password/page.tsx` | Replace unavailable notice with email form and generic receipt state |
| Reset password | new `web/app/auth/reset-password/page.tsx` and client component | Fragment token, new/confirm password, explicit submit, invalid/success states |
| Verify email | new `web/app/auth/verify-email/page.tsx` and client component | Signed-in matching account, explicit confirm, fresh session data |
| Settings | `web/components/settings/settings-screen.tsx` | Real verification state, request action, recovery eligibility, resend cooldown |
| Passkey copy | `web/components/settings/passkey-panel.tsx` | Explain password reset preserves passkey requirement; lost passkeys have no recovery here |
| Invitation owners | `web/app/useraccess/page.tsx`, `web/components/users/users-screen.tsx` | Durable owner-only list/create/reissue/revoke and delivery feedback |
| Invitation recipients | `web/app/auth/invitations/accept/page.tsx`, `web/components/auth/accept-invitation.tsx` | Existing explicit acceptance plus invitation-specific registration |
| API and errors | `web/lib/orderfit-api.ts`, `p7-api.ts`, `p7-model.ts` | New typed methods/errors, stable retry keys and refreshed capabilities |
| Generated declarations | `web/lib/generated-api.d.ts` | Sync from final backend exports; no independent handwritten DTO fork |
| Session cleanup | `web/lib/session-reset.ts` | Reuse cleanup after reset/signout and changed memberships |

Suggested new `web/lib/account-access-api.ts` and small auth components can keep
the existing P7 module focused. Confirm exact location with existing conventions.

## Browser flows and exact user states

### Forgot password and reset

1. Fetch public `GET /api/v1/auth/account-access`; get CSRF using existing client.
2. Label email field “Email address”; button “Send reset link”. Submit
   `POST /auth/password-reset/request` with `{email}`. Validate format locally;
   server remains authoritative. Disable duplicate submission while pending.
3. On ANY 202 show: “If an eligible account exists, we’ll email a reset link.”
   Also show account-independent help: “Recovery requires an email address you
   verified in Settings. Resetting your password does not remove a passkey
   requirement.” Never claim delivery or distinguish nonexistent/unverified users.
4. Allow explicit new request after 60 s; server may still suppress per-address
   mail. Do not poll a public delivery job or persist the email in analytics.
5. Email opens `/auth/reset-password#token=...`. Parse into component memory only,
   remove fragment from visible history after capture, and never put token in
   query/route params, React Query keys, server props, storage or error telemetry.
   A reload after removal asks the user to reopen the original email link.
6. Fields “New password” and “Confirm new password”; submit “Reset password”.
   Require a match locally; send `{token,new_password}` only. Use password-manager
   compatible `autocomplete="new-password"`; enforce 12–1024 character limits.
7. Success: clear session/business caches, reset local session state, discard token,
   show “Password reset. Sign in with your new password.” Link to `/auth/signin`.
   Explain existing passkey is still required. Do not auto-login.
8. Invalid link: one invalid/expired/unavailable message and link to request again.
   Never show token state, user identity, or evidence about account existence.

Fresh challenge and retry use the SAME key/body after an unknown request outcome.
If reset-confirm success response is lost, retry same body/key; do not generate a
different password or ask for a new token until that request is reconciled. Secret
form state may remain only in component memory for this bounded retry.

### Settings verification

`SessionView.email_verified` becomes a real boolean;
`password_recovery_eligible` is authenticated account policy, not delivery status.
Show “Email verified” or “Email not verified” with “Verify email” action. Request
current password, submit `{current_password}` while signed in. If backend returns
`REAUTHENTICATION_REQUIRED`, ask for fresh normal sign-in (including passkey),
then retry explicitly. Never call this action a business T3 approval.

202: “Verification email requested. Open the link and confirm while signed in.”
No assertion that it reached the inbox. `/auth/verify-email#token=...` follows
the same memory/fragment rules. Signed-out users sign in and reopen the email;
do not carry tokens through a `next` query. Explicit “Verify email” POST, then
refetch session and show the updated verified/recovery state. Wrong account or
invalid token has a generic error; do not reveal the token's intended email.

Existing locked-out unverified accounts cannot recover through this release.
Remove the current suggestion that a business owner can reset credentials;
there is no such backend override. Support copy must describe actual limitations.

### Invitation owners at `/useraccess`

Owner status must come from current server memberships and backend permission.
Display server-paged invitation history; do not depend on this tab's create result.
Use signed cursor and load-more/retry patterns. Refresh list/profile after stale
version or financial revision; do not silently create another invitation.

Create “Send invitation” with existing allowed role/email fields; retain financial
revision input sourced from current business profile. New response has
`invitation_url=null`: remove the email-mode copy-link expectation. Show “Queued
for email” after durable creation, not “Email sent”.

Each row shows intended email, role, invitation lifecycle, expiry, and separate
delivery status. Delivery `accepted` is “Accepted by email provider”; `delivered`
is “Delivered to receiving mail server”; neither means read or membership joined.
`bounced`/`complained`/`failed`/`unknown` get honest safe explanations. Do not show
raw provider diagnostics. Legacy `not_requested` means “Created before email
delivery”; it does not imply failure or ownership verification.

“Reissue invitation” requires confirmation explaining that the old link stops
working; include a short reason, expected version and current financial revision.
Replace/refresh the returned NEW row ID, retaining old row in history. Closed
rows cannot be reissued; use new create after revocation. “Revoke invitation”
also needs reason/version/revision. Explain mail already sent may still arrive,
but its revoked link will fail. Use bounded refetch while visible (e.g. 15 s
while queued/sending; stop on hidden tab/unmount or terminal state).

### Invitation recipients and new accounts

Preserve explicit acceptance, full matching-email session, fresh membership
response, and session/cache cleanup. Never auto-accept on mount or mail click.
Existing account: sign in, reopen original invitation link, then “Accept
invitation”. Wrong account gets generic `INVITATION_UNAVAILABLE`; offer signout.

New account: render “Create invited account” within the existing acceptance page
using the token already in memory. Ask full name/password/password confirmation;
POST `/auth/invitations/register` with `{token,full_name,password}`. Do not ask
for business name/currency/timezone or reuse ordinary owner signup. No email,
role or platform status fields are submitted. Success directs normal sign-in
and reopening original email link, followed by explicit acceptance. Registration
does not create membership or session and does not mark account email verified.
`ACCOUNT_EXISTS` after valid token offers sign-in instead of duplicate signup.

Settings verification is a separate step after acceptance. Invitation acceptance
must not display a verified-email badge automatically, including legacy links.

## Errors, privacy and accessibility

Use contract error table verbatim, mapped to helpful local copy. On 503 retain
form values and offer retry; on 429 obey Retry-After; on malformed input highlight
fields without rendering server-submitted secret values. Preserve existing CSRF
retry behavior and same-key replay. Do not retry mutations on generic network
failure under new keys. Abort obsolete GETs; avoid orphaned polling/subscriptions.

All token pages use `no-referrer`, noindex, no-store, no third-party analytics or
tracking pixels. Review application-wide scripts and server/cache behavior, not
just page metadata. Render backend names/text as escaped text; never insert
provider HTML. Token must not appear in URL logging, screenshots or recorded QA
artifacts. Label inputs, announce pending/errors/success, support keyboard/focus,
and verify desktop/mobile dark/light rendering with current theme cascade.

## Acceptance and handback

Supply focused client tests for generic receipts, unavailable capabilities,
stable keys on CSRF/network retry, token extraction/removal, reset validation,
passkey copy, owner-only list/pagination, reissue/new ID, expired links and
registration without business creation. Run lint/type/unit/build using repository
scripts. Mock tests are contract evidence only.

Browser integration must exercise a real disposable backend/DB: Settings
verification; signed-out reset then old-session rejection; retained passkey
requirement; existing and new invitees; owner reload/reissue/revoke; cross-tenant
denial; same-key lost-response recovery; mobile theme/focus. Captured fake inbox
links prove local integration only. Real inbox delivery is a separate staging gate.

Hand back exact changed files, exported contract version, commands/results,
screenshots with secrets removed, and PASS/FAIL/BLOCKED/NOT RUN per flow. List
missing backend fields/routes as blockers; do not build a parallel local workflow.

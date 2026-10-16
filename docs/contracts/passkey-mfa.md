# Password plus WebAuthn MFA

The existing opaque HttpOnly cookie remains the session credential. A password-only
session cannot be issued for an account with `passkey_required=true`. Legacy
`mfa_enforced=true` accounts retain their fail-closed unsupported-provider behavior;
the new WebAuthn policy is explicit and does not reinterpret that legacy flag.

An operator configures one exact relying-party hostname and one allowed origin.
HTTPS is mandatory except for localhost. Host/Origin request headers never select
the relying party. User presence and user verification are required. Attestation
is none; store only public keys, credential IDs and signature counters.

Enrollment requires the current session, password verification and authentication
within five minutes. Adding another key requires recent MFA authentication. First
successful enrollment enables the policy and revokes every existing session.
The user signs in again with password plus passkey. Enroll a backup authenticator;
there is no password-only fallback or automatic account recovery.

Login options require a correct password and are bound to the pre-authentication
CSRF cookie. Challenges are random, expire after five minutes, and are one-use
even when verification fails. Verification binds challenge, exact origin, RP ID,
credential owner, user verification, current password hash, counter and current
account policy. Successful login atomically advances the counter, consumes the
completion grant, creates an MFA-marked session and records an audit event.
Concurrent/replayed completions cannot issue another session. Login replaces this
browser's prior session; no session credential is returned in JSON.

Private auth tables have FORCE RLS, no direct runtime grants, pinned-search-path
helpers and no PUBLIC execution. The runtime performs WebAuthn cryptographic
verification; database helpers enforce challenge/freshness/replay invariants.
Enabling a factor revokes old sessions, so old jobs and approvals retain their
existing revocation fences. No approval or effect authorization is bypassed.

HTTP commands use the existing Origin, CSRF and Idempotency-Key checks. Authentication
completion is intentionally one-shot: a lost response requires fresh authentication,
not reuse of a consumed assertion. Enrollment replay does not add a duplicate key.
Errors contain curated codes only. No credential responses, challenge payloads,
passwords, cookies or public-key material are logged.

Endpoints: POST `/api/v1/auth/passkeys/enroll/options` (password),
`/enroll/verify` (challenge UUID and credential), `/login/options` (SignIn),
`/login/verify` (challenge UUID and credential). Options return challenge UUID and
standard WebAuthn public-key options; verification returns acknowledgment for
enrollment, SessionView for login. Password signin returns `409 MFA_REQUIRED`
only after successful password verification for an enabled account. Wrong passwords
and unknown users keep the same generic denial and throttling behavior.

Recovery after losing all authenticators requires a separately approved operator
identity-verification procedure; this feature does not expose a weaker recovery API.

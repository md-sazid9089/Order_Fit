# Partner integration: API keys, webhooks and deep links

Status: **proposed contract, not implemented.** Nothing below exists in the
checkout as of 18 October 2026 (HEAD `abf2c5f`). Implementation must follow this
contract, add a forward migration and tests, and update the generated catalogue.

## Goal and recommendation

Businesses want OrderFit inside the systems they already use (ERP, accounting,
order management, CRM) instead of retyping orders into a separate website.

Recommended order of delivery:

1. **Partner API with API keys** (this document). Every other integration shape
   consumes it.
2. **Signed webhooks** so external systems learn about verdicts without polling.
3. **Deep links** from the external system into the OrderFit review screen, where
   a human confirms figures and approves actions.
4. **Connectors** for specific products (QuickBooks, Xero, Shopify, Zoho) built
   as optional thin clients of 1–3. Steps 1–3 work with any platform, so no
   connector is required to integrate.

Rejected for now:

- **Iframe embedding / browser extension.** Both apps deny framing
  (`frame-ancestors 'none'` and `X-Frame-Options: DENY` in `web/next.config.ts`
  and `backend/orderfit/api/security_headers.py`). The session cookie is
  `SameSite=Lax` with no `Domain`, so a third-party frame would not be signed in.
  Relaxing either control would expose approval screens to clickjacking. Reconsider
  only with a separate design (popup sign-in, per-partner `frame-ancestors`,
  no approval actions inside the frame).
- **Unattended approval by integrations.** Human approval is a system invariant
  (root `AGENTS.md`). No key scope can confirm figures, approve bundles, execute,
  commit or compensate.

## Principal model

An API key authenticates an **integration principal**: a non-human user row bound
to exactly one business.

- Created only by an `owner` (T3) with recent step-up authentication, through the
  OrderFit UI. Creation and revocation are audited.
- Membership role is fixed at `commercial_lead` (T2) or `viewer` (T0). The database
  rejects any higher role for an integration principal.
- The principal has no password, passkey or browser session and cannot sign in.
- Requests set the same transaction-local `app.user_id`, `app.session_id` and
  `app.business_id` used by existing RLS (`backend/orderfit/store/db.py`), so
  tenant isolation reuses existing policies instead of adding a bypass. `app.session_id`
  carries the key ID; the key is checked as unexpired and unrevoked in the same
  transaction, exactly like a session.
- Approval, confirmation and execution helpers reject integration principals in
  SQL, not only in Python, so a misrouted endpoint cannot bypass the rule.
- Audit rows record `actor_kind = 'integration'` and the key ID.

Revoking a key, archiving the business or demoting the creating owner does not
need session-style fencing for approvals (keys cannot approve), but revocation
must be immediate for subsequent requests and must cancel the key's queued
operations that have not started.

## Keys

| Property | Contract |
|---|---|
| Format | `ofk_` + 8-character public prefix + `_` + 32 random bytes base64url. Example shape: `ofk_k7Q2mX9a_<43 chars>` |
| Storage | Prefix and SHA-256 of the full key. The full key is shown once at creation and never again |
| Transport | `Authorization: Bearer <key>` only. Keys in query strings or cookies are rejected |
| Scopes | `deals:read`, `deals:write`, `documents:write`, `evaluations:read`, `webhooks:manage` |
| Expiry | Required, at most 365 days. Default 90 |
| Limit | At most 10 active keys per business |
| Rate limit | Per key, 60 requests/minute and 10 evaluation requests/minute. `429 RATE_LIMITED` with `Retry-After` |

`viewer` principals may hold only `deals:read` and `evaluations:read`.

### Distinguishing keys from sessions

`session_token()` in `backend/orderfit/api/deps.py` already accepts
`Authorization: Bearer` as a session token. Key authentication must be a separate
dependency selected by the `ofk_` prefix:

- A request carrying both a key and an `orderfit_session` cookie is rejected
  (`400 AMBIGUOUS_CREDENTIALS`).
- Key requests skip the CSRF and `Origin` checks in `mutation()` because no
  ambient browser credential is involved. They still require `Idempotency-Key`
  and reject mutation query strings, matching existing behaviour.
- Session tokens never start with `ofk_`; the session issuer must enforce this.

## Operations available to keys

Keys use the existing `/api/v1` routes and DTOs. A key may call only operations
listed in an explicit allowlist in the endpoint catalogue
(`backend/orderfit/contracts/catalogue.py`); every other operation returns
`403 SCOPE_NOT_ALLOWED`. This avoids a second copy of each endpoint and keeps one
confirmed-input pipeline.

| Operation ID | Scope | Notes |
|---|---|---|
| `deals`, `deal_get` | `deals:read` | |
| `deal_create`, `deal_update` | `deals:write` | Creates/edits draft inputs only. Provenance `integration:<key_id>` |
| `customers`, `customer_create`, `customer_update` | `deals:write` | |
| `document_upload`, `documents` | `documents:write` | Same size/type limits; extraction proposals still need human review |
| `evaluate` | `evaluations:read` | Allowed only for an already confirmed snapshot. Returns `202 OperationAccepted` |
| `evaluations` | `evaluations:read` | |
| operation poll (`poll_url`) | any | Only operations created by the same business |
| webhook endpoint CRUD | `webhooks:manage` | |

Explicitly **not** allowed: `confirm`, `flag_resolve`, bundle approval,
execution, commitment, compensation, members, accounts, passkeys, admin, exports.

### Example: create a deal

```http
POST /api/v1/deals
Authorization: Bearer ofk_k7Q2mX9a_...
Idempotency-Key: erp-order-SO-10422
Content-Type: application/json
```

The body is the existing deal-create DTO. Money is integer minor units as text,
dates are business dates, and missing values stay `null` rather than guessed.

Invalid examples and their errors:

| Request | Result |
|---|---|
| No `Idempotency-Key` | `422 INVALID_IDEMPOTENCY_KEY` |
| Same key, different body | `409 IDEMPOTENCY_CONFLICT` |
| `POST /api/v1/deals/{id}/confirm` | `403 SCOPE_NOT_ALLOWED` |
| Deal ID from another business | `404` (same as today; no existence leak) |
| Revoked or expired key | `401 INVALID_API_KEY` |
| Key plus session cookie | `400 AMBIGUOUS_CREDENTIALS` |

Errors use the existing `ErrorEnvelope` (`code`, `message`, `request_id`,
`details`, `retryable`). No key material is echoed or logged.

## Webhooks

### Events

| Event | Emitted when | Payload `data` |
|---|---|---|
| `evaluation.completed` | An evaluation is stored | `deal_id`, `evaluation_id`, `decision`, `reason_codes`, `input_version`, `financial_revision` |
| `operation.failed` | A background operation ends `failed` | `operation_id`, `deal_id`, safe error `code`, `retryable` |
| `deal.status_changed` | Workflow state changes | `deal_id`, `from`, `to`, `version` |
| `deal.stale` | Confirmed inputs become stale | `deal_id`, `input_version` |
| `action.executed` | A human-approved sandbox action completes | `deal_id`, `action_id`, `kind`, `sandbox: true` |

`decision` is the engine's verdict copied from `EvaluationResultV1`. A failed
or timed-out operation is never reported as `decline_or_renegotiate`.

Payloads carry identifiers and the verdict, not full financial details or
documents. Receivers fetch details with `evaluations:read`. This keeps private
figures out of third-party logs by default.

### Envelope

```json
{
  "id": "evt_2b0f6a3e-...",
  "type": "evaluation.completed",
  "schema_version": "webhook.v1",
  "business_id": "9c1d...",
  "occurred_at": "2026-10-18T09:14:03Z",
  "data": { "deal_id": "...", "evaluation_id": "...", "decision": "accept_with_changes",
            "reason_codes": ["..."], "input_version": 4, "financial_revision": 2 }
}
```

### Delivery

- **Transactional outbox.** The event row is written in the same transaction as
  the change that causes it, in a new FORCE-RLS table scoped by `business_id`.
  The existing worker delivers it. No event is sent for a rolled-back change.
- **At-least-once.** Receivers must deduplicate by `id`. Ordering is not
  guaranteed; receivers compare `version`/`input_version`.
- **Signature.** Header
  `OrderFit-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, t + "." + body)>`.
  Receivers reject timestamps older than 5 minutes. Two secrets may be active
  during rotation. Secrets are shown once and stored with KMS envelope encryption
  (see Decisions), because they must be recoverable to sign.
- **Retries.** Non-2xx or timeout (10 s) retries with exponential backoff and
  jitter for up to 24 hours, then the attempt is marked `dead`. After 50
  consecutive failures the endpoint is disabled and the owners are notified
  through the existing notification table. Manual redelivery is available in the UI.
- **SSRF protection.** HTTPS only, port 443, no redirects, no credentials in the
  URL. Resolve DNS once per attempt and refuse loopback, private, link-local,
  multicast and cloud-metadata addresses; connect to the resolved address.
- **Limits.** At most 5 endpoints per business; body at most 64 KiB.

## Deep links

External systems link to `https://<app>/deals/<deal_id>` (and the review/approval
pages). The user signs in to OrderFit normally; normal RBAC applies. No token is
placed in the URL. The API returns these URLs as `app_url` on deal views for
key principals.

## Data and migration outline

Forward migration (next free revision after `0019_merge_passkey_roles`):

- `app_user.is_integration boolean NOT NULL DEFAULT false`, plus a constraint/trigger
  limiting integration memberships to `viewer`/`commercial_lead`.
- `api_key(id, business_id, principal_user_id, prefix UNIQUE, key_hash, scopes text[],
  created_by, created_at, expires_at, revoked_at, last_used_at)`. FORCE RLS; no
  direct runtime grants; lookup through a pinned-search-path `SECURITY DEFINER`
  helper that returns only the matched key's scope.
- `webhook_endpoint` and `webhook_delivery` (outbox) with FORCE RLS.
- Approval/confirm/execute helpers reject `is_integration` actors.

## Required tests

- Cross-tenant: key for business A cannot read or write business B (404).
- Each disallowed operation returns 403 for every scope combination.
- SQL-level rejection of approvals by an integration principal, called directly.
- Revocation takes effect on the next request; queued operations are cancelled.
- Idempotent replay returns the original response; conflicting replay returns 409.
- Webhook: no event after rollback; signature verifies; replayed/old timestamp is
  rejected by the reference receiver; SSRF targets refused; retry/dead/disable
  transitions; secret rotation window.
- Logs and audit rows never contain key or secret material.

## Decisions (18 October 2026, user)

- **Platform-neutral first.** Businesses use many different platforms, so the
  generic API, webhooks and deep links come before any product-specific
  connector. Each connector is an optional thin client of this contract; none
  gets its own endpoints or financial logic.
- **Secrets use the most secure storage available.**
  - API keys: only a SHA-256 hash is stored. The key cannot be recovered from the
    database; a lost key is revoked and replaced.
  - Webhook signing secrets (and future connector OAuth tokens): envelope
    encryption. Each secret is encrypted with a per-record data key; data keys are
    wrapped by a key held in a managed cloud KMS that the application can use
    but cannot export. The database stores only ciphertext and the wrapped key.
    Decryption happens in the worker at send time and is never logged.
  - A local application-held key is allowed **only** for local development and
    disposable tests. Hosted startup fails closed if KMS is not configured.
  - Hosted KMS provisioning and evidence remain open (see the development
    context); webhooks must not be enabled in a hosted environment until they exist.

## Open questions

- Should a T2 integration be allowed to **confirm** figures that came from a
  trusted ledger import? This contract says no; revisit with evidence from pilots.
- Which KMS provider: pick the one co-located with document storage when hosted
  storage is provisioned.

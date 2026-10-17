# Hackathon security and compliance acceptance matrix — 17 October 2026

This is a reviewer-facing map from the judging criteria to the implemented
controls and executed evidence. It describes OrderFit's synthetic,
sandbox-only workflow. It does not claim a production financial-services
certification or a real payment, bank, lender, or email integration.

The detailed hosted evidence is in [the isolated Neon acceptance report](neon_acceptance_2026-10-17.md).
The source threat model and control design are in
[architecture security and evaluation](../architecture/orderfit/05-security-and-evaluation.md).

## Demonstrable workflow

1. An authenticated business member uploads/reviews source evidence and confirms
   inputs. The deterministic engine calculates cash headroom, constraints and
   financing/term alternatives; model output cannot calculate or authorize an
   effect.
2. A permitted member prepares an immutable, hash-bound sandbox action bundle.
   The API checks tenant membership, the current deal/business versions and the
   exact bundle digest.
3. A `risk_officer` or `owner` completes a session-bound step-up and approves
   that exact bundle. A changed, expired, stale, revoked, or already-decided
   bundle cannot be approved or executed.
4. Execution admits one durable, idempotent sandbox run. The worker records a
   simulated effect only; no code path contacts a real counterparty or moves
   money. A separate exact bundle is required for compensation.
5. Each material action is included in the tenant's append-only hash chain.
   The exported chain can be verified independently and detects changed content,
   sequence, predecessor, scope and head mismatches.

This produces a useful financial result (a deterministic recommendation and a
reviewed sandbox decision) while keeping the irreversible real-world outcome
outside the product's authority.

## Security and compliance rubric

| Judging requirement | Control in the product | Evidence a reviewer can inspect |
|---|---|---|
| Permission controls | Roles are least-privilege: read, prepare, execute, finance and membership administration are separate. Only `risk_officer` and `owner` may approve or execute. Tenant-scoped application transactions use a restricted, non-owner runtime login; PostgreSQL RLS is an independent boundary. Foreign tenant access is concealed as 404. | `backend/orderfit/contracts/protocol.py`, `backend/orderfit/api/routes/bundles.py`, and the hosted run: 100 alternating two-tenant transactions; cross-tenant requests returned 404; restricted API DDL and worker-only access were denied with 42501. |
| Authentication and session safety | Opaque HttpOnly SameSite-Strict sessions, CSRF/session binding, Argon2id passwords, rate limits and passkey MFA after enrollment. Privilege/membership changes and restore quarantine invalidate stale sessions. | `backend/orderfit/services/identity.py`, `backend/orderfit/services/passkeys.py`, `backend/tests/db/test_passkeys.py`; hosted restore revoked 25 copied sessions, removed pending challenges, rejected old sessions and required two fresh logins. |
| Risk limits | The financial engine is deterministic and uses validated integer money/contracts. Input/freshness versions, bundle expiry, negotiation-round caps, request/body/upload bounds, SQL lock/statement/idle-transaction timeouts, retry fencing and idempotency prevent unsafe or repeated work. Unsupported, missing and conflicting inputs are surfaced for review rather than guessed. | `backend/orderfit/contracts/protocol.py`, `backend/orderfit/services/execution.py`, `backend/orderfit/store/db.py`, architecture fixtures and the external acceptance report. |
| Human approval | Approval binds the exact immutable manifest hash, authenticated user, session, purpose and step-up grant. It is rechecked under locks at execution admission. A current authorized person can revoke an approved bundle before execution. Party acceptance is recorded evidence, not an authorization substitute. | `backend/orderfit/services/bundles.py`, `backend/orderfit/services/execution.py`, `backend/orderfit/api/routes/preparation.py`; P6 approval/compensation/idempotency tests and browser journey described in [app reliability evidence](../app_reliability_2026-10-17.md). |
| Auditability | Application events use an append-only tenant hash chain. The verifier checks canonical PostgreSQL bytes without reserializing them, and rejects tampering or scope/sequence breaks. Approval, revocation, execution admission and completion are separately logged. | `backend/orderfit/services/exports.py`, `backend/tests/db/test_p3_exports.py`, `backend/tests/db/test_p7_operations.py`; hosted backup/restore verified all 17 tenant chains. |
| Data protection | Browser CSP uses a fresh nonce and strict dynamic scripts; API origin/cookie/TLS configuration fails closed. Remote PostgreSQL requires `sslmode=verify-full`. Documents are private and stored by immutable content identity. | `web/lib/security-policy.ts`, `web/proxy.ts`, `backend/orderfit/contracts/configuration.py`; hosted TLS and anonymous object GET/LIST denial passed. |
| Recovery and resilience | Backup data and documents were encrypted with restic before cloud storage. Restore runs into a fresh isolated database/bucket, checks documents, RLS/policies, audit chains and session invalidation before fresh sign-in. | [Neon acceptance report](neon_acceptance_2026-10-17.md) and its [sanitized evidence](evidence/neon_acceptance_2026-10-17.json). |

## What to show in a live review

1. Sign in as a synthetic owner and open a two-tenant sample business.
2. Confirm inputs and show the deterministic cash recommendation, including a
   constraint or escalation when an order is not safe as offered.
3. Prepare a sandbox action. Show that the exact bundle hash, expiry and allowed
   actions are visible.
4. Complete step-up, approve and execute the simulated action. Reload/retry the
   request to show one durable run rather than a duplicate effect.
5. Attempt a stale, altered, foreign-tenant, or revoked approval and show the
   server refusal. Then display/export the audit chain and verify it.

Do not use a real customer, supplier, bank, lender, payment account or financial
document in the demo.

## Release blockers deliberately kept visible

These are not papered over by the acceptance result:

- The Neon Free plan has public Internet reachability for valid credentials,
  six-hour history and no IP allowlist/VPC option. Production needs private
  networking or allowlisting, a retention decision and rotated credentials.
- The temporary Neon storage credential was able to write outside the document
  prefix. The provider must issue independent, prefix-scoped API and worker
  credentials before sensitive production documents are accepted.
- Provider-side KMS/encryption configuration, object version retention/object
  lock and a durable backup schedule remain unverified. The drill did verify
  client-side encrypted backups, integrity and restore, which is narrower.
- Historical credentials that were exposed during the drill or were previously
  committed must be rotated/revoked. No secret values are recorded here.

The temporary `orderfit-security-acceptance` branch and both drill buckets were
permanently removed through the Neon console after acceptance review.

# Security model

OrderFit separates proposed facts, confirmed inputs, deterministic calculations,
human authority, and sandbox effects. A hash identifies exact content; it does not
grant permission. Financial execution is sandbox-only.

## Enforced boundaries

- Opaque HttpOnly sessions, CSRF/origin checks, Argon2id passwords, revocation, and
  configured password-plus-passkey MFA. Password re-entry alone is not MFA.
- Current membership and permission checks for each business transaction, restricted
  non-owner runtime logins, transaction-local tenant context, and forced row-level security.
- Immutable reviewed snapshots, revision/freshness rejection, exact action bundles,
  approval expiry, step-up, and separate dispatch/commit/compensation authority.
- Durable jobs with idempotency, bounded leases/retries, fencing, and transactionally
  recorded sandbox effects and audit evidence.
- Private scoped documents, bounded upload admission, isolated PDF parsing, original
  bytes and quotes, and human review of missing/conflicting extracted candidates.
- Models have no action tools. Provider requests pass through `agent/llm.py`;
  calculations pass through `agent/nodes/compute.py`. Recording misses never call live.
- The web displays saved evaluations and verified-session roles. Failed reads do not
  become synthetic success; legacy browser-only financial drafts are purged at scope reset.
- Platform reads require server-verified administrator authority and backend capability.
  They do not authorize unrelated business details or mutations.

## Release limitations

Local tests do not establish hosted acceptance. Historical credential exposure still
requires independent rotation/revocation evidence. Provider/KMS controls, least-privilege
object credentials, durable backup retention, joint database/document restore, production
passkey origins, live-model quality, and account-mail delivery require their own acceptance.
Account mail and admin reads must remain disabled until their rollout gates pass.
The Render Blueprint selects the existing private S3 adapter and removes the direct
migration URL before the API server starts. It still requires a privately provisioned
bucket, verified service credentials/policies, and hosted acceptance; it is not a
verified deployment.

The audit chain detects tested modifications to exported rows; external anchoring and
privileged-tail protection are separate operational concerns. Never claim tamper-proof storage.

## Specifications and evidence

- [Detailed threat model and evaluation registry](../architecture/orderfit/05-security-and-evaluation.md)
- [Snapshots and exact bundles](../architecture/orderfit/adrs/0008-snapshots-and-exact-bundles.md)
- [Runtime roles and sessions](../architecture/orderfit/adrs/0009-runtime-roles-and-sessions.md)
- [Passkey contract](../contracts/passkey-mfa.md)
- [Account-access contract](../contracts/account-access-v1.md)
- [2026-10-16 audit](security_audit_2026-10-16.md)
- [2026-10-17 continuation](security_audit_2026-10-17.md)
- [Local acceptance update](security_acceptance_2026-10-17.md)
- [Isolated Neon drill and remaining controls](neon_acceptance_2026-10-17.md)
- [Controlled external acceptance](../deployment/external-acceptance.md)

These dated records retain their tested revisions and limitations. Their presence is
not evidence that the current deployment or credentials were verified.

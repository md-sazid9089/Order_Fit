# Security acceptance update — 17 October 2026

Later hosted follow-up: [isolated Neon acceptance](neon_acceptance_2026-10-17.md)
now verifies restricted pooled roles, tenant isolation, TLS, private buckets and an
encrypted cloud-backed hosted restore with session quarantine/fresh sign-in.
Prefix-scoped credentials, independent provider/KMS evidence and durable retention
remain open. Preflight-only limitations below describe the earlier checks.

This update supersedes only the local MFA, PG17/Docker, and encrypted-restore
gaps in [the reconciliation audit](security_audit_2026-10-17.md). It does not
claim hosted acceptance. Every exercised database, document and credential was
synthetic and disposable.

| Gate | Evidence | Result | Remaining requirement |
|---|---|---|---|
| PG17 / Docker runtime | Full frozen backend suite: **540 passed** in 848.01 seconds; Docker browser acceptance separately exercised the production images and isolated PG17 stack. | Passed locally. | Run the same restricted-role checks through Neon pooling on an approved disposable branch. |
| Passkey MFA | `backend/orderfit/services/passkeys.py:29`, `:37`, `:74`; `backend/migrations/sql/0019_passkey_mfa.sql:5`, `:35`, `:45`, `:55`; `backend/tests/db/test_passkeys.py:87`, `:106`, `:129`, `:145`, `:170`; `web/tests/e2e/passkeys.spec.ts:4`. | Passed locally. Password is first factor; a user-verifying passkey is required after enrollment. One-use, five-minute CSRF/session-bound challenges are consumed before cryptographic verification; replay, tenant substitution, invalid origin/RP/signature/UV, stale password and concurrent completion are rejected. Enrollment revokes existing sessions; successful MFA replaces the browser session. | Configure the exact HTTPS relying-party ID and origin in each deployment. Keep legacy `mfa_enforced` fail-closed until its separately supported migration exists. |
| Encrypted joint backup / restore | `backend/tests/db/test_encrypted_restore.py:34`, `:44`, `:116`, `:122`, `:167`, `:179`; `docs/deployment/external-acceptance.md:153`. | Passed locally with restic 0.19.1 in a non-networked, read-only, non-root container: two synthetic tenants, two documents, audit chains and hashes restored; wrong-key and tampered-repository checks failed as required. Measured restore portion: 8.109 seconds. Restored sessions were rejected, pending passkey challenges removed, and a fresh tenant-isolated login succeeded. | Validate the cloud bucket, database retention/PITR policy, KMS/key controls and recovery objective on a new disposable hosted target. The local timing is not a production RTO. |
| Runtime admin exposure | `backend/orderfit/api/main.py:333`, `backend/tests/db/test_admin_security.py:41`. | Passed locally. The prototype global admin router is intentionally unmounted; runtime retains tenant-scoped/RLS paths. | Design a separately authorized, paginated privileged reporting contract if global operations visibility is required. |

## MFA operating boundary

The implementation is password-plus-passkey MFA, not password-only step-up.
The trust-anchor configuration rejects missing or mismatched RP/origin values:
`backend/orderfit/contracts/configuration.py:15`, `:65`. The browser panel uses
the platform WebAuthn API and does not store credential material in local storage:
`web/lib/passkeys.ts:12`, `web/components/settings/passkey-panel.tsx:11`.
Users should register a backup authenticator before relying on MFA; there is no
automatic password-only recovery or disable endpoint.

## Hosted controls not verified

The ignored local runtime configuration was later used for a read-only Neon
preflight: both restricted pooled logins connected with `verify-full`, and the
deployed schema was found at `0019_merge_passkey_roles`. No hosted migration,
provisioner, synthetic tenant, destructive test, backup, restore, or load test
was run. There is still no verified disposable hosted branch or storage target.
Therefore these remain open:

- disposable Neon branch: migration compatibility, restricted API/worker roles,
  non-owner/non-superuser runtime, RLS and transaction pooling checks;
- Render/Vercel deployment controls: headers, origin/cookie behavior, worker
  restart/fencing and upload boundary;
- private object bucket: public-access denial, prefix least privilege,
  provider encryption/KMS, version retention and hosted joint restore;
- provider-side backup/PITR retention, RPO/RTO evidence and historical credential
  rotation confirmation.

The executable, credential-free hosted procedure is
`docs/deployment/external-acceptance.md`. It requires an explicitly disposable
target identity and local secret channel before network execution.

## Rotation still required

Historical committed database credentials and the removed live-RBAC test account
credentials still require provider-side rotation/revocation unless independent
records show that it already occurred. No secret values are included here and Git
history was not rewritten.

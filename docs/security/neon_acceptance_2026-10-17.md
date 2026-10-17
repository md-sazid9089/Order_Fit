# Neon isolated security and performance acceptance — 17 October 2026

User authorized temporary resources and testing from the logged-in Neon console.
This is executed hosted evidence, superseding the corresponding preflight-only
limitations in [the earlier report](security_acceptance_2026-10-17.md). P8 remains
partial: credential prefix isolation, independently verified provider encryption/
KMS and durable retention are not closed by these checks.

## Isolation and resources

- Project `silent-glitter-25854658`, AWS Singapore. Console confirms its production
  endpoint is `ep-quiet-fire-aoc4gl8k`, matching configured application URLs. The
  separate Ohio project named `order_fit` was not the active application target.
- Created `orderfit-security-acceptance`, branch `br-hidden-cell-aok23ia2`, from
  production data/schema. Endpoint `ep-silent-frost-aoz953vq`. Expires **18 October
  2026 at 18:56:39 Bangladesh time**. All database writes in this drill used this
  explicit endpoint, never the main endpoint; no main migration or load test ran.
- Created private branch-scoped buckets `orderfit-security-acceptance-20261017`
  and `orderfit-security-restored-20261017`. The latter is the restore destination.
- Restored into new database `orderfit_restore_cfa0532373f4` on the acceptance
  branch. Failed attempt `orderfit_restore_f0bd093d7ec6` is also isolated there;
  all its copied sessions were revoked and pending passkey challenges deleted.
  No application or worker was pointed at that failed database.
- Preserved existing working-tree changes on `main` at `8a9d1c2`. No shared
  credentials were changed. User deferred rotation; rotation remains outstanding,
  including the temporary storage credential exposed during browser inspection.

## Executed checks

| Check | Observed result | Scope/limit |
|---|---|---|
| Schema/runtime roles | Hosted PostgreSQL **18.6**, revision `0019_merge_passkey_roles`; API and worker pass complete non-owner/restricted/inherited-privilege checks | No hosted migration was necessary |
| Tenant isolation | **100** alternating A/B authenticated transactions with a one-connection application pool; unscoped business reads see zero rows; foreign-business admission returns 404 in both directions | Real pooled restricted logins, not owner simulations; 105.562 seconds |
| API restrictions | CREATE TABLE, worker-only publication and direct worker-presence reads fail with SQLSTATE 42501; worker publication/expiry helper succeeds | Does not grant API worker permissions |
| Pooling | Two simultaneously open client connections alternately reused backend PID 972 over six committed transactions | Actual backend reuse across clients, in addition to the pooled endpoint; not a large connection-load benchmark |
| TLS | Driver `pgconn.ssl_in_use` true, with `sslmode=verify-full` and trusted certifi CA, for restricted pooled logins and direct restore connections | Server `pg_stat_ssl` reports false behind Neon's proxy; that backend view does not measure client-to-proxy TLS |
| Private documents | Application S3 adapter put/read/SHA-256, immutable create refusal, readiness put/get/delete pass; anonymous GET and LIST return **403** | Actual synthetic bytes and a retained object during the anonymous probe |
| Encrypted backup | Real PG18 custom dump plus every source document encrypted by restic 0.19.1; **706,560-byte** encrypted repository archived to private cloud bucket, downloaded and integrity-checked | Key stays outside repository/bucket; backup object/key hash in sanitized JSON; no application secrets committed |
| Hosted restore | Downloaded encrypted archive restored to a new Neon database and a second private bucket; **all four** source documents recovered with matching hashes/sizes | No financial engine outputs regenerated; no outgoing work resumed |
| Database integrity | Counts match for business/user/membership/document/deal/evaluation/options/audit/approval/operation; all **17** tenant audit chains verify | Restored constraints/indexes/policies applied; all 65 table RLS settings/owners, 100 policies and 32 security-definer owners/search paths match source |
| Restored authority | **25** copied live sessions revoked and pending challenges deleted before application access; old synthetic sessions return 401; **two fresh sign-ins** succeed; foreign document downloads return 404 | Selected two accounts exercised through real FastAPI routes against hosted restored storage/database, not a deployed browser/edge test |
| Wrong key/tamper | Wrong repository key and altered downloaded encrypted pack both rejected | Corrupted only a disposable copy, preserving remote backup; earlier cloud-backed local PG18 recovery took 11.547 seconds |

Successful hosted restore/verification portion measured **50.954 seconds**, starting
after cloud download/decryption/manifest verification. It is a small drill timing,
not a production RTO or RPO guarantee. The two verified fresh logins were followed
by cross-tenant checks; no restored approval or inherited operation was executed.

### Neon restore permission repair

The first hosted restore failed on Neon-owned `cloud_admin` default ACL entries.
The new restore used a reviewed `pg_restore --use-list` manifest omitting exactly
two entries: provider-role default privileges for public tables and sequences.
It retained application-owner default privileges and all application ACLs, RLS,
constraints, triggers and indexes. `--no-owner` was verified against source: all
application table and security-definer owners/search paths match after restore.
Do not weaken RLS, add broad role membership, or ignore arbitrary restore errors.
The successful restore used four jobs only on its fresh destination database.

## Performance optimization

`Database._runtime_checks` previously issued three sequential SQL statements for
role flags/memberships, inherited ownership/privilege checks, and schema revision.
It now obtains those same results in **one statement/catalog snapshot**. Every
role, ownership and inheritance predicate is retained. Missing/wrong schema fails
closed; multiple revision rows still error. Nothing is cached across role changes.
Pool sizing, tenant locks/context, financial semantics and approval checks stay
unchanged. This is a code change, not a migration applied to the main database.

Seven warm read-only validation samples on the temporary Neon branch:

| | Samples, milliseconds | Median |
|---|---|---|
| Before, three SQL statements | 234 / 235 / 250 / 218 / 235 / 250 / 234 | **235 ms** |
| After, one SQL statement | 125 / 125 / 125 / 109 / 125 / 125 / 141 | **125 ms** |

Observed median reduction **46.8%** for this validation operation. Samples include
variable client/network latency; this does not establish a dashboard or whole-app
speedup. The prior timeout-setup optimization remains preserved and separate.
The tenant deal-list EXPLAIN used existing `deal_recent_idx` with 0.559 ms execution
on the small snapshot. No speculative index, pool/compute-size change or financial
cache was justified. Large-tenant/load/hosted-browser performance remains separate.

Verification executed now: **24 disposable-PG17 DB tests** (new validation query/
role/schema tests, timeout reset and foundation), then **19 runtime-hardening and
passkey DB tests**, **four architecture tests**, changed-file Ruff and diff check.
DB test runs each reported the existing Starlette/httpx deprecation warning. This
was not a full backend-suite or deployed browser acceptance rerun.

## Remaining controls and cleanup

1. **Prefix least privilege is not satisfied by the current branch credential.**
   A generated off-prefix synthetic write succeeded and was removed. The same
   branch credential can reach both drill buckets. Independently scoped API/worker
   keys, cross-bucket denial and enforcement of allowed document/readiness prefixes
   require an appropriate provider permission contract and dedicated credentials.
   Do not deploy this drill credential as evidence that those requirements pass.
2. S3 `GetBucketEncryption` returns `NotImplemented`; object responses do not
   echo `ServerSideEncryption`. Versioning returned no enabled status; no S3 bucket
   policy or public-access-block configuration was returned. These are not proof
   of public access: anonymous denial and console Private status were verified.
   Neon documents console-managed bucket visibility rather than S3 bucket policies
   ([storage architecture](https://neon.com/blog/building-neon-object-storage)).
3. Neon states AES-256 encryption at rest and TLS protections
   ([provider security](https://neon.com/security)). Provider statements are distinct
   from independently verified bucket/KMS controls. Client-side restic encryption,
   wrong-key rejection and integrity checks were exercised directly.
4. Console history window is **six hours**, the visible Free-plan maximum. Longer
   history requires a plan change. No paid change, retention policy, object-lock
   guarantee or long-term backup schedule was created. The retained encrypted
   archive in an expiring drill bucket is not a durable production backup policy.
5. After the report was accepted, the user directed cleanup through the Neon
   console. Both temporary buckets and the `orderfit-security-acceptance` branch
   were permanently deleted; the branch list dropped from four to three. The two
   restore databases were contained by that deleted branch. Private temporary local
   backup/key files remain outside Git and must be handled together during cleanup.

[Sanitized measured evidence](evidence/neon_acceptance_2026-10-17.json) includes
samples, resource IDs, counts, hashes and the changed-source manifest. Private
one-off runners/configuration are in the user's local Temp directory; the reusable
credential-free entry point remains [external acceptance](../deployment/external-acceptance.md).

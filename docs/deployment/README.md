# Deployment

Configuration in Git describes a deployment option; it does not prove a running
or accepted deployment. Identify the actual target, current schema, restricted API
and worker logins, private document store, and restore procedure before rollout.
Never run destructive tests against a configured/shared database.

| Environment | Guide | Boundary |
|---|---|---|
| Disposable local PostgreSQL + Compose | [Development](../development.md) | Recommended reproducible development/test path |
| Local services against an existing Neon DB | [Neon local](neon-local.md) | Explicit target and reviewed migrations; not disposable by default |
| Azure API/worker with Neon | [Azure](azure.md) | Existing workflow/configuration; external acceptance still environment-specific |
| Vercel frontend | [Vercel](vercel.md) | Same-origin proxy; `web/` build root; server-only API target |
| Hosted PostgreSQL | [Neon](neon.md) | Verified TLS, pooled restricted runtime, direct migration-only login |
| Render API/worker | [Render Blueprint](render.md) | Uses private external object storage and strips the migration URL from the API process; provider/hosted acceptance remains open |

The long-running API and worker processes must not receive `DATABASE_URL_DIRECT`.
The Render pre-deploy command uses its API service's migration secret, and the
custom API command removes that variable before starting Uvicorn. Split-host
processes use the same private object store; separate persistent disks do not share bytes.
Readiness checks database, schema, worker, and storage; liveness alone is insufficient.

Feature-specific procedures remain separate because they carry distinct privileges
and failure recovery: [admin reads](admin-reads.md), [account access/mail](account-access.md),
and [local FreeLLMPool testing](freellmpool.md). No configuration switch grants
authorization to enable an unverified external integration.

Use [external acceptance](external-acceptance.md) for separately authorized hosted,
provider, storage, and restore checks. Shared migrations and cloud/provider changes
require explicit target selection and the relevant rollout procedure.

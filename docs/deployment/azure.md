# Backend on the Azure VM (automatic deploys)

The API, worker and Caddy run with Docker Compose on `orderfit-vm` (resource group `orderfit-rg`).
Neon is the database and Vercel serves the web app with `API_INTERNAL_URL=https://orderfit-api.centralindia.cloudapp.azure.com`.

## How a change reaches production

`.github/workflows/deploy-backend.yml` runs after the `tests` workflow passes on `main`, or manually (Run workflow).

1. **build:** builds `backend/` and pushes `ghcr.io/<owner>/orderfit-backend:<commit>`.
2. **plan:** reads the database revision through the running API and compares it with the image's
   `SCHEMA_REVISION`. It fails early if the database revision is not in the image's migration history,
   which happens when branches diverged (see the 0017/0019 merge revisions).
3. **migrate:** runs only when a migration is pending. It waits for a reviewer on the
   `production-migration` environment, creates a Neon restore branch `pre-<revision>-<run id>`, then
   runs `alembic upgrade head` once from the new image with `/opt/orderfit/migrate.env`.
4. **deploy:** installs `deploy/azure/docker-compose.azure.yml` and `Caddyfile`, sets `ORDERFIT_IMAGE`
   in `/opt/orderfit/.env`, recreates the API and worker, and waits for `/ready`. If the image is not ready
   and no migration ran, the previous image and configuration are restored. After a migration the
   image is not rolled back; restore the Neon branch or fix forward.

GitHub reaches the VM with short-lived Azure OIDC tokens and `az vm run-command`. SSH stays limited to
the administrator's address. Logs never print secrets; `.env` and `migrate.env` stay on the VM.

## One-time setup

Azure (run by an administrator):

```
az ad app create --display-name orderfit-github-deploy
az ad sp create --id <appId>
az ad app federated-credential create --id <appId> --parameters '{"name":"production","issuer":"https://token.actions.githubusercontent.com","subject":"repo:md-sazid9089/Order_Fit:environment:production","audiences":["api://AzureADTokenExchange"]}'
az ad app federated-credential create --id <appId> --parameters '{"name":"production-migration","issuer":"https://token.actions.githubusercontent.com","subject":"repo:md-sazid9089/Order_Fit:environment:production-migration","audiences":["api://AzureADTokenExchange"]}'
az role assignment create --assignee <appId> --role "Virtual Machine Contributor" --scope <orderfit-vm resource id>
```

GitHub, under Settings → Environments:

- `production`: variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
- `production-migration`: the same three variables, plus **Required reviewers**, the secret `NEON_API_KEY`,
  and the variables `NEON_PROJECT_ID` and `NEON_PARENT_BRANCH_ID` (the production branch).

On the VM: `/opt/orderfit/.env` (runtime settings, mode 600) and `/opt/orderfit/migrate.env`
(`DATABASE_URL_DIRECT` only, mode 600). Rotate the Neon owner password by updating `migrate.env`.
Passkeys stay off until `.env` sets both `WEBAUTHN_RP_ID=orderfit-ten.vercel.app` and
`WEBAUTHN_ORIGIN=https://orderfit-ten.vercel.app`.

## Manual operations on the VM (`/opt/orderfit`)

```
docker compose -f docker-compose.azure.yml ps
docker compose -f docker-compose.azure.yml logs -f --tail 100 api worker
docker compose -f docker-compose.azure.yml restart api worker
ls backups/    # previous .env, compose and Caddyfile from each deploy
```

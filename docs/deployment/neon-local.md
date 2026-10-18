# Local Docker services with an existing Neon database

Docker Compose reads the root `.env`. The host Python launcher reads the file
passed to `--env-file`; `backend/.env` is not automatically used by Compose.

To select the Neon overlay for ordinary `docker compose` commands, set these
non-secret values in the ignored root `.env`:

```dotenv
COMPOSE_PATH_SEPARATOR=|
COMPOSE_FILE=docker-compose.yml|docker-compose.neon.yml
```

Set `DATABASE_URL` to the existing restricted API login's pooled Neon URL and
`WORKER_DATABASE_URL` to the distinct restricted worker login's pooled URL.
Use `postgresql+psycopg://` and `sslmode=verify-full`. For the current Docker
image, set `sslrootcert` to its bundled certifi CA file:
`/opt/venv/lib/python3.12/site-packages/certifi/cacert.pem` (URL-encode the path).
The system CA store failed certificate validation in the local Docker runtime;
the bundled certifi file passed a real container-to-Neon connection check.
Keep `DATABASE_URL_DIRECT` on the direct endpoint, for migration jobs only.
Never copy the owner URL into either runtime variable. See [neon.md](neon.md)
for role provisioning and endpoint details.

Reuse the `SESSION_SECRET`, `ACCOUNT_FINGERPRINT_KEY`, and
`ACCOUNT_FINGERPRINT_KEY_VERSION` configured for that Neon application. Do not
generate a new fingerprint key during a database switch: the same stored account
must continue to produce the same fingerprint. Switching identity keys may
require signing in again in browsers that used the previous local database.

The overlay starts only web, API and worker by default. The local Postgres
service is behind `local-db`; migration/provisioning jobs are behind `setup`.
The API and worker validate role privileges and schema compatibility at startup.
For a future schema change, review and apply the forward migration explicitly
before starting the new application version. Existing roles do not need
reprovisioning. This setup does not copy local data into Neon.

From the repository root:

```powershell
docker compose config --quiet
docker compose up --build -d
docker compose ps
curl.exe --fail http://localhost:3000/api/health
```

After startup, sign in with an existing Neon account and verify its saved data.
Do not use `docker compose config` without `--quiet`: its output contains secrets.
Retain the existing document volume; database URLs alone do not move uploaded
document files. For this database-only switch, existing
storage configuration is retained and document availability needs verification.

To return to local Postgres, restore the previous local URLs and remove the two
`COMPOSE_*` values from the root `.env`. Do not delete the local database volume.

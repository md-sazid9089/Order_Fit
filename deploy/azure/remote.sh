#!/usr/bin/env bash
# Runs on orderfit-vm through Azure Run Command (as root), invoked by .github/workflows/deploy-backend.yml.
#   remote.sh check   <image> <registry-token>
#   remote.sh migrate <image> <registry-token>
#   remote.sh deploy  <image> <registry-token> <migrated:true|false> <compose-b64> <caddyfile-b64>
# Prints RESULT_* lines that the workflow parses; Run Command itself always reports success.
# Never prints secrets: migrate.env and .env are read only by docker.
set -euo pipefail
MODE="$1" IMAGE="$2" TOKEN="$3"
DIR=/opt/orderfit
COMPOSE=(docker compose -f "$DIR/docker-compose.azure.yml")
cd "$DIR"

docker_login() { printf '%s' "$TOKEN" | docker login ghcr.io -u github-actions --password-stdin >/dev/null; }
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
fail() { echo "RESULT_ERROR=$*"; exit 1; }

current_revision() {
  "${COMPOSE[@]}" exec -T api python -c "
import os
from sqlalchemy import create_engine, text
with create_engine(os.environ['DATABASE_URL']).connect() as c:
    print(','.join(r[0] for r in c.execute(text('SELECT version_num FROM alembic_version'))))"
}

image_python() { docker run --rm --entrypoint python -w /app "$IMAGE" -c "$1"; }

wait_ready() {
  for _ in $(seq 1 45); do
    if "${COMPOSE[@]}" exec -T api python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=4)" >/dev/null 2>&1; then
      return 0
    fi
    sleep 4
  done
  return 1
}

docker_login
docker pull -q "$IMAGE" >/dev/null || fail "image pull failed"

case "$MODE" in
check)
  CURRENT="$(current_revision)" || fail "cannot read the database revision through the running API"
  HEAD="$(image_python 'from orderfit.store.db import SCHEMA_REVISION; print(SCHEMA_REVISION)')"
  # The image must know the database's revision, or Alembic cannot upgrade from it (a divergent branch).
  KNOWN="$(image_python "
from alembic.config import Config
from alembic.script import ScriptDirectory
s = ScriptDirectory.from_config(Config('alembic.ini'))
try:
    for revision in '$CURRENT'.split(','):
        s.get_revision(revision)
    print('known')
except Exception:
    print('unknown')")"
  echo "RESULT_CURRENT=$CURRENT"
  echo "RESULT_HEAD=$HEAD"
  [ "$KNOWN" = "unknown" ] && fail "database revision $CURRENT is not in this image's migration history"
  echo "RESULT_OK"
  ;;
migrate)
  [ -f "$DIR/migrate.env" ] || fail "migrate.env is missing on the VM"
  docker run --rm --env-file "$DIR/migrate.env" "$IMAGE" alembic upgrade head 2>&1 \
    | grep -E "Running upgrade|ERROR|Error" || true
  AFTER="$(current_revision)" || fail "cannot read the database revision after migrating"
  HEAD="$(image_python 'from orderfit.store.db import SCHEMA_REVISION; print(SCHEMA_REVISION)')"
  echo "RESULT_REVISION=$AFTER"
  [ "$AFTER" = "$HEAD" ] || fail "database is at $AFTER, image requires $HEAD"
  echo "RESULT_OK"
  ;;
deploy)
  MIGRATED="$4"
  STAMP="$(date +%Y%m%d%H%M%S)"
  mkdir -p "$DIR/backups"
  cp -p .env "backups/env.$STAMP"
  cp -p docker-compose.azure.yml "backups/compose.$STAMP"
  cp -p Caddyfile "backups/Caddyfile.$STAMP"
  if grep -q '^ORDERFIT_IMAGE=' .env; then
    sed -i "s#^ORDERFIT_IMAGE=.*#ORDERFIT_IMAGE=$IMAGE#" .env
  else
    printf 'ORDERFIT_IMAGE=%s\n' "$IMAGE" >> .env
  fi
  printf '%s' "$5" | base64 -d > docker-compose.azure.yml.new
  printf '%s' "$6" | base64 -d > Caddyfile.new
  if ! docker compose -f "$DIR/docker-compose.azure.yml.new" config -q; then
    cp -p "backups/env.$STAMP" .env
    rm -f docker-compose.azure.yml.new Caddyfile.new
    fail "new compose file is invalid; nothing changed"
  fi
  mv docker-compose.azure.yml.new docker-compose.azure.yml
  CADDY_CHANGED=false
  cmp -s Caddyfile.new Caddyfile || CADDY_CHANGED=true
  mv Caddyfile.new Caddyfile
  "${COMPOSE[@]}" up -d api worker caddy
  $CADDY_CHANGED && "${COMPOSE[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile
  if wait_ready; then
    echo "RESULT_DEPLOYED=$IMAGE"
    echo "RESULT_OK"
    exit 0
  fi
  "${COMPOSE[@]}" logs --tail 20 api worker 2>&1 | sed -E 's#(postgres(ql)?(\+psycopg)?://)[^ ]*#\1***#g' | tail -20
  if [ "$MIGRATED" = "true" ]; then
    fail "new image not ready after a migration; not rolling back the image (schema changed). Restore the Neon branch or fix forward."
  fi
  cp -p "backups/env.$STAMP" .env
  cp -p "backups/compose.$STAMP" docker-compose.azure.yml
  cp -p "backups/Caddyfile.$STAMP" Caddyfile
  "${COMPOSE[@]}" up -d api worker caddy
  wait_ready && fail "new image not ready; rolled back to the previous image (healthy)" \
             || fail "new image not ready and rollback is not ready either"
  ;;
*)
  fail "unknown mode $MODE"
  ;;
esac

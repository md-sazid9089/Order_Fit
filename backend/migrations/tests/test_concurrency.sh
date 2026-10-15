#!/usr/bin/env bash
# OrderFit concurrency test: the operation-log hash chain under concurrent writers, and the
# optimistic lock on deal.version.
#
# Run against a freshly migrated THROWAWAY database, as a superuser. It writes rows that cannot
# be deleted (the log is append-only), so never point it at a shared database.
#   PGHOST=... PGPORT=... PGUSER=postgres PGPASSWORD=... PGDATABASE=orderfit_test \
#     bash backend/migrations/tests/test_concurrency.sh
# Needs psql and pgbench on PATH.
set -euo pipefail

CLIENTS=8
TX_PER_CLIENT=50
EXPECTED=$((CLIENTS * TX_PER_CLIENT))
BIZ=$(psql -XAtq -c "SELECT gen_random_uuid()")
USR=$(psql -XAtq -c "SELECT gen_random_uuid()")
CON=$(psql -XAtq -c "SELECT gen_random_uuid()")
DEAL=$(psql -XAtq -c "SELECT gen_random_uuid()")
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
fail=0

psql -XAtq -v ON_ERROR_STOP=1 <<SQL
INSERT INTO business (id, name, currency) VALUES ('$BIZ', 'concurrency-$BIZ', 'USD');
INSERT INTO app_user (id, email, full_name, status) VALUES ('$USR', 'c-$BIZ@example.test', 'C', 'active');
INSERT INTO membership (user_id, business_id, role) VALUES ('$USR', '$BIZ', 'owner');
INSERT INTO owner_constraints (id, business_id, version, safety_reserve_minor, created_by) VALUES ('$CON', '$BIZ', 1, 0, '$USR');
INSERT INTO deal (id, business_id, public_ref, constraints_id, created_by) VALUES ('$DEAL', '$BIZ', 'CONC-1', '$CON', '$USR');
SQL

# 1. hash chain under concurrent writers (READ COMMITTED, the default)
cat > "$WORK/append.sql" <<SQL
INSERT INTO operation_log (business_id, actor, action, outcome) VALUES ('$BIZ', 'system', 'pgbench', 'completed');
SQL
pgbench -n -c "$CLIENTS" -j "$CLIENTS" -t "$TX_PER_CLIENT" -f "$WORK/append.sql" > "$WORK/pgbench.out" 2>&1 || { cat "$WORK/pgbench.out"; fail=1; }
RESULT=$(psql -XAtq -c "SELECT count(*) || ' ' || min(seq) || ' ' || max(seq) || ' ' || count(DISTINCT seq) FROM operation_log WHERE business_id = '$BIZ'")
VERIFY=$(psql -XAtq -c "SELECT ok || ' ' || rows_checked FROM verify_operation_log('$BIZ')")
if [[ "$RESULT" == "$EXPECTED 1 $EXPECTED $EXPECTED" && "$VERIFY" == "true $EXPECTED" ]]; then
  echo "ok   chain: $EXPECTED rows, seq 1..$EXPECTED, verify=$VERIFY"
else
  echo "FAIL chain: got rows/min/max/distinct='$RESULT' verify='$VERIFY' (want '$EXPECTED 1 $EXPECTED $EXPECTED' / 'true $EXPECTED')"; fail=1
fi

# 2. optimistic lock: two sessions update the same deal with WHERE version = v
V=$(psql -XAtq -c "SELECT version FROM deal WHERE id = '$DEAL'")
psql -XAtq -c "BEGIN; UPDATE deal SET po_number = 'S1' WHERE id = '$DEAL' AND version = $V; SELECT pg_sleep(2); COMMIT;" > "$WORK/s1.out" &
S1=$!
psql -XAtq -c "SELECT pg_sleep(0.5)" > /dev/null
S2=$(psql -XAt -c "UPDATE deal SET po_number = 'S2' WHERE id = '$DEAL' AND version = $V")
wait "$S1"
FINAL=$(psql -XAtq -c "SELECT po_number || ' v' || version FROM deal WHERE id = '$DEAL'")
if [[ "$S2" == "UPDATE 0" && "$FINAL" == "S1 v$((V + 1))" ]]; then
  echo "ok   optimistic lock: second writer updated 0 rows, deal is '$FINAL'"
else
  echo "FAIL optimistic lock: second writer '$S2', deal '$FINAL'"; fail=1
fi

if [[ $fail -ne 0 ]]; then echo "CONCURRENCY TEST FAILED"; exit 1; fi
echo "CONCURRENCY TEST PASSED"

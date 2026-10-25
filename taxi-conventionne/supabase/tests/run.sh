#!/usr/bin/env bash
# Teste le schéma sur un PostgreSQL local : ./supabase/tests/run.sh
# Connexion via les variables standard PGHOST, PGUSER, PGPASSWORD.
set -euo pipefail
cd "$(dirname "$0")"
DB=taxi_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f stub.sql
for f in ../migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" 2>/dev/null
  # Une seconde application ne doit pas échouer.
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" 2>/dev/null
done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f scenario.sql 2>&1 | sed -n 's/.*NOTICE:  //p; /ERROR/p'
exit "${PIPESTATUS[0]}"

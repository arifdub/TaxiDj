#!/usr/bin/env bash
# Runs the Taxi DJ SQL tests against a throwaway database on a local PostgreSQL.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="taxidj_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/auth_stub.sql
for f in migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -o /dev/null -v ON_ERROR_STOP=1 -d "$DB" -f tests/queue_flow.test.sql

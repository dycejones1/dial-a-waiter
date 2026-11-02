#!/usr/bin/env bash
# Runs the migration and security tests against a throwaway local Postgres (no Supabase needed).
set -euo pipefail
cd "$(dirname "$0")"
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)
[ -n "${BIN:-}" ] || BIN=$(dirname "$(command -v pg_ctl)")
DIR=$(mktemp -d); PORT=${PGPORT_TEST:-54329}
trap '"$BIN/pg_ctl" -D "$DIR" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
"$BIN/initdb" -D "$DIR" -U postgres -A trust >/dev/null
"$BIN/pg_ctl" -D "$DIR" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null
P="psql -X -q -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1"
$P -c 'create database daw' >/dev/null
$P -d daw -f stubs.sql >/dev/null
for f in ../migrations/*.sql; do $P -d daw -f "$f" >/dev/null; done
$P -t -d daw -f rls_test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //' | grep -E '^(ok|ALL|.*ERROR|.*FAIL)'

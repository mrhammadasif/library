#!/bin/bash
# Runs the database tests against a throwaway Supabase Postgres container:
# applies every migration in order, then runs supabase/tests/database/*.test.sql (pgTAP).
# Usage: bash scripts/test-db.sh   (needs Docker + psql)
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE=public.ecr.aws/supabase/postgres:17.6.1.141
PORT=55442
NAME=library-pgtest
export PGPASSWORD=postgres
DOCKER=${DOCKER:-docker}

$DOCKER rm -f "$NAME" >/dev/null 2>&1 || true
$DOCKER run -d --name "$NAME" -p "127.0.0.1:$PORT:5432" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
trap '$DOCKER rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 60); do
  psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -tAc 'select 1' >/dev/null 2>&1 && break
  sleep 1
done

for f in supabase/migrations/*.sql; do
  psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null
done

status=0
for t in supabase/tests/database/*.test.sql; do
  out=$(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -X -q -tA -v ON_ERROR_STOP=1 -f "$t" 2>&1) || status=1
  echo "$out" | grep -E '^(ok|not ok|#|1\.\.)|ERROR' || true
  if echo "$out" | grep -qE '^not ok|ERROR|Looks like'; then status=1; fi
done
exit $status

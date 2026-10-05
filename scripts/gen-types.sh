#!/bin/bash
# Regenerates src/models/Database.ts from supabase/migrations using a throwaway Postgres container.
set -euo pipefail
cd "$(dirname "$0")/.."
DOCKER=${DOCKER:-docker}
NAME=library-pgtypes
PORT=55443
export PGPASSWORD=postgres
$DOCKER rm -f "$NAME" >/dev/null 2>&1 || true
$DOCKER run -d --name "$NAME" -p "127.0.0.1:$PORT:5432" -e POSTGRES_PASSWORD=postgres public.ecr.aws/supabase/postgres:17.6.1.141 >/dev/null
trap '$DOCKER rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 60); do psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -tAc 'select 1' >/dev/null 2>&1 && break; sleep 1; done
for f in supabase/migrations/*.sql; do psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null; done
# Write to a temp file and only replace Database.ts on success (a failed run must not clobber it).
tmp=$(mktemp)
supabase gen types typescript --db-url "postgresql://postgres:postgres@127.0.0.1:$PORT/postgres?sslmode=disable" --schema public > "$tmp"
grep -q 'export type Database' "$tmp" || { echo "gen types failed:"; head -c 400 "$tmp"; rm -f "$tmp"; exit 1; }
mv "$tmp" src/models/Database.ts
echo "Wrote src/models/Database.ts"

#!/bin/bash
# Runs the API e2e suite against a real, throwaway Postgres 17 (row locks and concurrency behave for real here,
# unlike PGlite). Run on the home server, not the dev Mac. Usage: bash scripts/test-e2e-pg.sh   (needs Docker)
set -euo pipefail
cd "$(dirname "$0")/.."
DOCKER=${DOCKER:-docker}
NAME=library-api-pgtest
PORT=55452
$DOCKER rm -f "$NAME" >/dev/null 2>&1 || true
$DOCKER run -d --name "$NAME" -p "127.0.0.1:$PORT:5432" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=library postgres:17-alpine >/dev/null
trap '$DOCKER rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 60); do
  $DOCKER exec "$NAME" pg_isready -U postgres -d library >/dev/null 2>&1 && break
  sleep 1
done
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:$PORT/library"
npx prisma migrate deploy
TEST_DATABASE_URL="$DATABASE_URL" npx vitest run test/e2e

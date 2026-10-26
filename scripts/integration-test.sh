#!/usr/bin/env bash
# Runs the workspace test suites against a disposable dockerized Postgres +
# Redis (ports 54329/63799 — the dev compose Postgres owns 5433): migrates,
# runs `bun run test` (apps/api's suites hit the real database), and tears the
# containers down. Local development and CI use this same entry point; no
# .env or registry credentials are needed.
set -euo pipefail

cd "$(dirname "$0")/.."

PG_CONTAINER=myapp-int-pg
REDIS_CONTAINER=myapp-int-redis
PG_PORT=54329
REDIS_PORT=63799

cleanup() {
  docker rm -f "$PG_CONTAINER" "$REDIS_CONTAINER" >/dev/null 2>&1 || true
}

# A RUNNING container with one of our fixed names means another integration
# run is live — removing it would kill that run mid-suite. Check before
# installing the EXIT trap so aborting here can't tear the other run down.
for c in "$PG_CONTAINER" "$REDIS_CONTAINER"; do
  if [ -n "$(docker ps -q -f "name=^${c}\$" -f status=running)" ]; then
    echo "another integration run appears to be in progress (container $c) — wait for it to finish or \`docker rm -f $c\` it" >&2
    exit 1
  fi
done

trap cleanup EXIT

# Clear non-running leftovers from a previous crashed run before binding the ports.
cleanup

# Both registries serve Docker Official Images. Fall back when a shared runner
# hits an anonymous pull quota; fail if neither registry can supply the image.
pull_test_image() {
  local image="$1"
  if docker pull "$image"; then
    return
  fi
  local mirror="public.ecr.aws/docker/library/$image"
  echo "Docker Hub pull failed; trying $mirror" >&2
  docker pull "$mirror" && docker tag "$mirror" "$image"
}

pull_test_image postgres:17-alpine
pull_test_image redis:7-alpine

docker run --pull=never -d --rm --name "$PG_CONTAINER" \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=myapp_test \
  -p "$PG_PORT":5432 postgres:17-alpine >/dev/null
docker run --pull=never -d --rm --name "$REDIS_CONTAINER" \
  -p "$REDIS_PORT":6379 redis:7-alpine >/dev/null

# -h 127.0.0.1 so the init-phase temporary server (unix socket only) never
# reads as ready.
for i in $(seq 1 60); do
  if docker exec "$PG_CONTAINER" pg_isready -h 127.0.0.1 -U postgres -d myapp_test >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Postgres did not become ready in time" >&2
    docker logs "$PG_CONTAINER" >&2 || true
    exit 1
  fi
  sleep 0.5
done

for i in $(seq 1 60); do
  if [ "$(docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null)" = "PONG" ]; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Redis did not become ready in time" >&2
    docker logs "$REDIS_CONTAINER" >&2 || true
    exit 1
  fi
  sleep 0.5
done

# Explicit disposable-service settings keep local and CI tests consistent.
export DATABASE_URL="postgresql://postgres:postgres@localhost:$PG_PORT/myapp_test"
export REDIS_URL="redis://localhost:$REDIS_PORT"
export BETTER_AUTH_SECRET=ci-test-secret
export BETTER_AUTH_URL=http://localhost:3000
export APP_NAME=MyApp
export TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
export WS_API_SECRET=ci-ws-secret

# Invoke migrate.ts directly (not the --env-file package script) so a local
# .env can never redirect the run at another database.
(cd apps/migrate && bun src/migrate.ts)
bun run test

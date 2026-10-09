#!/usr/bin/env bash

set -euo pipefail

hosts=(host-1 host-2 host-3 host-4 host-5)
network="${COMPOSE_PROJECT_NAME:-campusresq}_default"

if ! docker compose ps --status running --services | grep -qx "host-1"; then
  echo "Host containers are not running. Start them with: docker compose up -d --build" >&2
  exit 1
fi
if ! docker network inspect "$network" >/dev/null 2>&1; then
  echo "Compose network $network was not found." >&2
  exit 1
fi

echo "Host health checks"
echo "=================="

for host in "${hosts[@]}"; do
  printf '\n%s /health\n' "$host"
  docker run --rm --network "$network" curlimages/curl:8.12.1 \
    --fail --silent --show-error \
    "http://${host}:8000/health"
  printf '\n%s /info\n' "$host"
  docker run --rm --network "$network" curlimages/curl:8.12.1 \
    --fail --silent --show-error \
    "http://${host}:8000/info"
  printf '\n'
done

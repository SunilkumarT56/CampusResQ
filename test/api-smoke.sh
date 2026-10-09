#!/usr/bin/env bash

set -euo pipefail

base_url="${API_URL:-http://localhost:3001/api}"

request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local response

  if [[ -n "$body" ]]; then
    response="$(curl --fail-with-body --silent --show-error \
      --request "$method" \
      --header 'content-type: application/json' \
      --data "$body" \
      --write-out $'\nHTTP_STATUS:%{http_code}' \
      "${base_url}${path}")"
  else
    response="$(curl --fail-with-body --silent --show-error \
      --request "$method" \
      --write-out $'\nHTTP_STATUS:%{http_code}' \
      "${base_url}${path}")"
  fi

  printf '%s %s\n%s\n\n' "$method" "$path" "$response"
}

echo "Network Router API smoke tests"
echo "=============================="

request GET /health
request GET /hosts
request GET /hosts/host-1
request GET /topology
request GET /topology/status
request GET /topology/links

echo "Invalid topology request (expected HTTP 400)"
curl --silent --show-error --request POST \
  --header 'content-type: application/json' \
  --data '{"type":"MESH"}' \
  --write-out $'\nHTTP_STATUS:%{http_code}\n\n' \
  "${base_url}/topology"

echo "STAR topology request"
star_response="$(curl --silent --show-error --request POST \
  --header 'content-type: application/json' \
  --data '{"type":"STAR"}' \
  --write-out $'\nHTTP_STATUS:%{http_code}' \
  "${base_url}/topology")"
printf '%s\n\n' "$star_response"

star_status="$(printf '%s' "$star_response" | sed -n 's/^HTTP_STATUS://p')"
if [[ "$star_status" != "201" && "$star_status" != "503" ]]; then
  echo "Unexpected STAR response status: $star_status" >&2
  exit 1
fi

if [[ "$star_status" == "201" ]]; then
  request GET /topology
  request GET /topology/status
  request GET /topology/links
  request POST /topology/links/link-1/fail
  request POST /topology/links/link-1/restore
else
  echo "STAR was not committed because Docker topology enforcement is unavailable."
fi

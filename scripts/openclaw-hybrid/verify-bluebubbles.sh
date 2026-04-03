#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BLUEBUBBLES_SERVER_URL:-}" ]]; then
  echo "Set BLUEBUBBLES_SERVER_URL first."
  exit 1
fi

if [[ -z "${BLUEBUBBLES_PASSWORD:-}" ]]; then
  echo "Set BLUEBUBBLES_PASSWORD first."
  exit 1
fi

echo "Pinging BlueBubbles server..."
ENCODED_PASSWORD="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "${BLUEBUBBLES_PASSWORD}")"
curl -sf "${BLUEBUBBLES_SERVER_URL}/api/v1/ping?password=${ENCODED_PASSWORD}" | jq '.'

echo "BlueBubbles ping OK."

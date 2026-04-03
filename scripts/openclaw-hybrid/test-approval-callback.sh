#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PA_APPROVAL_WEBHOOK_TOKEN:-}" ]]; then
  echo "Set PA_APPROVAL_WEBHOOK_TOKEN first."
  exit 1
fi

if [[ -z "${1:-}" ]]; then
  echo "Usage: $0 <outboundId> [approved:true|false]"
  exit 1
fi

OUTBOUND_ID="$1"
APPROVED="${2:-true}"

curl -sS -X POST "http://127.0.0.1:8787/approval/callback" \
  -H "Authorization: Bearer ${PA_APPROVAL_WEBHOOK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"outboundId\": \"${OUTBOUND_ID}\",
    \"approved\": ${APPROVED},
    \"reviewer\": \"manual-test\"
  }" | jq '.'

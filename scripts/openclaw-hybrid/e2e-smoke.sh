#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BRIDGE_INGEST_TOKEN:-}" ]]; then
  echo "Set BRIDGE_INGEST_TOKEN."
  exit 1
fi

if [[ -z "${PA_APPROVAL_WEBHOOK_TOKEN:-}" ]]; then
  echo "Set PA_APPROVAL_WEBHOOK_TOKEN."
  exit 1
fi

echo "Queueing low-risk iMessage test item..."
curl -sS -X POST "http://127.0.0.1:8787/outbound/queue" \
  -H "Authorization: Bearer ${BRIDGE_INGEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"imessage",
    "to":"+14156915618",
    "body":"Smoke test message from OpenClaw hybrid dispatcher."
  }' | jq '.'

echo "Queueing high-risk Outlook test item..."
OUTBOUND_ID="$(curl -sS -X POST "http://127.0.0.1:8787/outbound/queue" \
  -H "Authorization: Bearer ${BRIDGE_INGEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"outlook_email",
    "to":"legal@example.com",
    "subject":"Contract update",
    "body":"Please review signed agreement terms."
  }' | jq -r '.item.id // empty')"

if [[ -n "${OUTBOUND_ID}" ]]; then
  echo "Approving high-risk test item ${OUTBOUND_ID}..."
  curl -sS -X POST "http://127.0.0.1:8787/approval/callback" \
    -H "Authorization: Bearer ${PA_APPROVAL_WEBHOOK_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"outboundId\":\"${OUTBOUND_ID}\",\"approved\":true,\"reviewer\":\"smoke-test\"}" | jq '.'
fi

echo "Running dispatcher once..."
node "openclaw-hybrid/scripts/dispatcher.mjs"

echo "Smoke run complete. Review state files for statuses."

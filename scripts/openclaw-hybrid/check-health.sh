#!/usr/bin/env bash
set -euo pipefail

echo "== OpenClaw gateway =="
curl -sf "http://127.0.0.1:18789/health" | jq '.'

echo "== Bridge service =="
curl -sf "http://127.0.0.1:8787/health" | jq '.'

echo "== systemd status =="
systemctl is-active openclaw-gateway.service
systemctl is-active openclaw-bridge.service
systemctl is-active openclaw-dispatcher.timer

echo "Health check passed."

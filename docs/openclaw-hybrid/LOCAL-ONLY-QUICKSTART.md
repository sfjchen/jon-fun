# Local-Only Quickstart (No Cloud Host, No Outlook Bridge)

This mode is for your current setup:

- No VPS (Virtual Private Server) / cloud box
- iMessage-first with BlueBubbles
- OpenRouter models
- Outlook/Graph/Power Automate disabled

## 1) Environment file

Use:

- `openclaw-hybrid/config/env.cloud` (now configured for local paths)

Important toggles:

- `ENABLE_OUTLOOK_BRIDGE=false`
- `PA_APPROVAL_WEBHOOK_URL=` (empty)
- `GRAPH_WEBHOOK_URL=` (empty)

## 2) Start bridge + dispatcher locally

From repo root:

```bash
source openclaw-hybrid/config/env.cloud
npm run openclaw:bridge
```

In another terminal:

```bash
source openclaw-hybrid/config/env.cloud
while true; do npm run openclaw:dispatch; sleep 60; done
```

## 3) Start OpenClaw gateway

```bash
source openclaw-hybrid/config/env.cloud
openclaw gateway
```

## 4) BlueBubbles validation

```bash
source openclaw-hybrid/config/env.cloud
bash scripts/openclaw-hybrid/verify-bluebubbles.sh
```

If this passes, OpenClaw can use iMessage via BlueBubbles.

## 5) What is disabled in this mode

- Outlook scheduled send bridge
- Graph webhook subscription processing
- Power Automate approval callbacks

The code will safely skip/reject Outlook queue actions while disabled.

## 6) Optional fallback notifications

If you later set Telegram token/chat ID, important alerts can fall back to Telegram when BlueBubbles is unavailable.

# Important Email Alerts

## What is implemented

- Graph webhook ingestion endpoint: `POST /graph/webhook`
- Important-email classifier:
  - `vipSenders`
  - `importantKeywords`
- Queue-based notification dispatch:
  - Primary: BlueBubbles (`channel: bluebubbles`)
  - Fallback: Telegram (`channel: telegram`)

Implementation files:

- `openclaw-hybrid/scripts/bridge-server.mjs`
- `openclaw-hybrid/scripts/dispatcher.mjs`
- `openclaw-hybrid/scripts/graph-subscription.mjs`

## Setup

1. Set env vars:
   - `GRAPH_TENANT_ID`
   - `GRAPH_CLIENT_ID`
   - `GRAPH_CLIENT_SECRET`
   - `GRAPH_USER_ID`
   - `GRAPH_WEBHOOK_CLIENT_STATE`
   - `GRAPH_WEBHOOK_URL` (public URL that maps to `/graph/webhook`)
2. Tune `policies.json` values for important-email rules.
3. Enable renewal timer:

```bash
sudo cp /opt/openclaw-hybrid/systemd/graph-subscription-renew.service /etc/systemd/system/
sudo cp /opt/openclaw-hybrid/systemd/graph-subscription-renew.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now graph-subscription-renew.timer
```

4. Seed first subscription:

```bash
sudo -u openclaw node /opt/openclaw-hybrid/scripts/graph-subscription.mjs upsert
```

## Test flow

1. Send a test email with a keyword like `urgent`.
2. Confirm webhook event logged in:
   - `/opt/openclaw-hybrid/state/graph-events.jsonl`
3. Confirm notification queue in:
   - `/opt/openclaw-hybrid/state/notifications.json`
4. Run dispatcher:

```bash
sudo -u openclaw node /opt/openclaw-hybrid/scripts/dispatcher.mjs
```

5. Confirm iMessage alert is received; if unavailable, confirm Telegram fallback.

## Optional urgent escalation

If you want phone-call escalation for severe conditions:

- Install OpenClaw voice-call plugin and configure Twilio.
- Add policy condition in dispatcher for escalation severity and call trigger.
- Use this only for high-confidence, low-frequency events.

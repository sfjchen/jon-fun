# BlueBubbles Integration Guide

## Scope

This setup uses:

- BlueBubbles on Mac as iMessage transport
- Cloud OpenClaw gateway for orchestration and scheduling
- Queue/retry behavior in the bridge dispatcher when Mac transport is unavailable

## Mac setup

1. Install BlueBubbles server on the Mac.
2. Enable API + set password.
3. Ensure Messages is signed in and unlocked regularly.
4. Configure webhook URL to cloud gateway:

```text
https://<cloud-domain>/bluebubbles-webhook?password=<BLUEBUBBLES_PASSWORD>
```

## Cloud setup alignment

- Set `BLUEBUBBLES_SERVER_URL` and `BLUEBUBBLES_PASSWORD` in `env.cloud`.
- Keep OpenClaw channel configured in `openclaw.cloud.example.json5`.
- Validate connectivity:

```bash
source /opt/openclaw-hybrid/config/env.cloud
bash scripts/openclaw-hybrid/verify-bluebubbles.sh
```

## Reliability model

- If BlueBubbles is unavailable (Mac asleep/offline), bridge dispatcher attempts:
  1. iMessage primary send path
  2. Telegram fallback for important-email notifications
- Outbound items remain in queue until successfully sent or manually resolved.

## Validation checklist

1. **Ping test**
   - `verify-bluebubbles.sh` returns success.
2. **Inbound webhook test**
   - Send an iMessage to the paired contact; confirm OpenClaw receives event.
3. **Outbound send test**
   - Queue a low-risk iMessage item in `/outbound/queue`; run dispatcher and verify delivery.
4. **Offline fallback test**
   - Stop BlueBubbles or disconnect Mac.
   - Trigger important email notification.
   - Confirm Telegram fallback alert is sent.
5. **Recovery test**
   - Re-enable BlueBubbles.
   - Re-run dispatcher.
   - Confirm pending iMessage items are delivered.

## Known constraints

- iMessage delivery requires Mac-side BlueBubbles to be reachable.
- Scheduling remains reliable in cloud, but iMessage transport is not available while Mac path is down.

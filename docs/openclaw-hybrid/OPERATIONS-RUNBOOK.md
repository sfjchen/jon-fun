# Operations Runbook

## Daily checks

```bash
sudo systemctl is-active openclaw-gateway.service
sudo systemctl is-active openclaw-bridge.service
sudo systemctl is-active openclaw-dispatcher.timer
sudo systemctl is-active graph-subscription-renew.timer
```

Check queue depth:

```bash
jq 'map(select(.status=="pending" or .status=="awaiting_approval" or .status=="ready")) | length' /opt/openclaw-hybrid/state/notifications.json
jq 'map(select(.status=="awaiting_approval" or .status=="ready")) | length' /opt/openclaw-hybrid/state/outbound.json
```

## Incident playbooks

### BlueBubbles unreachable

Symptoms:

- iMessage send fails
- notifications fall back to Telegram only

Actions:

1. Run `verify-bluebubbles.sh`.
2. Confirm Mac is online and BlueBubbles service is running.
3. Re-run dispatcher to flush queued notifications.

### Graph subscription expired

Symptoms:

- no new webhook events in `graph-events.jsonl`

Actions:

1. Run renew script manually:
   - `node /opt/openclaw-hybrid/scripts/graph-subscription.mjs upsert`
2. Confirm timer is active.
3. Send a test email with urgent keyword and validate queue.

### Approval timeout

Symptoms:

- `outbound.json` has many `awaiting_approval` items

Actions:

1. Verify Power Automate flow run history.
2. Check callback endpoint auth token.
3. Use `test-approval-callback.sh` to recover one blocked item.

### Cloud restart/redeploy

Actions:

1. Restart units in order:
   - gateway -> bridge -> dispatcher timer
2. Run health script.
3. Run one synthetic enqueue test and verify end-to-end delivery.

## Backup policy

Daily backup targets:

- `/opt/openclaw-hybrid/config`
- `/opt/openclaw-hybrid/state`
- `/home/openclaw/.openclaw/openclaw.json`

## Change management

Before deploying policy/model changes:

1. Copy current config to timestamped backup.
2. Apply changes.
3. Run smoke tests.
4. Monitor first 24 hours for queue growth and delivery failures.

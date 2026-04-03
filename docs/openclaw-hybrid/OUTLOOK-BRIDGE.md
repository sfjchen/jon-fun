# Outlook Bridge (Power Automate + Graph)

This project uses Power Automate as the human-approval control plane and Microsoft Graph as the send/receive API backend.

## Outbound pipeline

1. OpenClaw or external scheduler enqueues outbound item to bridge:
   - `POST /outbound/queue`
2. Bridge marks item:
   - `awaiting_approval` if high-risk
   - `ready` if low-risk
3. Dispatcher sends approval request to Power Automate:
   - action: `request_approval`
4. Power Automate sends approval callback:
   - `POST /approval/callback` with `approved: true|false`
5. Dispatcher processes approved items:
   - default: `send_outlook_email` action to Power Automate
   - optional direct mode: set `GRAPH_DIRECT_SEND=true` for Graph `sendMail`

## Required Graph permissions

- `Mail.Send`
- `Mail.Read`
- `Mail.ReadWrite` (optional if draft workflows are used)
- `User.Read.All` (optional for directory-based enrichment)

Use application permissions with admin consent for service-driven sending.

## Power Automate flow contract

### Approval request input (from dispatcher)

```json
{
  "action": "request_approval",
  "outboundId": "out_...",
  "payload": {
    "type": "outlook_email",
    "to": "recipient@example.com",
    "subject": "Subject",
    "body": "Email body text"
  },
  "requiresApproval": true
}
```

### Approval callback output (to bridge)

```json
{
  "outboundId": "out_...",
  "approved": true,
  "reviewer": "Approver Name"
}
```

Headers required:

- `Authorization: Bearer <PA_APPROVAL_WEBHOOK_TOKEN>`

## Queueing scheduled sends

Use bridge queue endpoint:

```bash
curl -X POST "http://127.0.0.1:8787/outbound/queue" \
  -H "Authorization: Bearer $BRIDGE_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"outlook_email",
    "to":"recipient@example.com",
    "subject":"Scheduled follow-up",
    "body":"Hello, sharing a quick update."
  }'
```

## High-risk policy defaults

High-risk routing is triggered by:

- recipient domain in `highRiskDomains`
- subject/body keyword hit in `highRiskKeywords`

Policy file:

- `/opt/openclaw-hybrid/config/policies.json`

## Failure handling

- If Power Automate endpoint fails, queue items remain pending and retry next dispatcher cycle.
- If callback is rejected/failed, item remains `awaiting_approval`.
- Rejected items are not sent; status set to `rejected`.

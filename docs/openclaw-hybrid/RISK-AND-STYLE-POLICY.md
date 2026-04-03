# Risk and Style Policy

## High-risk send policy

Human approval is required when any rule matches:

- Recipient domain is external high-risk domain
- Subject/body contains legal/financial/security keywords
- Message contains high-commitment language:
  - `signed agreement`
  - `wire transfer`
  - `payment today`
  - `legal notice`

Policy source files:

- `openclaw-hybrid/config/policies.json`
- `openclaw-hybrid/config/approval.policy.example.json`

## Style profile policy

Default style profile:

- Tone: clear, warm, concise
- Length: short by default
- Signature: optional
- Avoid stale/corporate phrasing

Style profile is embedded in policy JSON and should be consumed by `comms` agent prompts.

## Approval UX contract

Approval payload should include:

- `outboundId`
- `to`
- `subject`
- `body`
- `riskReason`
- actions:
  - `approve`
  - `reject`
  - `edit_then_approve`

Edit flow:

1. Reviewer edits body/subject in Power Automate form.
2. Flow writes edited payload back to queue item.
3. Callback posts `approved=true`.
4. Dispatcher sends edited payload.

## Duplicate and loop suppression

Implemented in bridge queue layer:

- Important-email dedupe: suppress by Graph message ID.
- Outbound dedupe: suppress by content fingerprint (type + recipient + subject + body + schedule).

Operational guidance:

- Keep dispatcher interval at 60 seconds.
- Never enqueue via multiple jobs with same payload unless intended.
- Review queue files daily during initial rollout.

State files:

- `/opt/openclaw-hybrid/state/notifications.json`
- `/opt/openclaw-hybrid/state/outbound.json`

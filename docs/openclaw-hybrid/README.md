# OpenClaw Hybrid Kit

This folder contains the implementation kit for hybrid automation:

- Cloud scheduler/webhooks + orchestration
- Mac-hosted BlueBubbles iMessage transport
- Outlook bridge with human approval for high-risk sends
- Important-email detection and notifications

## Documents

- `DEPLOYMENT.md` - cloud + service install sequence
- `LOCAL-ONLY-QUICKSTART.md` - fastest local mode (no cloud, no Outlook bridge)
- `BLUEBUBBLES.md` - iMessage integration and reliability tests
- `OUTLOOK-BRIDGE.md` - approval and send pipeline
- `IMPORTANT-EMAIL-ALERTS.md` - Graph subscription and alert flow
- `RISK-AND-STYLE-POLICY.md` - risk thresholds, style profile, dedupe rules
- `COST-TUNING.md` - budget and routing controls
- `OPERATIONS-RUNBOOK.md` - incident playbooks and daily checks

## Runtime assets

- `openclaw-hybrid/config` - config templates
- `openclaw-hybrid/systemd` - service/timer units
- `openclaw-hybrid/scripts` - bridge, dispatcher, Graph subscription tools
- `scripts/openclaw-hybrid` - host bootstrap and smoke/health scripts

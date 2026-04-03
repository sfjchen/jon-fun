# OpenClaw Hybrid Deployment

This deployment is designed for:

- Always-on cloud scheduling and webhooks
- Mac-hosted BlueBubbles for iMessage delivery
- Outlook automation through Power Automate + Microsoft Graph

## 1) Cloud host bootstrap

Run from repo root on the cloud host:

```bash
sudo bash scripts/openclaw-hybrid/bootstrap-cloud.sh
```

Then create the runtime env file:

```bash
sudo cp /opt/openclaw-hybrid/config/env.cloud.example /opt/openclaw-hybrid/config/env.cloud
sudo nano /opt/openclaw-hybrid/config/env.cloud
```

## 2) OpenClaw config deployment

Copy template and fill values:

```bash
sudo -u openclaw mkdir -p /home/openclaw/.openclaw
sudo -u openclaw cp /opt/openclaw-hybrid/config/openclaw.cloud.example.json5 /home/openclaw/.openclaw/openclaw.json
sudo -u openclaw cp /opt/openclaw-hybrid/config/policies.example.json /opt/openclaw-hybrid/config/policies.json
```

Run onboarding once as `openclaw`:

```bash
sudo -u openclaw openclaw onboard --install-daemon
```

## 3) Install services

```bash
sudo cp /opt/openclaw-hybrid/systemd/openclaw-gateway.service /etc/systemd/system/
sudo cp /opt/openclaw-hybrid/systemd/openclaw-bridge.service /etc/systemd/system/
sudo cp /opt/openclaw-hybrid/systemd/openclaw-dispatcher.service /etc/systemd/system/
sudo cp /opt/openclaw-hybrid/systemd/openclaw-dispatcher.timer /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-gateway.service
sudo systemctl enable --now openclaw-bridge.service
sudo systemctl enable --now openclaw-dispatcher.timer
```

## 4) Health checks

```bash
curl http://127.0.0.1:18789/health
curl http://127.0.0.1:8787/health
sudo systemctl status openclaw-gateway.service --no-pager
sudo systemctl status openclaw-bridge.service --no-pager
sudo systemctl status openclaw-dispatcher.timer --no-pager
```

## 5) BlueBubbles linking (Mac side)

- Configure BlueBubbles API password and webhook endpoint
- Set webhook target to cloud gateway:
  - `https://<cloud-domain>/bluebubbles-webhook?password=<same_password>`
- Keep the Mac signed into Messages and BlueBubbles server running

## 6) Security baseline

- Use long random values for:
  - `OPENCLAW_HOOKS_TOKEN`
  - `PA_APPROVAL_WEBHOOK_TOKEN`
  - `GRAPH_WEBHOOK_CLIENT_STATE`
  - `BLUEBUBBLES_PASSWORD`
- Keep OpenClaw bound to loopback and use reverse proxy/Tailscale for external paths
- Run periodic audit:

```bash
sudo -u openclaw openclaw security audit --deep
```

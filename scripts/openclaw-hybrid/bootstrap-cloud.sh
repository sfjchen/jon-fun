#!/usr/bin/env bash
set -euo pipefail

# OpenClaw cloud bootstrap for Ubuntu/Debian hosts.
# This script installs runtime dependencies and creates an automation user.

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/openclaw-hybrid/bootstrap-cloud.sh"
  exit 1
fi

AUTOMATION_USER="${AUTOMATION_USER:-openclaw}"
INSTALL_DIR="${INSTALL_DIR:-/opt/openclaw-hybrid}"

echo "[1/6] Installing system packages..."
apt-get update
apt-get install -y curl ca-certificates jq unzip git rsync cron

echo "[2/6] Installing Node.js 24.x..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

echo "[3/6] Installing OpenClaw CLI..."
npm install -g openclaw@latest

echo "[4/6] Creating automation user..."
if ! id -u "${AUTOMATION_USER}" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "${AUTOMATION_USER}"
fi

echo "[5/6] Copying automation assets..."
mkdir -p "${INSTALL_DIR}"
rsync -a --delete ./openclaw-hybrid/ "${INSTALL_DIR}/"
chown -R "${AUTOMATION_USER}:${AUTOMATION_USER}" "${INSTALL_DIR}"

echo "[6/6] Next steps"
echo "- Run onboarding as ${AUTOMATION_USER}: sudo -u ${AUTOMATION_USER} openclaw onboard --install-daemon"
echo "- Copy .env template from ${INSTALL_DIR}/config/env.cloud.example"
echo "- Install systemd units from ${INSTALL_DIR}/systemd/"
echo "Bootstrap complete."

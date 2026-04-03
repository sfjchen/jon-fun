#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${HOME}/Library/Application Support/bluebubbles-server/config.db"
ENV_PATH="${1:-openclaw-hybrid/config/env.cloud}"

if [[ ! -f "${DB_PATH}" ]]; then
  echo "BlueBubbles config DB not found at: ${DB_PATH}"
  exit 1
fi

if [[ ! -f "${ENV_PATH}" ]]; then
  echo "Env file not found: ${ENV_PATH}"
  exit 1
fi

URL="$(sqlite3 "${DB_PATH}" "select value from config where name='server_address';")"
if [[ -z "${URL}" ]]; then
  echo "Could not read BlueBubbles server_address from config DB."
  exit 1
fi

python3 - <<'PY' "${ENV_PATH}" "${URL}"
import pathlib, re, sys
env_path = pathlib.Path(sys.argv[1])
url = sys.argv[2]
text = env_path.read_text()
new = re.sub(r"^BLUEBUBBLES_SERVER_URL=.*$", f"BLUEBUBBLES_SERVER_URL={url}", text, flags=re.M)
if new == text:
    new += f"\nBLUEBUBBLES_SERVER_URL={url}\n"
env_path.write_text(new)
print(f"Updated BLUEBUBBLES_SERVER_URL -> {url}")
PY

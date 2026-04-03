import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const stateDir = process.env.BRIDGE_STATE_DIR ?? "/opt/openclaw-hybrid/state";
const tenantId = process.env.GRAPH_TENANT_ID ?? "";
const clientId = process.env.GRAPH_CLIENT_ID ?? "";
const clientSecret = process.env.GRAPH_CLIENT_SECRET ?? "";
const clientState = process.env.GRAPH_WEBHOOK_CLIENT_STATE ?? "";
const webhookUrl = process.env.GRAPH_WEBHOOK_URL ?? "";
const mailboxUser = process.env.GRAPH_USER_ID ?? "";
const statePath = path.join(stateDir, "graph-subscription.json");
const mode = process.argv[2] ?? "upsert";

if (!tenantId || !clientId || !clientSecret || !webhookUrl || !mailboxUser || !clientState) {
  throw new Error("Missing Graph subscription env vars.");
}

async function getToken() {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );
  if (!tokenRes.ok) {
    throw new Error(await tokenRes.text());
  }
  const tokenJson = await tokenRes.json();
  return tokenJson.access_token;
}

async function readState() {
  try {
    const data = await readFile(statePath, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeState(value) {
  await writeFile(statePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function upsertSubscription() {
  const token = await getToken();
  const state = await readState();
  const expirationDateTime = new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString();

  if (state.subscriptionId) {
    const patchRes = await fetch(
      `https://graph.microsoft.com/v1.0/subscriptions/${state.subscriptionId}`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ expirationDateTime }),
      },
    );
    if (patchRes.ok) {
      await writeState({
        ...state,
        expirationDateTime,
        updatedAt: new Date().toISOString(),
      });
      return;
    }
  }

  const resource = `users/${encodeURIComponent(mailboxUser)}/mailFolders('Inbox')/messages`;
  const createRes = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      changeType: "created",
      notificationUrl: webhookUrl,
      resource,
      expirationDateTime,
      clientState,
    }),
  });
  if (!createRes.ok) {
    throw new Error(await createRes.text());
  }
  const created = await createRes.json();
  await writeState({
    subscriptionId: created.id,
    resource: created.resource,
    expirationDateTime: created.expirationDateTime,
    createdAt: new Date().toISOString(),
  });
}

async function deleteSubscription() {
  const state = await readState();
  if (!state.subscriptionId) return;
  const token = await getToken();
  await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${state.subscriptionId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  await writeState({});
}

if (mode === "delete") {
  await deleteSubscription();
} else {
  await upsertSubscription();
}

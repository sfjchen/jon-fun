import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const stateDir = process.env.BRIDGE_STATE_DIR ?? "/opt/openclaw-hybrid/state";
const hooksToken = process.env.OPENCLAW_HOOKS_TOKEN ?? "";
const hooksBase = process.env.OPENCLAW_HOOKS_BASE_URL ?? "http://127.0.0.1:18789/hooks";
const bluebubblesBase = process.env.BLUEBUBBLES_SERVER_URL ?? "";
const bluebubblesPassword = process.env.BLUEBUBBLES_PASSWORD ?? "";
const paWebhookUrl = process.env.PA_APPROVAL_WEBHOOK_URL ?? "";
const paWebhookToken = process.env.PA_APPROVAL_WEBHOOK_TOKEN ?? "";
const graphDirectSend = process.env.GRAPH_DIRECT_SEND === "true";
const outlookBridgeEnabled = process.env.ENABLE_OUTLOOK_BRIDGE === "true";
const graphTenantId = process.env.GRAPH_TENANT_ID ?? "";
const graphClientId = process.env.GRAPH_CLIENT_ID ?? "";
const graphClientSecret = process.env.GRAPH_CLIENT_SECRET ?? "";
const graphUserId = process.env.GRAPH_USER_ID ?? "";
const imessageTarget = process.env.BRIDGE_IMESSAGE_TARGET ?? "";
const telegramTarget = process.env.TELEGRAM_CHAT_ID ?? "";
const urgentCallEnabled = process.env.ENABLE_URGENT_CALL === "true";
const urgentCallTo = process.env.URGENT_CALL_TO_NUMBER ?? "";

const files = {
  notifications: path.join(stateDir, "notifications.json"),
  outbound: path.join(stateDir, "outbound.json"),
};

async function readJson(filePath, fallback) {
  try {
    if (!existsSync(filePath)) return fallback;
    const data = await readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function postJson(url, body, token = "") {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`POST ${url} failed (${response.status}): ${text}`);
  }
}

function encode(value) {
  return encodeURIComponent(value);
}

function normalizePhoneTarget(raw) {
  return String(raw ?? "").replace(/[^\d+]/g, "");
}

async function sendBlueBubblesText(to, message) {
  if (!bluebubblesBase || !bluebubblesPassword) {
    throw new Error("BlueBubbles env is missing.");
  }
  const target = normalizePhoneTarget(to);
  const url = `${bluebubblesBase}/api/v1/message/text?password=${encode(bluebubblesPassword)}`;
  const payload = {
    tempGuid: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chatGuid: `iMessage;-;${target}`,
    message,
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BlueBubbles send failed (${response.status}): ${text}`);
  }
  const body = await response.text();
  if (body && body.includes("\"status\":500")) {
    throw new Error(`BlueBubbles send reported error: ${body}`);
  }
}

async function getGraphAccessToken() {
  if (!graphTenantId || !graphClientId || !graphClientSecret) {
    throw new Error("Graph credentials missing.");
  }

  const tokenUrl = `https://login.microsoftonline.com/${graphTenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: graphClientId,
    client_secret: graphClientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Graph token request failed: ${text}`);
  }
  const data = await response.json();
  return data.access_token;
}

async function sendOutlookViaGraph(payload) {
  if (!graphUserId) throw new Error("GRAPH_USER_ID missing.");
  const token = await getGraphAccessToken();
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(graphUserId)}/sendMail`;
  const body = {
    message: {
      subject: payload.subject ?? "Scheduled message",
      body: {
        contentType: "Text",
        content: payload.body ?? "",
      },
      toRecipients: [
        {
          emailAddress: {
            address: payload.to,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Graph sendMail failed: ${text}`);
  }
}

function summarizeMail(mail) {
  const from = mail.from?.emailAddress?.address ?? "unknown sender";
  const subject = mail.subject ?? "No subject";
  return `Important email detected.\nFrom: ${from}\nSubject: ${subject}\nRespond if needed.`;
}

function isSevereMail(mail) {
  const subject = String(mail.subject ?? "").toLowerCase();
  return ["urgent", "immediate", "deadline today", "legal notice"].some((k) =>
    subject.includes(k),
  );
}

async function dispatchImportantNotifications(queue) {
  for (const item of queue) {
    if (item.kind !== "important_email" || item.status !== "pending") continue;
    const text = summarizeMail(item.payload ?? {});
    try {
      await sendBlueBubblesText(imessageTarget, text);
      item.status = "sent_primary";
      item.sentAt = new Date().toISOString();
    } catch {
      if (telegramTarget) {
        await postJson(
          `${hooksBase}/agent`,
          {
            name: "ImportantEmailFallback",
            agentId: "orchestrator",
            message: text,
            wakeMode: "now",
            deliver: true,
            channel: "telegram",
            to: telegramTarget,
          },
          hooksToken,
        );
        item.status = "sent_fallback";
        item.sentAt = new Date().toISOString();
      }
    }

    if (urgentCallEnabled && urgentCallTo && isSevereMail(item.payload ?? {})) {
      await postJson(
        `${hooksBase}/agent`,
        {
          name: "UrgentEmailCall",
          agentId: "comms",
          wakeMode: "now",
          deliver: false,
          message: `Place a voice call to ${urgentCallTo} with a short alert: urgent email requires immediate review.`,
        },
        hooksToken,
      );
      item.callEscalatedAt = new Date().toISOString();
    }
  }
}

async function dispatchOutbound(queue) {
  for (const item of queue) {
    if (item.status === "awaiting_approval" && !item.approvalRequestedAt) {
      if (!paWebhookUrl) continue;
      await postJson(
        paWebhookUrl,
        {
          action: "request_approval",
          outboundId: item.id,
          payload: item.payload,
          requiresApproval: true,
        },
        paWebhookToken,
      );
      item.approvalRequestedAt = new Date().toISOString();
      continue;
    }

    if (item.status !== "ready") continue;
    const type = String(item.payload?.type ?? "imessage");
    if (type === "imessage") {
      await sendBlueBubblesText(item.payload.to ?? imessageTarget, item.payload.body ?? "");
      item.status = "completed";
      item.completedAt = new Date().toISOString();
      continue;
    }

    if (type === "outlook_email" && paWebhookUrl) {
      if (!outlookBridgeEnabled) {
        item.status = "skipped";
        item.skipReason = "outlook_bridge_disabled";
        item.completedAt = new Date().toISOString();
        continue;
      }
      if (graphDirectSend) {
        await sendOutlookViaGraph(item.payload);
        item.status = "completed";
        item.completedAt = new Date().toISOString();
        continue;
      }
      await postJson(
        paWebhookUrl,
        {
          action: "send_outlook_email",
          outboundId: item.id,
          payload: item.payload,
        },
        paWebhookToken,
      );
      item.status = "sent_to_pa";
      item.completedAt = new Date().toISOString();
      continue;
    }

    if (type === "outlook_email" && !paWebhookUrl) {
      item.status = "skipped";
      item.skipReason = "missing_power_automate_webhook";
      item.completedAt = new Date().toISOString();
    }
  }
}

async function main() {
  const notifications = await readJson(files.notifications, []);
  await dispatchImportantNotifications(notifications);
  await writeJson(files.notifications, notifications);

  const outbound = await readJson(files.outbound, []);
  await dispatchOutbound(outbound);
  await writeJson(files.outbound, outbound);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

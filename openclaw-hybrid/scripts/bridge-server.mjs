import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const host = process.env.BRIDGE_HOST ?? "127.0.0.1";
const port = Number(process.env.BRIDGE_PORT ?? "8787");
const stateDir = process.env.BRIDGE_STATE_DIR ?? "/opt/openclaw-hybrid/state";
const policyPath =
  process.env.BRIDGE_POLICY_PATH ?? "/opt/openclaw-hybrid/config/policies.json";
const approvalToken = process.env.PA_APPROVAL_WEBHOOK_TOKEN ?? "";
const ingestToken = process.env.BRIDGE_INGEST_TOKEN ?? "";
const graphClientState = process.env.GRAPH_WEBHOOK_CLIENT_STATE ?? "";
const outlookBridgeEnabled = process.env.ENABLE_OUTLOOK_BRIDGE === "true";

const files = {
  notifications: path.join(stateDir, "notifications.json"),
  outbound: path.join(stateDir, "outbound.json"),
  webhookEvents: path.join(stateDir, "graph-events.jsonl"),
};

const defaultPolicies = {
  importantKeywords: [
    "urgent",
    "asap",
    "deadline",
    "action required",
    "respond today",
    "approval needed",
  ],
  vipSenders: [],
  highRiskDomains: [],
  highRiskKeywords: ["wire", "bank", "contract", "legal", "payment", "invoice"],
};

async function ensureState() {
  await mkdir(stateDir, { recursive: true });
  if (!existsSync(files.notifications)) {
    await writeFile(files.notifications, "[]\n", "utf8");
  }
  if (!existsSync(files.outbound)) {
    await writeFile(files.outbound, "[]\n", "utf8");
  }
}

async function readJson(filePath, fallback) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function json(res, code, data) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(data)}\n`);
}

function plain(res, code, text) {
  res.writeHead(code, { "content-type": "text/plain; charset=utf-8" });
  res.end(`${text}`);
}

function parseAuth(req) {
  const auth = req.headers.authorization ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return "";
}

function isImportantMail(mail, policies) {
  const subject = String(mail.subject ?? "").toLowerCase();
  const fromAddress = String(mail.from?.emailAddress?.address ?? "").toLowerCase();
  const keywords = (policies.importantKeywords ?? []).map((k) => String(k).toLowerCase());
  const vip = (policies.vipSenders ?? []).map((s) => String(s).toLowerCase());

  if (vip.includes(fromAddress)) return true;
  return keywords.some((word) => subject.includes(word));
}

function isHighRiskOutbound(payload, policies) {
  const to = String(payload.to ?? "").toLowerCase();
  const subject = String(payload.subject ?? "").toLowerCase();
  const body = String(payload.body ?? "").toLowerCase();
  const domains = (policies.highRiskDomains ?? []).map((d) => String(d).toLowerCase());
  const riskWords = (policies.highRiskKeywords ?? []).map((w) => String(w).toLowerCase());
  const domain = to.includes("@") ? to.split("@").pop() ?? "" : "";

  if (domains.includes(domain)) return true;
  return riskWords.some((w) => subject.includes(w) || body.includes(w));
}

function outboundFingerprint(payload) {
  const type = String(payload.type ?? "");
  const to = String(payload.to ?? "").trim().toLowerCase();
  const subject = String(payload.subject ?? "").trim().toLowerCase();
  const body = String(payload.body ?? "").trim().toLowerCase();
  const scheduledFor = String(payload.scheduledFor ?? "").trim();
  return `${type}|${to}|${subject}|${body}|${scheduledFor}`;
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function appendEventLine(event) {
  const line = `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`;
  const current = existsSync(files.webhookEvents)
    ? await readFile(files.webhookEvents, "utf8")
    : "";
  await writeFile(files.webhookEvents, `${current}${line}`, "utf8");
}

async function enqueueImportantNotifications(mails) {
  const queue = await readJson(files.notifications, []);
  for (const mail of mails) {
    const mailId = String(mail.id ?? "").trim();
    const isDup = queue.some(
      (item) => item.kind === "important_email" && String(item.payload?.id ?? "") === mailId,
    );
    if (mailId && isDup) continue;
    queue.push({
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      status: "pending",
      kind: "important_email",
      createdAt: new Date().toISOString(),
      payload: mail,
    });
  }
  await writeJson(files.notifications, queue);
}

async function enqueueOutbound(payload, requiresApproval) {
  const queue = await readJson(files.outbound, []);
  const fingerprint = outboundFingerprint(payload);
  const isDup = queue.some(
    (item) =>
      item.fingerprint === fingerprint &&
      ["awaiting_approval", "ready", "sent_to_pa"].includes(String(item.status ?? "")),
  );
  if (isDup) {
    return { skipped: true, reason: "duplicate", fingerprint };
  }
  const record = {
    id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    status: requiresApproval ? "awaiting_approval" : "ready",
    createdAt: new Date().toISOString(),
    requiresApproval,
    fingerprint,
    payload,
  };
  queue.push(record);
  await writeJson(files.outbound, queue);
  return record;
}

async function setApprovalStatus(outboundId, approved, reviewer) {
  const queue = await readJson(files.outbound, []);
  let updated = null;
  for (const item of queue) {
    if (item.id === outboundId) {
      item.status = approved ? "ready" : "rejected";
      item.reviewedAt = new Date().toISOString();
      item.reviewer = reviewer;
      updated = item;
      break;
    }
  }
  await writeJson(files.outbound, queue);
  return updated;
}

async function server() {
  await ensureState();
  const http = createServer(async (req, res) => {
    const reqUrl = new URL(req.url ?? "/", `http://${host}:${port}`);
    const policies = {
      ...defaultPolicies,
      ...(await readJson(policyPath, {})),
    };

    if (req.method === "GET" && reqUrl.pathname === "/health") {
      return json(res, 200, { ok: true, service: "openclaw-bridge" });
    }

    if (req.method === "POST" && reqUrl.pathname === "/graph/webhook") {
      const validation = reqUrl.searchParams.get("validationToken");
      if (validation) return plain(res, 200, validation);

      const bodyText = await collectBody(req);
      let body;
      try {
        body = JSON.parse(bodyText || "{}");
      } catch {
        return json(res, 400, { ok: false, error: "Invalid JSON" });
      }

      const notifications = Array.isArray(body.value) ? body.value : [];
      const matched = [];
      for (const n of notifications) {
        if (graphClientState && n.clientState && n.clientState !== graphClientState) {
          continue;
        }
        const resourceData = n.resourceData ?? {};
        const synthesized = {
          id: resourceData.id ?? n.id ?? "",
          subject: resourceData.subject ?? "New email",
          from: resourceData.from ?? {},
          receivedDateTime: resourceData.receivedDateTime ?? new Date().toISOString(),
        };
        if (isImportantMail(synthesized, policies)) {
          matched.push(synthesized);
        }
      }

      if (matched.length > 0) {
        await enqueueImportantNotifications(matched);
      }

      await appendEventLine({
        type: "graph_webhook",
        total: notifications.length,
        important: matched.length,
      });
      return json(res, 202, {
        ok: true,
        accepted: notifications.length,
        importantQueued: matched.length,
      });
    }

    if (req.method === "POST" && reqUrl.pathname === "/outbound/queue") {
      if (ingestToken && parseAuth(req) !== ingestToken) {
        return json(res, 401, { ok: false, error: "Unauthorized" });
      }
      const bodyText = await collectBody(req);
      let payload;
      try {
        payload = JSON.parse(bodyText || "{}");
      } catch {
        return json(res, 400, { ok: false, error: "Invalid JSON" });
      }
      if (String(payload.type ?? "") === "outlook_email" && !outlookBridgeEnabled) {
        return json(res, 400, {
          ok: false,
          error: "Outlook bridge disabled. Set ENABLE_OUTLOOK_BRIDGE=true to enable.",
        });
      }
      const requiresApproval = isHighRiskOutbound(payload, policies);
      const record = await enqueueOutbound(payload, requiresApproval);
      return json(res, 200, { ok: true, item: record });
    }

    if (req.method === "POST" && reqUrl.pathname === "/approval/callback") {
      if (approvalToken && parseAuth(req) !== approvalToken) {
        return json(res, 401, { ok: false, error: "Unauthorized" });
      }
      const bodyText = await collectBody(req);
      let payload;
      try {
        payload = JSON.parse(bodyText || "{}");
      } catch {
        return json(res, 400, { ok: false, error: "Invalid JSON" });
      }
      const updated = await setApprovalStatus(
        String(payload.outboundId ?? ""),
        Boolean(payload.approved),
        String(payload.reviewer ?? "unknown"),
      );
      if (!updated) {
        return json(res, 404, { ok: false, error: "Outbound item not found" });
      }
      return json(res, 200, { ok: true, item: updated });
    }

    return json(res, 404, { ok: false, error: "Not found" });
  });

  http.listen(port, host, () => {
    console.log(`OpenClaw bridge listening on http://${host}:${port}`);
  });
}

server().catch((err) => {
  console.error("Bridge failed to start", err);
  process.exit(1);
});

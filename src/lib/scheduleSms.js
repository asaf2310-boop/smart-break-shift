import { demoModeEnabled } from "@/api/demoClient";
import { cleanEnvValue } from "@/api/supabase";
import { getAgentBearerHeaders } from "@/lib/agentAuthClient";
import { listManagedAgents } from "@/lib/agentsApi";
import { normalizeAgentPhone } from "@/lib/agentPhone";
import { DEMO_AGENT_PHONES } from "@/constants/agentPhones";

const DEMO_SMS_LOG_KEY = "schedule-sms-demo-log-v1";
const DEFAULT_APP_URL = "https://hypsmart.vercel.app";
const SMS_RETRY_DELAY_MS = 1500;

export function getScheduleSmsShiftsUrl() {
  const base =
    cleanEnvValue(import.meta.env.VITE_APP_URL) ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    DEFAULT_APP_URL;
  return `${base.replace(/\/$/, "")}/shifts`;
}

export function buildSchedulePublishSmsMessage() {
  return `שלום, השיבוץ לשבוע הבא פורסם בקישור - ${getScheduleSmsShiftsUrl()}`;
}

export function recordsFromShiftRegistrations(regs) {
  return (regs || []).map((row) => ({
    agent_name: row.agent_name,
    shift_type: row.shift_type,
    date: row.date,
  }));
}

async function loadAgentPhoneMap() {
  const map = new Map();
  try {
    const agents = await listManagedAgents();
    for (const agent of agents) {
      const name = String(agent.name || "").trim();
      const phone = normalizeAgentPhone(agent.phone);
      if (name && phone) map.set(name, phone);
    }
  } catch (err) {
    console.warn("[scheduleSms] loadAgentPhoneMap failed", err);
  }

  if (demoModeEnabled) {
    for (const [name, phone] of Object.entries(DEMO_AGENT_PHONES)) {
      const normalized = normalizeAgentPhone(phone);
      if (normalized && !map.has(name)) map.set(name, normalized);
    }
  }

  return map;
}

/** מקבץ נמעני SMS לפי נציגים משובצים (אותה הודעה לכולם) */
export async function buildScheduleSmsPayloads(records) {
  const message = buildSchedulePublishSmsMessage();
  const phoneMap = await loadAgentPhoneMap();
  const agentNames = [...new Set((records || []).map((row) => row.agent_name).filter(Boolean))];

  return agentNames.map((agentName) => ({
    agentName,
    phone: phoneMap.get(String(agentName).trim()) || "",
    message,
  }));
}

function readDemoSmsLog() {
  try {
    const raw = localStorage.getItem(DEMO_SMS_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeDemoSmsLog(entries) {
  const merged = [...entries, ...readDemoSmsLog()].slice(0, 50);
  localStorage.setItem(DEMO_SMS_LOG_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent("schedule-sms-sent"));
}

export function getDemoScheduleSmsLog() {
  return readDemoSmsLog();
}

const DEFAULT_SMS_WEBHOOK_PATH = "/api/send-schedule-sms";

function resolveSmsWebhookUrl(webhook) {
  const cleaned = cleanEnvValue(webhook);
  if (!cleaned) return "";
  if (cleaned.startsWith("/") && typeof window !== "undefined") {
    return `${window.location.origin}${cleaned}`;
  }
  return cleaned;
}

function getScheduleSmsWebhookUrl() {
  const fromEnv = resolveSmsWebhookUrl(import.meta.env.VITE_SCHEDULE_SMS_WEBHOOK);
  if (fromEnv) return fromEnv;
  if (demoModeEnabled) return "";
  return resolveSmsWebhookUrl(DEFAULT_SMS_WEBHOOK_PATH);
}

function emptySmsResult() {
  return { sent: [], skipped: [], failed: [], simulated: demoModeEnabled, retried: false };
}

function mergeSmsResults(first, second) {
  return {
    sent: [...first.sent, ...second.sent],
    skipped: first.skipped,
    failed: second.failed,
    simulated: first.simulated,
    retried: true,
  };
}

/** תיאור קצר לטוסט — למה SMS לא יצא */
export function describeSmsResult(smsResult) {
  const { sent = [], skipped = [], failed = [], retried = false } = smsResult || {};
  if (sent.length > 0 && skipped.length === 0 && failed.length === 0) {
    return retried
      ? "הנציגים קיבלו עדכון על השיבוץ (אחרי ניסיון שליחה נוסף)"
      : "הנציגים קיבלו עדכון על השיבוץ";
  }

  const parts = [];
  if (retried) {
    parts.push("בוצע ניסיון שליחה נוסף לנציגים שנכשלו");
  }
  const noPhone = skipped.filter((r) => r.reason === "אין מספר טלפון");
  const noWebhook = skipped.filter((r) => r.reason === "לא הוגדר VITE_SCHEDULE_SMS_WEBHOOK");

  if (noPhone.length) {
    const names = noPhone.map((r) => r.agentName).filter(Boolean);
    const preview = names.slice(0, 3).join(", ");
    const more = names.length > 3 ? ` +${names.length - 3}` : "";
    parts.push(`ללא טלפון: ${preview}${more} — עדכן/י בניהול נציגים`);
  }
  if (noWebhook.length) {
    parts.push("Webhook SMS לא מוגדר (VITE_SCHEDULE_SMS_WEBHOOK)");
  }
  if (failed.length) {
    parts.push(`${failed.length} נכשלו: ${failed[0]?.error || "שגיאת שליחה"}`);
  }
  if (!parts.length && skipped.length) {
    parts.push(`${skipped.length} נציגים דולגו`);
  }
  return parts.join(" · ") || "בדוק/י טלפונים בניהול נציגים והגדרות Inforu ב-Vercel";
}

export function toastScheduleSmsResult(toast, smsResult, labels = {}) {
  if (!smsResult) return;

  const retrySuffix = smsResult.retried ? " (כולל ניסיון נוסף)" : "";
  const {
    simulatedTitle = (count) => `SMS דמו: ${count} הודעות`,
    successTitle = (count) => `נשלחו ${count} SMS${retrySuffix}`,
    emptyTitle = "SMS לא נשלח",
  } = labels;

  if (smsResult.simulated) {
    toast({
      title: simulatedTitle(smsResult.sent.length),
      description: describeSmsResult(smsResult),
    });
    return;
  }

  if (smsResult.sent.length > 0) {
    toast({
      title: successTitle(smsResult.sent.length),
      description: describeSmsResult(smsResult),
    });
    return;
  }

  toast({
    title: emptyTitle,
    description: describeSmsResult(smsResult),
    variant: "destructive",
  });
}

async function postScheduleSms(webhook, item) {
  const headers = await getAgentBearerHeaders({ "Content-Type": "application/json" });
  const response = await fetch(webhook, {
    method: "POST",
    headers,
    body: JSON.stringify({
      to: item.phone,
      message: item.message,
      agent_name: item.agentName,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || `SMS webhook failed (${response.status})`);
  }
}

async function dispatchScheduleSmsPayloads(payloads, webhook) {
  const sent = [];
  const skipped = [];
  const failed = [];

  for (const item of payloads) {
    if (!item.phone) {
      skipped.push({ ...item, reason: "אין מספר טלפון" });
      continue;
    }

    if (demoModeEnabled) {
      sent.push({ ...item, simulated: true });
      continue;
    }

    if (!webhook) {
      skipped.push({ ...item, reason: "לא הוגדר VITE_SCHEDULE_SMS_WEBHOOK" });
      continue;
    }

    try {
      await postScheduleSms(webhook, item);
      sent.push(item);
    } catch (error) {
      failed.push({ ...item, error: error.message });
    }
  }

  return { sent, skipped, failed, simulated: demoModeEnabled, retried: false };
}

function payloadsFromFailed(failedItems) {
  return failedItems.map(({ agentName, phone, message }) => ({ agentName, phone, message }));
}

async function writeDemoLogIfNeeded(sent) {
  if (!demoModeEnabled || !sent.length) return;
  writeDemoSmsLog(
    sent.map((row) => ({
      id: `${Date.now()}_${row.agentName}`,
      at: new Date().toISOString(),
      agent_name: row.agentName,
      phone: row.phone,
      message: row.message,
    }))
  );
}

/**
 * שולח SMS בפרסום שיבוץ.
 * דמו: שומר ב-localStorage ומדמה שליחה.
 * אמת: POST ל-VITE_SCHEDULE_SMS_WEBHOOK — מומלץ /api/send-schedule-sms (Inforu ב-Vercel).
 */
export async function sendScheduleSmsNotifications({
  records,
  enabled = true,
  retryFailed = true,
} = {}) {
  if (!enabled) {
    return emptySmsResult();
  }

  const payloads = await buildScheduleSmsPayloads(records);
  const webhook = getScheduleSmsWebhookUrl();
  let result = await dispatchScheduleSmsPayloads(payloads, webhook);

  if (retryFailed && !demoModeEnabled && result.failed.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, SMS_RETRY_DELAY_MS));
    const retryResult = await dispatchScheduleSmsPayloads(
      payloadsFromFailed(result.failed),
      webhook
    );
    result = mergeSmsResults(result, retryResult);
  }

  await writeDemoLogIfNeeded(result.sent);
  return result;
}

/** שליחה חוזרת בלבד — לא נוגע בשיבוץ שפורסם */
export async function resendScheduleSmsNotifications(records) {
  return sendScheduleSmsNotifications({ records, enabled: true, retryFailed: true });
}

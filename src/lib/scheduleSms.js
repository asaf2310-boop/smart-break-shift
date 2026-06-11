import { demoModeEnabled } from "@/api/demoClient";
import { cleanEnvValue } from "@/api/supabase";
import { getAgentPhone } from "@/constants/agentPhones";

const DEMO_SMS_LOG_KEY = "schedule-sms-demo-log-v1";
const DEFAULT_APP_URL = "https://hypsmart.vercel.app";

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

/** מקבץ נמעני SMS לפי נציגים משובצים (אותה הודעה לכולם) */
export function buildScheduleSmsPayloads(records) {
  const message = buildSchedulePublishSmsMessage();
  const agentNames = [...new Set((records || []).map((row) => row.agent_name).filter(Boolean))];

  return agentNames.map((agentName) => ({
    agentName,
    phone: getAgentPhone(agentName),
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

function resolveSmsWebhookUrl(webhook) {
  const cleaned = cleanEnvValue(webhook);
  if (!cleaned) return "";
  if (cleaned.startsWith("/") && typeof window !== "undefined") {
    return `${window.location.origin}${cleaned}`;
  }
  return cleaned;
}

/**
 * שולח SMS בפרסום שיבוץ.
 * דמו: שומר ב-localStorage ומדמה שליחה.
 * אמת: POST ל-VITE_SCHEDULE_SMS_WEBHOOK — מומלץ /api/send-schedule-sms (Inforu ב-Vercel).
 */
export async function sendScheduleSmsNotifications({ records, weekDays, enabled = true }) {
  if (!enabled) {
    return { sent: [], skipped: [], failed: [], simulated: demoModeEnabled };
  }

  const payloads = buildScheduleSmsPayloads(records);
  const sent = [];
  const skipped = [];
  const failed = [];
  const webhook = resolveSmsWebhookUrl(import.meta.env.VITE_SCHEDULE_SMS_WEBHOOK);

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
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      sent.push(item);
    } catch (error) {
      failed.push({ ...item, error: error.message });
    }
  }

  if (demoModeEnabled && sent.length) {
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

  return { sent, skipped, failed, simulated: demoModeEnabled };
}

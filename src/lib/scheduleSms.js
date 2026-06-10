import { format, parseISO } from "date-fns";
import { demoModeEnabled } from "@/api/demoClient";
import { cleanEnvValue } from "@/api/supabase";
import { getAgentPhone } from "@/constants/agentPhones";
import { WEEKDAY_LABELS } from "@/constants/scheduling";

const DEMO_SMS_LOG_KEY = "schedule-sms-demo-log-v1";

const SHIFT_LABELS = {
  morning: "בוקר (08:00-16:00)",
  evening: "ערב (09:00-17:00)",
};

function weekdayLabel(dateStr) {
  const day = parseISO(dateStr).getDay();
  return WEEKDAY_LABELS[day] || "";
}

function formatShortDate(dateStr) {
  return format(parseISO(dateStr), "dd/MM");
}

/** מקבץ רשומות שיבוץ להודעת SMS לכל נציג */
export function buildScheduleSmsPayloads(records, weekDays) {
  const weekLabel =
    weekDays?.length >= 2
      ? `${format(weekDays[0], "dd/MM")}-${format(weekDays[weekDays.length - 1], "dd/MM/yyyy")}`
      : "";

  const byAgent = new Map();
  for (const row of records) {
    if (!byAgent.has(row.agent_name)) byAgent.set(row.agent_name, []);
    byAgent.get(row.agent_name).push(row);
  }

  const appUrl =
    cleanEnvValue(import.meta.env.VITE_APP_URL) ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const payloads = [];
  for (const [agentName, rows] of byAgent.entries()) {
    const lines = rows
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.shift_type.localeCompare(b.shift_type))
      .map((row) => {
        const shift = SHIFT_LABELS[row.shift_type] || row.shift_type;
        return `${weekdayLabel(row.date)} ${formatShortDate(row.date)}: ${shift}`;
      });

    const message = [
      `שלום ${agentName},`,
      `פורסם השיבוץ לשבוע ${weekLabel}:`,
      ...lines,
      appUrl ? `לצפייה: ${appUrl}/shifts` : "",
    ]
      .filter(Boolean)
      .join("\n");

    payloads.push({
      agentName,
      phone: getAgentPhone(agentName),
      message,
    });
  }

  return payloads;
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

/**
 * שולח SMS בפרסום שיבוץ.
 * דמו: שומר ב-localStorage ומדמה שליחה.
 * אמת: POST ל-VITE_SCHEDULE_SMS_WEBHOOK (Make / Twilio / שרת פנימי).
 */
export async function sendScheduleSmsNotifications({ records, weekDays, enabled = true }) {
  if (!enabled) {
    return { sent: [], skipped: [], failed: [], simulated: demoModeEnabled };
  }

  const payloads = buildScheduleSmsPayloads(records, weekDays);
  const sent = [];
  const skipped = [];
  const failed = [];
  const webhook = cleanEnvValue(import.meta.env.VITE_SCHEDULE_SMS_WEBHOOK);

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
      if (!response.ok) throw new Error(`SMS webhook failed (${response.status})`);
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
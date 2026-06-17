import { demoModeEnabled } from "@/api/demoClient";
import { cleanEnvValue } from "@/api/supabase";
import { getAgentBearerHeaders } from "@/lib/agentAuthClient";
import { normalizeAgentPhone } from "@/lib/agentPhone";

const DEFAULT_SMS_WEBHOOK_PATH = "/api/send-schedule-sms";

function resolveSmsWebhookUrl(webhook) {
  const cleaned = cleanEnvValue(webhook);
  if (!cleaned) return "";
  if (cleaned.startsWith("/") && typeof window !== "undefined") {
    return `${window.location.origin}${cleaned}`;
  }
  return cleaned;
}

export function getAgentSmsWebhookUrl() {
  const fromEnv = resolveSmsWebhookUrl(import.meta.env.VITE_SCHEDULE_SMS_WEBHOOK);
  if (fromEnv) return fromEnv;
  if (demoModeEnabled) return "";
  return resolveSmsWebhookUrl(DEFAULT_SMS_WEBHOOK_PATH);
}

/** שליחת SMS לנציג (איפוס סיסמה, שיבוץ וכו') */
export async function sendAgentSms({ phone, message, agentName }) {
  const normalized = normalizeAgentPhone(phone);
  if (!normalized) {
    return { ok: false, error: "invalid_phone", message: "מספר טלפון לא תקין" };
  }

  if (demoModeEnabled) {
    return { ok: true, simulated: true, phone: normalized, message };
  }

  const webhook = getAgentSmsWebhookUrl();
  if (!webhook) {
    return {
      ok: false,
      error: "webhook_not_configured",
      message: "שירות SMS לא מוגדר",
    };
  }

  try {
    const headers = await getAgentBearerHeaders({ "Content-Type": "application/json" });
    const response = await fetch(webhook, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: normalized,
        message,
        agent_name: agentName || "",
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || data.error || `SMS failed (${response.status})`);
    }
    return { ok: true, phone: normalized, message: data.message || "נשלח" };
  } catch (err) {
    return { ok: false, error: "send_failed", message: err.message || "שליחת SMS נכשלה" };
  }
}

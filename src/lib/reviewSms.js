import { demoModeEnabled } from "@/api/demoClient";
import { cleanEnvValue } from "@/api/supabase";
import { apiSendReviewSms } from "@/lib/agentAuthClient";
import { normalizeAgentPhone } from "@/lib/agentPhone";

export const DEFAULT_REVIEW_SMS_TEMPLATE =
  "תודה שפנית אלינו! נשמח אם תדרגו אותנו בגוגל: {url}";

export function getGoogleReviewUrlPreview() {
  return cleanEnvValue(import.meta.env.VITE_GOOGLE_REVIEW_URL) || "";
}

export function buildReviewSmsPreview(customMessage) {
  const url = getGoogleReviewUrlPreview() || "https://g.page/r/…";
  const custom = String(customMessage || "").trim();
  if (!custom) {
    return DEFAULT_REVIEW_SMS_TEMPLATE.replace(/\{url\}/g, url);
  }
  if (custom.includes("{url}")) {
    return custom.replace(/\{url\}/g, url);
  }
  return `${custom} ${url}`;
}

/** שליחת SMS ללקוח עם קישור לדירוג בגוגל */
export async function sendReviewSms({ phone, message }) {
  const normalized = normalizeAgentPhone(phone);
  if (!normalized) {
    return { ok: false, error: "invalid_phone", message: "מספר טלפון לא תקין" };
  }

  const preview = buildReviewSmsPreview(message);

  if (demoModeEnabled) {
    return { ok: true, simulated: true, phone: normalized, preview };
  }

  const result = await apiSendReviewSms({
    phone: normalized,
    message: String(message || "").trim(),
  });

  if (!result.ok) {
    return result;
  }

  return { ok: true, phone: normalized, preview, message: result.message || "נשלח בהצלחה" };
}

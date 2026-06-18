import { demoModeEnabled } from "@/api/demoClient";
import { cleanEnvValue } from "@/api/supabase";
import { apiSendReviewSms } from "@/lib/agentAuthClient";
import { normalizeAgentPhone } from "@/lib/agentPhone";

export const GOOGLE_REVIEW_REDIRECT_PATH = "/go/review";

/** Max SMS body length — must match server/review/reviewLink.js */
export const REVIEW_SMS_MAX_LENGTH = 500;

export const DEFAULT_REVIEW_SMS_TEMPLATE = "תודה שפנית אלינו! דרגו אותנו: {url}";

function getPublicAppOrigin() {
  const fromEnv = cleanEnvValue(import.meta.env.VITE_APP_URL)?.replace(/\/$/, "") || "";
  if (typeof window === "undefined") return fromEnv;
  const origin = window.location.origin;
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
  if (isLocal && fromEnv) return fromEnv;
  return fromEnv || origin;
}

/** Short public URL sent in SMS (redirects to full GOOGLE_REVIEW_URL on server). */
export function buildGoogleReviewShortUrl() {
  const base = getPublicAppOrigin().replace(/\/$/, "");
  if (!base) return GOOGLE_REVIEW_REDIRECT_PATH;
  return `${base}${GOOGLE_REVIEW_REDIRECT_PATH}`;
}

export function buildReviewSmsPreview(customMessage) {
  const url = buildGoogleReviewShortUrl();
  const custom = String(customMessage || "").trim();
  if (!custom) {
    return DEFAULT_REVIEW_SMS_TEMPLATE.replace(/\{url\}/g, url);
  }
  if (custom.includes("{url}")) {
    return custom.replace(/\{url\}/g, url);
  }
  return `${custom} ${url}`;
}

export function validateReviewSmsLength(message) {
  const text = String(message || "");
  if (text.length <= REVIEW_SMS_MAX_LENGTH) {
    return { ok: true, length: text.length };
  }
  return {
    ok: false,
    error: "message_too_long",
    length: text.length,
    message: `ההודעה ארוכה מדי (${text.length} תווים). מקסימום ${REVIEW_SMS_MAX_LENGTH} תווים — קיצרו את הטקסט.`,
  };
}

/** שליחת SMS ללקוח עם קישור לדירוג בגוגל */
export async function sendReviewSms({ phone, message }) {
  const normalized = normalizeAgentPhone(phone);
  if (!normalized) {
    return { ok: false, error: "invalid_phone", message: "מספר טלפון לא תקין" };
  }

  const preview = buildReviewSmsPreview(message);
  const lengthCheck = validateReviewSmsLength(preview);
  if (!lengthCheck.ok) {
    return lengthCheck;
  }

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

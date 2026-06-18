import { demoModeEnabled } from "@/api/demoClient";
import { cleanEnvValue } from "@/api/supabase";
import { apiGetReviewSmsConfig, apiSendReviewSms } from "@/lib/agentAuthClient";
import { normalizeAgentPhone } from "@/lib/agentPhone";

/** Max SMS body length — must match server/review/reviewLink.js */
export const REVIEW_SMS_MAX_LENGTH = 500;

export const DEFAULT_REVIEW_SMS_TEMPLATE = "תודה שפנית אלינו! דרגו אותנו: {url}";

function getClientPreviewSmsUrl() {
  return cleanEnvValue(import.meta.env.VITE_GOOGLE_REVIEW_SMS_URL) || null;
}

export function buildReviewSmsPreview(customMessage, smsUrl) {
  const url = String(smsUrl || getClientPreviewSmsUrl() || "[קישור דירוג לא מוגדר]").trim();
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

/** Fetch configured SMS review URL from server (or client env in demo). */
export async function fetchReviewSmsConfig() {
  if (demoModeEnabled) {
    const smsUrl = getClientPreviewSmsUrl();
    return {
      ok: Boolean(smsUrl),
      smsUrl,
      error: smsUrl ? null : "review_sms_url_not_configured",
      message: smsUrl
        ? null
        : "הגדירו VITE_GOOGLE_REVIEW_SMS_URL לתצוגה מקדימה בדמו, או GOOGLE_REVIEW_SMS_URL בשרת.",
      template: DEFAULT_REVIEW_SMS_TEMPLATE,
      maxLength: REVIEW_SMS_MAX_LENGTH,
    };
  }

  const result = await apiGetReviewSmsConfig();
  if (!result.ok) {
    return {
      ok: false,
      smsUrl: null,
      error: result.error || "request_failed",
      message: result.message || "לא הצלחנו לטעון את הגדרות הקישור",
      template: DEFAULT_REVIEW_SMS_TEMPLATE,
      maxLength: REVIEW_SMS_MAX_LENGTH,
    };
  }

  return {
    ok: Boolean(result.smsUrl),
    smsUrl: result.smsUrl || null,
    error: result.error || null,
    message: result.message || null,
    template: result.template || DEFAULT_REVIEW_SMS_TEMPLATE,
    maxLength: result.maxLength || REVIEW_SMS_MAX_LENGTH,
  };
}

/** שליחת SMS ללקוח עם קישור לדירוג בגוגל */
export async function sendReviewSms({ phone, message }) {
  const normalized = normalizeAgentPhone(phone);
  if (!normalized) {
    return { ok: false, error: "invalid_phone", message: "מספר טלפון לא תקין" };
  }

  if (demoModeEnabled) {
    const config = await fetchReviewSmsConfig();
    if (!config.ok || !config.smsUrl) {
      return {
        ok: false,
        error: config.error || "review_sms_url_not_configured",
        message: config.message || "קישור דירוג לא מוגדר",
      };
    }
    const preview = buildReviewSmsPreview(message, config.smsUrl);
    const lengthCheck = validateReviewSmsLength(preview);
    if (!lengthCheck.ok) {
      return lengthCheck;
    }
    return { ok: true, simulated: true, phone: normalized, preview };
  }

  const result = await apiSendReviewSms({
    phone: normalized,
    message: String(message || "").trim(),
  });

  if (!result.ok) {
    return result;
  }

  return { ok: true, phone: normalized, message: result.message || "נשלח בהצלחה" };
}

import { normalizeIsraeliPhone, sendInforuSms } from "../../api/send-schedule-sms.js";
import { logSecurityEvent } from "../security/auditLog.js";

export const DEFAULT_REVIEW_SMS_TEMPLATE =
  "תודה שפנית אלינו! נשמח אם תדרגו אותנו בגוגל: {url}";

export function getGoogleReviewUrl() {
  return String(process.env.GOOGLE_REVIEW_URL || process.env.VITE_GOOGLE_REVIEW_URL || "").trim();
}

export function isInforuSmsConfigured() {
  const userName = String(process.env.INFORU_USERNAME || "").trim();
  const apiToken = String(process.env.INFORU_API_TOKEN || "").trim();
  const sender = String(process.env.INFORU_SENDER || "").trim();
  return Boolean(userName && apiToken && sender);
}

export function buildReviewSmsMessage({ reviewUrl, customMessage } = {}) {
  const url = String(reviewUrl || "").trim();
  if (!url) {
    return { ok: false, error: "review_url_not_configured", message: "קישור דירוג גוגל לא מוגדר" };
  }

  const custom = String(customMessage || "").trim();
  if (!custom) {
    return { ok: true, message: DEFAULT_REVIEW_SMS_TEMPLATE.replace(/\{url\}/g, url) };
  }
  if (custom.includes("{url}")) {
    return { ok: true, message: custom.replace(/\{url\}/g, url) };
  }
  return { ok: true, message: `${custom} ${url}` };
}

function maskPhoneForAudit(phone) {
  const digits = String(phone || "");
  if (digits.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

/**
 * Send Google review request SMS to a customer (Inforu).
 */
export async function sendReviewSmsToCustomer({
  phone,
  customMessage,
  actorAgentId,
  actorName,
  req,
} = {}) {
  const reviewUrl = getGoogleReviewUrl();
  if (!reviewUrl) {
    return {
      ok: false,
      error: "review_url_not_configured",
      message:
        "קישור דירוג גוגל לא מוגדר. הגדירו GOOGLE_REVIEW_URL ב-Vercel (משתנה שרת) ופרסמו מחדש.",
    };
  }

  const normalized = normalizeIsraeliPhone(phone);
  if (!normalized) {
    return { ok: false, error: "invalid_phone", message: "מספר טלפון לא תקין" };
  }

  const built = buildReviewSmsMessage({ reviewUrl, customMessage });
  if (!built.ok) return built;

  if (!isInforuSmsConfigured()) {
    return {
      ok: false,
      error: "sms_not_configured",
      message:
        "שירות SMS לא מוגדר. הגדירו INFORU_USERNAME, INFORU_API_TOKEN ו-INFORU_SENDER ב-Vercel.",
    };
  }

  const userName = String(process.env.INFORU_USERNAME || "").trim();
  const apiToken = String(process.env.INFORU_API_TOKEN || "").trim();
  const sender = String(process.env.INFORU_SENDER || "").trim();

  const result = await sendInforuSms({
    userName,
    apiToken,
    sender,
    to: normalized,
    message: built.message,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: "inforu_failed",
      message: result.message || "שליחת SMS נכשלה",
      inforuStatus: result.status ?? null,
    };
  }

  void logSecurityEvent({
    action: "send_review_sms",
    actorAgentId: actorAgentId || null,
    resourceType: "customer_phone",
    resourceId: maskPhoneForAudit(normalized),
    metadata: {
      actorName: actorName || null,
      phoneLast4: normalized.slice(-4),
    },
    req,
  });

  return {
    ok: true,
    to: normalized,
    message: result.message || "נשלח בהצלחה",
  };
}

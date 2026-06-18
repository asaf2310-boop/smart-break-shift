import { normalizeIsraeliPhone, sendInforuSms } from "../../api/send-schedule-sms.js";
import { logSecurityEvent } from "../security/auditLog.js";
import {
  DEFAULT_REVIEW_SMS_TEMPLATE,
  buildReviewSmsMessage,
  validateReviewSmsMessageLength,
} from "../review/reviewLink.js";
import { resolveReviewSmsUrl } from "../review/reviewSmsSettingsService.js";

export {
  DEFAULT_REVIEW_SMS_TEMPLATE,
  buildReviewSmsMessage,
} from "../review/reviewLink.js";
export { resolveReviewSmsUrl } from "../review/reviewSmsSettingsService.js";

export function isInforuSmsConfigured() {
  const userName = String(process.env.INFORU_USERNAME || "").trim();
  const apiToken = String(process.env.INFORU_API_TOKEN || "").trim();
  const sender = String(process.env.INFORU_SENDER || "").trim();
  return Boolean(userName && apiToken && sender);
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
  const resolved = await resolveReviewSmsUrl();
  if (!resolved.ok) {
    return resolved;
  }

  const normalized = normalizeIsraeliPhone(phone);
  if (!normalized) {
    return { ok: false, error: "invalid_phone", message: "מספר טלפון לא תקין" };
  }

  const built = buildReviewSmsMessage({ reviewUrl: resolved.url, customMessage });
  if (!built.ok) return built;

  const lengthCheck = validateReviewSmsMessageLength(built.message);
  if (!lengthCheck.ok) return lengthCheck;

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

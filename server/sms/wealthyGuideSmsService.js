import { normalizeIsraeliPhone, sendInforuSms } from "../../api/send-schedule-sms.js";
import { logSecurityEvent } from "../security/auditLog.js";
import { isInforuSmsConfigured } from "./reviewSmsService.js";
import {
  buildWealthyGuideSmsMessage,
  validateWealthyGuideSmsMessageLength,
} from "./wealthyGuideSmsLink.js";

export {
  buildWealthyGuideSmsMessage,
  getManualChargeGuideUrl,
  getManualChargePresentationUrl,
} from "./wealthyGuideSmsLink.js";

function maskPhoneForAudit(phone) {
  const digits = String(phone || "");
  if (digits.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

/**
 * Send wealthy-guide links SMS to a customer (Inforu).
 */
export async function sendWealthyGuideLinksSms({
  phone,
  variant = "both",
  actorAgentId,
  actorName,
  req,
} = {}) {
  const normalized = normalizeIsraeliPhone(phone);
  if (!normalized) {
    return { ok: false, error: "invalid_phone", message: "מספר טלפון לא תקין" };
  }

  const built = buildWealthyGuideSmsMessage({ variant });
  if (!built.ok) return built;

  const lengthCheck = validateWealthyGuideSmsMessageLength(built.message);
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
    action: "send_wealthy_guide_sms",
    actorAgentId: actorAgentId || null,
    resourceType: "customer_phone",
    resourceId: maskPhoneForAudit(normalized),
    metadata: {
      actorName: actorName || null,
      phoneLast4: normalized.slice(-4),
      variant: built.variant,
    },
    req,
  });

  return {
    ok: true,
    to: normalized,
    message: result.message || "נשלח בהצלחה",
    preview: built.message,
    variant: built.variant,
  };
}

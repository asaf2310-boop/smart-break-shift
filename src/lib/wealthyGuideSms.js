import { demoModeEnabled } from "@/api/demoClient";
import { apiSendWealthyGuideSms } from "@/lib/agentAuthClient";
import { normalizeAgentPhone } from "@/lib/agentPhone";
import {
  getManualChargeGuideUrl,
  getManualChargePresentationUrl,
} from "@/lib/wealthyGuideConfig";
import { REVIEW_SMS_MAX_LENGTH } from "@/lib/reviewSms";

export const WEALTHY_GUIDE_SMS_VARIANTS = [
  { id: "both", label: "מדריך + מצגת" },
  { id: "guide", label: "מדריך בלבד" },
  { id: "presentation", label: "מצגת בלבד" },
];

const SMS_TEMPLATES = {
  guide: "מדריך חיוב ידני: {guideUrl}",
  presentation: "מצגת הדרכה — חיוב ידני: {presentationUrl}",
  both: "מדריך חיוב ידני: {guideUrl}\nמצגת: {presentationUrl}",
};

export function buildWealthyGuideSmsPreview(variant = "both") {
  const kind = SMS_TEMPLATES[variant] ? variant : "both";
  const guideUrl = getManualChargeGuideUrl();
  const presentationUrl = getManualChargePresentationUrl();
  return SMS_TEMPLATES[kind]
    .replace(/\{guideUrl\}/g, guideUrl)
    .replace(/\{presentationUrl\}/g, presentationUrl);
}

export function validateWealthyGuideSmsLength(message) {
  const text = String(message || "");
  if (text.length <= REVIEW_SMS_MAX_LENGTH) {
    return { ok: true, length: text.length };
  }
  return {
    ok: false,
    error: "message_too_long",
    length: text.length,
    message: `ההודעה ארוכה מדי (${text.length} תווים). מקסימום ${REVIEW_SMS_MAX_LENGTH} תווים.`,
  };
}

/** שליחת SMS ללקוח עם קישורי מדריך תשלומים */
export async function sendWealthyGuideLinksSms({ phone, variant = "both" }) {
  const normalized = normalizeAgentPhone(phone);
  if (!normalized) {
    return { ok: false, error: "invalid_phone", message: "מספר טלפון לא תקין" };
  }

  const preview = buildWealthyGuideSmsPreview(variant);
  const lengthCheck = validateWealthyGuideSmsLength(preview);
  if (!lengthCheck.ok) {
    return lengthCheck;
  }

  if (demoModeEnabled) {
    return { ok: true, simulated: true, phone: normalized, preview, variant };
  }

  const result = await apiSendWealthyGuideSms({ phone: normalized, variant });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    phone: normalized,
    preview: result.preview || preview,
    variant: result.variant || variant,
    message: result.message || "נשלח בהצלחה",
  };
}

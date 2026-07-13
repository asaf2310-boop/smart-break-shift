import { demoModeEnabled } from "@/api/demoClient";
import { apiSendWealthyGuideSms } from "@/lib/agentAuthClient";
import { normalizeAgentPhone } from "@/lib/agentPhone";
import {
  getManualChargeGuideUrl,
  getManualChargePresentationUrl,
  getPaymentLinkGuideUrl,
  getPaymentLinkPresentationUrl,
  getTransactionDetailsGuideUrl,
  getTransactionDetailsPresentationUrl,
  getThreeDsSettingsGuideUrl,
  getWordPressPluginGuideUrl,
} from "@/lib/wealthyGuideConfig";
import { REVIEW_SMS_MAX_LENGTH } from "@/lib/reviewSms";

export const WEALTHY_GUIDE_SMS_VARIANTS = [
  { id: "both", label: "מדריך + מצגת" },
  { id: "guide", label: "מדריך בלבד" },
  { id: "presentation", label: "מצגת בלבד" },
];

export const WEALTHY_GUIDE_TYPES = ["manual-charge", "payment-link", "transaction-details", "3ds-settings", "wordpress-plugin"];

const SMS_CONFIG = {
  "manual-charge": {
    templates: {
      guide: "מדריך חיוב ידני: {guideUrl}",
      presentation: "מצגת הדרכה — חיוב ידני: {presentationUrl}",
      both: "מדריך חיוב ידני: {guideUrl}\nמצגת: {presentationUrl}",
    },
    getGuideUrl: getManualChargeGuideUrl,
    getPresentationUrl: getManualChargePresentationUrl,
  },
  "payment-link": {
    templates: {
      guide: "מדריך לינק לתשלום: {guideUrl}",
      presentation: "מצגת הדרכה — לינק לתשלום: {presentationUrl}",
      both: "מדריך לינק לתשלום: {guideUrl}\nמצגת: {presentationUrl}",
    },
    getGuideUrl: getPaymentLinkGuideUrl,
    getPresentationUrl: getPaymentLinkPresentationUrl,
  },
  "transaction-details": {
    templates: {
      guide: "מדריך פירוט עסקאות: {guideUrl}",
      presentation: "מצגת הדרכה — פירוט עסקאות: {presentationUrl}",
      both: "מדריך פירוט עסקאות: {guideUrl}\nמצגת: {presentationUrl}",
    },
    getGuideUrl: getTransactionDetailsGuideUrl,
    getPresentationUrl: getTransactionDetailsPresentationUrl,
  },
  "3ds-settings": {
    templates: {
      guide: "מדריך הגדרת 3D Secure: {guideUrl}",
      presentation: "מדריך הגדרת 3D Secure: {guideUrl}",
      both: "מדריך הגדרת 3D Secure: {guideUrl}",
    },
    getGuideUrl: getThreeDsSettingsGuideUrl,
    getPresentationUrl: getThreeDsSettingsGuideUrl,
  },
  "wordpress-plugin": {
    templates: {
      guide: "מדריך תוסף וורדפרס (WooCommerce): {guideUrl}",
      presentation: "מדריך תוסף וורדפרס (WooCommerce): {guideUrl}",
      both: "מדריך תוסף וורדפרס (WooCommerce): {guideUrl}",
    },
    getGuideUrl: getWordPressPluginGuideUrl,
    getPresentationUrl: getWordPressPluginGuideUrl,
  },
};

function resolveGuideType(guideType) {
  return WEALTHY_GUIDE_TYPES.includes(guideType) ? guideType : "manual-charge";
}

export function getWealthyGuideSmsUrls(guideType = "manual-charge") {
  const config = SMS_CONFIG[resolveGuideType(guideType)];
  return {
    guideUrl: config.getGuideUrl(),
    presentationUrl: config.getPresentationUrl(),
  };
}

export function buildWealthyGuideSmsPreview(variant = "both", guideType = "manual-charge") {
  const kind = SMS_CONFIG[resolveGuideType(guideType)].templates[variant] ? variant : "both";
  const config = SMS_CONFIG[resolveGuideType(guideType)];
  const guideUrl = config.getGuideUrl();
  const presentationUrl = config.getPresentationUrl();
  return config.templates[kind]
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
export async function sendWealthyGuideLinksSms({ phone, variant = "both", guideType = "manual-charge" }) {
  const normalized = normalizeAgentPhone(phone);
  if (!normalized) {
    return { ok: false, error: "invalid_phone", message: "מספר טלפון לא תקין" };
  }

  const resolvedGuideType = resolveGuideType(guideType);
  const preview = buildWealthyGuideSmsPreview(variant, resolvedGuideType);
  const lengthCheck = validateWealthyGuideSmsLength(preview);
  if (!lengthCheck.ok) {
    return lengthCheck;
  }

  if (demoModeEnabled) {
    return { ok: true, simulated: true, phone: normalized, preview, variant, guideType: resolvedGuideType };
  }

  const result = await apiSendWealthyGuideSms({ phone: normalized, variant, guideType: resolvedGuideType });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    phone: normalized,
    preview: result.preview || preview,
    variant: result.variant || variant,
    guideType: result.guideType || resolvedGuideType,
    message: result.message || "נשלח בהצלחה",
  };
}

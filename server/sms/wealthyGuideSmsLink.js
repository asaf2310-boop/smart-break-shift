/** Wealthy Guide — public URLs and SMS message helpers (server) */

import { REVIEW_SMS_MAX_LENGTH, validateReviewSmsMessageLength } from "../review/reviewLink.js";

export { REVIEW_SMS_MAX_LENGTH as WEALTHY_GUIDE_SMS_MAX_LENGTH };

export const WEALTHY_GUIDE_BASE = "/knowledge/wealthy-guide";
export const MANUAL_CHARGE_SLUG = "manual-charge";
export const PAYMENT_LINK_SLUG = "payment-link";
export const PUBLIC_MANUAL_CHARGE_VIDEO_PATH = "/guide/manual-charge/video";
export const PUBLIC_MANUAL_CHARGE_PDF_PATH = "/guide/manual-charge/pdf";
export const PUBLIC_PAYMENT_LINK_VIDEO_PATH = "/guide/payment-link/video";
export const PUBLIC_PAYMENT_LINK_PDF_PATH = "/guide/payment-link/pdf";
export const PUBLIC_TRANSACTION_DETAILS_VIDEO_PATH = "/guide/transaction-details/video";
export const PUBLIC_TRANSACTION_DETAILS_PDF_PATH = "/guide/transaction-details/pdf";
export const PUBLIC_THREE_DS_SETTINGS_PDF_PATH = "/guide/3ds-settings/pdf";
export const PUBLIC_WORDPRESS_PLUGIN_PDF_PATH = "/guide/wordpress-plugin/pdf";
export const PUBLIC_SHVA_ERRORS_PDF_PATH = "/guide/shva-errors/pdf";
export const PUBLIC_THREE_DS_ERRORS_PDF_PATH = "/guide/3ds-errors/pdf";

export const WEALTHY_GUIDE_SMS_VARIANTS = ["guide", "presentation", "both"];
export const WEALTHY_GUIDE_TYPES = [
  "manual-charge",
  "payment-link",
  "transaction-details",
  "3ds-settings",
  "wordpress-plugin",
  "shva-errors",
  "3ds-errors",
];

export function getWealthyGuidePublicOrigin() {
  return String(process.env.VITE_APP_URL || process.env.VERCEL_URL || "")
    .trim()
    .replace(/\/$/, "")
    .replace(/^(?!https?:\/\/)/, (host) => `https://${host}`);
}

export function getManualChargeGuideUrl(origin) {
  const base = String(origin || getWealthyGuidePublicOrigin() || "").replace(/\/$/, "");
  if (!base) return PUBLIC_MANUAL_CHARGE_PDF_PATH;
  return `${base}${PUBLIC_MANUAL_CHARGE_PDF_PATH}`;
}

export function getManualChargePresentationUrl(origin) {
  const custom = String(
    process.env.WEALTHY_GUIDE_MANUAL_CHARGE_PRESENTATION_URL ||
      process.env.VITE_WEALTHY_GUIDE_MANUAL_CHARGE_PRESENTATION_PATH ||
      ""
  ).trim();
  if (custom) {
    if (/^https?:\/\//i.test(custom)) return custom;
    const base = String(origin || getWealthyGuidePublicOrigin() || "").replace(/\/$/, "");
    const path = custom.startsWith("/") ? custom : `/${custom}`;
    return base ? `${base}${path}` : path;
  }
  const base = String(origin || getWealthyGuidePublicOrigin() || "").replace(/\/$/, "");
  if (!base) return PUBLIC_MANUAL_CHARGE_VIDEO_PATH;
  return `${base}${PUBLIC_MANUAL_CHARGE_VIDEO_PATH}`;
}

export function getPaymentLinkGuideUrl(origin) {
  const base = String(origin || getWealthyGuidePublicOrigin() || "").replace(/\/$/, "");
  if (!base) return PUBLIC_PAYMENT_LINK_PDF_PATH;
  return `${base}${PUBLIC_PAYMENT_LINK_PDF_PATH}`;
}

export function getPaymentLinkPresentationUrl(origin) {
  const base = String(origin || getWealthyGuidePublicOrigin() || "").replace(/\/$/, "");
  if (!base) return PUBLIC_PAYMENT_LINK_VIDEO_PATH;
  return `${base}${PUBLIC_PAYMENT_LINK_VIDEO_PATH}`;
}

export function getTransactionDetailsGuideUrl(origin) {
  const base = String(origin || getWealthyGuidePublicOrigin() || "").replace(/\/$/, "");
  if (!base) return PUBLIC_TRANSACTION_DETAILS_PDF_PATH;
  return `${base}${PUBLIC_TRANSACTION_DETAILS_PDF_PATH}`;
}

export function getTransactionDetailsPresentationUrl(origin) {
  const base = String(origin || getWealthyGuidePublicOrigin() || "").replace(/\/$/, "");
  if (!base) return PUBLIC_TRANSACTION_DETAILS_VIDEO_PATH;
  return `${base}${PUBLIC_TRANSACTION_DETAILS_VIDEO_PATH}`;
}

export function getThreeDsSettingsGuideUrl(origin) {
  const base = String(origin || getWealthyGuidePublicOrigin() || "").replace(/\/$/, "");
  if (!base) return PUBLIC_THREE_DS_SETTINGS_PDF_PATH;
  return `${base}${PUBLIC_THREE_DS_SETTINGS_PDF_PATH}`;
}

export function getWordPressPluginGuideUrl(origin) {
  const base = String(origin || getWealthyGuidePublicOrigin() || "").replace(/\/$/, "");
  if (!base) return PUBLIC_WORDPRESS_PLUGIN_PDF_PATH;
  return `${base}${PUBLIC_WORDPRESS_PLUGIN_PDF_PATH}`;
}

export function getShvaErrorsGuideUrl(origin) {
  const base = String(origin || getWealthyGuidePublicOrigin() || "").replace(/\/$/, "");
  if (!base) return PUBLIC_SHVA_ERRORS_PDF_PATH;
  return `${base}${PUBLIC_SHVA_ERRORS_PDF_PATH}`;
}

export function getThreeDsErrorsGuideUrl(origin) {
  const base = String(origin || getWealthyGuidePublicOrigin() || "").replace(/\/$/, "");
  if (!base) return PUBLIC_THREE_DS_ERRORS_PDF_PATH;
  return `${base}${PUBLIC_THREE_DS_ERRORS_PDF_PATH}`;
}

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
  "shva-errors": {
    templates: {
      guide: 'מדריך שגיאות שב"א: {guideUrl}',
      presentation: 'מדריך שגיאות שב"א: {guideUrl}',
      both: 'מדריך שגיאות שב"א: {guideUrl}',
    },
    getGuideUrl: getShvaErrorsGuideUrl,
    getPresentationUrl: getShvaErrorsGuideUrl,
  },
  "3ds-errors": {
    templates: {
      guide: "מדריך שגיאות 3DS: {guideUrl}",
      presentation: "מדריך שגיאות 3DS: {guideUrl}",
      both: "מדריך שגיאות 3DS: {guideUrl}",
    },
    getGuideUrl: getThreeDsErrorsGuideUrl,
    getPresentationUrl: getThreeDsErrorsGuideUrl,
  },
};

function resolveGuideType(guideType) {
  return WEALTHY_GUIDE_TYPES.includes(guideType) ? guideType : "manual-charge";
}

export function buildWealthyGuideSmsMessage({
  variant = "both",
  guideType = "manual-charge",
  guideUrl,
  presentationUrl,
  origin,
} = {}) {
  const kind = WEALTHY_GUIDE_SMS_VARIANTS.includes(variant) ? variant : "both";
  const config = SMS_CONFIG[resolveGuideType(guideType)];
  const guide = String(guideUrl || config.getGuideUrl(origin)).trim();
  const presentation = String(presentationUrl || config.getPresentationUrl(origin)).trim();

  if (kind === "guide" && !guide) {
    return { ok: false, error: "missing_guide_url", message: "קישור המדריך לא זמין" };
  }
  if (kind === "presentation" && !presentation) {
    return { ok: false, error: "missing_presentation_url", message: "קישור המצגת לא זמין" };
  }

  const template = config.templates[kind];
  const message = template
    .replace(/\{guideUrl\}/g, guide)
    .replace(/\{presentationUrl\}/g, presentation);

  return {
    ok: true,
    message,
    variant: kind,
    guideType: resolveGuideType(guideType),
    guideUrl: guide,
    presentationUrl: presentation,
  };
}

export function validateWealthyGuideSmsMessageLength(message) {
  return validateReviewSmsMessageLength(message);
}

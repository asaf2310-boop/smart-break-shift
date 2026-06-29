/** Wealthy Guide — public URLs and SMS message helpers (server) */

import { REVIEW_SMS_MAX_LENGTH, validateReviewSmsMessageLength } from "../review/reviewLink.js";

export { REVIEW_SMS_MAX_LENGTH as WEALTHY_GUIDE_SMS_MAX_LENGTH };

export const WEALTHY_GUIDE_BASE = "/knowledge/wealthy-guide";
export const MANUAL_CHARGE_SLUG = "manual-charge";
export const PUBLIC_MANUAL_CHARGE_VIDEO_PATH = "/guide/manual-charge/video";
export const PUBLIC_MANUAL_CHARGE_PDF_PATH = "/guide/manual-charge/pdf";

export const WEALTHY_GUIDE_SMS_VARIANTS = ["guide", "presentation", "both"];

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

const SMS_TEMPLATES = {
  guide: "מדריך חיוב ידני: {guideUrl}",
  presentation: "מצגת הדרכה — חיוב ידני: {presentationUrl}",
  both: "מדריך חיוב ידני: {guideUrl}\nמצגת: {presentationUrl}",
};

export function buildWealthyGuideSmsMessage({ variant = "both", guideUrl, presentationUrl } = {}) {
  const kind = WEALTHY_GUIDE_SMS_VARIANTS.includes(variant) ? variant : "both";
  const guide = String(guideUrl || getManualChargeGuideUrl()).trim();
  const presentation = String(presentationUrl || getManualChargePresentationUrl()).trim();

  if (kind === "guide" && !guide) {
    return { ok: false, error: "missing_guide_url", message: "קישור המדריך לא זמין" };
  }
  if (kind === "presentation" && !presentation) {
    return { ok: false, error: "missing_presentation_url", message: "קישור המצגת לא זמין" };
  }

  const template = SMS_TEMPLATES[kind];
  const message = template
    .replace(/\{guideUrl\}/g, guide)
    .replace(/\{presentationUrl\}/g, presentation);

  return { ok: true, message, variant: kind, guideUrl: guide, presentationUrl: presentation };
}

export function validateWealthyGuideSmsMessageLength(message) {
  return validateReviewSmsMessageLength(message);
}

/** Google review SMS — short public link + message helpers (server) */

export const GOOGLE_REVIEW_REDIRECT_PATH = "/go/review";

/** Max SMS body length before send (Inforu allows ~1000; keep headroom for Hebrew segments). */
export const REVIEW_SMS_MAX_LENGTH = 500;

export const DEFAULT_REVIEW_SMS_TEMPLATE = "תודה שפנית אלינו! דרגו אותנו: {url}";

export function getGoogleReviewUrl() {
  return String(process.env.GOOGLE_REVIEW_URL || process.env.VITE_GOOGLE_REVIEW_URL || "").trim();
}

export function getPublicAppOrigin() {
  return String(process.env.VITE_APP_URL || process.env.VERCEL_URL || "")
    .trim()
    .replace(/\/$/, "")
    .replace(/^(?!https?:\/\/)/, (host) => `https://${host}`);
}

export function buildGoogleReviewShortUrl(origin) {
  const base = String(origin || getPublicAppOrigin() || "").replace(/\/$/, "");
  if (!base) return GOOGLE_REVIEW_REDIRECT_PATH;
  return `${base}${GOOGLE_REVIEW_REDIRECT_PATH}`;
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

export function validateReviewSmsMessageLength(message) {
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

export function handleGoogleReviewRedirect(res) {
  const target = getGoogleReviewUrl();
  if (!target) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      "<!DOCTYPE html><html lang=\"he\" dir=\"rtl\"><body><p>קישור דירוג לא זמין כרגע.</p></body></html>"
    );
    return;
  }

  res.statusCode = 302;
  res.setHeader("Location", target);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

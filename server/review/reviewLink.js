/** Google review SMS — short public link + message helpers (server) */

export const GOOGLE_REVIEW_REDIRECT_PATH = "/go/review";

/** Max SMS body length before send (Inforu allows ~1000; keep headroom for Hebrew segments). */
export const REVIEW_SMS_MAX_LENGTH = 500;

/** Max review URL length in SMS when falling back to GOOGLE_REVIEW_URL (no GOOGLE_REVIEW_SMS_URL). */
export const REVIEW_SMS_URL_MAX_LENGTH = 120;

export const DEFAULT_REVIEW_SMS_TEMPLATE = "תודה שפנית אלינו! דרגו אותנו: {url}";

export function getGoogleReviewUrl() {
  return String(process.env.GOOGLE_REVIEW_URL || process.env.VITE_GOOGLE_REVIEW_URL || "").trim();
}

export function getGoogleReviewSmsUrlEnv() {
  return String(process.env.GOOGLE_REVIEW_SMS_URL || "").trim();
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

function getAppHostname() {
  const origin = getPublicAppOrigin();
  if (!origin) return "";
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}

function urlContainsAppDomain(url) {
  const host = getAppHostname();
  if (!host) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === host || parsed.hostname.endsWith(`.${host}`);
  } catch {
    return String(url).includes(host);
  }
}

const BLOCKED_SMS_HOST_SUFFIXES = ["hypsmart.vercel.app", "hypsmart.com"];

function getBlockedSmsHostnames() {
  const hosts = new Set(BLOCKED_SMS_HOST_SUFFIXES);
  const appHost = getAppHostname();
  if (appHost) hosts.add(appHost);
  return hosts;
}

function hostnameMatchesBlocked(host, blocked) {
  const normalized = String(host || "").toLowerCase();
  if (!normalized) return false;
  return normalized === blocked || normalized.endsWith(`.${blocked}`);
}

export function isBlockedReviewSmsHostname(hostname) {
  for (const blocked of getBlockedSmsHostnames()) {
    if (hostnameMatchesBlocked(hostname, blocked.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/** Validate review URL pasted by admin (long URLs allowed — may be auto-shortened). */
export function validateGoogleReviewTargetUrl(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url) {
    return { ok: false, error: "empty_url", message: "יש להזין קישור דירוג" };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "invalid_url", message: "קישור לא תקין — השתמשו בכתובת https מלאה" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "invalid_protocol", message: "הקישור חייב להתחיל ב-https://" };
  }

  if (isBlockedReviewSmsHostname(parsed.hostname)) {
    return {
      ok: false,
      error: "app_domain_blocked",
      message:
        "אין להשתמש בדומיין האפליקציה (hypsmart) בקישור SMS. השתמשו בקישור קצר של גוגל (g.page/r/…/review).",
    };
  }

  if (parsed.pathname === GOOGLE_REVIEW_REDIRECT_PATH || url.includes("/go/review")) {
    return {
      ok: false,
      error: "redirect_path_blocked",
      message: "אין לשלוח ב-SMS את קישור ההפניה של האפליקציה. השתמשו בקישור g.page ישיר לגוגל.",
    };
  }

  return { ok: true, url };
}

/** Validate URL stored/sent in SMS (must be short). */
export function validateGoogleReviewSmsUrl(rawUrl) {
  const target = validateGoogleReviewTargetUrl(rawUrl);
  if (!target.ok) {
    return target;
  }

  if (target.url.length > REVIEW_SMS_URL_MAX_LENGTH) {
    return {
      ok: false,
      error: "url_too_long",
      message: `הקישור ארוך מדי (${target.url.length} תווים). מקסימום ${REVIEW_SMS_URL_MAX_LENGTH} — יקוצר אוטומטית בשמירה.`,
    };
  }

  return { ok: true, url: target.url };
}

/** Whether admin input should be shortened before storing as SMS URL. */
export function shouldAutoShortenReviewUrl(rawUrl) {
  const target = validateGoogleReviewTargetUrl(rawUrl);
  if (!target.ok) {
    return { shorten: false, validation: target };
  }

  const sms = validateGoogleReviewSmsUrl(target.url);
  if (sms.ok) {
    return { shorten: false, targetUrl: target.url, smsUrl: sms.url };
  }

  if (sms.error === "url_too_long" || target.url.length > REVIEW_SMS_URL_MAX_LENGTH) {
    return { shorten: true, targetUrl: target.url };
  }

  return { shorten: false, validation: sms };
}

/**
 * URL placed in review SMS — never the app /go/review redirect.
 * 1. DB google_review_sms_url if set
 * 2. GOOGLE_REVIEW_SMS_URL env if set
 * 3. else GOOGLE_REVIEW_URL if short and not app domain
 * 4. else Hebrew error (admin must configure link)
 */
export function resolveReviewSmsUrlFromSources({ dbSmsUrl } = {}) {
  const dbUrl = String(dbSmsUrl || "").trim();
  if (dbUrl) {
    const validation = validateGoogleReviewSmsUrl(dbUrl);
    if (validation.ok) {
      return { ok: true, url: validation.url, source: "db" };
    }
  }

  const smsUrl = getGoogleReviewSmsUrlEnv();
  if (smsUrl) {
    const validation = validateGoogleReviewSmsUrl(smsUrl);
    if (validation.ok) {
      return { ok: true, url: validation.url, source: "env_sms" };
    }
  }

  const fullUrl = getGoogleReviewUrl();
  if (!fullUrl) {
    return {
      ok: false,
      error: "review_url_not_configured",
      message:
        "קישור דירוג גוגל לא מוגדר. מנהל יכול להגדיר קישור קצר (g.page) בדשבורד מנהל → קישור דירוג גוגל ל-SMS.",
    };
  }

  if (fullUrl.length <= REVIEW_SMS_URL_MAX_LENGTH && !urlContainsAppDomain(fullUrl)) {
    return { ok: true, url: fullUrl, source: "env_fallback" };
  }

  return {
    ok: false,
    error: "review_sms_url_not_configured",
    message:
      "קישור הדירוג ארוך מדי ל-SMS. מנהל יכול להגדיר קישור קצר (g.page/r/…/review) בדשבורד מנהל → קישור דירוג גוגל ל-SMS.",
  };
}

/** @deprecated Use resolveReviewSmsUrl from reviewSmsSettingsService (async, includes DB). */
export function resolveReviewSmsUrl() {
  return resolveReviewSmsUrlFromSources();
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

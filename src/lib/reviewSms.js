import { demoModeEnabled } from "@/api/demoClient";
import { cleanEnvValue } from "@/api/supabase";
import { apiGetReviewSmsConfig, apiSendReviewSms } from "@/lib/agentAuthClient";
import { normalizeAgentPhone } from "@/lib/agentPhone";

/** Max SMS body length — must match server/review/reviewLink.js */
export const REVIEW_SMS_MAX_LENGTH = 500;

export const DEFAULT_REVIEW_SMS_TEMPLATE = "תודה שפנית אלינו! דרגו אותנו: {url}";

const REVIEW_SMS_CONFIG_CACHE_KEY = "review-sms-config-cache-v1";
const REVIEW_SMS_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

function getClientPreviewSmsUrl() {
  return cleanEnvValue(import.meta.env.VITE_GOOGLE_REVIEW_SMS_URL) || null;
}

export function buildReviewSmsPreview(smsUrl) {
  const url = String(smsUrl || getClientPreviewSmsUrl() || "[קישור דירוג לא מוגדר]").trim();
  return DEFAULT_REVIEW_SMS_TEMPLATE.replace(/\{url\}/g, url);
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

function reviewSmsConfigFallback({ error = "request_failed", message = "לא הצלחנו לטעון את הגדרות הקישור" } = {}) {
  return {
    ok: false,
    smsUrl: null,
    source: null,
    dbError: null,
    dbErrorMessage: null,
    error,
    message,
    template: DEFAULT_REVIEW_SMS_TEMPLATE,
    maxLength: REVIEW_SMS_MAX_LENGTH,
  };
}

function normalizeReviewSmsConfigPayload(payload) {
  if (!payload) return null;
  return {
    ok: Boolean(payload.ok),
    smsUrl: payload.smsUrl || null,
    source: payload.source || null,
    dbError: payload.dbError || null,
    dbErrorMessage: payload.dbErrorMessage || null,
    error: payload.error || null,
    message: payload.message || null,
    template: payload.template || DEFAULT_REVIEW_SMS_TEMPLATE,
    maxLength: payload.maxLength || REVIEW_SMS_MAX_LENGTH,
  };
}

/** Cached config for instant page paint (5 min TTL). */
export function readReviewSmsConfigCache() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(REVIEW_SMS_CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cachedAt || Date.now() - parsed.cachedAt > REVIEW_SMS_CONFIG_CACHE_TTL_MS) {
      sessionStorage.removeItem(REVIEW_SMS_CONFIG_CACHE_KEY);
      return null;
    }
    return normalizeReviewSmsConfigPayload(parsed.config);
  } catch {
    return null;
  }
}

function writeReviewSmsConfigCache(config) {
  if (typeof sessionStorage === "undefined" || !config) return;
  try {
    sessionStorage.setItem(
      REVIEW_SMS_CONFIG_CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), config })
    );
  } catch {
    // Cache is only a speed boost; ignore browsers that block storage.
  }
}

export function clearReviewSmsConfigCache() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(REVIEW_SMS_CONFIG_CACHE_KEY);
  } catch {
    // ignore
  }
}

/** Initial UI state: cached config paints instantly; otherwise defaults while loading. */
export function getInitialReviewSmsConfigState() {
  const cached = readReviewSmsConfigCache();
  if (cached) {
    return { loading: false, refreshing: true, ...cached };
  }
  return {
    loading: true,
    refreshing: false,
    ok: false,
    smsUrl: null,
    source: null,
    message: null,
    dbError: null,
    dbErrorMessage: null,
    template: DEFAULT_REVIEW_SMS_TEMPLATE,
    maxLength: REVIEW_SMS_MAX_LENGTH,
  };
}

/** Fetch configured SMS review URL from server (or client env in demo). */
export async function fetchReviewSmsConfig({ accessToken = null } = {}) {
  try {
    if (demoModeEnabled) {
      const smsUrl = getClientPreviewSmsUrl();
      const config = normalizeReviewSmsConfigPayload({
        ok: Boolean(smsUrl),
        smsUrl,
        source: smsUrl ? "env_sms" : null,
        error: smsUrl ? null : "review_sms_url_not_configured",
        message: smsUrl
          ? null
          : "הגדירו קישור בדשבורד מנהל (או VITE_GOOGLE_REVIEW_SMS_URL בדמו מקומי).",
        template: DEFAULT_REVIEW_SMS_TEMPLATE,
        maxLength: REVIEW_SMS_MAX_LENGTH,
      });
      if (config.ok) writeReviewSmsConfigCache(config);
      return config;
    }

    const result = await apiGetReviewSmsConfig({ accessToken });
    const configLoaded = result.template != null || result.maxLength != null;

    if (!configLoaded) {
      return reviewSmsConfigFallback({
        error: result.error || "request_failed",
        message: result.message || "לא הצלחנו לטעון את הגדרות הקישור",
      });
    }

    const config = normalizeReviewSmsConfigPayload({
      ok: Boolean(result.smsUrl),
      smsUrl: result.smsUrl || null,
      source: result.source || null,
      dbError: result.dbError || null,
      dbErrorMessage: result.dbErrorMessage || null,
      error: result.error || null,
      message: result.message || null,
      template: result.template || DEFAULT_REVIEW_SMS_TEMPLATE,
      maxLength: result.maxLength || REVIEW_SMS_MAX_LENGTH,
    });
    writeReviewSmsConfigCache(config);
    return config;
  } catch {
    return reviewSmsConfigFallback();
  }
}

/** שליחת SMS ללקוח עם קישור לדירוג בגוגל */
export async function sendReviewSms({ phone }) {
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
    const preview = buildReviewSmsPreview(config.smsUrl);
    const lengthCheck = validateReviewSmsLength(preview);
    if (!lengthCheck.ok) {
      return lengthCheck;
    }
    return { ok: true, simulated: true, phone: normalized, preview };
  }

  const result = await apiSendReviewSms({ phone: normalized });

  if (!result.ok) {
    return result;
  }

  return { ok: true, phone: normalized, message: result.message || "נשלח בהצלחה" };
}

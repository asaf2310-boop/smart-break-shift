import { getRetryAfterSec } from "../openaiRetry.js";
import {
  isGeminiHighDemandError,
  isGeminiRateLimitError,
} from "../knowledge/geminiErrorMessages.js";

export const GEMINI_QUOTA_DAILY_MESSAGE_HE =
  "מכסה יומית של Gemini אזלה — נסו שוב מחר או בדקו מגבלות ב-Google AI Studio (aistudio.google.com).";

export const GEMINI_QUOTA_MESSAGE_HE = GEMINI_QUOTA_DAILY_MESSAGE_HE;

export const GEMINI_RATE_LIMIT_MESSAGE_HE =
  "עומס זמני ב-Gemini — נסו שוב בעוד דקה.";

export const GEMINI_AUTH_MESSAGE_HE =
  "מפתח Gemini לא תקין או חסר הרשאה — עדכנו את GEMINI_API_KEY ב-Vercel.";

export const GEMINI_GENERIC_MESSAGE_HE = "שגיאה ב-Gemini — נסו שוב מאוחר יותר.";

export const GEMINI_MODEL_NOT_FOUND_MESSAGE_HE =
  "מודל Gemini לא נמצא — בדקו את GEMINI_CHAT_MODEL ב-Vercel (לדוגמה: gemini-2.0-flash-lite).";

export const GEMINI_INVALID_REQUEST_MESSAGE_HE =
  "בקשה לא תקינה ל-Gemini — ייתכן שהמודל או הגדרת הכלים שגויים. פנו למנהל המערכת.";

export const GEMINI_HIGH_DEMAND_MESSAGE_HE =
  "שירות Gemini עמוס זמנית — נסו שוב בעוד דקה.";

/**
 * @param {string} bodyText
 * @returns {{ message?: string, status?: string, code?: number, details?: unknown[] } | null}
 */
export function parseGeminiErrorBody(bodyText) {
  const raw = String(bodyText || "").trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error && typeof parsed.error === "object" ? parsed.error : null;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return parsed?.error && typeof parsed.error === "object" ? parsed.error : null;
    } catch {
      return null;
    }
  }
}

/**
 * @param {{ details?: unknown[] } | null} apiError
 * @returns {{ retryDelaySec: number | null, isPerMinute: boolean, isPerDay: boolean }}
 */
export function parseGeminiErrorDetails(apiError) {
  const details = Array.isArray(apiError?.details) ? apiError.details : [];
  let retryDelaySec = null;
  let isPerMinute = false;
  let isPerDay = false;

  for (const entry of details) {
    if (!entry || typeof entry !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (entry);
    const type = String(row["@type"] || "");

    if (type.includes("RetryInfo") && row.retryDelay != null) {
      const match = String(row.retryDelay).match(/^(\d+(?:\.\d+)?)s$/);
      if (match) {
        retryDelaySec = Math.max(1, Math.ceil(Number(match[1])));
      }
    }

    if (type.includes("QuotaFailure") && Array.isArray(row.violations)) {
      for (const violation of row.violations) {
        if (!violation || typeof violation !== "object") continue;
        const v = /** @type {Record<string, unknown>} */ (violation);
        const id = `${v.quotaId || ""} ${v.quotaMetric || ""}`.toLowerCase();
        if (/perminute|per.minute|requestsperminute|\/rpm|_rpm/i.test(id)) {
          isPerMinute = true;
        }
        if (/perday|per.day|daily|perprojectperday/i.test(id)) {
          isPerDay = true;
        }
      }
    }
  }

  return { retryDelaySec, isPerMinute, isPerDay };
}

/**
 * @param {number} status
 * @param {string} apiMessage
 * @param {string} apiStatus
 * @param {{ retryDelaySec: number | null, isPerMinute: boolean, isPerDay: boolean }} details
 * @returns {"rate" | "daily" | null}
 */
export function classifyGeminiResourceExhausted(status, apiMessage, apiStatus, details) {
  const msg = String(apiMessage || "").toLowerCase();
  const exhausted =
    apiStatus === "RESOURCE_EXHAUSTED" ||
    msg.includes("resource exhausted") ||
    msg.includes("quota") ||
    msg.includes("exceeded");

  if (!exhausted) return null;

  if (details.isPerDay || /per day|daily limit|requests per day/i.test(msg)) {
    return "daily";
  }

  if (
    status === 429 ||
    details.isPerMinute ||
    details.retryDelaySec != null ||
    /per minute|requests per minute|rate limit|too many requests/i.test(msg)
  ) {
    return "rate";
  }

  if (msg.includes("billing") && !details.isPerMinute) {
    return "daily";
  }

  // Free-tier 429 RESOURCE_EXHAUSTED without PerDay signal is almost always RPM.
  if (status === 429 || apiStatus === "RESOURCE_EXHAUSTED") {
    return "rate";
  }

  return "daily";
}

/**
 * @param {string} bodyText
 * @returns {number | null} milliseconds to wait before retry
 */
export function getGeminiRetryDelayMs(bodyText) {
  const apiError = parseGeminiErrorBody(bodyText);
  const { retryDelaySec } = parseGeminiErrorDetails(apiError);
  if (retryDelaySec != null && retryDelaySec > 0) {
    return Math.min(retryDelaySec * 1000, 20_000);
  }
  return null;
}

/**
 * @param {number} status
 * @param {string} bodyText
 * @returns {boolean}
 */
export function isGeminiDailyQuotaError(status, bodyText) {
  const apiError = parseGeminiErrorBody(bodyText);
  const apiMessage = String(apiError?.message || bodyText || "").toLowerCase();
  const apiStatus = String(apiError?.status || "").toUpperCase();
  const details = parseGeminiErrorDetails(apiError);
  return classifyGeminiResourceExhausted(status, apiMessage, apiStatus, details) === "daily";
}

function formatRateLimitMessage(waitSec) {
  if (waitSec > 0 && waitSec < 60) {
    return `עומס זמני ב-Gemini — נסו שוב בעוד ${waitSec} שניות.`;
  }
  return GEMINI_RATE_LIMIT_MESSAGE_HE;
}

/**
 * @param {number} status
 * @param {string} bodyText
 * @param {Response | null} [response]
 * @returns {{ error: string, message: string, retryAfterSec?: number }}
 */
export function mapGeminiHttpError(status, bodyText, response = null) {
  const apiError = parseGeminiErrorBody(bodyText);
  const apiMessage = String(apiError?.message || bodyText || "").toLowerCase();
  const apiStatus = String(apiError?.status || "").toUpperCase();
  const details = parseGeminiErrorDetails(apiError);
  const headerRetrySec =
    (status === 429 || isGeminiRateLimitError(status, apiMessage)) && response
      ? getRetryAfterSec(response)
      : null;
  const retryAfterSec = details.retryDelaySec ?? headerRetrySec ?? null;

  if (isGeminiHighDemandError(status, apiMessage)) {
    return { error: "gemini_high_demand", message: GEMINI_HIGH_DEMAND_MESSAGE_HE };
  }

  const quotaKind = classifyGeminiResourceExhausted(status, apiMessage, apiStatus, details);
  if (quotaKind === "rate") {
    const waitSec = retryAfterSec && retryAfterSec > 0 ? retryAfterSec : 60;
    return {
      error: "gemini_rate_limited",
      message: formatRateLimitMessage(waitSec),
      retryAfterSec: waitSec,
    };
  }

  if (quotaKind === "daily") {
    return { error: "gemini_quota_exceeded", message: GEMINI_QUOTA_DAILY_MESSAGE_HE };
  }

  if (isGeminiRateLimitError(status, apiMessage)) {
    const waitSec = retryAfterSec && retryAfterSec > 0 ? retryAfterSec : 60;
    return {
      error: "gemini_rate_limited",
      message: formatRateLimitMessage(waitSec),
      retryAfterSec: waitSec,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    apiMessage.includes("api key not valid") ||
    apiMessage.includes("api key invalid") ||
    apiMessage.includes("invalid api key") ||
    apiMessage.includes("permission denied")
  ) {
    return { error: "gemini_auth_error", message: GEMINI_AUTH_MESSAGE_HE };
  }

  if (
    status === 404 ||
    apiStatus === "NOT_FOUND" ||
    /model.*not found|not found for api version|is not supported/i.test(apiMessage)
  ) {
    return { error: "gemini_model_not_found", message: GEMINI_MODEL_NOT_FOUND_MESSAGE_HE };
  }

  if (status === 400) {
    if (/api[_ ]?key|unregistered caller|access token/i.test(apiMessage)) {
      return { error: "gemini_auth_error", message: GEMINI_AUTH_MESSAGE_HE };
    }
    return { error: "gemini_invalid_request", message: GEMINI_INVALID_REQUEST_MESSAGE_HE };
  }

  return {
    error: `gemini_error_${status}`,
    message: GEMINI_GENERIC_MESSAGE_HE,
  };
}

/**
 * Lightweight key / connectivity check for admin status (minimal tokens, no tools).
 * @param {() => string} getApiKey
 * @param {(model: string) => string} buildUrl — (model) => generateContent URL
 * @param {() => string} getModel
 */
export async function probeGeminiAccess(getApiKey, buildUrl, getModel) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: "not_configured", message: null };
  }

  const model = getModel();
  const body = {
    contents: [{ role: "user", parts: [{ text: "ping" }] }],
    generationConfig: { maxOutputTokens: 1 },
  };

  let res;
  try {
    res = await fetch(buildUrl(model), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: "network_error", message: null };
  }

  if (res.ok) {
    return { ok: true, error: null, message: null };
  }

  const errText = await res.text().catch(() => "");
  console.error("[probeGeminiAccess] Gemini probe failed", {
    status: res.status,
    model,
    body: errText.slice(0, 500),
  });
  const mapped = mapGeminiHttpError(res.status, errText, res);
  return {
    ok: false,
    error: mapped.error,
    message: mapped.message,
  };
}

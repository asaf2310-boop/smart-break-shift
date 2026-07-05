import { getRetryAfterSec } from "../openaiRetry.js";
import {
  isGeminiHighDemandError,
  isGeminiRateLimitError,
} from "../knowledge/geminiErrorMessages.js";

export const GEMINI_QUOTA_MESSAGE_HE =
  "מכסת Gemini אזלה. בדקו מגבלות ב-Google AI Studio או עדכנו את GEMINI_API_KEY ב-Vercel.";

export const GEMINI_AUTH_MESSAGE_HE =
  "מפתח Gemini לא תקין או חסר הרשאה — עדכנו את GEMINI_API_KEY ב-Vercel.";

export const GEMINI_GENERIC_MESSAGE_HE = "שגיאה ב-Gemini — נסו שוב מאוחר יותר.";

export const GEMINI_HIGH_DEMAND_MESSAGE_HE =
  "שירות Gemini עמוס זמנית — נסו שוב בעוד דקה.";

/**
 * @param {string} bodyText
 * @returns {{ message?: string, status?: string, code?: number } | null}
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
 * @param {number} status
 * @param {string} bodyText
 * @param {Response | null} [response]
 * @returns {{ error: string, message: string, retryAfterSec?: number }}
 */
export function mapGeminiHttpError(status, bodyText, response = null) {
  const apiError = parseGeminiErrorBody(bodyText);
  const apiMessage = String(apiError?.message || bodyText || "").toLowerCase();
  const apiStatus = String(apiError?.status || "").toUpperCase();
  const retryAfterSec =
    (status === 429 || isGeminiRateLimitError(status, apiMessage)) && response
      ? getRetryAfterSec(response)
      : null;

  if (
    apiStatus === "RESOURCE_EXHAUSTED" ||
    apiMessage.includes("quota") ||
    apiMessage.includes("exceeded") ||
    apiMessage.includes("billing")
  ) {
    return { error: "gemini_quota_exceeded", message: GEMINI_QUOTA_MESSAGE_HE };
  }

  if (isGeminiRateLimitError(status, apiMessage)) {
    const waitSec = retryAfterSec && retryAfterSec > 0 ? retryAfterSec : 60;
    return {
      error: "gemini_rate_limited",
      message:
        waitSec > 0
          ? `מגבלת קצב ב-Gemini — נסו שוב בעוד ${waitSec} שניות.`
          : "מגבלת קצב ב-Gemini — המתן כדקה ונסו שוב.",
      retryAfterSec: waitSec,
    };
  }

  if (isGeminiHighDemandError(status, apiMessage)) {
    return { error: "gemini_high_demand", message: GEMINI_HIGH_DEMAND_MESSAGE_HE };
  }

  if (status === 401 || status === 403 || apiMessage.includes("api key not valid")) {
    return { error: "gemini_auth_error", message: GEMINI_AUTH_MESSAGE_HE };
  }

  return {
    error: `gemini_error_${status}`,
    message: GEMINI_GENERIC_MESSAGE_HE,
  };
}

/**
 * Lightweight quota / key check for admin status (minimal tokens).
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
  let res;
  try {
    res = await fetch(buildUrl(model), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    });
  } catch {
    return { ok: false, error: "network_error", message: null };
  }

  if (res.ok) {
    return { ok: true, error: null, message: null };
  }

  const errText = await res.text().catch(() => "");
  const mapped = mapGeminiHttpError(res.status, errText, res);
  return {
    ok: false,
    error: mapped.error,
    message: mapped.message,
  };
}

import { getRetryAfterSec } from "../openaiRetry.js";

export const OPENAI_QUOTA_MESSAGE_HE =
  "מכסת OpenAI אזלה. יש לעדכן חיוב או מפתח API בהגדרות Vercel.";

export const OPENAI_AUTH_MESSAGE_HE =
  "מפתח OpenAI לא תקין או חסר הרשאה — עדכנו את OPENAI_API_KEY ב-Vercel.";

export const OPENAI_GENERIC_MESSAGE_HE = "שגיאה ב-OpenAI — נסו שוב מאוחר יותר.";

/**
 * @param {string} bodyText
 * @returns {{ message?: string, type?: string, code?: string } | null}
 */
export function parseOpenAiErrorBody(bodyText) {
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
export function mapOpenAiHttpError(status, bodyText, response = null) {
  const apiError = parseOpenAiErrorBody(bodyText);
  const code = String(apiError?.code || apiError?.type || "").toLowerCase();
  const apiMessage = String(apiError?.message || "").toLowerCase();
  const retryAfterSec =
    status === 429 && response ? getRetryAfterSec(response) : null;

  if (
    code === "insufficient_quota" ||
    apiMessage.includes("exceeded your current quota") ||
    apiMessage.includes("insufficient_quota")
  ) {
    return { error: "openai_quota_exceeded", message: OPENAI_QUOTA_MESSAGE_HE };
  }

  if (status === 429 || code === "rate_limit_exceeded" || code === "rate_limit") {
    const waitSec = retryAfterSec && retryAfterSec > 0 ? retryAfterSec : 60;
    return {
      error: "openai_rate_limited",
      message:
        waitSec > 0
          ? `מגבלת קצב ב-OpenAI — נסו שוב בעוד ${waitSec} שניות.`
          : "מגבלת קצב ב-OpenAI — המתן כדקה ונסו שוב.",
      retryAfterSec: waitSec,
    };
  }

  if (status === 401 || status === 403 || code === "invalid_api_key") {
    return { error: "openai_auth_error", message: OPENAI_AUTH_MESSAGE_HE };
  }

  return {
    error: `openai_error_${status}`,
    message: OPENAI_GENERIC_MESSAGE_HE,
  };
}

/**
 * Lightweight quota / key check for admin status (minimal tokens).
 * @param {() => string} getApiKey
 * @param {() => string} getModel
 */
export async function probeOpenAiAccess(getApiKey, getModel) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: "not_configured", message: null };
  }

  let res;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getModel(),
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
  } catch {
    return { ok: false, error: "network_error", message: null };
  }

  if (res.ok) {
    return { ok: true, error: null, message: null };
  }

  const errText = await res.text().catch(() => "");
  const mapped = mapOpenAiHttpError(res.status, errText, res);
  return {
    ok: false,
    error: mapped.error,
    message: mapped.message,
  };
}

export const OPENAI_QUOTA_MESSAGE_HE =
  "מכסת OpenAI אזלה. יש לעדכן חיוב או מפתח API בהגדרות Vercel.";

export const GEMINI_QUOTA_MESSAGE_HE =
  "מכסה יומית של Gemini אזלה. נסו שוב מחר (איפוס סביב חצות PT), או צרו מפתח API חדש מחשבון Google אחר ב-aistudio.google.com/apikey.";

const ERROR_CODE_MESSAGES = {
  openai_quota_exceeded: OPENAI_QUOTA_MESSAGE_HE,
  openai_rate_limited: "מגבלת קצב ב-OpenAI — המתן כדקה ונסו שוב.",
  openai_auth_error: "מפתח OpenAI לא תקין או חסר הרשאה — עדכנו את OPENAI_API_KEY ב-Vercel.",
  gemini_quota_exceeded: GEMINI_QUOTA_MESSAGE_HE,
  gemini_rate_limited: "עומס זמני ב-Gemini — נסו שוב בעוד דקה.",
  gemini_high_demand: "שירות Gemini עמוס זמנית — נסו שוב בעוד דקה.",
  gemini_auth_error: "מפתח Gemini לא תקין או חסר הרשאה — עדכנו את GEMINI_API_KEY ב-Vercel.",
  ai_not_configured: "סוכן AI לא מוגדר בשרת (חסר GEMINI_API_KEY ב-Vercel)",
};

/**
 * Turn API error payloads or raw OpenAI JSON into a friendly Hebrew string.
 * @param {unknown} data
 * @param {string} [fallback]
 */
export function friendlyOpenAiErrorMessage(data, fallback = "שגיאה בשליחה") {
  if (!data) return fallback;

  if (typeof data === "string") {
    return friendlyOpenAiErrorMessage(parseOpenAiJsonString(data), fallback);
  }

  if (typeof data === "object") {
    const obj = /** @type {{ error?: string, message?: string }} */ (data);
    if (obj.error && ERROR_CODE_MESSAGES[obj.error]) {
      return ERROR_CODE_MESSAGES[obj.error];
    }
    if (obj.message) {
      const fromJson = messageFromOpenAiJsonString(obj.message);
      if (fromJson) return fromJson;
      if (!looksLikeOpenAiJson(obj.message)) return obj.message;
    }
    if (obj.error && looksLikeOpenAiJson(String(obj.error))) {
      return friendlyOpenAiErrorMessage(parseOpenAiJsonString(String(obj.error)), fallback);
    }
  }

  return fallback;
}

function looksLikeOpenAiJson(text) {
  const s = String(text || "").trim();
  return s.startsWith("{") && (s.includes('"error"') || s.includes("insufficient_quota"));
}

/**
 * @param {string} text
 */
export function parseOpenAiJsonString(text) {
  const raw = String(text || "").trim();
  if (!looksLikeOpenAiJson(raw)) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

/**
 * @param {string} text
 */
export function messageFromOpenAiJsonString(text) {
  const parsed = parseOpenAiJsonString(text);
  if (!parsed?.error) return null;

  const code = String(parsed.error.code || parsed.error.type || "").toLowerCase();
  const apiMessage = String(parsed.error.message || "").toLowerCase();

  if (
    code === "insufficient_quota" ||
    apiMessage.includes("insufficient_quota")
  ) {
    return OPENAI_QUOTA_MESSAGE_HE;
  }
  if (
    code === "429" ||
    apiMessage.includes("resource exhausted") ||
    apiMessage.includes("exceeded your current quota")
  ) {
    if (/\bper day\b|\bdaily\b|\bperday\b/i.test(apiMessage)) {
      return GEMINI_QUOTA_MESSAGE_HE;
    }
    return ERROR_CODE_MESSAGES.gemini_rate_limited;
  }
  if (code === "rate_limit_exceeded" || code === "rate_limit") {
    return ERROR_CODE_MESSAGES.openai_rate_limited;
  }
  if (code === "invalid_api_key") {
    return ERROR_CODE_MESSAGES.openai_auth_error;
  }
  return null;
}

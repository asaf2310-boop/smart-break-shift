/** User-facing Hebrew messages for Gemini API failures. */

export function isGeminiHighDemandError(status, message = "") {
  const msg = String(message || "");
  const code = Number(status);
  return code === 503 || /high demand|overloaded|temporarily unavailable|spikes in demand/i.test(msg);
}

export function isGeminiRateLimitError(status, message = "") {
  const code = Number(status);
  const msg = String(message || "");
  return (
    code === 429 ||
    /rate limit|too many requests|requests per minute|per minute/i.test(msg)
  );
}

/**
 * @param {string} error — machine error code / ai_error string
 * @param {{ rateLimited?: boolean, highDemand?: boolean }} [flags]
 */
export function formatGeminiUserError(error, flags = {}) {
  const code = String(error || "");

  if (flags.rateLimited || isGeminiRateLimitError(null, code)) {
    return "מגבלת קצב ב-Gemini — נסו שוב בעוד רגע.";
  }
  if (flags.highDemand || isGeminiHighDemandError(null, code)) {
    return "שירות Gemini עמוס זמנית (ביקוש גבוה). נסו שוב בעוד דקה.";
  }
  if (code.includes("ai_not_configured") || code.includes("gemini_required")) {
    return "חיפוש ברשת דורש הגדרת GEMINI_API_KEY בשרת.";
  }
  if (code.includes("empty_response")) {
    return "לא התקבלה תשובה מחיפוש ברשת.";
  }
  if (code.includes("network") || code.includes("Failed to fetch")) {
    return "בעיית רשת — נסו שוב.";
  }
  return "חיפוש ברשת נכשל. נסו שוב בעוד רגע.";
}

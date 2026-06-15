/** Gemini + Google Search grounding — bypasses local RAG context. */

import { isGeminiConfigured, geminiGenerateWebSearchAnswer } from "../ai/geminiClient.js";
import { GEMINI_WEB_SEARCH_SYSTEM_PROMPT } from "./geminiKnowledgePrompt.js";
import { sanitizeAssistantAnswer } from "./assistantBidi.js";

/**
 * @param {string} query
 * @returns {Promise<{ hebrewAnswerMarkdown: string, webSources: Array<{ title: string, url: string }>, error?: string, retryAfterSec?: number, rateLimited?: boolean }>}
 */
export async function generateWebSearchAnswer(query) {
  const trimmed = String(query || "").replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return { hebrewAnswerMarkdown: "", webSources: [], error: "query_required" };
  }

  if (!isGeminiConfigured()) {
    return { hebrewAnswerMarkdown: "", webSources: [], error: "ai_not_configured" };
  }

  const result = await geminiGenerateWebSearchAnswer({
    systemInstruction: GEMINI_WEB_SEARCH_SYSTEM_PROMPT,
    userQuery: trimmed,
  });

  if (result.error) {
    return {
      hebrewAnswerMarkdown: "",
      webSources: result.webSources || [],
      error: result.error,
      retryAfterSec: result.retryAfterSec,
      rateLimited: result.rateLimited,
    };
  }

  const hebrewAnswerMarkdown = sanitizeAssistantAnswer(result.text || "");

  return {
    hebrewAnswerMarkdown: hebrewAnswerMarkdown || "לא התקבלה תשובה מחיפוש ברשת. נסו שוב.",
    webSources: result.webSources || [],
    webSearchQueries: result.groundingMetadata?.webSearchQueries || [],
  };
}

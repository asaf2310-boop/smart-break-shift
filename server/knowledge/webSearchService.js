/** Two-step web search: English Google Search → Hebrew localization. */

import {
  isGeminiConfigured,
  geminiGenerateWebSearchAnswer,
  geminiLocalizeWebSearchToHebrew,
} from "../ai/geminiClient.js";
import {
  GEMINI_WEB_SEARCH_ENGLISH_SYSTEM_PROMPT,
  GEMINI_WEB_SEARCH_HEBREW_LOCALIZE_SYSTEM_PROMPT,
} from "./geminiKnowledgePrompt.js";
import { sanitizeAssistantAnswer, sanitizeHebrewText } from "./assistantBidi.js";
import { formatGeminiUserError, isGeminiHighDemandError, isGeminiRateLimitError } from "./geminiErrorMessages.js";

function buildWebSearchError(result, partial = {}) {
  return {
    hebrewAnswerMarkdown: "",
    webSources: partial.webSources || [],
    error: result.error,
    userMessage: formatGeminiUserError(result.error, {
      rateLimited: result.rateLimited,
      highDemand: result.highDemand,
    }),
    retryAfterSec: result.retryAfterSec,
    rateLimited: result.rateLimited,
    highDemand: result.highDemand,
    modelsTried: result.modelsTried || [],
    pipelineStep: partial.pipelineStep || null,
  };
}

/**
 * @param {string} query
 * @returns {Promise<{ hebrewAnswerMarkdown: string, webSources: Array<{ title: string, url: string }>, error?: string, retryAfterSec?: number, rateLimited?: boolean, pipeline?: string }>}
 */
export async function generateWebSearchAnswer(query) {
  const trimmed = String(query || "").replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return { hebrewAnswerMarkdown: "", webSources: [], error: "query_required" };
  }

  if (!isGeminiConfigured()) {
    return { hebrewAnswerMarkdown: "", webSources: [], error: "ai_not_configured" };
  }

  // Step 1: Google Search → English factual summary
  const englishResult = await geminiGenerateWebSearchAnswer({
    systemInstruction: GEMINI_WEB_SEARCH_ENGLISH_SYSTEM_PROMPT,
    userQuery: trimmed,
    skipHebrewSanitize: true,
  });

  if (englishResult.error) {
    return buildWebSearchError(englishResult, { pipelineStep: "english_search" });
  }

  const englishDraft = String(englishResult.text || "").trim();
  if (!englishDraft) {
    return buildWebSearchError(
      { error: "empty_response", rateLimited: false, highDemand: false },
      { webSources: englishResult.webSources, pipelineStep: "english_search" },
    );
  }

  // Step 2: English → Hebrew Markdown (no tools)
  const hebrewResult = await geminiLocalizeWebSearchToHebrew({
    systemInstruction: GEMINI_WEB_SEARCH_HEBREW_LOCALIZE_SYSTEM_PROMPT,
    userQuestion: trimmed,
    englishDraft,
  });

  if (hebrewResult.error) {
    const statusMatch = String(hebrewResult.error).match(/ai_error:(\d+)/);
    const status = statusMatch ? Number(statusMatch[1]) : 500;
    return buildWebSearchError(
      {
        error: hebrewResult.error,
        rateLimited: hebrewResult.rateLimited || isGeminiRateLimitError(status, hebrewResult.error),
        highDemand: isGeminiHighDemandError(status, hebrewResult.error),
        retryAfterSec: hebrewResult.retryAfterSec,
      },
      { webSources: englishResult.webSources, pipelineStep: "hebrew_localize" },
    );
  }

  const hebrewAnswerMarkdown = sanitizeAssistantAnswer(
    sanitizeHebrewText(hebrewResult.text || ""),
  );

  return {
    hebrewAnswerMarkdown: hebrewAnswerMarkdown || "לא התקבלה תשובה מחיפוש ברשת. נסו שוב.",
    webSources: englishResult.webSources || [],
    webSearchQueries: englishResult.groundingMetadata?.webSearchQueries || [],
    pipeline: "two_step_en_then_he",
    modelUsed: englishResult.modelUsed || null,
  };
}

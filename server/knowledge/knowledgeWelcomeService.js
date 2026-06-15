/** Knowledge chat welcome message — Gemini with strict Hebrew + sanitizer fallback. */

import { geminiGenerateText } from "../ai/geminiClient.js";
import { GEMINI_KNOWLEDGE_WELCOME_SYSTEM_PROMPT } from "./geminiKnowledgePrompt.js";
import { sanitizeAssistantAnswer } from "./assistantBidi.js";
import { advancedHebrewPostProcess } from "./sanitizeHebrewText.js";

/** Static fallback — short, active Hebrew; safe if Gemini is unavailable. */
export const KNOWLEDGE_WELCOME_FALLBACK =
  "שלום! שאלו כאן שאלות על המסמכים. כל תשובה תציין את המקור.";

function finalizeWelcomeText(text) {
  const raw = String(text || "").trim();
  if (!raw) return KNOWLEDGE_WELCOME_FALLBACK;
  return sanitizeAssistantAnswer(advancedHebrewPostProcess(raw)) || KNOWLEDGE_WELCOME_FALLBACK;
}

/**
 * @returns {Promise<{ message: string, source: "gemini" | "fallback", error?: string | null }>}
 */
export async function generateKnowledgeWelcomeMessage() {
  const result = await geminiGenerateText({
    system: GEMINI_KNOWLEDGE_WELCOME_SYSTEM_PROMPT,
    user: "כתוב הודעת פתיחה לנציג שמתחיל לעבוד עם צ'אט הידע.",
    maxTokens: 100,
    temperature: 0.1,
  });

  if (result.error || !result.text?.trim()) {
    return {
      message: finalizeWelcomeText(KNOWLEDGE_WELCOME_FALLBACK),
      source: "fallback",
      error: result.error || null,
    };
  }

  return {
    message: finalizeWelcomeText(result.text),
    source: "gemini",
    error: null,
  };
}

export function getKnowledgeWelcomeFallback() {
  return finalizeWelcomeText(KNOWLEDGE_WELCOME_FALLBACK);
}

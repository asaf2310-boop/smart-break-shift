/** Unified AI provider — Gemini (default) or OpenAI fallback. */

import {
  isGeminiConfigured,
  getGeminiChatModel,
  getGeminiEmbedModel,
  geminiGenerateText,
  geminiEmbedTexts,
  geminiOcrImage,
} from "./geminiClient.js";
import {
  isOpenAiConfigured,
  getOpenAiChatModel,
  getOpenAiEmbedModel,
  openAiGenerateText,
  openAiEmbedTexts,
  openAiOcrImage,
} from "./openaiClient.js";

/** @returns {"gemini" | "openai" | "none"} */
export function getAiProvider() {
  const forced = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (forced === "gemini" && isGeminiConfigured()) return "gemini";
  if (forced === "openai" && isOpenAiConfigured()) return "openai";
  if (!forced || forced === "auto") {
    if (isGeminiConfigured()) return "gemini";
    if (isOpenAiConfigured()) return "openai";
  }
  return "none";
}

export function isAiConfigured() {
  return getAiProvider() !== "none";
}

export function getChatModel() {
  return getAiProvider() === "openai" ? getOpenAiChatModel() : getGeminiChatModel();
}

export function getEmbedModel() {
  return getAiProvider() === "openai" ? getOpenAiEmbedModel() : getGeminiEmbedModel();
}

export function getEmbeddingDimensions() {
  return getAiProvider() === "openai" ? 1536 : 768;
}

export async function generateText(options) {
  if (getAiProvider() === "openai") return openAiGenerateText(options);
  if (getAiProvider() === "gemini") return geminiGenerateText(options);
  return { text: null, error: "ai_not_configured", retryAfterSec: null, rateLimited: false };
}

export async function embedTexts(texts) {
  if (getAiProvider() === "openai") return openAiEmbedTexts(texts);
  if (getAiProvider() === "gemini") return geminiEmbedTexts(texts);
  return { embeddings: null, error: "ai_not_configured", retryAfterSec: null };
}

export async function ocrImage(imageDataUrl, meta) {
  if (getAiProvider() === "openai") return openAiOcrImage(imageDataUrl, meta);
  if (getAiProvider() === "gemini") return geminiOcrImage(imageDataUrl, meta);
  return { ocrText: "", description: "", error: "ai_not_configured" };
}

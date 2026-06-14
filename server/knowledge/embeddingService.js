/** AI embeddings for server-side RAG ingest and query. */

import { embedTexts as providerEmbedTexts, getEmbedModel, isAiConfigured } from "../ai/aiProvider.js";

const MAX_BATCH = 64;

export function getEmbedModelName() {
  return getEmbedModel();
}

export function isEmbeddingConfigured() {
  return isAiConfigured();
}

/** Build embedding input with metadata prefix (matches client RAG). */
export function buildEmbeddingInput(chunk) {
  const meta = [
    chunk.documentName || chunk.documentTitle,
    chunk.category ? `קטגוריה: ${chunk.category}` : null,
    chunk.sectionTitle ? `סעיף: ${chunk.sectionTitle}` : null,
    chunk.pageNumber != null ? `עמוד ${chunk.pageNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return meta ? `${meta}\n${chunk.text}` : chunk.text;
}

export function buildQueryEmbeddingInput(query) {
  const q = String(query || "").replace(/\s+/g, " ").trim();
  return q ? `שאלה: ${q}` : "";
}

/**
 * @param {string[]} texts
 * @returns {Promise<{ embeddings: number[][] | null, error: string | null, retryAfterSec: number | null }>}
 */
export async function embedTexts(texts) {
  if (!isAiConfigured()) {
    return { embeddings: null, error: "ai_not_configured", retryAfterSec: null };
  }

  const inputs = (texts || []).map((t) => String(t || "").trim()).filter(Boolean);
  if (!inputs.length) {
    return { embeddings: [], error: null, retryAfterSec: null };
  }

  const allEmbeddings = [];

  for (let offset = 0; offset < inputs.length; offset += MAX_BATCH) {
    const batch = inputs.slice(offset, offset + MAX_BATCH);
    const { embeddings, error, retryAfterSec } = await providerEmbedTexts(batch);
    if (error || !embeddings) {
      return { embeddings: null, error, retryAfterSec };
    }
    allEmbeddings.push(...embeddings);
  }

  return { embeddings: allEmbeddings, error: null, retryAfterSec: null };
}

export async function embedQuery(query) {
  const input = buildQueryEmbeddingInput(query);
  if (!input) return { embedding: null, error: "empty_query", retryAfterSec: null };
  const { embeddings, error, retryAfterSec } = await embedTexts([input]);
  return { embedding: embeddings?.[0] ?? null, error, retryAfterSec };
}

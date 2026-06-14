/** OpenAI embeddings for server-side RAG ingest and query. */

import { fetchOpenAiWithRetry, getRetryAfterSec } from "../../openaiRetry.js";

const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_MODEL = "text-embedding-3-small";
const MAX_BATCH = 64;

function getApiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

export function getEmbedModel() {
  return String(process.env.OPENAI_EMBED_MODEL || DEFAULT_MODEL).trim();
}

export function isEmbeddingConfigured() {
  return Boolean(getApiKey());
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
  const apiKey = getApiKey();
  if (!apiKey) {
    return { embeddings: null, error: "openai_not_configured", retryAfterSec: null };
  }

  const inputs = (texts || []).map((t) => String(t || "").trim()).filter(Boolean);
  if (!inputs.length) {
    return { embeddings: [], error: null, retryAfterSec: null };
  }

  const model = getEmbedModel();
  const allEmbeddings = [];

  for (let offset = 0; offset < inputs.length; offset += MAX_BATCH) {
    const batch = inputs.slice(offset, offset + MAX_BATCH);
    const openaiRes = await fetchOpenAiWithRetry(OPENAI_EMBED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: batch }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => "");
      const retryAfterSec = openaiRes.status === 429 ? getRetryAfterSec(openaiRes) : null;
      return {
        embeddings: null,
        error: `openai_error:${openaiRes.status}:${errText.slice(0, 80)}`,
        retryAfterSec,
      };
    }

    const data = await openaiRes.json();
    const batchEmbeddings = (data.data || [])
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((row) => row.embedding);
    allEmbeddings.push(...batchEmbeddings);
  }

  return { embeddings: allEmbeddings, error: null, retryAfterSec: null };
}

export async function embedQuery(query) {
  const input = buildQueryEmbeddingInput(query);
  if (!input) return { embedding: null, error: "empty_query", retryAfterSec: null };
  const { embeddings, error, retryAfterSec } = await embedTexts([input]);
  return { embedding: embeddings?.[0] ?? null, error, retryAfterSec };
}

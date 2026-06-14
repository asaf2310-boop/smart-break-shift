/** OpenAI — chat, embeddings, vision (legacy / fallback). */

import { fetchOpenAiWithRetry, getRetryAfterSec } from "../openaiRetry.js";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const EMBED_URL = "https://api.openai.com/v1/embeddings";

function getApiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

export function getOpenAiChatModel() {
  return String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
}

export function getOpenAiEmbedModel() {
  return String(process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small").trim();
}

export function isOpenAiConfigured() {
  return Boolean(getApiKey());
}

function parseError(status, bodyText) {
  return `ai_error:${status}:${String(bodyText || "").slice(0, 120)}`;
}

/**
 * @param {{ system: string, user: string, maxTokens?: number, temperature?: number }}
 */
export async function openAiGenerateText({ system, user, maxTokens = 480, temperature = 0.2 }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { text: null, error: "ai_not_configured", retryAfterSec: null, rateLimited: false };
  }

  const res = await fetchOpenAiWithRetry(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getOpenAiChatModel(),
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      text: null,
      error: parseError(res.status, errText),
      retryAfterSec: res.status === 429 ? getRetryAfterSec(res) : null,
      rateLimited: res.status === 429,
    };
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || null;
  return { text, error: null, retryAfterSec: null, rateLimited: false };
}

/**
 * @param {string[]} texts
 */
export async function openAiEmbedTexts(texts) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { embeddings: null, error: "ai_not_configured", retryAfterSec: null };
  }

  const inputs = (texts || []).map((t) => String(t || "").trim()).filter(Boolean);
  if (!inputs.length) {
    return { embeddings: [], error: null, retryAfterSec: null };
  }

  const res = await fetchOpenAiWithRetry(EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: getOpenAiEmbedModel(), input: inputs }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      embeddings: null,
      error: parseError(res.status, errText),
      retryAfterSec: res.status === 429 ? getRetryAfterSec(res) : null,
    };
  }

  const data = await res.json();
  const embeddings = (data.data || [])
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((row) => row.embedding);

  return { embeddings, error: null, retryAfterSec: null };
}

/**
 * @param {string} imageDataUrl
 * @param {{ fileName?: string, pageNumber?: number }} meta
 */
export async function openAiOcrImage(imageDataUrl, meta = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ocrText: "", description: "", error: "ai_not_configured" };
  }

  const imageUrl = String(imageDataUrl || "").trim();
  if (!imageUrl) {
    return { ocrText: "", description: "", error: "empty_image" };
  }

  const contextHint = [
    meta.fileName ? `קובץ: ${meta.fileName}` : null,
    meta.pageNumber != null ? `עמוד ${meta.pageNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const res = await fetchOpenAiWithRetry(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getOpenAiChatModel(),
      temperature: 0.1,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: `אתה מומחה OCR לעברית. החזר JSON: {"ocr_text":"...","description":"..."}`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: `חלץ טקסט.${contextHint ? `\n${contextHint}` : ""}` },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      ocrText: "",
      description: "",
      error: parseError(res.status, errText),
      retryAfterSec: res.status === 429 ? getRetryAfterSec(res) : null,
    };
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || "";

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    return {
      ocrText: String(parsed.ocr_text || parsed.ocrText || "").trim(),
      description: String(parsed.description || "").trim(),
      error: null,
    };
  } catch {
    return {
      ocrText: raw.trim(),
      description: meta.fileName ? `תמונה: ${meta.fileName}` : "תמונה",
      error: null,
    };
  }
}

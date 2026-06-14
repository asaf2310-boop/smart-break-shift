/** Google Gemini — chat, embeddings, vision OCR, structured SDK responses. */

import { GoogleGenAI } from "@google/genai";
import { fetchOpenAiWithRetry, getRetryAfterSec } from "../openaiRetry.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey() {
  return String(process.env.GEMINI_API_KEY || "").trim();
}

export function getGeminiChatModel() {
  return String(process.env.GEMINI_CHAT_MODEL || "gemini-2.0-flash").trim();
}

export function getGeminiEmbedModel() {
  return String(process.env.GEMINI_EMBED_MODEL || "text-embedding-004").trim();
}

export function isGeminiConfigured() {
  return Boolean(getApiKey());
}

/** Structured agent JSON schema — Hebrew answer + relevant screenshot URLs. */
export const AGENT_STRUCTURED_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    hebrewAnswerMarkdown: {
      type: "STRING",
      description: "The formatting answer in Hebrew Markdown",
    },
    relevantImageUrlsToDisplay: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "List of URLs of the screenshots that the agent should see",
    },
  },
  required: ["hebrewAnswerMarkdown", "relevantImageUrlsToDisplay"],
};

let sdkClient = null;

function getSdkClient() {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  if (!sdkClient) {
    sdkClient = new GoogleGenAI({ apiKey });
  }
  return sdkClient;
}

export function isGeminiSdkAvailable() {
  return Boolean(getSdkClient());
}

/**
 * Structured agent response via @google/genai SDK.
 * @param {{ systemInstruction: string, contents: Array<{ text?: string, inlineData?: { mimeType: string, data: string } }>, model?: string, maxOutputTokens?: number, temperature?: number }}
 */
export async function geminiGenerateStructuredAgentResponse({
  systemInstruction,
  contents,
  model,
  maxOutputTokens = 720,
  temperature = 0.15,
}) {
  const ai = getSdkClient();
  if (!ai) {
    return { parsed: null, text: null, error: "ai_not_configured", retryAfterSec: null, rateLimited: false };
  }

  try {
    const response = await ai.models.generateContent({
      model: model || getGeminiChatModel(),
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: AGENT_STRUCTURED_RESPONSE_SCHEMA,
        temperature,
        maxOutputTokens,
      },
    });

    const text = String(response.text || "").trim();
    if (!text) {
      return { parsed: null, text: null, error: "empty_response", retryAfterSec: null, rateLimited: false };
    }

    try {
      const parsed = JSON.parse(text);
      return { parsed, text, error: null, retryAfterSec: null, rateLimited: false };
    } catch {
      return { parsed: null, text, error: "json_parse_failed", retryAfterSec: null, rateLimited: false };
    }
  } catch (err) {
    const status = err?.status ?? err?.code ?? 500;
    const is429 = status === 429;
    return {
      parsed: null,
      text: null,
      error: `ai_error:${status}:${String(err?.message || "").slice(0, 120)}`,
      retryAfterSec: is429 ? getRetryAfterSec({ headers: { get: () => err?.headers?.["retry-after"] } }) : null,
      rateLimited: is429,
    };
  }
}

function modelPath(model) {
  const name = String(model || "").replace(/^models\//, "");
  return `models/${name}`;
}

function geminiUrl(model, action) {
  const key = getApiKey();
  return `${GEMINI_BASE}/${modelPath(model)}:${action}?key=${encodeURIComponent(key)}`;
}

function parseGeminiError(status, bodyText) {
  return `ai_error:${status}:${String(bodyText || "").slice(0, 120)}`;
}

/**
 * @param {{ system: string, user: string, maxTokens?: number, temperature?: number }}
 */
export async function geminiGenerateText({ system, user, maxTokens = 480, temperature = 0.2 }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { text: null, error: "ai_not_configured", retryAfterSec: null, rateLimited: false };
  }

  const model = getGeminiChatModel();
  const res = await fetchOpenAiWithRetry(
    geminiUrl(model, "generateContent"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      text: null,
      error: parseGeminiError(res.status, errText),
      retryAfterSec: res.status === 429 ? getRetryAfterSec(res) : null,
      rateLimited: res.status === 429,
    };
  }

  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim() || null;

  return { text, error: null, retryAfterSec: null, rateLimited: false };
}

/**
 * Multimodal generateContent — text + optional inline images.
 * @param {{ system: string, userParts: Array<{ text?: string, inline_data?: { mime_type: string, data: string } }>, maxTokens?: number, temperature?: number }}
 */
export async function geminiGenerateMultimodal({ system, userParts, maxTokens = 560, temperature = 0.15 }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { text: null, error: "ai_not_configured", retryAfterSec: null, rateLimited: false };
  }

  const model = getGeminiChatModel();
  const res = await fetchOpenAiWithRetry(
    geminiUrl(model, "generateContent"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: userParts }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      text: null,
      error: parseGeminiError(res.status, errText),
      retryAfterSec: res.status === 429 ? getRetryAfterSec(res) : null,
      rateLimited: res.status === 429,
    };
  }

  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim() || null;

  return { text, error: null, retryAfterSec: null, rateLimited: false };
}

/**
 * @param {string[]} texts
 */
export async function geminiEmbedTexts(texts) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { embeddings: null, error: "ai_not_configured", retryAfterSec: null };
  }

  const inputs = (texts || []).map((t) => String(t || "").trim()).filter(Boolean);
  if (!inputs.length) {
    return { embeddings: [], error: null, retryAfterSec: null };
  }

  const model = getGeminiEmbedModel();
  const allEmbeddings = [];
  const BATCH = 20;

  for (let offset = 0; offset < inputs.length; offset += BATCH) {
    const batch = inputs.slice(offset, offset + BATCH);
    const res = await fetchOpenAiWithRetry(
      geminiUrl(model, "batchEmbedContents"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: modelPath(model),
            content: { parts: [{ text }] },
          })),
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        embeddings: null,
        error: parseGeminiError(res.status, errText),
        retryAfterSec: res.status === 429 ? getRetryAfterSec(res) : null,
      };
    }

    const data = await res.json();
    const batchEmbeddings = (data.embeddings || []).map((row) => row.values || []);
    allEmbeddings.push(...batchEmbeddings);
  }

  return { embeddings: allEmbeddings, error: null, retryAfterSec: null };
}

/**
 * @param {string} imageDataUrl
 * @param {{ fileName?: string, pageNumber?: number }} meta
 */
export async function geminiOcrImage(imageDataUrl, meta = {}) {
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

  let mimeType = "image/jpeg";
  let base64Data = "";

  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }
  } else {
    return { ocrText: "", description: "", error: "remote_image_url_not_supported" };
  }

  const model = getGeminiChatModel();
  const res = await fetchOpenAiWithRetry(
    geminiUrl(model, "generateContent"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: `אתה מומחה OCR לעברית. חלץ את כל הטקסט מהתמונה בדיוק, עם רווחים נכונים.
החזר JSON בלבד: {"ocr_text":"...","description":"..."}
description — כיתוב קצר (עד 120 תווים).`,
          }],
        },
        contents: [{
          role: "user",
          parts: [
            { text: `חלץ טקסט ותיאור קצר.${contextHint ? `\n${contextHint}` : ""}` },
            { inline_data: { mime_type: mimeType, data: base64Data } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 900 },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      ocrText: "",
      description: "",
      error: parseGeminiError(res.status, errText),
      retryAfterSec: res.status === 429 ? getRetryAfterSec(res) : null,
    };
  }

  const data = await res.json();
  const raw =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim() || "";

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
      ocrText: raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim(),
      description: meta.fileName ? `תמונה: ${meta.fileName}` : "תמונה ממסמך",
      error: null,
    };
  }
}

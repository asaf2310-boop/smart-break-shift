/** Google Gemini — chat, embeddings, vision OCR, structured SDK responses. */

import { GoogleGenAI } from "@google/genai";
import { fetchOpenAiWithRetry, getRetryAfterSec } from "../openaiRetry.js";
import { sanitizeHebrewText } from "../knowledge/sanitizeHebrewText.js";
import { isGeminiHighDemandError, isGeminiRateLimitError } from "../knowledge/geminiErrorMessages.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey() {
  return String(process.env.GEMINI_API_KEY || "").trim();
}

export function getGeminiChatModel() {
  return String(process.env.GEMINI_CHAT_MODEL || "gemini-2.0-flash-lite").trim();
}

/** Model for Google Search grounding — stable default with optional override. */
export function getGeminiWebSearchModel() {
  const explicit = String(process.env.GEMINI_WEB_SEARCH_MODEL || "").trim();
  if (explicit) return explicit.replace(/^models\//, "");
  const chat = getGeminiChatModel().replace(/^models\//, "");
  if (/gemini-2\.5|gemini-3/i.test(chat)) return chat;
  return "gemini-2.0-flash";
}

/** Models to try for web search when the primary is overloaded (503). */
export function getGeminiWebSearchModelCandidates() {
  const seen = new Set();
  const candidates = [
    getGeminiWebSearchModel(),
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
  ];
  return candidates.filter((model) => {
    const name = String(model || "").replace(/^models\//, "").trim();
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEPRECATED_GEMINI_EMBED_MODELS = new Set(["text-embedding-004", "embedding-001"]);

export function getGeminiEmbedModel() {
  const raw = String(process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001").trim();
  const name = raw.replace(/^models\//, "");
  if (DEPRECATED_GEMINI_EMBED_MODELS.has(name)) {
    return "gemini-embedding-001";
  }
  return name;
}

/** Keep pgvector column width (768) when using gemini-embedding-001 (default 3072). */
export function getGeminiEmbedOutputDimensionality() {
  const n = Number(process.env.GEMINI_EMBED_DIMENSIONS || 768);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 768;
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
      if (parsed?.hebrewAnswerMarkdown) {
        parsed.hebrewAnswerMarkdown = sanitizeHebrewText(parsed.hebrewAnswerMarkdown);
      }
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

function extractGeminiResponseTextRaw(data) {
  const raw =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim() || "";
  return raw || null;
}

function extractGeminiResponseText(data) {
  const raw = extractGeminiResponseTextRaw(data);
  return raw ? sanitizeHebrewText(raw) : null;
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
  const text = extractGeminiResponseText(data);

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
  const text = extractGeminiResponseText(data);

  return { text, error: null, retryAfterSec: null, rateLimited: false };
}

/**
 * @param {string[]} texts
 */
function extractEmbeddingVectors(embeddingsPayload) {
  return (embeddingsPayload || []).map((row) => {
    if (Array.isArray(row)) return row;
    if (Array.isArray(row?.values)) return row.values;
    if (Array.isArray(row?.embedding?.values)) return row.embedding.values;
    return [];
  });
}

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
  const outputDimensionality = getGeminiEmbedOutputDimensionality();
  const allEmbeddings = [];
  const BATCH = 20;

  const ai = getSdkClient();
  if (ai) {
    try {
      for (let offset = 0; offset < inputs.length; offset += BATCH) {
        const batch = inputs.slice(offset, offset + BATCH);
        const result = await ai.models.embedContent({
          model,
          contents: batch,
          config: { outputDimensionality },
        });
        const vectors = extractEmbeddingVectors(result.embeddings);
        if (vectors.length !== batch.length || vectors.some((v) => !v.length)) {
          throw new Error("invalid_sdk_embedding_response");
        }
        allEmbeddings.push(...vectors);
      }
      return { embeddings: allEmbeddings, error: null, retryAfterSec: null };
    } catch (err) {
      const status = err?.status ?? err?.code ?? 500;
      if (status === 429) {
        return {
          embeddings: null,
          error: `ai_error:429:${String(err?.message || "").slice(0, 120)}`,
          retryAfterSec: getRetryAfterSec({ headers: { get: () => err?.headers?.["retry-after"] } }),
        };
      }
      console.warn("[geminiEmbedTexts] SDK failed, trying REST", String(err?.message || err).slice(0, 160));
    }
  }

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
            outputDimensionality,
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
    const batchEmbeddings = extractEmbeddingVectors(data.embeddings);
    allEmbeddings.push(...batchEmbeddings);
  }

  return { embeddings: allEmbeddings, error: null, retryAfterSec: null };
}

/** Parse grounding chunks into { title, url } for the agent UI. */
export function extractWebSourcesFromGroundingMetadata(groundingMetadata) {
  const chunks = groundingMetadata?.groundingChunks || [];
  const seen = new Set();
  const sources = [];

  for (const chunk of chunks) {
    const web = chunk?.web;
    if (!web?.uri) continue;
    const url = String(web.uri).trim();
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      title: String(web.title || web.domain || url).trim() || url,
      url,
    });
  }

  return sources;
}

/**
 * Gemini answer with Google Search grounding (live web).
 * Retries on 503/429 and falls back across models when overloaded.
 * @param {{ systemInstruction: string, userQuery: string, model?: string, maxOutputTokens?: number, temperature?: number, skipHebrewSanitize?: boolean }}
 */
export async function geminiGenerateWebSearchAnswer({
  systemInstruction,
  userQuery,
  model,
  maxOutputTokens = 720,
  temperature = 0.2,
  skipHebrewSanitize = false,
}) {
  const query = String(userQuery || "").trim();
  if (!query) {
    return {
      text: null,
      webSources: [],
      groundingMetadata: null,
      error: "query_required",
      retryAfterSec: null,
      rateLimited: false,
      highDemand: false,
      modelsTried: [],
    };
  }

  const models = model
    ? [String(model).replace(/^models\//, "")]
    : getGeminiWebSearchModelCandidates();
  const ai = getSdkClient();
  const apiKey = getApiKey();

  if (!ai && !apiKey) {
    return {
      text: null,
      webSources: [],
      groundingMetadata: null,
      error: "ai_not_configured",
      retryAfterSec: null,
      rateLimited: false,
      highDemand: false,
      modelsTried: [],
    };
  }

  let lastError = null;
  let lastHighDemand = false;
  let lastRateLimited = false;
  let lastRetryAfterSec = null;
  const modelsTried = [];

  for (const searchModel of models) {
    modelsTried.push(searchModel);

    for (let attempt = 0; attempt <= 2; attempt += 1) {
      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: searchModel,
            contents: [{ role: "user", parts: [{ text: query }] }],
            config: {
              systemInstruction,
              tools: [{ googleSearch: {} }],
              temperature,
              maxOutputTokens,
            },
          });

          const rawText = String(response.text || "").trim();
          const text = skipHebrewSanitize ? rawText : sanitizeHebrewText(rawText);
          const groundingMetadata =
            response.candidates?.[0]?.groundingMetadata ?? response.groundingMetadata ?? null;
          const webSources = extractWebSourcesFromGroundingMetadata(groundingMetadata);

          if (!text) {
            return {
              text: null,
              webSources,
              groundingMetadata,
              error: "empty_response",
              retryAfterSec: null,
              rateLimited: false,
              highDemand: false,
              modelsTried,
              modelUsed: searchModel,
            };
          }

          return {
            text,
            webSources,
            groundingMetadata,
            error: null,
            retryAfterSec: null,
            rateLimited: false,
            highDemand: false,
            modelsTried,
            modelUsed: searchModel,
          };
        } catch (err) {
          const status = err?.status ?? err?.code ?? 500;
          const message = String(err?.message || "");
          const highDemand = isGeminiHighDemandError(status, message);
          const rateLimited = isGeminiRateLimitError(status, message);
          lastError = `ai_error:${status}:${message.slice(0, 120)}`;
          lastHighDemand = highDemand;
          lastRateLimited = rateLimited;
          lastRetryAfterSec = rateLimited
            ? getRetryAfterSec({ headers: { get: () => err?.headers?.["retry-after"] } })
            : null;

          if ((highDemand || rateLimited) && attempt < 2) {
            await sleep(1000 * 2 ** attempt);
            continue;
          }
          if (highDemand || rateLimited) break;
          return {
            text: null,
            webSources: [],
            groundingMetadata: null,
            error: lastError,
            retryAfterSec: lastRetryAfterSec,
            rateLimited,
            highDemand,
            modelsTried,
          };
        }
      } else {
        const res = await fetchOpenAiWithRetry(
          geminiUrl(searchModel, "generateContent"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents: [{ role: "user", parts: [{ text: query }] }],
              tools: [{ google_search: {} }],
              generationConfig: {
                temperature,
                maxOutputTokens,
              },
            }),
          },
        );

        if (res.ok) {
          const data = await res.json();
          const text = skipHebrewSanitize
            ? extractGeminiResponseTextRaw(data)
            : extractGeminiResponseText(data);
          const groundingMetadata = data.candidates?.[0]?.groundingMetadata ?? null;
          const webSources = extractWebSourcesFromGroundingMetadata(groundingMetadata);

          if (!text) {
            return {
              text: null,
              webSources,
              groundingMetadata,
              error: "empty_response",
              retryAfterSec: null,
              rateLimited: false,
              highDemand: false,
              modelsTried,
              modelUsed: searchModel,
            };
          }

          return {
            text,
            webSources,
            groundingMetadata,
            error: null,
            retryAfterSec: null,
            rateLimited: false,
            highDemand: false,
            modelsTried,
            modelUsed: searchModel,
          };
        }

        const errText = await res.text().catch(() => "");
        const highDemand = isGeminiHighDemandError(res.status, errText);
        const rateLimited = isGeminiRateLimitError(res.status, errText);
        lastError = parseGeminiError(res.status, errText);
        lastHighDemand = highDemand;
        lastRateLimited = rateLimited;
        lastRetryAfterSec = rateLimited ? getRetryAfterSec(res) : null;

        if (highDemand || rateLimited) break;
        return {
          text: null,
          webSources: [],
          groundingMetadata: null,
          error: lastError,
          retryAfterSec: lastRetryAfterSec,
          rateLimited,
          highDemand,
          modelsTried,
        };
      }
    }
  }

  return {
    text: null,
    webSources: [],
    groundingMetadata: null,
    error: lastError || "ai_error:503:all_models_failed",
    retryAfterSec: lastRetryAfterSec,
    rateLimited: lastRateLimited,
    highDemand: lastHighDemand,
    modelsTried,
  };
}

/**
 * Step 2 of web search — localize English draft to Hebrew Markdown (no tools).
 * @param {{ systemInstruction: string, userQuestion: string, englishDraft: string, maxOutputTokens?: number, temperature?: number }}
 */
export async function geminiLocalizeWebSearchToHebrew({
  systemInstruction,
  userQuestion,
  englishDraft,
  maxOutputTokens = 720,
  temperature = 0.15,
}) {
  const question = String(userQuestion || "").trim();
  const draft = String(englishDraft || "").trim();
  if (!draft) {
    return { text: null, error: "empty_english_draft", retryAfterSec: null, rateLimited: false };
  }

  const user = `User question (may be Hebrew): ${question || "(not provided)"}

English research summary — translate and format for a Hebrew-speaking support agent:

${draft}`;

  return geminiGenerateText({
    system: systemInstruction,
    user,
    maxTokens: maxOutputTokens,
    temperature,
  });
}

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
אל תעתיק מילים מחוברות או שבורות — נסח עברית טבעית ותקינה.
מונחים באנגלית מהתמונה: שמור אותם באנגלית, מופרדים מהעברית.
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

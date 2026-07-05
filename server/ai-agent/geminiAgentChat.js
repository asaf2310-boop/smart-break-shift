import { fetchOpenAiWithRetry } from "../openaiRetry.js";
import { getGeminiChatModel, isGeminiConfigured } from "../ai/geminiClient.js";
import {
  getGeminiRetryDelayMs,
  isGeminiDailyQuotaError,
  logGeminiApiError,
  mapGeminiHttpError,
} from "../ai/geminiErrors.js";
import { AGENT_TOOLS_GEMINI } from "./agentTools.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Only used on 404 / model-not-found — never on 429 (would triple RPM spend). */
const MODEL_FALLBACKS = ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash-latest"];

function getApiKey() {
  return String(process.env.GEMINI_API_KEY || "").trim();
}

function modelPath(model) {
  const name = String(model || "").replace(/^models\//, "");
  return `models/${name}`;
}

function geminiUrl(model) {
  const key = getApiKey();
  return `${GEMINI_BASE}/${modelPath(model)}:generateContent?key=${encodeURIComponent(key)}`;
}

export function getAgentGeminiModelCandidates() {
  const primary = getGeminiChatModel().replace(/^models\//, "");
  const seen = new Set();
  return [primary, ...MODEL_FALLBACKS].filter((name) => {
    const model = String(name || "").trim();
    if (!model || seen.has(model)) return false;
    seen.add(model);
    return true;
  });
}

export function isGeminiAgentConfigured() {
  return isGeminiConfigured();
}

export function getAgentGeminiModel() {
  return getGeminiChatModel();
}

/**
 * @param {string} model
 * @param {string} systemPrompt
 * @param {Array<{ role: string, parts: unknown[] }>} contents
 */
async function callGeminiAgentOnce(model, systemPrompt, contents) {
  return fetchOpenAiWithRetry(
    geminiUrl(model),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools: [{ functionDeclarations: AGENT_TOOLS_GEMINI }],
        toolConfig: { functionCallingConfig: { mode: "AUTO" } },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800,
        },
      }),
    },
    {
      maxRetries: 0,
      maxDelayMs: 20_000,
      parseBodyRetryMs: getGeminiRetryDelayMs,
      skipRetryIf: isGeminiDailyQuotaError,
    },
  );
}

/**
 * @param {string} systemPrompt
 * @param {Array<{ role: string, parts: unknown[] }>} contents
 */
export async function callGeminiAgent(systemPrompt, contents) {
  if (!isGeminiAgentConfigured()) {
    return {
      ok: false,
      error: "ai_not_configured",
      message: "סוכן AI לא מוגדר בשרת — חסר GEMINI_API_KEY ב-Vercel.",
    };
  }

  const models = getAgentGeminiModelCandidates();
  let lastStatus = 0;
  let lastErrText = "";
  let lastResponse = null;

  for (let i = 0; i < models.length; i += 1) {
    const model = models[i];
    let res;
    try {
      res = await callGeminiAgentOnce(model, systemPrompt, contents);
    } catch {
      return { ok: false, error: "ai_network_error", message: "שגיאת רשת בחיבור ל-Gemini — נסו שוב" };
    }

    if (res.ok) {
      try {
        const data = await res.json();
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const finishReason = candidate?.finishReason || null;
        return {
          ok: true,
          parts,
          finishReason,
          modelContent: candidate?.content || null,
          modelUsed: model,
        };
      } catch {
        return { ok: false, error: "ai_parse_error", message: "שגיאה בפענוח תגובת Gemini" };
      }
    }

    const errText = await res.text().catch(() => "");
    lastStatus = res.status;
    lastErrText = errText;
    lastResponse = res;

    console.error("[callGeminiAgent] Gemini API error", {
      status: res.status,
      model,
      attempt: i + 1,
      modelsTried: models.slice(0, i + 1),
      body: errText.slice(0, 800),
    });
    logGeminiApiError("callGeminiAgent", res.status, errText, { model, attempt: i + 1 });

    const isRateOrQuota =
      res.status === 429 ||
      /"status"\s*:\s*"RESOURCE_EXHAUSTED"/i.test(errText);
    const isModelMissing =
      !isRateOrQuota &&
      (res.status === 404 ||
        /model.*not found|not found for api version|is not supported/i.test(errText));
    if (isModelMissing && i < models.length - 1) {
      continue;
    }

    const mapped = mapGeminiHttpError(res.status, errText, res);
    return { ok: false, error: mapped.error, message: mapped.message };
  }

  const mapped = mapGeminiHttpError(lastStatus, lastErrText, lastResponse);
  return { ok: false, error: mapped.error, message: mapped.message };
}

export { geminiUrl as buildGeminiAgentUrl };

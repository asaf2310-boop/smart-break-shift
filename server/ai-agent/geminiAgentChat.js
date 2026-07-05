import { fetchOpenAiWithRetry } from "../openaiRetry.js";
import { getGeminiChatModel, isGeminiConfigured } from "../ai/geminiClient.js";
import { mapGeminiHttpError } from "../ai/geminiErrors.js";
import { AGENT_TOOLS_GEMINI } from "./agentTools.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

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

export function isGeminiAgentConfigured() {
  return isGeminiConfigured();
}

export function getAgentGeminiModel() {
  return getGeminiChatModel();
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

  const model = getAgentGeminiModel();
  let res;
  try {
    res = await fetchOpenAiWithRetry(
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
    );
  } catch {
    return { ok: false, error: "ai_network_error", message: "שגיאת רשת בחיבור ל-Gemini — נסו שוב" };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const mapped = mapGeminiHttpError(res.status, errText, res);
    return { ok: false, error: mapped.error, message: mapped.message };
  }

  try {
    const data = await res.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const finishReason = candidate?.finishReason || null;
    return { ok: true, parts, finishReason, modelContent: candidate?.content || null };
  } catch {
    return { ok: false, error: "ai_parse_error", message: "שגיאה בפענוח תגובת Gemini" };
  }
}

export { geminiUrl as buildGeminiAgentUrl };

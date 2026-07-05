import { fetchOpenAiWithRetry } from "../openaiRetry.js";
import { getOpenAiChatModel, isOpenAiConfigured } from "../ai/openaiClient.js";
import { mapOpenAiHttpError } from "../ai/openaiErrors.js";
import { AGENT_TOOLS_OPENAI } from "./agentTools.js";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";

function getApiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

/**
 * @param {Array<{ role: string, content?: string, tool_calls?: unknown[], tool_call_id?: string }>} messages
 */
export async function callOpenAiAgent(messages) {
  if (!isOpenAiConfigured()) {
    return {
      ok: false,
      error: "ai_not_configured",
      message: "סוכן AI לא מוגדר בשרת — חסר OPENAI_API_KEY ב-Vercel.",
    };
  }

  const apiKey = getApiKey();
  let res;
  try {
    res = await fetchOpenAiWithRetry(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getOpenAiChatModel(),
        temperature: 0.3,
        max_tokens: 800,
        messages,
        tools: AGENT_TOOLS_OPENAI,
        tool_choice: "auto",
      }),
    });
  } catch {
    return { ok: false, error: "ai_network_error", message: "שגיאת רשת בחיבור ל-OpenAI — נסו שוב" };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const mapped = mapOpenAiHttpError(res.status, errText, res);
    return { ok: false, error: mapped.error, message: mapped.message };
  }

  try {
    const data = await res.json();
    const choice = data.choices?.[0];
    return { ok: true, message: choice?.message || null, finishReason: choice?.finish_reason };
  } catch {
    return { ok: false, error: "ai_parse_error", message: "שגיאה בפענוח תגובת OpenAI" };
  }
}

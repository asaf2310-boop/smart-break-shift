import { getAiProvider, isAiConfigured } from "../ai/aiProvider.js";
import { getBusinessData } from "./getBusinessData.js";
import { searchDocuments } from "./searchDocuments.js";
import { ALLOWED_TOOL_NAMES } from "./agentTools.js";
import { callGeminiAgent } from "./geminiAgentChat.js";
import { callOpenAiAgent } from "./openaiAgentChat.js";

const MAX_TOOL_ROUNDS = 5;
const MAX_GEMINI_TOOL_ROUNDS = 2;

const SYSTEM_PROMPT = `אתה סוכן AI עוזר לנציגי מוקד טלפוני בישראל.
ענה תמיד בעברית ברורה ומקצועית.
כשחסר מידע — שאל שאלת הבהרה לפני שאתה מסיק מסקנות.
כשצריך נתונים עסקיים (לקוחות, תורים, כרטיסים, שירותים) — השתמש בכלי getBusinessData.
כשצריך מידע ממסמכי ידע (נהלים, מדריכים, מדיניות) — השתמש בכלי searchDocuments וסכם בעברית.
אם searchDocuments מחזיר documentsUnavailable או "אין מסמכים זמינים" — אל תנסה שוב; ענה מ-getBusinessData או מידע כללי.
אל תמציא נתונים. אם הכלי נכשל, אין תוצאות, או הטבלה חסרה — הסבר לנציג בבירור.
הצג תשובות מסודרות; אם יש רשימות — השתמש בנקודות.`;

function notConfiguredMessage() {
  const provider = getAiProvider();
  if (provider === "openai") {
    return "סוכן AI לא מוגדר בשרת — חסר OPENAI_API_KEY ב-Vercel.";
  }
  return "סוכן AI לא מוגדר בשרת — חסר GEMINI_API_KEY ב-Vercel.";
}

/**
 * Gemini may return JSON-string tool args (e.g. filters) when schema uses type string.
 * @param {string} toolName
 * @param {Record<string, unknown>} args
 */
function normalizeGeminiToolArgs(toolName, args) {
  const out = { ...args };
  if (toolName === "getBusinessData" && typeof out.filters === "string") {
    const raw = String(out.filters || "").trim();
    if (!raw) {
      delete out.filters;
    } else {
      try {
        out.filters = JSON.parse(raw);
      } catch {
        out.filters = {};
      }
    }
  }
  return out;
}

/**
 * @param {string} toolName
 * @param {Record<string, unknown>} parsedArgs
 */
async function executeTool(toolName, parsedArgs) {
  try {
    return toolName === "searchDocuments"
      ? await searchDocuments(parsedArgs)
      : await getBusinessData(parsedArgs);
  } catch {
    return {
      ok: false,
      error: "tool_exception",
      message: "שגיאה בהרצת הכלי — נסו שוב או נסחו את השאלה אחרת",
    };
  }
}

/**
 * @param {string} userMessage
 */
export async function runAiAgent(userMessage) {
  try {
    return await runAiAgentInner(userMessage);
  } catch (err) {
    console.error("[runAiAgent] unexpected error", {
      message: err?.message,
      stack: err?.stack,
    });
    return {
      ok: false,
      error: "internal_error",
      message: "שגיאת שרת פנימית — נסו שוב בעוד רגע",
    };
  }
}

async function runAiAgentInner(userMessage) {
  const text = String(userMessage || "").trim();
  if (!text) {
    return { ok: false, error: "message_required", message: "נדרשת הודעה" };
  }
  if (text.length > 4000) {
    return { ok: false, error: "message_too_long", message: "ההודעה ארוכה מדי (מקסימום 4000 תווים)" };
  }

  if (!isAiConfigured()) {
    return {
      ok: false,
      error: "ai_not_configured",
      message: notConfiguredMessage(),
    };
  }

  const provider = getAiProvider();
  if (provider === "gemini") {
    return runGeminiAgentLoop(text);
  }
  return runOpenAiAgentLoop(text);
}

/**
 * @param {string} text
 */
async function runGeminiAgentLoop(text) {
  /** @type {Array<{ role: string, parts: unknown[] }>} */
  const contents = [{ role: "user", parts: [{ text }] }];

  for (let round = 0; round < MAX_GEMINI_TOOL_ROUNDS; round += 1) {
    const result = await callGeminiAgent(SYSTEM_PROMPT, contents);
    if (!result.ok) {
      return { ok: false, error: result.error, message: result.message };
    }

    const parts = result.parts || [];
    if (!parts.length) {
      return { ok: false, error: "empty_response", message: "לא התקבלה תשובה מהמודל" };
    }

    const functionCalls = parts.filter((p) => p.functionCall);
    if (!functionCalls.length) {
      const reply = parts
        .map((p) => p.text || "")
        .join("")
        .trim();
      return {
        ok: true,
        reply: reply || "לא הצלחתי לנסח תשובה. נסו לנסח מחדש.",
        toolRounds: round,
        provider: "gemini",
      };
    }

    contents.push({ role: "model", parts });

    /** @type {Array<{ functionResponse: { name: string, response: unknown } }>} */
    const responseParts = [];

    for (const part of functionCalls) {
      const toolName = part.functionCall?.name;
      const args = normalizeGeminiToolArgs(toolName, part.functionCall?.args || {});

      if (!ALLOWED_TOOL_NAMES.has(toolName)) {
        responseParts.push({
          functionResponse: {
            name: toolName || "unknown",
            response: { ok: false, error: "tool_not_allowed" },
          },
        });
        continue;
      }

      const toolResult = await executeTool(toolName, args);
      responseParts.push({
        functionResponse: {
          name: toolName,
          response: toolResult,
        },
      });
    }

    contents.push({ role: "user", parts: responseParts });
  }

  return {
    ok: false,
    error: "tool_loop_exceeded",
    message: "חריגה ממספר סיבובי כלים — נסו שאלה ממוקדת יותר.",
  };
}

/**
 * @param {string} text
 */
async function runOpenAiAgentLoop(text) {
  /** @type {Array<{ role: string, content?: string, tool_calls?: unknown[], tool_call_id?: string }>} */
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: text },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const result = await callOpenAiAgent(messages);
    if (!result.ok) {
      return { ok: false, error: result.error, message: result.message };
    }

    const assistantMsg = result.message;
    if (!assistantMsg) {
      return { ok: false, error: "empty_response", message: "לא התקבלה תשובה מהמודל" };
    }

    messages.push(assistantMsg);

    const toolCalls = assistantMsg.tool_calls;
    if (!toolCalls?.length) {
      const reply = String(assistantMsg.content || "").trim();
      return {
        ok: true,
        reply: reply || "לא הצלחתי לנסח תשובה. נסו לנסח מחדש.",
        toolRounds: round,
        provider: "openai",
      };
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type !== "function") {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ ok: false, error: "tool_not_allowed" }),
        });
        continue;
      }

      const toolName = toolCall.function?.name;
      if (!ALLOWED_TOOL_NAMES.has(toolName)) {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ ok: false, error: "tool_not_allowed" }),
        });
        continue;
      }

      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        parsedArgs = {};
      }

      const toolResult = await executeTool(toolName, parsedArgs);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  return {
    ok: false,
    error: "tool_loop_exceeded",
    message: "חריגה ממספר סיבובי כלים — נסו שאלה ממוקדת יותר.",
  };
}

export { SYSTEM_PROMPT };

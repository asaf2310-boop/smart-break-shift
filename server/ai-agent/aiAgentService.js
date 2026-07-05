import { fetchOpenAiWithRetry } from "../openaiRetry.js";
import { getOpenAiChatModel, isOpenAiConfigured } from "../ai/openaiClient.js";
import { getBusinessData, GET_BUSINESS_DATA_TOOL } from "./getBusinessData.js";
import { searchDocuments, SEARCH_DOCUMENTS_TOOL } from "./searchDocuments.js";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MAX_TOOL_ROUNDS = 5;

const SYSTEM_PROMPT = `אתה סוכן AI עוזר לנציגי מוקד טלפוני בישראל.
ענה תמיד בעברית ברורה ומקצועית.
כשחסר מידע — שאל שאלת הבהרה לפני שאתה מסיק מסקנות.
כשצריך נתונים עסקיים (לקוחות, תורים, כרטיסים, שירותים) — השתמש בכלי getBusinessData.
כשצריך מידע ממסמכי ידע (נהלים, מדריכים, מדיניות) — השתמש בכלי searchDocuments וסכם בעברית.
אם searchDocuments מחזיר documentsUnavailable או "אין מסמכים זמינים" — אל תנסה שוב; ענה מ-getBusinessData או מידע כללי.
אל תמציא נתונים. אם הכלי נכשל, אין תוצאות, או הטבלה חסרה — הסבר לנציג בבירור.
הצג תשובות מסודרות; אם יש רשימות — השתמש בנקודות.`;

function getApiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

/**
 * @param {Array<{ role: string, content?: string, tool_calls?: unknown[], tool_call_id?: string }>} messages
 */
async function callOpenAi(messages) {
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
        tools: [GET_BUSINESS_DATA_TOOL, SEARCH_DOCUMENTS_TOOL],
        tool_choice: "auto",
      }),
    });
  } catch {
    return { ok: false, error: "ai_network_error", message: "שגיאת רשת בחיבור ל-OpenAI — נסו שוב" };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      ok: false,
      error: `ai_error:${res.status}`,
      message: errText.slice(0, 200) || "שגיאת OpenAI",
    };
  }

  try {
    const data = await res.json();
    const choice = data.choices?.[0];
    return { ok: true, message: choice?.message || null, finishReason: choice?.finish_reason };
  } catch {
    return { ok: false, error: "ai_parse_error", message: "שגיאה בפענוח תגובת OpenAI" };
  }
}

/**
 * @param {string} userMessage
 */
export async function runAiAgent(userMessage) {
  const text = String(userMessage || "").trim();
  if (!text) {
    return { ok: false, error: "message_required", message: "נדרשת הודעה" };
  }
  if (text.length > 4000) {
    return { ok: false, error: "message_too_long", message: "ההודעה ארוכה מדי (מקסימום 4000 תווים)" };
  }

  if (!isOpenAiConfigured()) {
    return {
      ok: false,
      error: "ai_not_configured",
      message: "OPENAI_API_KEY לא מוגדר בשרת.",
    };
  }

  /** @type {Array<{ role: string, content?: string, tool_calls?: unknown[], tool_call_id?: string }>} */
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: text },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const result = await callOpenAi(messages);
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
      if (toolName !== "getBusinessData" && toolName !== "searchDocuments") {
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

      let toolResult;
      try {
        toolResult =
          toolName === "searchDocuments"
            ? await searchDocuments(parsedArgs)
            : await getBusinessData(parsedArgs);
      } catch {
        toolResult = {
          ok: false,
          error: "tool_exception",
          message: "שגיאה בהרצת הכלי — נסו שוב או נסחו את השאלה אחרת",
        };
      }
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

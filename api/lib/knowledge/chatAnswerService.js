/** OpenAI chat completion for RAG answers (chunks only — no full documents). */

import { fetchOpenAiWithRetry, getRetryAfterSec } from "../../openaiRetry.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export const KNOWLEDGE_SYSTEM_PROMPT = `אתה עוזר AI לבסיס ידע של מוקד שירות לקוחות.
ענה בעברית בלבד, בצורה טבעית וברורה.
השתמש אך ורק בקטעי ההקשר שסופקו — התעלם מכל מידע שלא קשור ישירות לשאלה.
אם התשובה לא קיימת בהקשר, אמור בדיוק:
'לא מצאתי תשובה ברורה במסמכים הקיימים.'
אסור להמציא מידע, לענות מידע כללי, או להזכיר נושאים שלא נשאלו עליהם.
כתוב עם רווח בין כל מילה עברית, סימני פיסוק נכונים, ושורות מסודרות.
שמור על סדר שלבים לוגי — אל תהפוך או תמזג מילים.
חובה לציין מקור: שם מסמך / עמוד / סעיף עם מספר סימוכין [1], [2] מההקשר.`;

export const KNOWLEDGE_ANSWER_FORMAT_HINT = `Structure every answer as:
תשובה קצרה וברורה
(optional) פירוט לפי סעיפים אם צריך — רק מידע שקשור ישירות לשאלה
מקור: שם המסמך / עמוד / כותרת (חובה — ציין את מספר הסימוכין [1], [2] מההקשר אם רלוונטי)`;

export const KNOWLEDGE_NO_CONTEXT_ANSWER = "לא מצאתי תשובה ברורה במסמכים הקיימים.";

export const KNOWLEDGE_LOW_RELEVANCE_ANSWER = "לא מצאתי מקור ברור במאגר הידע.";

const MAX_CONTEXT_CHARS = 2800;
const MAX_SNIPPET_CHARS = 480;

function isHowToQuestion(query) {
  const q = String(query || "").replace(/\s+/g, " ").trim();
  return /^(איך|כיצד|מהן?\s+השלבים|מה\s+התהליך|תהליך|הסבר\s+איך)/u.test(q);
}

function truncateSnippet(text, max = MAX_SNIPPET_CHARS) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.55 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export function buildContextBlocks(chunks) {
  const blocks = [];
  let totalChars = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const c = chunks[i];
    const snippet = truncateSnippet(c.text);
    const meta = [
      c.documentName || c.documentTitle || "מסמך",
      c.chunkIndex != null ? `קטע ${c.chunkIndex}` : null,
      c.pageNumber != null ? `עמוד ${c.pageNumber}` : null,
      c.sectionTitle ? `סעיף: ${c.sectionTitle}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const block = `[${i + 1}] ${meta}\n${snippet}`;
    if (totalChars + block.length > MAX_CONTEXT_CHARS) break;
    blocks.push(block);
    totalChars += block.length + 2;
  }

  return blocks;
}

function uniqueCitations(chunks) {
  const seen = new Set();
  return chunks
    .filter((c) => {
      if (seen.has(c.documentId)) return false;
      seen.add(c.documentId);
      return true;
    })
    .map((c) => ({
      documentId: c.documentId,
      title: c.documentName || c.documentTitle,
      category: c.category,
      pageNumber: c.pageNumber,
      sectionTitle: c.sectionTitle,
    }));
}

function sanitizeAssistantAnswer(text) {
  let s = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!s) return "";
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function buildMessages(query, context) {
  const howTo = isHowToQuestion(query);
  const trimmedContext = String(context || "").trim();

  const user = `קטעי הקשר (היחידים המותרים לשימוש):\n${trimmedContext || "(ריק)"}\n\nשאלת הנציג: ${query}\n\n${KNOWLEDGE_ANSWER_FORMAT_HINT}${
    howTo ? "\n\nסוג שאלה: הדרכה / תהליך — השתמש בפירוט לפי סעיפים." : ""
  }`;

  return {
    howTo,
    messages: [
      {
        role: "system",
        content: `${KNOWLEDGE_SYSTEM_PROMPT}\n\n${KNOWLEDGE_ANSWER_FORMAT_HINT}`,
      },
      { role: "user", content: user },
    ],
  };
}

/**
 * @param {string} query
 * @param {Array} chunks
 */
export async function generateChatAnswer(query, chunks) {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

  if (!apiKey) {
    return {
      answer: null,
      citations: uniqueCitations(chunks),
      error: "openai_not_configured",
      retryAfterSec: null,
    };
  }

  const contextBlocks = buildContextBlocks(chunks);
  const context = contextBlocks.join("\n\n");
  const { howTo, messages } = buildMessages(query, context);

  const openaiRes = await fetchOpenAiWithRetry(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: howTo ? 480 : 380,
      messages,
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => "");
    const retryAfterSec = openaiRes.status === 429 ? getRetryAfterSec(openaiRes) : null;
    return {
      answer: null,
      citations: uniqueCitations(chunks),
      error: `openai_error:${openaiRes.status}`,
      detail: errText.slice(0, 200),
      retryAfterSec,
      rateLimited: openaiRes.status === 429,
    };
  }

  const data = await openaiRes.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || KNOWLEDGE_NO_CONTEXT_ANSWER;

  return {
    answer: sanitizeAssistantAnswer(raw),
    citations: uniqueCitations(chunks),
    context,
    error: null,
    retryAfterSec: null,
    rateLimited: false,
  };
}

export { uniqueCitations, truncateSnippet };

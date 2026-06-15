/** AI chat completion for RAG answers (chunks only — no full documents). */

import { generateText, getAiProvider } from "../ai/aiProvider.js";
import { generateGeminiKnowledgeAnswer } from "./geminiChatService.js";
import {
  GEMINI_KNOWLEDGE_SYSTEM_PROMPT,
  KNOWLEDGE_MISSING_ANSWER,
} from "./geminiKnowledgePrompt.js";
import { KNOWLEDGE_BIDI_FORMAT_HINT, sanitizeAssistantAnswer } from "./assistantBidi.js";

export const KNOWLEDGE_SYSTEM_PROMPT = GEMINI_KNOWLEDGE_SYSTEM_PROMPT;
export const KNOWLEDGE_ANSWER_FORMAT_HINT = KNOWLEDGE_BIDI_FORMAT_HINT;

export const KNOWLEDGE_NO_CONTEXT_ANSWER = KNOWLEDGE_MISSING_ANSWER;

export const KNOWLEDGE_LOW_RELEVANCE_ANSWER = KNOWLEDGE_MISSING_ANSWER;

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
 * @param {{ images?: Array, confidence?: number }} [options]
 */
export async function generateChatAnswer(query, chunks, options = {}) {
  if (getAiProvider() === "gemini") {
    return generateGeminiKnowledgeAnswer(query, chunks, options);
  }

  const contextBlocks = buildContextBlocks(chunks);
  const context = contextBlocks.join("\n\n");
  const { howTo, messages } = buildMessages(query, context);

  if (!messages.length) {
    return {
      answer: null,
      citations: uniqueCitations(chunks),
      error: "ai_not_configured",
      retryAfterSec: null,
    };
  }

  const system = messages.find((m) => m.role === "system")?.content || KNOWLEDGE_SYSTEM_PROMPT;
  const user = messages.find((m) => m.role === "user")?.content || "";

  const result = await generateText({
    system,
    user,
    maxTokens: howTo ? 480 : 380,
    temperature: 0.2,
  });

  if (result.error) {
    return {
      answer: null,
      citations: uniqueCitations(chunks),
      error: result.error,
      retryAfterSec: result.retryAfterSec,
      rateLimited: result.rateLimited,
    };
  }

  const raw = result.text?.trim() || KNOWLEDGE_NO_CONTEXT_ANSWER;

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

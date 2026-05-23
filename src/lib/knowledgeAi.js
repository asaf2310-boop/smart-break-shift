import { listKnowledgeDocuments } from "@/lib/knowledgeStore";

const CHUNK_SIZE = 480;
const CHUNK_OVERLAP = 60;
const MAX_CHUNKS_RETURNED = 2;
const MIN_CHUNK_SCORE = 3;
const MIN_RELATIVE_SCORE_RATIO = 0.55;
const MAX_CONTEXT_CHARS = 2200;
const MAX_SNIPPET_CHARS = 380;
const MAX_TEMPLATE_SENTENCES = 3;

const NO_MATCH_ANSWER = "לא נמצא מידע רלוונטי בבסיס הידע. נסה לנסח את השאלה אחרת, או פנה למנהל להוסיף מסמכים ב«ניהול ידע».";

const STOP_WORDS = new Set([
  "מה",
  "איך",
  "למה",
  "האם",
  "מי",
  "איפה",
  "מתי",
  "כמה",
  "את",
  "של",
  "על",
  "עם",
  "אל",
  "גם",
  "או",
  "לא",
  "כן",
  "יש",
  "אין",
  "זה",
  "זו",
  "הם",
  "היא",
  "הוא",
  "the",
  "a",
  "an",
  "is",
  "are",
  "to",
  "of",
  "in",
  "for",
]);

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fix OCR/PDF spacing: collapse whitespace and rejoin broken Hebrew letter runs. */
export function normalizeHebrewText(text) {
  let s = normalizeText(text);
  if (!s) return "";

  s = s.replace(/\s+([,.;:!?…])/g, "$1");

  let prev;
  do {
    prev = s;
    s = s.replace(
      /(^|[^\u0590-\u05FF])([\u0590-\u05FF]{1,2})\s+(?=[\u0590-\u05FF])/gu,
      "$1$2",
    );
    s = s.replace(/([\u0590-\u05FF]{1,2})\s+(?=[\u0590-\u05FF]{2,})/gu, "$1");
  } while (s !== prev);

  return s.replace(/\s+/g, " ").trim();
}

/** Split document body into overlapping chunks for RAG-lite retrieval. */
export function chunkDocument(document) {
  const text = normalizeText(document.content);
  if (!text) return [];

  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    let slice = text.slice(start, end);

    if (end < text.length) {
      const lastSpace = slice.lastIndexOf(" ");
      if (lastSpace > CHUNK_SIZE * 0.5) {
        slice = slice.slice(0, lastSpace);
      }
    }

    const chunkText = normalizeHebrewText(slice);
    if (chunkText) {
      chunks.push({
        id: `${document.id}_c${index}`,
        documentId: document.id,
        documentTitle: document.title,
        category: document.category,
        index,
        text: chunkText,
      });
      index += 1;
    }

    if (end >= text.length) break;
    start += Math.max(slice.length - CHUNK_OVERLAP, 1);
  }

  return chunks;
}

export function getAllChunks() {
  return listKnowledgeDocuments().flatMap(chunkDocument);
}

function tokenize(query) {
  const raw = normalizeText(query).toLowerCase();
  const words = raw.match(/[\u0590-\u05ff\w]+/g) || [];
  const meaningful = [...new Set(words.filter((w) => w.length > 1 && !STOP_WORDS.has(w)))];
  if (meaningful.length) return meaningful;
  return [...new Set(words.filter((w) => w.length > 1))];
}

function scoreChunk(chunk, tokens) {
  if (!tokens.length) return 0;
  const hay = `${chunk.documentTitle} ${chunk.text} ${chunk.category || ""}`.toLowerCase();
  let score = 0;
  let matchedTokens = 0;
  for (const token of tokens) {
    if (hay.includes(token)) {
      matchedTokens += 1;
      score += token.length >= 4 ? 3 : 2;
      const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
      const matches = hay.match(re);
      if (matches) score += matches.length * 0.5;
    }
  }
  if (matchedTokens >= 2) score += 1;
  return score;
}

/** Keyword overlap search — returns only chunks above relevance threshold. */
export function searchKnowledgeChunks(query, limit = MAX_CHUNKS_RETURNED) {
  const tokens = tokenize(query);
  const all = getAllChunks();
  if (!all.length || !tokens.length) return [];

  const ranked = all
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, tokens) }))
    .filter((row) => row.score >= MIN_CHUNK_SCORE)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return [];

  const topScore = ranked[0].score;
  const minRelative = topScore * MIN_RELATIVE_SCORE_RATIO;

  return ranked
    .filter((row) => row.score >= minRelative)
    .slice(0, limit)
    .map((row) => row.chunk);
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
      title: c.documentTitle,
      category: c.category,
    }));
}

function splitSentences(text) {
  const normalized = normalizeHebrewText(text);
  return normalized
    .split(/(?<=[.!?…])\s+|[\n\r]+/)
    .map((s) => normalizeHebrewText(s))
    .filter((s) => s.length > 8);
}

function sentenceMatchesTokens(sentence, tokens) {
  const hay = sentence.toLowerCase();
  return tokens.some((t) => hay.includes(t));
}

function truncateSnippet(text, max = MAX_SNIPPET_CHARS) {
  const normalized = normalizeHebrewText(text);
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.55 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function countTokenHits(sentence, tokens) {
  const hay = sentence.toLowerCase();
  return tokens.reduce((n, t) => (hay.includes(t) ? n + 1 : n), 0);
}

/** Pick 2–3 full sentences from chunks (never word/token concatenation). */
function synthesizeTemplateSentences(query, chunks) {
  const tokens = tokenize(query);
  const ranked = [];
  const seen = new Set();

  for (const chunk of chunks) {
    const candidates = splitSentences(chunk.text).filter((s) => sentenceMatchesTokens(s, tokens));
    for (const sentence of candidates) {
      const key = sentence.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      ranked.push({ sentence, hits: countTokenHits(sentence, tokens) });
    }
  }

  ranked.sort((a, b) => b.hits - a.hits || a.sentence.length - b.sentence.length);

  if (ranked.length) {
    return ranked.slice(0, MAX_TEMPLATE_SENTENCES).map((r) => r.sentence);
  }

  const fallback = splitSentences(chunks[0]?.text || "").slice(0, MAX_TEMPLATE_SENTENCES);
  return fallback;
}

function buildTemplateAnswerHebrew(query, chunks) {
  if (!chunks.length) {
    return {
      answer: NO_MATCH_ANSWER,
      citations: [],
      mode: "template",
    };
  }

  const sentences = synthesizeTemplateSentences(query, chunks);
  if (!sentences.length) {
    return {
      answer: NO_MATCH_ANSWER,
      citations: [],
      mode: "template",
    };
  }

  const citations = uniqueCitations(chunks);
  const body = normalizeHebrewText(sentences.slice(0, MAX_TEMPLATE_SENTENCES).join(" "));
  const footer =
    "\n\n(סיכום אוטומטי מקטעים רלוונטיים בלבד · מצב דמו. להפעלת GPT, הגדר VITE_OPENAI_API_KEY.)";

  return {
    answer: normalizeHebrewText(body) + footer,
    citations,
    mode: "template",
  };
}

function buildContextBlocks(chunks) {
  const blocks = [];
  let totalChars = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const c = chunks[i];
    const snippet = truncateSnippet(c.text);
    const block = `[${i + 1}] מסמך: ${c.documentTitle}\n${snippet}`;
    if (totalChars + block.length > MAX_CONTEXT_CHARS) break;
    blocks.push(block);
    totalChars += block.length + 2;
  }

  return blocks;
}

export function isOpenAiConfigured() {
  return Boolean(String(import.meta.env.VITE_OPENAI_API_KEY ?? "").trim());
}

async function callOpenAi(query, chunks) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const model = import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini";

  const contextBlocks = buildContextBlocks(chunks);
  const context = contextBlocks.join("\n\n");

  const system = `אתה עוזר ידע לנציגי שירות. ענה בעברית בלבד.
כללים:
- תשובה קצרה וישירה בעברית, 2–4 משפטים לכל היותר, בלי להעתיק פסקאות שלמות.
- המשפט הראשון: תשובה ישירה לשאלה (כן/לא או העובדה המרכזית).
- ענה רק על השאלה — בלי רשימות, בלי bullets, בלי לסכם את כל המסמך.
- השתמש אך ורק במידע שמופיע בקטעי ההקשר — אל תוסיף ידע חיצוני.
- אם אין תשובה בקטעים, ענה במדויק: "לא נמצא מידע רלוונטי בבסיס הידע."
- בסוף ציין [1], [2] רק למקורות שבאמת השתמשת בהם.`;

  const user = `קטעי הקשר (היחידים המותרים לשימוש):\n${context || "(ריק)"}\n\nשאלת הנציג: ${query}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 280,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`openai_error:${res.status}:${errText.slice(0, 120)}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || "לא התקבלה תשובה מהמודל.";
  const answer = normalizeHebrewText(raw);

  return {
    answer,
    citations: uniqueCitations(chunks),
    mode: "openai",
  };
}

/**
 * Retrieve relevant chunks and produce an answer (template or OpenAI).
 * @returns {Promise<{ answer: string, citations: Array, chunks: Array, mode: string }>}
 */
export async function askKnowledgeBase(query) {
  const trimmed = normalizeText(query);
  if (!trimmed) {
    return { answer: "נא להקליד שאלה.", citations: [], chunks: [], mode: "empty" };
  }

  const chunks = searchKnowledgeChunks(trimmed);

  if (!chunks.length) {
    return {
      answer: NO_MATCH_ANSWER,
      citations: [],
      chunks: [],
      mode: "no_match",
    };
  }

  if (isOpenAiConfigured()) {
    try {
      const result = await callOpenAi(trimmed, chunks);
      return { ...result, chunks };
    } catch {
      // fall through to template on API errors
    }
  }

  const template = buildTemplateAnswerHebrew(trimmed, chunks);
  return { ...template, chunks };
}

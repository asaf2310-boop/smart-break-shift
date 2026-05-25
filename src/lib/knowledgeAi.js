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

/** Strip broken markdown / OCR link noise; separate glued Hebrew+Latin (e.g. בHYP). */
export function sanitizeChunkText(text) {
  let s = String(text || "");

  s = s.replace(/\[([^\]\n]{1,160})\]\([^)\n]{0,240}\)/g, "$1");
  s = s.replace(/\[[^\]\n]{1,160}\]\([^)\n]*$/g, "$1");
  s = s.replace(/\)\s*[-–—]\s*\[[^\]\n]{0,160}(?:\]|$)/g, "");
  s = s.replace(/\(\s*#?[^\s)\]]{1,100}(?:[.,;:]|\s*\))?/g, "");
  s = s.replace(/\(#[^\s)\]]{1,80}/g, "");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  s = s.replace(/__([^_\n]+)__/g, "$1");
  s = s.replace(/`([^`\n]+)`/g, "$1");
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/<\/?[a-z][^>]*>/gi, " ");
  s = s.replace(/(?:^|\s)[-*•]\s+/gm, " ");
  s = s.replace(/([\u0590-\u05FF])([A-Za-z0-9])/g, "$1 $2");
  s = s.replace(/([A-Za-z0-9])([\u0590-\u05FF])/g, "$1 $2");

  return normalizeHebrewText(s);
}

function isHowToQuestion(query) {
  const q = normalizeText(query);
  return /^(איך|כיצד|מהן?\s+השלבים|מה\s+התהליך|תהליך|הסבר\s+איך)/u.test(q);
}

const HEBREW_CHAR = /[\u0590-\u05FF]/u;

/** Fix OCR/PDF spacing: rejoin broken letters inside words; keep real word gaps. */
export function normalizeHebrewText(text) {
  let s = normalizeText(text);
  if (!s) return "";

  s = s.replace(/\s+([,.;:!?…])/g, "$1");
  s = s.replace(/([,.;:!?…])(?=[\u0590-\u05FF])/g, "$1 ");

  s = s.replace(/(?:[\u0590-\u05FF](?:\s+[\u0590-\u05FF]){2,})/gu, (run) => {
    const parts = run.split(/\s+/).filter(Boolean);
    if (parts.length >= 3 && parts.every((p) => p.length === 1)) {
      return parts.join("");
    }
    return run;
  });

  let prev;
  do {
    prev = s;
    // "מ דיניות" — orphaned letter before a longer Hebrew word
    s = s.replace(/([\u0590-\u05FF])\s+(?=[\u0590-\u05FF]{3,})/gu, "$1");
    // "מדיניותהחזרות" — missing space between two Hebrew words (4+ chars each)
    s = s.replace(
      /([\u0590-\u05FF]{4,})([\u0590-\u05FF]{4,})/gu,
      (m, a, b) => (HEBREW_CHAR.test(a) && HEBREW_CHAR.test(b) ? `${a} ${b}` : m),
    );
  } while (s !== prev);

  return s.replace(/\s+/g, " ").trim();
}

function ensureSentenceTerminal(sentence) {
  const s = String(sentence || "").trim();
  if (!s) return "";
  return /[.!?…]$/.test(s) ? s : `${s}.`;
}

/** Join full sentences with a visible gap; never glue fragments. */
export function joinSentences(sentences) {
  const parts = (Array.isArray(sentences) ? sentences : [])
    .map((s) => normalizeHebrewText(s))
    .filter((s) => s.length > 0)
    .map(ensureSentenceTerminal);
  return normalizeHebrewText(parts.join(" "));
}

function isLikelyFullSentence(sentence) {
  const s = normalizeHebrewText(sentence);
  if (s.length < 12) return false;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2) return s.length >= 24;
  const shortWords = words.filter((w) => w.length <= 2).length;
  if (words.length >= 3 && shortWords / words.length > 0.45) return false;
  return true;
}

/** Split document body into overlapping chunks for RAG-lite retrieval. */
export function chunkDocument(document) {
  const text = sanitizeChunkText(document.content);
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
  const expanded = raw
    .replace(/([\u0590-\u05ff])([a-z0-9])/gi, "$1 $2")
    .replace(/([a-z0-9])([\u0590-\u05ff])/gi, "$1 $2");
  const words =
    expanded.match(/[\u0590-\u05ff][\u0590-\u05ff'"-]*|[a-z0-9][a-z0-9_.-]*/gi) || [];
  const meaningful = [...new Set(words.filter((w) => w.length > 1 && !STOP_WORDS.has(w)))];
  if (meaningful.length) return meaningful;
  return [...new Set(words.filter((w) => w.length > 1))];
}

function scoreChunk(chunk, tokens) {
  if (!tokens.length) return 0;
  const hay = sanitizeChunkText(`${chunk.documentTitle} ${chunk.text} ${chunk.category || ""}`).toLowerCase();
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
  const normalized = sanitizeChunkText(text);
  return normalized
    .split(/(?<=[.!?…])\s+|[\n\r]+|(?<=[\u0590-\u05FF])\s*[-–—]\s*/)
    .map((s) => sanitizeChunkText(s))
    .filter(isLikelyFullSentence);
}

function sentenceMatchesTokens(sentence, tokens) {
  const hay = sentence.toLowerCase();
  return tokens.some((t) => hay.includes(t));
}

function truncateSnippet(text, max = MAX_SNIPPET_CHARS) {
  const normalized = sanitizeChunkText(text);
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
    const candidates = splitSentences(chunk.text).filter(
      (s) => isLikelyFullSentence(s) && sentenceMatchesTokens(s, tokens),
    );
    for (const sentence of candidates) {
      const key = sentence.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      ranked.push({ sentence, hits: countTokenHits(sentence, tokens) });
    }
  }

  ranked.sort((a, b) => b.hits - a.hits || b.sentence.length - a.sentence.length);

  if (ranked.length) {
    return ranked.slice(0, MAX_TEMPLATE_SENTENCES).map((r) => r.sentence);
  }

  return splitSentences(chunks[0]?.text || "")
    .filter(isLikelyFullSentence)
    .slice(0, MAX_TEMPLATE_SENTENCES);
}

function formatTemplateBody(query, sentences) {
  const cleaned = sentences
    .map((s) => sanitizeChunkText(s))
    .filter((s) => s.length >= 12);

  if (!cleaned.length) return "";

  if (isHowToQuestion(query) && cleaned.length >= 2) {
    return cleaned
      .slice(0, MAX_TEMPLATE_SENTENCES)
      .map((s, i) => `${i + 1}. ${ensureSentenceTerminal(s).replace(/^\d+[\.\)]\s*/, "")}`)
      .join("\n");
  }

  return joinSentences(cleaned.slice(0, MAX_TEMPLATE_SENTENCES));
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
  const body = formatTemplateBody(query, sentences);
  if (!body) {
    return {
      answer: NO_MATCH_ANSWER,
      citations: [],
      mode: "template",
    };
  }

  const citations = uniqueCitations(chunks);
  const intro = isHowToQuestion(query)
    ? "לפי המידע שבבסיס הידע, כך ניתן לפעול:"
    : "לפי המידע שבבסיס הידע:";

  return {
    answer: `${intro}\n\n${body}`,
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

  const howTo = isHowToQuestion(query);

  const system = `אתה יועץ ידע מקצועי לנציגי שירות ב-HYP. ענה בעברית בלבד, בטון מקצועי וברור (רמת ChatGPT).
כללים מחייבים:
- השתמש אך ורק במידע מקטעי ההקשר — אין ידע חיצוני, אין השערות.
- משפט ראשון: תשובה ישירה לשאלה (כן/לא, מספר, או העובדה המרכזית).
- ניסוח מחדש; אל תעתיק טקסט גולמי, קישורי markdown, או שברי OCR.
- בלי markdown (ללא #, ללא [], ללא \`\`), בלי אנגלית מיותרת — עברית בלבד למעט מונחים טכניים מהמסמך.
- רווח תקין בין מילים עבריות; תקן רווחים שבורים בתוך מילים.
${
    howTo
      ? `- שאלת "איך": ענה ב-3–5 שלבים ממוספרים (שורה לכל שלב: "1. ...", "2. ..."), כל שלב משפט שלם עם נקודה בסוף.`
      : `- 2–4 משפטים שלמים; כל משפט מסתיים בנקודה.`
  }
- אם אין תשובה בקטעים, ענה במדויק: "לא נמצא מידע רלוונטי בבסיס הידע."
- בסוף שורה נפרדת: "מקורות:" ואז [1], [2] רק למסמכים שבאמת נשעדת עליהם.`;

  const user = `קטעי הקשר (היחידים המותרים לשימוש):\n${context || "(ריק)"}\n\nשאלת הנציג: ${query}${
    howTo ? "\n\nסוג שאלה: הדרכה / תהליך — השב בשלבים ממוספרים." : ""
  }`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      max_tokens: howTo ? 420 : 320,
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
  const answer = polishModelAnswer(raw, query);

  return {
    answer,
    citations: uniqueCitations(chunks),
    mode: "openai",
  };
}

function polishModelAnswer(raw, query) {
  let text = sanitizeChunkText(raw);
  text = text.replace(/^(#{1,6}\s+|\*\s+|-\s+)/gm, "");
  text = text.replace(/\r\n/g, "\n").trim();

  if (isHowToQuestion(query)) {
    const lines = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const steps = lines.filter((l) => /^\d+[\.\)]\s/.test(l));
    if (steps.length >= 2) {
      const intro = lines.find((l) => !/^\d+[\.\)]\s/.test(l) && !/^מקורות:/i.test(l));
      const sources = lines.find((l) => /^מקורות:/i.test(l));
      const body = steps
        .map((s) => ensureSentenceTerminal(sanitizeChunkText(s.replace(/^\d+[\.\)]\s*/, ""))))
        .map((s, i) => `${i + 1}. ${s.replace(/^\d+[\.\)]\s*/, "")}`)
        .join("\n");
      const parts = [];
      if (intro) parts.push(intro);
      parts.push(body);
      if (sources) parts.push("", sources);
      return parts.join("\n\n").trim();
    }
  }

  const paragraphs = text.split(/\n{2,}/).map((p) => sanitizeChunkText(p.replace(/\n+/g, " "))).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs.join("\n\n");

  const sentences = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => sanitizeChunkText(s))
    .filter(isLikelyFullSentence);
  return joinSentences(sentences) || text;
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

import {
  getKnowledgeDocumentsFingerprint,
  listKnowledgeDocuments,
  patchKnowledgeDocumentsContent,
  readKnowledgeChunkIndex,
  writeKnowledgeChunkIndex,
} from "@/lib/knowledgeStore";
import {
  KNOWLEDGE_ANSWER_FORMAT_HINT,
  KNOWLEDGE_LOW_RELEVANCE_ANSWER,
  KNOWLEDGE_NO_CONTEXT_ANSWER,
  KNOWLEDGE_SYSTEM_PROMPT,
} from "@/lib/knowledgePrompt";

/** ~500–800 tokens at ~4 chars/token (Hebrew) */
const CHUNK_TARGET_CHARS = 2600;
const CHUNK_MIN_CHARS = 2000;
const CHUNK_MAX_CHARS = 3200;
/** ~100–150 tokens overlap */
const CHUNK_OVERLAP_CHARS = 500;

const RETRIEVAL_TOP_K_MIN = 5;
const RETRIEVAL_TOP_K_MAX = 8;
const RETRIEVAL_TOP_K = 6;

const MIN_EMBEDDING_SCORE = 0.58;
const MIN_KEYWORD_SCORE = 3.5;
const MIN_KEYWORD_RELATIVE_RATIO = 0.5;

const MAX_CONTEXT_CHARS = 2400;
const MAX_SNIPPET_CHARS = 420;

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

const KNOWLEDGE_SANITIZE_STORAGE_KEY = "knowledge-content-sanitize-v3";

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
  s = s.replace(/#{1,6}(?=\s|[\u0590-\u05FF])/g, " ");
  s = s.replace(/^#{1,6}\s*/gm, "");
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  s = s.replace(/__([^_\n]+)__/g, "$1");
  s = s.replace(/\*{2,}/g, "");
  s = s.replace(/_{2,}/g, "");
  s = s.replace(/`([^`\n]+)`/g, "$1");
  s = s.replace(/`+/g, "");
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/<\/?[a-z][^>]*>/gi, " ");
  s = s.replace(/(?:^|\s)[-*•]\s+/gm, " ");
  s = s.replace(/([\u0590-\u05FF])([A-Za-z0-9])/g, "$1 $2");
  s = s.replace(/([A-Za-z0-9])([\u0590-\u05FF])/g, "$1 $2");

  return normalizeHebrewText(s);
}

const HEBREW_CHAR = /[\u0590-\u05FF]/u;

/** Rejoin OCR single-letter spacing only inside short runs (one word), never whole sentences. */
function rejoinShortSingleLetterRuns(text) {
  return String(text || "").replace(/(?:[\u0590-\u05FF](?:\s+[\u0590-\u05FF]){1,5})/gu, (run) => {
    const parts = run.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts.length <= 6 && parts.every((p) => p.length === 1)) {
      return parts.join("");
    }
    return run;
  });
}

/**
 * Fix OCR/PDF spacing without splitting real Hebrew words.
 * Preserves existing spaces; only rejoins letter-by-letter OCR artifacts.
 */
export function normalizeHebrewText(text) {
  let s = normalizeText(text);
  if (!s) return "";

  s = s.replace(/\s+([,.;:!?…])/g, "$1");
  s = s.replace(/([,.;:!?…])(?=[\u0590-\u05FF])/g, "$1 ");
  s = rejoinShortSingleLetterRuns(s);

  return s.replace(/\s+/g, " ").trim();
}

function ensureSentenceTerminal(sentence) {
  const s = String(sentence || "").trim();
  if (!s) return "";
  return /[.!?…]$/.test(s) ? s : `${s}.`;
}

export function joinSentences(sentences) {
  const parts = (Array.isArray(sentences) ? sentences : [])
    .map((s) => normalizeHebrewText(s))
    .filter((s) => s.length > 0)
    .map(ensureSentenceTerminal);
  return normalizeHebrewText(parts.join(" "));
}

function isHowToQuestion(query) {
  const q = normalizeText(query);
  return /^(איך|כיצד|מהן?\s+השלבים|מה\s+התהליך|תהליך|הסבר\s+איך)/u.test(q);
}

function detectSectionTitle(line) {
  const t = String(line || "").trim();
  if (!t) return null;
  if (/^#{1,4}\s+/.test(t)) return t.replace(/^#{1,4}\s+/, "").trim();
  if (t.length >= 4 && t.length <= 72 && /^[\u0590-\u05FF]/.test(t) && !/[.!?…]$/.test(t)) {
    return t;
  }
  return null;
}

function splitTextIntoSections(text) {
  const lines = String(text || "").split(/\n+/);
  const sections = [];
  let currentTitle = null;
  let buffer = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (body) sections.push({ sectionTitle: currentTitle, text: body });
    buffer = [];
  };

  for (const line of lines) {
    const title = detectSectionTitle(line);
    if (title && buffer.length === 0) {
      currentTitle = title;
      continue;
    }
    if (title && buffer.length > 0) {
      flush();
      currentTitle = title;
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (!sections.length && text.trim()) {
    return [{ sectionTitle: null, text: text.trim() }];
  }
  return sections;
}

function findChunkBreak(slice, maxLen) {
  if (slice.length <= maxLen) return slice.length;
  const window = slice.slice(0, maxLen);
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph > CHUNK_MIN_CHARS * 0.5) return paragraph;
  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
    window.lastIndexOf("… "),
  );
  if (sentence > CHUNK_MIN_CHARS * 0.45) return sentence + 1;
  const space = window.lastIndexOf(" ");
  if (space > CHUNK_MIN_CHARS * 0.4) return space;
  return maxLen;
}

/** Split document body into overlapping chunks with metadata for RAG retrieval. */
export function chunkDocument(document) {
  const text = sanitizeChunkText(document.content);
  if (!text) return [];

  const pageSections = Array.isArray(document.pages)
    ? document.pages
        .map((p) => ({
          sectionTitle: p.sectionTitle || null,
          pageNumber: p.pageNumber ?? null,
          text: sanitizeChunkText(p.text),
        }))
        .filter((p) => p.text)
    : null;

  const sections = pageSections?.length
    ? pageSections.map((p) => ({
        sectionTitle: p.sectionTitle,
        pageNumber: p.pageNumber,
        text: p.text,
      }))
    : splitTextIntoSections(text).map((s) => ({ ...s, pageNumber: null }));

  const chunks = [];
  let globalIndex = 0;

  for (const section of sections) {
    const sectionText = section.text;
    let start = 0;

    while (start < sectionText.length) {
      const maxEnd = Math.min(start + CHUNK_MAX_CHARS, sectionText.length);
      let end = findChunkBreak(sectionText.slice(start, maxEnd), CHUNK_MAX_CHARS);
      if (end < CHUNK_MIN_CHARS && maxEnd < sectionText.length) {
        end = Math.min(CHUNK_TARGET_CHARS, maxEnd - start);
      }
      if (end <= 0) end = Math.min(CHUNK_TARGET_CHARS, sectionText.length - start);

      const slice = sectionText.slice(start, start + end);
      const chunkText = normalizeHebrewText(slice);
      if (chunkText) {
        chunks.push({
          id: `${document.id}_c${globalIndex}`,
          documentId: document.id,
          documentName: document.title,
          documentTitle: document.title,
          category: document.category,
          chunkIndex: globalIndex,
          pageNumber: section.pageNumber ?? null,
          sectionTitle: section.sectionTitle || null,
          index: globalIndex,
          text: chunkText,
        });
        globalIndex += 1;
      }

      if (start + end >= sectionText.length) break;
      start += Math.max(end - CHUNK_OVERLAP_CHARS, 1);
    }
  }

  return chunks;
}

function ensureKnowledgeSanitizeMigration() {
  try {
    if (localStorage.getItem(KNOWLEDGE_SANITIZE_STORAGE_KEY) === "1") return;
  } catch {
    // ignore
  }
  patchKnowledgeDocumentsContent((content) => normalizeHebrewText(sanitizeChunkText(content)));
  try {
    localStorage.setItem(KNOWLEDGE_SANITIZE_STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}

let indexBuildPromise = null;

async function fetchEmbeddingsBatch(texts) {
  if (!texts.length) return [];
  try {
    const res = await fetch("/api/knowledge-embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: texts }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.embeddings) ? data.embeddings : null;
  } catch {
    return null;
  }
}

/** Rebuild localStorage chunk index (with optional OpenAI embeddings). */
export async function rebuildKnowledgeChunkIndex() {
  ensureKnowledgeSanitizeMigration();
  const documents = listKnowledgeDocuments();
  const fingerprint = getKnowledgeDocumentsFingerprint(documents);
  const existing = readKnowledgeChunkIndex();
  if (existing?.fingerprint === fingerprint && existing.chunks?.length) {
    return existing.chunks;
  }

  const rawChunks = documents.flatMap(chunkDocument);
  const texts = rawChunks.map((c) => c.text);
  const embeddings = await fetchEmbeddingsBatch(texts);

  const chunks = rawChunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings?.[i] ?? null,
  }));

  writeKnowledgeChunkIndex(chunks, fingerprint);
  return chunks;
}

function ensureChunkIndexReady() {
  const documents = listKnowledgeDocuments();
  const fingerprint = getKnowledgeDocumentsFingerprint(documents);
  const existing = readKnowledgeChunkIndex();
  if (existing?.fingerprint === fingerprint && existing.chunks?.length) {
    return Promise.resolve(existing.chunks);
  }
  if (!indexBuildPromise) {
    indexBuildPromise = rebuildKnowledgeChunkIndex().finally(() => {
      indexBuildPromise = null;
    });
  }
  return indexBuildPromise;
}

export function getAllChunks() {
  ensureKnowledgeSanitizeMigration();
  const indexed = readKnowledgeChunkIndex();
  const fingerprint = getKnowledgeDocumentsFingerprint();
  if (indexed?.fingerprint === fingerprint && indexed.chunks?.length) {
    return indexed.chunks;
  }
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

function buildTfidfVector(tokens, vocabulary) {
  const vec = new Float32Array(vocabulary.length);
  for (let i = 0; i < vocabulary.length; i += 1) {
    const term = vocabulary[i];
    const count = tokens.filter((t) => t === term).length;
    if (count) vec[i] = 1 + Math.log(count);
  }
  return vec;
}

function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function cosineEmbedding(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function scoreChunkKeyword(chunk, tokens) {
  if (!tokens.length) return 0;
  const hay = sanitizeChunkText(
    `${chunk.documentName || chunk.documentTitle} ${chunk.sectionTitle || ""} ${chunk.text} ${chunk.category || ""}`,
  ).toLowerCase();
  let score = 0;
  let matched = 0;
  for (const token of tokens) {
    if (hay.includes(token)) {
      matched += 1;
      score += token.length >= 4 ? 3 : 2;
      const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      const matches = hay.match(re);
      if (matches) score += matches.length * 0.35;
    }
  }
  if (matched >= 2) score += 1.2;
  return score;
}

async function embedQuery(text) {
  const result = await fetchEmbeddingsBatch([text]);
  return result?.[0] ?? null;
}

/**
 * Retrieve top-k chunks with scores (embedding-first, keyword fallback).
 * @returns {Promise<{ chunks: Array, hits: Array<{ chunk, score, method }>, method: string }>}
 */
export async function searchKnowledgeChunksWithScores(query, limit = RETRIEVAL_TOP_K) {
  const tokens = tokenize(query);
  const trimmed = normalizeText(query);
  if (!trimmed) return { chunks: [], hits: [], method: "empty" };

  await ensureChunkIndexReady();
  const all = getAllChunks();
  if (!all.length) return { chunks: [], hits: [], method: "no_index" };

  const topK = Math.min(RETRIEVAL_TOP_K_MAX, Math.max(RETRIEVAL_TOP_K_MIN, limit));
  const withEmbeddings = all.filter((c) => Array.isArray(c.embedding) && c.embedding.length);

  if (withEmbeddings.length) {
    const queryEmbedding = await embedQuery(trimmed);
    if (queryEmbedding) {
      const ranked = withEmbeddings
        .map((chunk) => ({
          chunk,
          score: cosineEmbedding(queryEmbedding, chunk.embedding),
          method: "embedding",
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return {
        chunks: ranked.map((r) => r.chunk),
        hits: ranked,
        method: "embedding",
      };
    }
  }

  if (!tokens.length) return { chunks: [], hits: [], method: "no_tokens" };

  const vocabulary = [...new Set(tokens)];
  const queryVec = buildTfidfVector(tokens, vocabulary);

  const ranked = all
    .map((chunk) => {
      const chunkTokens = tokenize(chunk.text);
      const chunkVec = buildTfidfVector(chunkTokens, vocabulary);
      const tfidfScore = cosineSimilarity(queryVec, chunkVec);
      const keywordScore = scoreChunkKeyword(chunk, tokens);
      const score = tfidfScore * 4 + keywordScore;
      return { chunk, score, method: "keyword_tfidf" };
    })
    .filter((row) => row.score >= MIN_KEYWORD_SCORE)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return { chunks: [], hits: [], method: "keyword_tfidf" };

  const topScore = ranked[0].score;
  const minRelative = topScore * MIN_KEYWORD_RELATIVE_RATIO;
  const filtered = ranked.filter((row) => row.score >= minRelative).slice(0, topK);

  return {
    chunks: filtered.map((r) => r.chunk),
    hits: filtered,
    method: "keyword_tfidf",
  };
}

/** @deprecated use searchKnowledgeChunksWithScores */
export async function searchKnowledgeChunks(query, limit = RETRIEVAL_TOP_K) {
  const { chunks } = await searchKnowledgeChunksWithScores(query, limit);
  return chunks;
}

function passesRelevanceThreshold(hits, method) {
  if (!hits.length) return false;
  const best = hits[0].score;
  if (method === "embedding") return best >= MIN_EMBEDDING_SCORE;
  return best >= MIN_KEYWORD_SCORE;
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

function truncateSnippet(text, max = MAX_SNIPPET_CHARS) {
  const normalized = sanitizeChunkText(text);
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.55 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function buildContextBlocks(chunks) {
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

function logRetrievalDebug(payload) {
  if (import.meta.env.DEV) {
    console.log("[knowledge RAG]", payload);
  }
}

function hasClientOpenAiKey() {
  return Boolean(String(import.meta.env.VITE_OPENAI_API_KEY ?? "").trim());
}

export function isOpenAiConfigured() {
  return hasClientOpenAiKey() || import.meta.env.PROD;
}

let openAiProbeCache = null;

export async function probeOpenAiAvailability() {
  if (openAiProbeCache) return openAiProbeCache;

  try {
    const res = await fetch("/api/knowledge-chat?health=1");
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        openAiProbeCache = { available: true, source: "server" };
        return openAiProbeCache;
      }
    }
  } catch {
    // local dev without vercel dev
  }

  if (hasClientOpenAiKey()) {
    openAiProbeCache = { available: true, source: "client" };
    return openAiProbeCache;
  }

  openAiProbeCache = { available: false, source: null };
  return openAiProbeCache;
}

export function formatOpenAiError(err) {
  const msg = String(err?.message || err || "");
  if (msg.includes("openai_not_configured") || msg.includes("openai_error:503")) {
    return "שירות GPT לא מוגדר בשרת. הוסף OPENAI_API_KEY ב-Vercel → Environment Variables ופרוס מחדש.";
  }
  if (msg.includes("openai_error:401") || msg.includes("openai_error:403")) {
    return "מפתח OpenAI לא תקין או חסר הרשאה. בדוק את OPENAI_API_KEY ב-Vercel ופרוס מחדש.";
  }
  if (msg.includes("openai_error:429")) {
    return "מגבלת קצב ב-OpenAI — נסה שוב בעוד רגע.";
  }
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
    return "בעיית רשת בחיבור ל-GPT — בדוק חיבור או הרץ vercel dev עם OPENAI_API_KEY.";
  }
  if (msg.startsWith("openai_error:")) {
    return "שגיאה ב-OpenAI — נסה שוב מאוחר יותר.";
  }
  return "לא ניתן להפעיל GPT כרגע.";
}

async function callOpenAiViaServer(query, chunks, context) {
  const res = await fetch("/api/knowledge-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      context,
      chunkMeta: chunks.map((c, i) => ({
        ref: i + 1,
        documentName: c.documentName || c.documentTitle,
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber,
        sectionTitle: c.sectionTitle,
      })),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data.error || data.code || `openai_error:${res.status}`;
    throw new Error(String(code));
  }

  const raw = data.answer?.trim() || KNOWLEDGE_NO_CONTEXT_ANSWER;
  return {
    answer: polishModelAnswer(raw),
    citations: uniqueCitations(chunks),
    mode: "openai",
  };
}

async function callOpenAiViaClient(query, chunks, context) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const model = import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini";

  const user = `קטעי הקשר (היחידים המותרים לשימוש):\n${context || "(ריק)"}\n\nשאלת הנציג: ${query}\n\n${KNOWLEDGE_ANSWER_FORMAT_HINT}${
    isHowToQuestion(query) ? "\n\nסוג שאלה: הדרכה / תהליך — השתמש בפירוט לפי סעיפים." : ""
  }`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: isHowToQuestion(query) ? 480 : 380,
      messages: [
        { role: "system", content: `${KNOWLEDGE_SYSTEM_PROMPT}\n\n${KNOWLEDGE_ANSWER_FORMAT_HINT}` },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`openai_error:${res.status}:${errText.slice(0, 120)}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || KNOWLEDGE_NO_CONTEXT_ANSWER;
  return {
    answer: polishModelAnswer(raw),
    citations: uniqueCitations(chunks),
    mode: "openai",
  };
}

async function callOpenAi(query, chunks, context) {
  const tryServerFirst = import.meta.env.PROD || !hasClientOpenAiKey();

  if (tryServerFirst) {
    try {
      return await callOpenAiViaServer(query, chunks, context);
    } catch (serverErr) {
      if (hasClientOpenAiKey()) {
        return callOpenAiViaClient(query, chunks, context);
      }
      throw serverErr;
    }
  }

  return callOpenAiViaClient(query, chunks, context);
}

function polishModelAnswer(raw) {
  let text = sanitizeChunkText(raw);
  text = text.replace(/^(#{1,6}\s+|\*\s+|-\s+)/gm, "");
  return text.replace(/\r\n/g, "\n").trim();
}

function formatSourceLine(chunk) {
  const parts = [
    chunk.documentName || chunk.documentTitle,
    chunk.pageNumber != null ? `עמוד ${chunk.pageNumber}` : null,
    chunk.sectionTitle || null,
  ].filter(Boolean);
  return parts.join(" / ");
}

/** Structured Hebrew answer without GPT (demo / missing API key). */
function buildLocalStructuredAnswer(chunks) {
  const lead = truncateSnippet(chunks[0]?.text || "", 320);
  const detail =
    chunks.length > 1
      ? chunks
          .slice(1, 3)
          .map((c, i) => `${i + 1}. ${truncateSnippet(c.text, 200)}`)
          .join("\n")
      : "";

  const source = formatSourceLine(chunks[0]);
  const parts = [`תשובה קצרה וברורה\n${lead}`];
  if (detail) parts.push(`פירוט:\n${detail}`);
  if (source) parts.push(`מקור: ${source}`);
  return parts.join("\n\n");
}

function buildDebugPayload(query, retrieval, context) {
  return {
    question: query,
    retrievalMethod: retrieval.method,
    retrievedChunks: retrieval.hits.map((h) => ({
      documentName: h.chunk.documentName || h.chunk.documentTitle,
      chunkIndex: h.chunk.chunkIndex,
      pageNumber: h.chunk.pageNumber,
      sectionTitle: h.chunk.sectionTitle,
      score: Number(h.score.toFixed(4)),
      snippet: truncateSnippet(h.chunk.text, 160),
    })),
    contextSent: context,
  };
}

/**
 * Retrieve relevant chunks and produce an answer (OpenAI or low-relevance message).
 */
export async function askKnowledgeBase(query) {
  const trimmed = normalizeText(query);
  if (!trimmed) {
    return { answer: "נא להקליד שאלה.", citations: [], chunks: [], mode: "empty", debug: null };
  }

  const retrieval = await searchKnowledgeChunksWithScores(trimmed);
  const { chunks, hits, method } = retrieval;

  const contextBlocks = buildContextBlocks(chunks);
  const context = contextBlocks.join("\n\n");

  const debug = buildDebugPayload(trimmed, retrieval, context);

  logRetrievalDebug(debug);

  if (!chunks.length || !passesRelevanceThreshold(hits, method)) {
    return {
      answer: KNOWLEDGE_LOW_RELEVANCE_ANSWER,
      citations: [],
      chunks: [],
      mode: "low_relevance",
      debug,
    };
  }

  const probe = await probeOpenAiAvailability();
  if (probe.available) {
    try {
      const result = await callOpenAi(trimmed, chunks, context);
      return { ...result, chunks, debug };
    } catch (err) {
      return {
        answer: buildLocalStructuredAnswer(chunks),
        citations: uniqueCitations(chunks),
        chunks,
        mode: "local_fallback",
        openAiFailed: true,
        openAiError: formatOpenAiError(err),
        debug,
      };
    }
  }

  return {
    answer: buildLocalStructuredAnswer(chunks),
    citations: uniqueCitations(chunks),
    chunks,
    mode: "local_fallback",
    debug,
  };
}

export { KNOWLEDGE_SYSTEM_PROMPT, KNOWLEDGE_LOW_RELEVANCE_ANSWER };

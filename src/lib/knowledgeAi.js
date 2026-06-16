import {
  getKnowledgeDocumentsFingerprint,
  getKnowledgeDocument,
  hydrateKnowledgeStore,
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
  isPageReferenceOnlyQuestion,
} from "@/lib/knowledgePrompt";
import { askKnowledgeServer, shouldUseServerRag, getKnowledgeTenantId } from "@/lib/knowledge/knowledgeClient";
import { formatAssistantDisplayMarkdown as applyBidiDisplayMarkdown, stripAnswerMetadataLeakage } from "@/lib/knowledge/assistantBidi";
import { sanitizeHebrewText, advancedHebrewSanitizer } from "@/lib/knowledge/sanitizeHebrewText";

/** ~500–800 tokens at ~4 chars/token (Hebrew) */
import { cleanPdfPageText } from "@/lib/knowledge/pdfTextQuality";
import { normalizeExtractedDocumentText } from "@/lib/knowledge/textExtractionNormalize";

const MARKDOWN_HEADING = /^#{1,6}\s+\S/;
const NUMBERED_SECTION_HEADING = /^\d+\.\s+\S/;

const RETRIEVAL_TOP_K_MIN = 4;
const RETRIEVAL_TOP_K_MAX = 6;
const RETRIEVAL_TOP_K = 5;

const MIN_EMBEDDING_SCORE = 0.62;
const MIN_EMBEDDING_RELATIVE_RATIO = 0.72;
const MIN_KEYWORD_SCORE = 4;
const MIN_KEYWORD_RELATIVE_RATIO = 0.55;
const MIN_KEYWORD_MATCHES_FOR_EMBEDDING = 1;

const MAX_CONTEXT_CHARS = 2800;
const MAX_SNIPPET_CHARS = 480;
const EMBED_BATCH_SIZE = 48;
const EMBED_BATCH_DELAY_MS = 750;
const EMBED_CLIENT_MAX_RETRIES = 1;
const CHAT_CLIENT_MAX_RETRIES = 0;
const MAX_CHUNKS_PER_DOCUMENT = 2;
const API_FETCH_TIMEOUT_MS = 22_000;
const QUERY_RATE_LIMIT_WAIT_CAP_MS = 12_000;

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

const KNOWLEDGE_SANITIZE_STORAGE_KEY = "knowledge-content-sanitize-v6";

/** Light sanitize for GPT answers — preserves spacing; fixes Hebrew OCR/PDF artifacts. */
export function sanitizeAssistantAnswer(text) {
  let s = sanitizeHebrewText(
    advancedHebrewSanitizer(stripAnswerMetadataLeakage(String(text || "").replace(/\r\n/g, "\n").trim())),
  );
  if (!s) return "";

  s = stripBrokenMarkdownLinks(s);
  s = separateHebrewLatinGlue(s);
  s = s
    .split("\n")
    .map((line) => {
      const trimmed = line.replace(/[ \t]+/g, " ").trim();
      return normalizeHebrewText(repairPdfHebrewSplits(repairHebrewPrefixes(trimmed)));
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

/** Prepare assistant markdown for RTL chat display (clean text + BiDi + linkify URLs). */
export function formatAssistantDisplayMarkdown(text) {
  const cleaned = sanitizeAssistantAnswer(text);
  if (!cleaned) return "";
  return applyBidiDisplayMarkdown(cleaned);
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripBrokenMarkdownLinks(s) {
  let out = String(s || "");
  out = out.replace(/\[([^\]\n]{1,160})\]\([^)\n]{0,240}\)/g, "$1");
  out = out.replace(/\[[^\]\n]{1,160}\]\([^)\n]*$/g, "$1");
  out = out.replace(/\)\s*[-–—]\s*\[[^\]\n]{0,160}(?:\]|$)/g, "");
  out = out.replace(/\(\s*#?[^\s)\]]{1,100}(?:[.,;:]|\s*\))?/g, "");
  out = out.replace(/\(#[^\s)\]]{1,80}/g, "");
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  return out;
}

function stripAggressiveMarkdownFormatting(s) {
  let out = String(s || "");
  out = out.replace(/#{1,6}(?=\s|[\u0590-\u05FF])/g, " ");
  out = out.replace(/^#{1,6}\s*/gm, "");
  out = out.replace(/^\s*[-*+]\s+/gm, "");
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  out = out.replace(/__([^_\n]+)__/g, "$1");
  out = out.replace(/\*{2,}/g, "");
  out = out.replace(/_{2,}/g, "");
  out = out.replace(/`([^`\n]+)`/g, "$1");
  out = out.replace(/`+/g, "");
  out = out.replace(/<\/?[a-z][^>]*>/gi, " ");
  out = out.replace(/(?:^|\s)[-*•]\s+/gm, " ");
  return out;
}

function separateHebrewLatinGlue(s) {
  return String(s || "")
    .replace(/([\u0590-\u05FF])([A-Za-z0-9])/g, "$1 $2")
    .replace(/([A-Za-z0-9])([\u0590-\u05FF])/g, "$1 $2");
}

/** Fix detached Hebrew prefixes (e.g. "וב הגעה" → "ובהגעה"). */
function repairHebrewPrefixes(s) {
  return String(s || "").replace(
    /(^|[\s([{«"'])(([ובלכמהשה])(?:'|׳)?)(\s+)([\u0590-\u05FF])/gu,
    "$1$2$5",
  );
}

/** Merge short PDF/OCR syllable splits inside Hebrew words (e.g. "הני הול" → "הניהול"). */
function repairPdfHebrewSplits(line) {
  return String(line || "").replace(
    /([\u0590-\u05FF]{2,5})\s+([\u0590-\u05FF]{2,4})(?=\s|[,.;:!?…]|$)/gu,
    (match, a, b) => {
      if (a.length + b.length > 12) return match;
      if (/[.!?…]$/.test(a)) return match;
      return a + b;
    },
  );
}

/**
 * @param {string} text
 * @param {{ preserveLines?: boolean, keepMarkdown?: boolean }} [options]
 */
export function sanitizeChunkText(text, options = {}) {
  const keepMarkdown = options.keepMarkdown === true;
  let s = normalizeExtractedDocumentText(text);
  s = stripBrokenMarkdownLinks(s);
  if (!keepMarkdown) {
    s = stripAggressiveMarkdownFormatting(s);
  }
  return s.trim();
}

/** Light sanitize for uploaded markdown — keeps headings, lists, and paragraph breaks. */
export function sanitizeMarkdownIngestText(text) {
  return sanitizeChunkText(text, { preserveLines: true, keepMarkdown: true });
}

const HEBREW_CHAR = /[\u0590-\u05FF]/u;

/** Rejoin OCR single-letter spacing only for isolated letter runs, not cross-word boundaries. */
function rejoinShortSingleLetterRuns(text) {
  const full = String(text || "");
  return full.replace(/(?:[\u0590-\u05FF](?:\s+[\u0590-\u05FF]){1,5})/gu, (run, offset) => {
    const parts = run.split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.length > 6 || !parts.every((p) => p.length === 1)) {
      return run;
    }
    const before = full[offset - 1];
    const after = full[offset + run.length];
    if (before && HEBREW_CHAR.test(before)) return run;
    if (after && HEBREW_CHAR.test(after)) return run;
    return parts.join("");
  });
}

function normalizeHebrewTextSingleLine(text) {
  let s = String(text || "")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!s) return "";

  s = s.replace(/[ \t]+([,.;:!?…])/g, "$1");
  s = s.replace(/([,.;:!?…])(?=[\u0590-\u05FF])/g, "$1 ");
  s = rejoinShortSingleLetterRuns(s);

  return s.replace(/[ \t]+/g, " ").trim();
}

/**
 * Fix OCR/PDF spacing without splitting real Hebrew words.
 * Preserves existing spaces; only rejoins letter-by-letter OCR artifacts.
 * @param {string} text
 * @param {{ preserveLines?: boolean }} [options]
 */
export function normalizeHebrewText(text, options = {}) {
  if (options.preserveLines === true) {
    return String(text || "")
      .split("\n")
      .map((line) => normalizeHebrewTextSingleLine(line))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return normalizeHebrewTextSingleLine(normalizeText(text));
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

function isStructuralHeadingLine(line) {
  const t = String(line || "").trim();
  if (!t) return false;
  return MARKDOWN_HEADING.test(t) || NUMBERED_SECTION_HEADING.test(t);
}

function headingTitle(line) {
  const t = String(line || "").trim();
  if (MARKDOWN_HEADING.test(t)) return t.replace(/^#{1,6}\s+/, "").trim();
  if (NUMBERED_SECTION_HEADING.test(t)) return t;
  return null;
}

/** Split by markdown/numbered headings or double newlines — no character slicing. */
export function splitIntoSemanticBlocks(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return [];

  const hasStructuralHeadings = normalized
    .split("\n")
    .some((line) => isStructuralHeadingLine(line));

  if (hasStructuralHeadings) {
    const lines = normalized.split("\n");
    const blocks = [];
    let current = [];

    const flush = () => {
      const body = current.join("\n").trim();
      if (!body) return;
      const first = current.find((l) => l.trim())?.trim() || "";
      blocks.push({
        sectionTitle: headingTitle(first),
        text: body,
      });
      current = [];
    };

    for (const line of lines) {
      if (isStructuralHeadingLine(line) && current.length > 0) {
        flush();
      }
      current.push(line);
    }
    flush();
    return blocks;
  }

  return normalized
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({
      sectionTitle: headingTitle(block.split("\n")[0]?.trim() || "") || null,
      text: block,
    }));
}

function pageSectionText(page, docTitle) {
  const raw = cleanPdfPageText(page.text);
  const sanitized = raw ? sanitizeChunkText(raw, { preserveLines: true, keepMarkdown: true }) : "";
  if (sanitized) return sanitized;
  if (page.thumbnail || page.hasThumbnail || page.pageNumber != null) {
    const n = page.pageNumber ?? "?";
    const name = docTitle || "מסמך";
    return `עמוד ${n} — תוכן ויזואלי מהמסמך "${name}"`;
  }
  return "";
}

function pushSemanticChunk(chunks, document, section, globalIndex) {
  const chunkText = String(section.text || "").trim();
  if (!chunkText) return globalIndex;

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
  return globalIndex + 1;
}

/** Split document into semantic chunks (headings / paragraph blocks only). */
export function chunkDocument(document) {
  const keepMarkdown = contentLooksLikeMarkdown(document.content);
  const text = sanitizeChunkText(document.content, { preserveLines: true, keepMarkdown });
  const hasVisualPages =
    Array.isArray(document.pages) && document.pages.some((p) => p?.thumbnail || p?.hasThumbnail);
  if (!text && !hasVisualPages) return [];

  const pageSections = Array.isArray(document.pages)
    ? document.pages
        .map((p) => ({
          sectionTitle: p.sectionTitle || (p.pageNumber != null ? `עמוד ${p.pageNumber}` : null),
          pageNumber: p.pageNumber ?? null,
          thumbnail: p.thumbnail || null,
          text: pageSectionText(p, document.title || document.documentName),
        }))
        .filter((p) => p.text || p.thumbnail || p.hasThumbnail)
    : null;

  const chunks = [];
  let globalIndex = 0;

  if (pageSections?.length) {
    for (const page of pageSections) {
      const pageBlocks = splitIntoSemanticBlocks(page.text);
      const blocks =
        pageBlocks.length > 0
          ? pageBlocks
          : page.text
            ? [{ sectionTitle: page.sectionTitle, text: page.text }]
            : [];

      for (const block of blocks) {
        globalIndex = pushSemanticChunk(
          chunks,
          document,
          {
            ...block,
            pageNumber: page.pageNumber,
            sectionTitle: block.sectionTitle || page.sectionTitle,
          },
          globalIndex,
        );
      }
    }
    return chunks;
  }

  for (const block of splitIntoSemanticBlocks(text)) {
    globalIndex = pushSemanticChunk(chunks, document, { ...block, pageNumber: null }, globalIndex);
  }

  return chunks;
}

function contentLooksLikeMarkdown(content) {
  const s = String(content || "");
  return /^#{1,6}\s/m.test(s) || /\[[^\]\n]{1,160}\]\([^)\n]+\)/.test(s);
}

function sanitizeStoredKnowledgeContent(content) {
  if (!String(content || "").trim()) return content;
  if (contentLooksLikeMarkdown(content)) {
    return sanitizeMarkdownIngestText(content);
  }
  return sanitizeChunkText(content, { preserveLines: true });
}

function ensureKnowledgeSanitizeMigration() {
  try {
    if (localStorage.getItem(KNOWLEDGE_SANITIZE_STORAGE_KEY) === "1") return;
  } catch {
    // ignore
  }
  patchKnowledgeDocumentsContent((content) => sanitizeStoredKnowledgeContent(content));
  try {
    localStorage.setItem(KNOWLEDGE_SANITIZE_STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}

let indexBuildPromise = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = API_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("request_timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isRateLimitCode(code, status) {
  const msg = String(code || "");
  return status === 429 || msg.includes("429") || msg.includes("rate_limited") || msg.includes("ai_error:429");
}

let rateLimitUntil = 0;

function markRateLimited(retryAfterMs = 30_000) {
  rateLimitUntil = Math.max(rateLimitUntil, Date.now() + retryAfterMs);
}

export function isOpenAiRateLimited() {
  return Date.now() < rateLimitUntil;
}

export function getOpenAiRateLimitRetrySec() {
  return Math.max(0, Math.ceil((rateLimitUntil - Date.now()) / 1000));
}

function parseRetryAfterFromResponse(res, data) {
  const header = res.headers?.get?.("retry-after");
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000;
  }
  if (data?.retryAfterSec > 0) return data.retryAfterSec * 1000;
  return null;
}

const queryEmbedCache = new Map();
const QUERY_EMBED_CACHE_TTL_MS = 15 * 60_000;

/** Text sent to the embedding model — includes doc metadata for better retrieval. */
function buildEmbeddingInput(chunk) {
  const meta = [
    chunk.documentName || chunk.documentTitle,
    chunk.category ? `קטגוריה: ${chunk.category}` : null,
    chunk.sectionTitle ? `סעיף: ${chunk.sectionTitle}` : null,
    chunk.pageNumber != null ? `עמוד ${chunk.pageNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return meta ? `${meta}\n${chunk.text}` : chunk.text;
}

function statsFromChunks(chunks) {
  const totalCount = chunks.length;
  const embeddingCount = chunks.filter(
    (c) => Array.isArray(c.embedding) && c.embedding.length,
  ).length;
  return {
    chunkCount: totalCount,
    embeddingCount,
    embeddingsOk: totalCount > 0 && embeddingCount === totalCount,
    embeddingCoverage: totalCount ? embeddingCount / totalCount : 0,
  };
}

export function getKnowledgeIndexStats() {
  return statsFromChunks(getAllChunks());
}

async function fetchEmbedBatchWithRetry(inputs) {
  let lastError = null;

  for (let attempt = 0; attempt <= EMBED_CLIENT_MAX_RETRIES; attempt += 1) {
    if (attempt > 0) {
      await sleep(1200 * 2 ** (attempt - 1));
    }

    try {
      const res = await fetchWithTimeout("/api/knowledge-embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const code = data.error || data.code || `http_${res.status}`;
        lastError = code;
        if (isRateLimitCode(code, res.status) && attempt < EMBED_CLIENT_MAX_RETRIES) {
          const retryMs = parseRetryAfterFromResponse(res, data) ?? 2500 * 2 ** attempt;
          markRateLimited(retryMs);
          await sleep(retryMs);
          continue;
        }
        return {
          embeddings: null,
          error: code,
          retryAfterSec: data.retryAfterSec ?? getOpenAiRateLimitRetrySec(),
          rateLimited: isRateLimitCode(code, res.status),
        };
      }

      if (!Array.isArray(data.embeddings)) {
        return { embeddings: null, error: "invalid_response", rateLimited: false };
      }

      return { embeddings: data.embeddings, error: null, rateLimited: false };
    } catch {
      lastError = "network";
      if (attempt < EMBED_CLIENT_MAX_RETRIES) continue;
      return { embeddings: null, error: "network", rateLimited: false };
    }
  }

  return {
    embeddings: null,
    error: lastError || "network",
    retryAfterSec: getOpenAiRateLimitRetrySec(),
    rateLimited: isRateLimitCode(lastError),
  };
}

async function fetchEmbeddingsBatch(texts) {
  if (!texts.length) return { embeddings: [], error: null, rateLimited: false };

  if (isOpenAiRateLimited()) {
    return {
      embeddings: null,
      error: "openai_error:429",
      retryAfterSec: getOpenAiRateLimitRetrySec(),
      rateLimited: true,
    };
  }

  const allEmbeddings = [];
  for (let offset = 0; offset < texts.length; offset += EMBED_BATCH_SIZE) {
    if (offset > 0) {
      await sleep(EMBED_BATCH_DELAY_MS);
    }

    const batch = texts.slice(offset, offset + EMBED_BATCH_SIZE);
    const result = await fetchEmbedBatchWithRetry(batch);
    if (result.error) {
      return {
        embeddings: null,
        error: result.error,
        retryAfterSec: result.retryAfterSec,
        rateLimited: result.rateLimited,
      };
    }
    allEmbeddings.push(...result.embeddings);
  }

  return { embeddings: allEmbeddings, error: null, rateLimited: false };
}

/**
 * Rebuild localStorage chunk index (with optional OpenAI embeddings).
 * @returns {Promise<{ chunks: Array, chunkCount: number, embeddingCount: number, embeddingsOk: boolean, embeddingError: string | null }>}
 */
export async function rebuildKnowledgeChunkIndex({ force = false } = {}) {
  if (indexBuildPromise) {
    const pending = await indexBuildPromise;
    if (!force) return pending;
  }

  const task = rebuildKnowledgeChunkIndexInner({ force });
  indexBuildPromise = task;
  try {
    return await task;
  } finally {
    if (indexBuildPromise === task) indexBuildPromise = null;
  }
}

async function rebuildKnowledgeChunkIndexInner({ force = false } = {}) {
  await hydrateKnowledgeStore();
  ensureKnowledgeSanitizeMigration();
  const documents = listKnowledgeDocuments();
  const fingerprint = getKnowledgeDocumentsFingerprint(documents);
  const existing = readKnowledgeChunkIndex();
  if (
    !force &&
    existing?.fingerprint === fingerprint &&
    existing.chunks?.length
  ) {
    return { chunks: existing.chunks, embeddingError: null, ...statsFromChunks(existing.chunks) };
  }

  if (!documents.length) {
    if (existing?.chunks?.length) {
      writeKnowledgeChunkIndex([], fingerprint);
    }
    return { chunks: [], embeddingError: null, ...statsFromChunks([]) };
  }

  const existingEmbeddingsById = new Map();
  if (existing?.chunks?.length) {
    for (const chunk of existing.chunks) {
      if (Array.isArray(chunk.embedding) && chunk.embedding.length) {
        existingEmbeddingsById.set(chunk.id, chunk.embedding);
      }
    }
  }

  const rawChunks = documents.flatMap(chunkDocument);
  const needEmbedIndices = [];
  const needEmbedTexts = [];

  for (let i = 0; i < rawChunks.length; i += 1) {
    const chunk = rawChunks[i];
    if (existingEmbeddingsById.has(chunk.id)) continue;
    needEmbedIndices.push(i);
    needEmbedTexts.push(buildEmbeddingInput(chunk));
  }

  let embeddingError = null;
  const embeddingsByIndex = new Map();

  for (let i = 0; i < rawChunks.length; i += 1) {
    const reused = existingEmbeddingsById.get(rawChunks[i].id);
    if (reused) embeddingsByIndex.set(i, reused);
  }

  if (needEmbedTexts.length && !isOpenAiRateLimited()) {
    const { embeddings, error, rateLimited } = await fetchEmbeddingsBatch(needEmbedTexts);
    embeddingError = error;
    if (embeddings?.length) {
      needEmbedIndices.forEach((chunkIndex, embedIndex) => {
        embeddingsByIndex.set(chunkIndex, embeddings[embedIndex] ?? null);
      });
    } else if (rateLimited) {
      markRateLimited((getOpenAiRateLimitRetrySec() || 30) * 1000);
    }
  } else if (needEmbedTexts.length) {
    embeddingError = "openai_error:429";
  }

  const chunks = rawChunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddingsByIndex.get(i) ?? null,
  }));

  writeKnowledgeChunkIndex(chunks, fingerprint);
  return { chunks, embeddingError, ...statsFromChunks(chunks) };
}

function ensureChunkIndexReady() {
  const existing = readKnowledgeChunkIndex();
  if (existing?.chunks?.length) {
    return Promise.resolve(existing.chunks);
  }
  return rebuildKnowledgeChunkIndex();
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
  const key = normalizeText(text);
  if (!key) return null;

  const cached = queryEmbedCache.get(key);
  if (cached && Date.now() - cached.at < QUERY_EMBED_CACHE_TTL_MS) {
    return cached.embedding;
  }

  if (isOpenAiRateLimited()) return null;

  const enriched = `שאלה: ${key}`;
  const { embeddings, error, rateLimited } = await fetchEmbeddingsBatch([enriched]);
  if (rateLimited || error) return null;

  const embedding = embeddings?.[0] ?? null;
  if (embedding) {
    queryEmbedCache.set(key, { embedding, at: Date.now() });
  }
  return embedding;
}

/** Prefer diverse sources — cap chunks per document before filling remaining slots. */
function diversifyHits(hits, topK, maxPerDocument = MAX_CHUNKS_PER_DOCUMENT) {
  const picked = [];
  const pickedIds = new Set();
  const docCounts = new Map();

  for (const hit of hits) {
    if (picked.length >= topK) break;
    const docId = hit.chunk.documentId;
    const count = docCounts.get(docId) || 0;
    if (count >= maxPerDocument) continue;
    docCounts.set(docId, count + 1);
    picked.push(hit);
    pickedIds.add(hit.chunk.id);
  }

  if (picked.length < topK) {
    for (const hit of hits) {
      if (picked.length >= topK) break;
      if (pickedIds.has(hit.chunk.id)) continue;
      picked.push(hit);
      pickedIds.add(hit.chunk.id);
    }
  }

  return picked;
}

/**
 * Retrieve top-k chunks with scores (embedding-first, keyword fallback).
 * @returns {Promise<{ chunks: Array, hits: Array<{ chunk, score, method }>, method: string }>}
 */
function searchByKeywordTfidf(all, tokens, topK) {
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
  const filtered = diversifyHits(
    ranked.filter((row) => row.score >= minRelative),
    topK,
  );

  return {
    chunks: filtered.map((r) => r.chunk),
    hits: filtered,
    method: "keyword_tfidf",
  };
}

export async function searchKnowledgeChunksWithScores(query, limit = RETRIEVAL_TOP_K, { onPhase } = {}) {
  const tokens = tokenize(query);
  const trimmed = normalizeText(query);
  if (!trimmed) return { chunks: [], hits: [], method: "empty" };

  onPhase?.("searching");
  await ensureChunkIndexReady();
  const all = getAllChunks();
  if (!all.length) return { chunks: [], hits: [], method: "no_index" };

  const topK = Math.min(RETRIEVAL_TOP_K_MAX, Math.max(RETRIEVAL_TOP_K_MIN, limit));
  const indexStats = statsFromChunks(all);
  const canUseEmbeddings =
    indexStats.embeddingsOk && !isOpenAiRateLimited();

  if (canUseEmbeddings) {
    onPhase?.("embedding");
    const queryEmbedding = await embedQuery(trimmed);
    if (queryEmbedding) {
      const withEmbeddings = all.filter((c) => Array.isArray(c.embedding) && c.embedding.length);
      const ranked = withEmbeddings
        .map((chunk) => {
          const embScore = cosineEmbedding(queryEmbedding, chunk.embedding);
          const keywordScore = scoreChunkKeyword(chunk, tokens);
          const keywordBoost = Math.min(keywordScore / 14, 1);
          const score = embScore * 0.84 + keywordBoost * 0.16;
          return { chunk, score, embScore, keywordScore, method: "embedding" };
        })
        .filter((row) => {
          if (row.embScore < MIN_EMBEDDING_SCORE - 0.06) return false;
          if (tokens.length >= 2 && row.keywordScore < MIN_KEYWORD_MATCHES_FOR_EMBEDDING) {
            return false;
          }
          return row.score >= MIN_EMBEDDING_SCORE;
        })
        .sort((a, b) => b.score - a.score);

      if (ranked.length) {
        const topScore = ranked[0].score;
        const minRelative = topScore * MIN_EMBEDDING_RELATIVE_RATIO;
        const filtered = diversifyHits(
          ranked.filter((row) => row.score >= minRelative),
          topK,
        );

        return {
          chunks: filtered.map((r) => r.chunk),
          hits: filtered,
          method: "embedding",
        };
      }
    }
  }

  return searchByKeywordTfidf(all, tokens, topK);
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
let openAiProbeAt = 0;
const OPENAI_PROBE_TTL_MS = 5 * 60_000;
const OPENAI_PROBE_RATE_LIMIT_TTL_MS = 90_000;

export function resetOpenAiProbeCache() {
  openAiProbeCache = null;
  openAiProbeAt = 0;
}

export async function probeOpenAiAvailability({ force = false } = {}) {
  const probeTtl = isOpenAiRateLimited() ? OPENAI_PROBE_RATE_LIMIT_TTL_MS : OPENAI_PROBE_TTL_MS;

  if (
    !force &&
    openAiProbeCache &&
    Date.now() - openAiProbeAt < probeTtl
  ) {
    return openAiProbeCache;
  }

  if (isOpenAiRateLimited()) {
    openAiProbeCache = {
      available: false,
      source: null,
      rateLimited: true,
      retryAfterSec: getOpenAiRateLimitRetrySec(),
    };
    openAiProbeAt = Date.now();
    return openAiProbeCache;
  }

  try {
    const res = await fetchWithTimeout("/api/knowledge-chat?health=1", {}, 8000);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        openAiProbeCache = { available: true, source: "server", rateLimited: false };
        openAiProbeAt = Date.now();
        return openAiProbeCache;
      }
    }
  } catch {
    // local dev without vercel dev
  }

  if (hasClientOpenAiKey()) {
    openAiProbeCache = { available: true, source: "client", rateLimited: false };
    openAiProbeAt = Date.now();
    return openAiProbeCache;
  }

  openAiProbeCache = { available: false, source: null, rateLimited: false };
  openAiProbeAt = Date.now();
  return openAiProbeCache;
}

export function formatOpenAiError(err, retryAfterSec) {
  const msg = String(err?.message || err || "");
  const waitSec = retryAfterSec ?? getOpenAiRateLimitRetrySec();
  if (msg.includes("ai_not_configured") || msg.includes("openai_not_configured") || msg.includes("openai_error:503")) {
    return "שירות AI לא מוגדר בשרת. הוסף GEMINI_API_KEY (או OPENAI_API_KEY) ב-Vercel ופרוס מחדש.";
  }
  if (msg.includes("openai_error:401") || msg.includes("openai_error:403") || msg.includes("ai_error:401") || msg.includes("ai_error:403")) {
    return "מפתח AI לא תקין או חסר הרשאה. בדוק את GEMINI_API_KEY / OPENAI_API_KEY ב-Vercel.";
  }
  if (msg.includes("openai_error:429") || msg.includes("ai_error:429") || msg.includes("429")) {
    if (waitSec > 0) {
      return `מגבלת קצב ב-AI — ניסיון חוזר אוטומטי בעוד ${waitSec} שניות.`;
    }
    return "מגבלת קצב ב-AI — המתן כדקה ונסה שוב.";
  }
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("request_timeout") || msg === "network") {
    return "בעיית רשת או זמן תגובה ארוך — נסה שוב.";
  }
  if (msg.includes("pgvector_not_configured")) {
    return "pgvector לא מוגדר — הוסף SUPABASE_SERVICE_ROLE_KEY ב-Vercel והרץ knowledge_pgvector.sql.";
  }
  if (msg.includes("query_and_context_required")) {
    return "שגיאת שרת — חיפוש מקומי יופעל אוטומטית.";
  }
  if (msg.includes("search_failed") || msg.includes("embedding_failed")) {
    return "שגיאה בחיפוש בשרת — נסה שוב או בדוק הגדרות Supabase.";
  }
  if (msg.includes("http_400") || msg.includes("http_500") || msg.includes("http_503")) {
    return "שגיאת שרת בבסיס הידע — נסה שוב בעוד רגע.";
  }
  if (msg.startsWith("openai_error:") || msg.startsWith("ai_error:")) {
    return "שגיאה ב-AI — נסה שוב מאוחר יותר.";
  }
  return "לא ניתן להפעיל AI כרגע.";
}

export function formatEmbeddingError(code, retryAfterSec) {
  const msg = String(code || "");
  const waitSec = retryAfterSec ?? getOpenAiRateLimitRetrySec();
  if (msg.includes("openai_not_configured")) {
    return "Embeddings לא זמינים — הגדר OPENAI_API_KEY ב-Vercel. החיפוש יעבוד במצב מילות מפתח בלבד.";
  }
  if (msg.includes("429")) {
    if (waitSec > 0) {
      return `מגבלת קצב ב-OpenAI — embeddings חלקיים נשמרו. נסה לבנות אינדקס שוב בעוד ${waitSec} שניות.`;
    }
    return "מגבלת קצב ב-OpenAI — embeddings חלקיים נשמרו. המתן דקה ונסה שוב.";
  }
  if (msg === "network") {
    return "בעיית רשת בעת יצירת embeddings — בדוק חיבור או הרץ vercel dev.";
  }
  return "יצירת embeddings נכשלה — החיפוש יעבוד במצב מילות מפתח בלבד.";
}

async function callOpenAiViaServer(query, chunks, context) {
  let lastErr = null;

  for (let attempt = 0; attempt <= CHAT_CLIENT_MAX_RETRIES; attempt += 1) {
    if (attempt > 0) {
      const waitMs = (getOpenAiRateLimitRetrySec() || 8) * 1000;
      await sleep(waitMs);
    }

    const res = await fetchWithTimeout("/api/knowledge-chat", {
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
      lastErr = new Error(String(code));
      lastErr.retryAfterSec = data.retryAfterSec ?? getOpenAiRateLimitRetrySec();
      lastErr.rateLimited = isRateLimitCode(code, res.status);

      if (lastErr.rateLimited) {
        markRateLimited((lastErr.retryAfterSec || 30) * 1000);
        if (attempt < CHAT_CLIENT_MAX_RETRIES) continue;
      }
      throw lastErr;
    }

    const raw = data.answer?.trim() || KNOWLEDGE_NO_CONTEXT_ANSWER;
    return {
      answer: polishModelAnswer(raw),
      citations: uniqueCitations(chunks),
      mode: "openai",
    };
  }

  throw lastErr || new Error("openai_error:429");
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
  return sanitizeAssistantAnswer(raw);
}

function resolvePageImages(chunks, limit = 3) {
  const seen = new Set();
  const images = [];

  for (const chunk of chunks) {
    if (chunk.pageNumber == null) continue;
    const key = `${chunk.documentId}:${chunk.pageNumber}`;
    if (seen.has(key)) continue;

    const doc = getKnowledgeDocument(chunk.documentId);
    const page = doc?.pages?.find((p) => p.pageNumber === chunk.pageNumber);
    if (!page?.thumbnail) continue;

    seen.add(key);
    images.push({
      documentId: chunk.documentId,
      documentTitle: chunk.documentName || chunk.documentTitle || doc?.title,
      pageNumber: chunk.pageNumber,
      src: page.thumbnail,
    });
    if (images.length >= limit) break;
  }

  return images;
}

function formatSourceLine(chunk) {
  const parts = [
    chunk.documentName || chunk.documentTitle,
    chunk.pageNumber != null ? `עמוד ${chunk.pageNumber}` : null,
    chunk.sectionTitle || null,
  ].filter(Boolean);
  return parts.join(" / ");
}

function collectChunkPageNumbers(chunks) {
  return [
    ...new Set(
      (chunks || [])
        .map((c) => c.pageNumber)
        .filter((n) => n != null),
    ),
  ].sort((a, b) => a - b);
}

/** Page-only answer — no procedural text from OCR chunks. */
function buildPageReferenceAnswer(chunks, imageCount = 0) {
  const docName = chunks[0]?.documentName || chunks[0]?.documentTitle || "המסמך";
  const pages = collectChunkPageNumbers(chunks);

  if (!pages.length && imageCount === 0) {
    return KNOWLEDGE_LOW_RELEVANCE_ANSWER;
  }

  const pageList =
    pages.length > 0
      ? pages.map((n) => `- עמוד ${n}`).join("\n")
      : "- (ראו צילומי המסך למטה)";

  const line1 =
    pages.length > 0
      ? `העמודים הרלוונטיים במסמך **${docName}** הם: ${pages.join(", ")}.`
      : `נמצאו צילומי מסך רלוונטיים במסמך **${docName}**.`;
  const line2 = "להלן תצוגת העמודים — ללא טקסט הוראות.";

  const parts = [`${line1}\n${line2}`, `### עמודים רלוונטיים\n${pageList}`];
  if (imageCount > 0) {
    const pageHint =
      pages.length > 1
        ? ` (עמודים ${pages.slice(0, 6).join(", ")}${pages.length > 6 ? "…" : ""})`
        : pages.length === 1
          ? ` (עמוד ${pages[0]})`
          : "";
    parts.push(`להלן צילומי העמודים הרלוונטיים ממסמך **${docName}**${pageHint}:`);
  }

  return sanitizeAssistantAnswer(parts.join("\n\n"));
}

/** Pick sentences from chunk text that match the user's question. */
function extractRelevantSentences(text, queryTokens, maxSentences = 4) {
  const cleaned = sanitizeChunkText(text, { preserveLines: true });
  const sentences = cleaned
    .split(/(?<=[.!?…\n])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 12 && /[\u0590-\u05FFa-zA-Z]/.test(s));

  if (!sentences.length) return [truncateSnippet(cleaned, 280)];

  const scored = sentences.map((sentence) => {
    const hay = sentence.toLowerCase();
    let score = 0;
    for (const token of queryTokens) {
      if (hay.includes(token)) score += token.length >= 4 ? 3 : 2;
    }
    return { sentence, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const picked = scored.filter((r) => r.score > 0).slice(0, maxSentences);
  if (picked.length) return picked.map((r) => r.sentence);

  return sentences.slice(0, Math.min(2, sentences.length));
}

/** Structured Hebrew answer without GPT — keyword-focused excerpts. */
function buildLocalStructuredAnswer(chunks, query = "", imageCount = 0) {
  if (isPageReferenceOnlyQuestion(query)) {
    return buildPageReferenceAnswer(chunks, imageCount);
  }

  const queryTokens = tokenize(query);
  const sentences = [];
  const seen = new Set();

  for (const chunk of chunks.slice(0, 3)) {
    for (const sentence of extractRelevantSentences(chunk.text, queryTokens, 3)) {
      const key = sentence.slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      sentences.push(sentence);
      if (sentences.length >= 4) break;
    }
    if (sentences.length >= 4) break;
  }

  if (!sentences.length) {
    sentences.push(truncateSnippet(chunks[0]?.text || "", 320));
  }

  const lead = sanitizeAssistantAnswer(sentences[0]);
  const detail =
    sentences.length > 1
      ? sentences
          .slice(1)
          .map((s) => `- ${sanitizeAssistantAnswer(s)}`)
          .join("\n")
      : "";

  const source = formatSourceLine(chunks[0]);
  const parts = [lead];
  if (detail) parts.push(`**פירוט:**\n${detail}`);
  if (source) parts.push(`*מקור: ${source}*`);
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
 * Client-side RAG — local index + GPT via /api/knowledge-chat (with context).
 */
async function askKnowledgeLocal(query, { onPhase } = {}) {
  const trimmed = normalizeText(query);

  await hydrateKnowledgeStore();
  const existing = readKnowledgeChunkIndex();
  if (!existing?.chunks?.length && listKnowledgeDocuments().length > 0 && !isOpenAiRateLimited()) {
    onPhase?.("indexing");
    await rebuildKnowledgeChunkIndex().catch(() => {});
  } else if (!existing?.chunks?.length && listKnowledgeDocuments().length > 0) {
    await rebuildKnowledgeChunkIndex().catch(() => {});
  }

  const retrieval = await searchKnowledgeChunksWithScores(trimmed, RETRIEVAL_TOP_K, { onPhase });
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
      images: [],
      mode: "low_relevance",
      debug,
    };
  }

  const pageImages = resolvePageImages(chunks);
  const localAnswer = () => ({
    answer: buildLocalStructuredAnswer(chunks, trimmed, pageImages.length),
    citations: uniqueCitations(chunks),
    chunks,
    images: pageImages,
    mode: "local_fallback",
    debug,
  });

  if (isOpenAiRateLimited()) {
    return { ...localAnswer(), gptSkipped: true, gptSkipReason: "rate_limit" };
  }

  onPhase?.("gpt");
  const probe = await probeOpenAiAvailability();
  if (probe.available && !probe.rateLimited) {
    try {
      const result = await callOpenAi(trimmed, chunks, context);
      return { ...result, chunks, images: pageImages, debug };
    } catch (err) {
      resetOpenAiProbeCache();

      const retryAfterSec = err?.retryAfterSec ?? getOpenAiRateLimitRetrySec();
      const rateLimited = err?.rateLimited || isRateLimitCode(err?.message, 429);

      if (rateLimited) {
        markRateLimited((retryAfterSec || 45) * 1000);
        return {
          ...localAnswer(),
          gptSkipped: true,
          gptSkipReason: "rate_limit",
          retryAfterSec,
        };
      }

      return {
        ...localAnswer(),
        openAiFailed: true,
        openAiError: formatOpenAiError(err, retryAfterSec),
        rateLimited,
        retryAfterSec,
      };
    }
  }

  return localAnswer();
}

/**
 * Retrieve relevant chunks and produce an answer (OpenAI or low-relevance message).
 */
export async function askKnowledgeBase(query, { onPhase } = {}) {
  const trimmed = normalizeText(query);
  if (!trimmed) {
    return { answer: "נא להקליד שאלה.", citations: [], chunks: [], images: [], mode: "empty", debug: null };
  }

  if (shouldUseServerRag()) {
    try {
      return await askKnowledgeServer(trimmed, { onPhase, tenantId: getKnowledgeTenantId() });
    } catch (err) {
      if (err?.rateLimited || isRateLimitCode(err?.message, 429)) {
        markRateLimited((err?.retryAfterSec || 45) * 1000);
      }
      if (import.meta.env.DEV) {
        console.warn("[knowledge] server RAG failed, falling back to local", err?.message || err);
      }
      onPhase?.("fallback_local");
    }
  }

  return askKnowledgeLocal(trimmed, { onPhase });
}

export { KNOWLEDGE_SYSTEM_PROMPT, KNOWLEDGE_LOW_RELEVANCE_ANSWER };

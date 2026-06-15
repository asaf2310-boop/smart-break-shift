/**
 * Client API for server-side pgvector RAG.
 * Production + Supabase: ingest/search/chat run on Vercel — no full documents to AI.
 */

import { demoModeEnabled } from "@/api/demoClient";
import { isSupabaseBackend } from "@/api/dataClient";
import { KNOWLEDGE_LOW_RELEVANCE_ANSWER } from "@/lib/knowledgePrompt";

const API_TIMEOUT_MS = 25_000;
const INGEST_TIMEOUT_MS = 120_000;
const PAGE_INGEST_TIMEOUT_MS = 120_000;
const PAGE_INGEST_BATCH = 1;
const INGEST_RETRY_ATTEMPTS = 2;

async function postKnowledgeUploadWithRetry(body, timeoutMs = API_TIMEOUT_MS) {
  let lastErr;
  for (let attempt = 0; attempt < INGEST_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await postKnowledgeUpload(body, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (err?.name === "AbortError") throw new Error("ingest_timeout");
      if (attempt + 1 < INGEST_RETRY_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
    }
  }
  throw new Error("ingest_network");
}

function postKnowledgeUpload(body, timeoutMs = API_TIMEOUT_MS) {
  return fetchWithTimeout(
    "/api/knowledge-upload",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
}

function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

/** Resolve tenant for knowledge isolation — shared (null) when unset. */
export function getKnowledgeTenantId() {
  const envTenant = String(import.meta.env.VITE_DEFAULT_TENANT || "").trim();
  return envTenant || null;
}

/** Use pgvector server RAG in production with Supabase backend. */
export function shouldUseServerRag() {
  return import.meta.env.PROD && !demoModeEnabled && isSupabaseBackend();
}

export async function probeServerRagHealth() {
  try {
    const res = await fetchWithTimeout("/api/knowledge-chat?health=1");
    if (!res.ok) return { available: false, pgvector: false, provider: null };
    const data = await res.json();
    return {
      available: Boolean(data.ok),
      provider: data.provider || null,
      pgvector: Boolean(data.pgvector),
      embeddings: Boolean(data.embeddings),
      minConfidence: data.minConfidence ?? 0.58,
    };
  } catch {
    return { available: false, pgvector: false, provider: null };
  }
}

export async function fetchKnowledgeWelcome() {
  const res = await fetchWithTimeout("/api/knowledge-chat?welcome=1");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "welcome_failed");
  return {
    message: String(data.message || "").trim(),
    source: data.source || "fallback",
  };
}

export async function listServerDocuments() {
  const res = await fetchWithTimeout("/api/knowledge-upload");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "list_failed");
  return data;
}

/**
 * @param {object} document — id, title, content, category, sourceType, fileName, pages, images, tenantId
 */
export async function ingestServerDocument(document) {
  let res;
  try {
    res = await postKnowledgeUploadWithRetry(
      {
        action: "ingest",
        document: { ...document, tenantId: document.tenantId ?? getKnowledgeTenantId() },
      },
      INGEST_TIMEOUT_MS,
    );
  } catch (err) {
    if (err?.message === "ingest_timeout" || err?.name === "AbortError") throw new Error("ingest_timeout");
    throw new Error("ingest_network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `ingest_http_${res.status}`);
    err.httpStatus = res.status;
    throw err;
  }
  return data;
}

/**
 * Upload PDF page thumbnails in a small batch (after text ingest).
 */
export async function ingestServerDocumentPages({
  documentId,
  title,
  fileName,
  category,
  content,
  tenantId,
  pages,
  replaceAll = false,
  runOcr = true,
}) {
  let res;
  try {
    res = await postKnowledgeUploadWithRetry(
      {
        action: "ingest_pages",
        documentId,
        title,
        fileName,
        category,
        content,
        tenantId: tenantId ?? getKnowledgeTenantId(),
        pages,
        replaceAll,
        runOcr,
      },
      PAGE_INGEST_TIMEOUT_MS,
    );
  } catch (err) {
    if (err?.message === "ingest_timeout" || err?.name === "AbortError") throw new Error("ingest_timeout");
    throw new Error("ingest_network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `ingest_pages_http_${res.status}`);
    err.httpStatus = res.status;
    throw err;
  }
  return data;
}

/**
 * Load page thumbnails stored on server (for admin edit preview).
 */
export async function fetchServerDocumentPageImages(documentId) {
  const id = String(documentId || "").trim();
  if (!id) return [];
  const res = await fetchWithTimeout(`/api/knowledge-upload?documentId=${encodeURIComponent(id)}&images=1`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "page_images_failed");
  return data.pages || [];
}

/** Public read-only document viewer URL (opens in new tab from chat citations). */
export function buildKnowledgeDocumentViewUrl(documentId, pageNumber) {
  const id = String(documentId || "").trim();
  if (!id) return "/knowledge";
  const base = `/knowledge/document/${encodeURIComponent(id)}`;
  const page = Number(pageNumber);
  if (Number.isFinite(page) && page > 0) return `${base}?page=${page}`;
  return base;
}

export async function fetchKnowledgeDocumentView(documentId) {
  const id = String(documentId || "").trim();
  if (!id) throw new Error("document_id_required");
  const res = await fetchWithTimeout(`/api/knowledge-upload?documentId=${encodeURIComponent(id)}&view=1`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "document_view_failed");
  return data;
}

export { PAGE_INGEST_BATCH };

export async function reprocessServerDocument(documentId) {
  const res = await fetchWithTimeout("/api/knowledge-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reprocess", documentId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "reprocess_failed");
  return data;
}

export async function deleteServerDocument(documentId) {
  const res = await fetchWithTimeout("/api/knowledge-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", documentId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "delete_failed");
  return data;
}

export async function listKnowledgeGaps({ status = null } = {}) {
  const params = new URLSearchParams({ type: "gaps" });
  if (status) params.set("status", status);
  const tenantId = getKnowledgeTenantId();
  if (tenantId) params.set("tenantId", tenantId);

  const res = await fetchWithTimeout(`/api/knowledge-feedback?${params}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "list_gaps_failed");
  return data.gaps || [];
}

export async function updateKnowledgeGap(gapId, { manualAnswer, status }) {
  const res = await fetchWithTimeout("/api/knowledge-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "update_gap",
      gapId,
      manualAnswer,
      status,
      tenantId: getKnowledgeTenantId(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "update_gap_failed");
  return data;
}

export async function submitKnowledgeFeedback({ question, answer, helpful, confidence }) {
  const res = await fetchWithTimeout("/api/knowledge-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "feedback",
      question,
      answer,
      helpful,
      confidence,
      tenantId: getKnowledgeTenantId(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "feedback_failed");
  return data;
}

/**
 * Web search fallback — Gemini + Google Search grounding (no local RAG).
 * @param {string} query
 * @param {{ onPhase?: Function }} [options]
 */
export async function askKnowledgeWebSearch(query, { onPhase } = {}) {
  const trimmed = String(query || "").replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return {
      answer: "נא להקליד שאלה.",
      citations: [],
      webSources: [],
      chunks: [],
      images: [],
      confidence: 0,
      mode: "empty",
      grounded: false,
      debug: null,
    };
  }

  onPhase?.("web_search");

  let res;
  try {
    res = await fetchWithTimeout("/api/ask-web", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: trimmed }),
    });
  } catch {
    throw new Error("network");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `http_${res.status}`);
    err.retryAfterSec = data.retryAfterSec;
    err.rateLimited = data.rateLimited || res.status === 429;
    err.highDemand = data.highDemand || (!err.rateLimited && res.status === 503);
    err.userMessage =
      data.message ||
      (err.rateLimited
        ? "מגבלת קצב ב-Gemini — נסו שוב בעוד רגע."
        : err.highDemand
          ? "שירות Gemini עמוס זמנית (ביקוש גבוה). נסו שוב בעוד דקה."
          : "חיפוש ברשת נכשל. נסו שוב בעוד רגע.");
    throw err;
  }

  onPhase?.("gpt");

  return {
    answer: data.hebrewAnswerMarkdown || data.answer || "לא התקבלה תשובה.",
    citations: [],
    webSources: data.webSources || [],
    sources: data.sources || [],
    chunks: [],
    images: [],
    confidence: null,
    grounded: false,
    mode: data.mode || "web_search",
    debug: data.debug || null,
    openAiFailed: false,
  };
}

/**
 * Load page thumbnails when API returned chunks but no image URLs.
 */
async function hydrateKnowledgeImagesFromChunks(existingImages, chunks) {
  if (existingImages?.length) return existingImages;
  if (!chunks?.length) return [];

  const byDoc = new Map();
  for (const c of chunks) {
    if (!c?.documentId) continue;
    if (!byDoc.has(c.documentId)) byDoc.set(c.documentId, new Set());
    if (c.pageNumber != null) byDoc.get(c.documentId).add(c.pageNumber);
  }

  const images = [];
  for (const [documentId, pageSet] of byDoc) {
    try {
      const pages = await fetchServerDocumentPageImages(documentId);
      const picked = pageSet.size
        ? pages.filter((p) => pageSet.has(p.pageNumber))
        : pages;
      for (const p of picked.slice(0, 5)) {
        if (!p?.thumbnail) continue;
        images.push({
          url: p.thumbnail,
          src: p.thumbnail,
          documentId,
          documentName: null,
          documentTitle: null,
          pageNumber: p.pageNumber ?? null,
          caption: p.sectionTitle || null,
        });
      }
    } catch {
      /* optional hydration */
    }
  }
  return images;
}

/**
 * Full server-side RAG — query only, no document bodies.
 * @param {string} query
 * @param {{ onPhase?: Function, tenantId?: string | null }} [options]
 */
export async function askKnowledgeServer(query, { onPhase, tenantId } = {}) {
  const trimmed = String(query || "").replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return {
      answer: "נא להקליד שאלה.",
      citations: [],
      chunks: [],
      images: [],
      confidence: 0,
      mode: "empty",
      debug: null,
    };
  }

  onPhase?.("searching");
  onPhase?.("embedding");

  let res;
  try {
    res = await fetchWithTimeout("/api/knowledge-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: trimmed,
        rag: true,
        tenantId: tenantId ?? getKnowledgeTenantId(),
      }),
    });
  } catch {
    throw new Error("network");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `http_${res.status}`);
    err.retryAfterSec = data.retryAfterSec;
    err.rateLimited = data.rateLimited || res.status === 429;
    throw err;
  }

  onPhase?.("gpt");

  const chunks = data.chunks || [];
  const images = await hydrateKnowledgeImagesFromChunks(
    (data.images || []).map((img) => ({
      id: img.id ?? null,
      url: img.url || img.src,
      src: img.src || img.url,
      documentId: img.documentId,
      documentName: img.documentName || img.documentTitle,
      documentTitle: img.documentTitle || img.documentName,
      pageNumber: img.pageNumber ?? null,
      caption: img.caption || img.description || null,
      label: img.label ?? null,
    })),
    chunks,
  );

  return {
    answer: data.answer || KNOWLEDGE_LOW_RELEVANCE_ANSWER,
    citations: data.citations || [],
    sources: data.sources || [],
    chunks,
    images,
    confidence: data.confidence ?? null,
    grounded: data.grounded === true,
    mode: data.mode || "openai",
    debug: data.debug || null,
    openAiFailed: false,
  };
}

export { KNOWLEDGE_LOW_RELEVANCE_ANSWER };

/**
 * Client API for server-side pgvector RAG.
 * Production + Supabase: ingest/search/chat run on Vercel — no full documents to AI.
 */

import { demoModeEnabled } from "@/api/demoClient";
import { isSupabaseBackend } from "@/api/dataClient";
import { KNOWLEDGE_LOW_RELEVANCE_ANSWER } from "@/lib/knowledgePrompt";

const API_TIMEOUT_MS = 25_000;

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
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
    if (!res.ok) return { available: false, pgvector: false };
    const data = await res.json();
    return {
      available: Boolean(data.ok),
      pgvector: Boolean(data.pgvector),
      embeddings: Boolean(data.embeddings),
      minConfidence: data.minConfidence ?? 0.58,
    };
  } catch {
    return { available: false, pgvector: false };
  }
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
  const res = await fetchWithTimeout("/api/knowledge-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "ingest",
      document: { ...document, tenantId: document.tenantId ?? getKnowledgeTenantId() },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "ingest_failed");
  return data;
}

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

  return {
    answer: data.answer || KNOWLEDGE_LOW_RELEVANCE_ANSWER,
    citations: data.citations || [],
    chunks: data.chunks || [],
    images: data.images || [],
    confidence: data.confidence ?? null,
    mode: data.mode || "openai",
    debug: data.debug || null,
    openAiFailed: false,
  };
}

export { KNOWLEDGE_LOW_RELEVANCE_ANSWER };

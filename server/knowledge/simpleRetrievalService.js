/** Direct chunk retrieval — scans DB text/OCR/file names without relying on embeddings. */

import { getSupabaseAdmin } from "./supabaseAdmin.js";
import {
  extractSearchTerms,
  scoreChunkKeywordMatch,
  normalizeKeywordScore,
  hasStrongKeywordMatch,
} from "./queryTermsService.js";

const MAX_CHUNKS_LOAD = 250;

function tenantOrFilter(query, tenantId) {
  if (tenantId) {
    return query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
  }
  return query;
}

function enrichChunkRow(row, docMeta, ocrByDocPage) {
  const doc = docMeta.get(row.document_id);
  const pageKey = `${row.document_id}:${row.page_number ?? ""}`;
  const ocrHay = ocrByDocPage.get(pageKey) || "";
  const baseText = String(row.chunk_text || "").trim();
  const combinedText = [baseText, ocrHay, doc?.file_name, doc?.title]
    .filter(Boolean)
    .join("\n\n");

  return {
    id: row.id,
    documentId: row.document_id,
    documentName: row.document_name || doc?.title || "מסמך",
    documentTitle: row.document_name || doc?.title || "מסמך",
    fileName: doc?.file_name || null,
    category: row.category,
    chunkIndex: row.chunk_index,
    pageNumber: row.page_number,
    sectionTitle: row.section_title,
    text: combinedText || baseText,
    ocrText: ocrHay || null,
  };
}

function scoreDirectHit(chunk, terms, query) {
  const raw = scoreChunkKeywordMatch(chunk, terms);
  let boost = 0;

  for (const term of terms) {
    const t = term.toLowerCase();
    const fileName = String(chunk.fileName || "").toLowerCase();
    const docName = String(chunk.documentName || "").toLowerCase();
    const ocr = String(chunk.ocrText || "").toLowerCase();
    if (fileName.includes(t)) boost += 5;
    if (docName.includes(t)) boost += 4;
    if (ocr.includes(t)) boost += 4;
  }

  const keywordScore = normalizeKeywordScore(raw + boost, terms);
  const strong = hasStrongKeywordMatch(query, chunk);

  return {
    chunk,
    score: Math.max(keywordScore, strong ? 0.72 : 0),
    keywordScore: Math.max(keywordScore, strong ? 0.72 : 0),
    vectorScore: 0,
    imageScore: 0,
    method: "direct",
    strongMatch: strong,
  };
}

/**
 * Load chunks from Supabase and rank by literal term overlap (text, OCR, file name).
 * @param {string} query
 * @param {{ topK?: number, tenantId?: string | null }} [options]
 */
export async function directChunkSearch(query, options = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { hits: [], searchTerms: [], passesThreshold: false, error: "supabase_not_configured" };
  }

  const topK = options.topK ?? 5;
  const tenantId = options.tenantId ?? null;
  const terms = extractSearchTerms(query);

  let chunkQuery = supabase
    .from("knowledge_chunks")
    .select(
      "id, tenant_id, document_id, document_name, chunk_text, chunk_index, page_number, section_title, category",
    )
    .limit(MAX_CHUNKS_LOAD);

  chunkQuery = tenantOrFilter(chunkQuery, tenantId);

  const { data: rows, error } = await chunkQuery;
  if (error) {
    return { hits: [], searchTerms: terms, passesThreshold: false, error: error.message };
  }

  if (!rows?.length) {
    return { hits: [], searchTerms: terms, passesThreshold: false, error: null };
  }

  const docIds = [...new Set(rows.map((r) => r.document_id).filter(Boolean))];

  const [{ data: docs }, { data: images }] = await Promise.all([
    supabase.from("knowledge_documents").select("id, file_name, title").in("id", docIds),
    supabase
      .from("knowledge_images")
      .select("document_id, page_number, ocr_text, description")
      .in("document_id", docIds),
  ]);

  const docMeta = new Map((docs || []).map((d) => [d.id, d]));
  const ocrByDocPage = new Map();
  for (const img of images || []) {
    const key = `${img.document_id}:${img.page_number ?? ""}`;
    const prev = ocrByDocPage.get(key) || "";
    ocrByDocPage.set(key, `${prev} ${img.ocr_text || ""} ${img.description || ""}`.trim());
  }

  const scored = [];
  for (const row of rows) {
    const chunk = enrichChunkRow(row, docMeta, ocrByDocPage);
    const hit = scoreDirectHit(chunk, terms, query);
    if (hit.keywordScore > 0 || hit.strongMatch) {
      scored.push(hit);
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const hits = scored.slice(0, topK);
  const top = hits[0];
  const passesThreshold = Boolean(
    top && (top.strongMatch || top.keywordScore >= 0.2 || top.score >= 0.2),
  );

  return {
    hits,
    searchTerms: terms,
    passesThreshold,
    retrievalMethod: "direct",
    error: null,
  };
}

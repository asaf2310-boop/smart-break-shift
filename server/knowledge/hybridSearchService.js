/** Hybrid RAG search — pgvector + keyword + image embeddings, reranked. */

import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { searchKnowledgeChunks, RETRIEVAL_TOP_K_DEFAULT } from "./vectorSearchService.js";
import { searchKnowledgeImages } from "./imageIngestService.js";
import { KNOWLEDGE_MISSING_ANSWER } from "./geminiKnowledgePrompt.js";

export const MIN_CONFIDENCE = 0.58;
export const KNOWLEDGE_NO_SOURCE_ANSWER = KNOWLEDGE_MISSING_ANSWER;

const VECTOR_WEIGHT = 0.55;
const KEYWORD_WEIGHT = 0.25;
const IMAGE_WEIGHT = 0.20;
const MAX_CHUNKS_PER_DOCUMENT = 2;

/**
 * @param {string} query
 * @param {number[]} queryEmbedding
 * @param {{ topK?: number, tenantId?: string | null }} [options]
 */
export async function hybridSearch(query, queryEmbedding, options = {}) {
  const topK = options.topK ?? RETRIEVAL_TOP_K_DEFAULT;
  const tenantId = options.tenantId ?? null;

  const [vectorResult, keywordHits, imageResult] = await Promise.all([
    searchKnowledgeChunks(queryEmbedding, { topK: topK * 2, tenantId }),
    searchKeywordChunks(query, { topK: topK * 2, tenantId }),
    searchKnowledgeImages(queryEmbedding, { topK, tenantId }),
  ]);

  const merged = mergeAndRerank(
    vectorResult.hits || [],
    keywordHits,
    imageResult.hits || [],
    topK,
  );

  const top = merged[0];
  const confidence = top
    ? Math.max(top.vectorScore || 0, top.keywordScore || 0, top.score || 0)
    : 0;

  return {
    hits: merged,
    imageHits: imageResult.hits || [],
    confidence,
    passesThreshold: passesHybridThreshold(merged),
    retrievalMethod: "hybrid",
    error: vectorResult.error || imageResult.error || null,
  };
}

/**
 * MIN_CONFIDENCE targets raw embedding similarity; hybrid combined scores are weighted
 * (vector-only max ≈ VECTOR_WEIGHT). Check component scores, not combined alone.
 */
export function passesHybridThreshold(hits) {
  if (!hits.length) return false;
  const top = hits[0];
  const vectorScore = top.vectorScore || 0;
  const keywordScore = top.keywordScore || 0;
  const imageScore = top.imageScore || 0;
  const combined = top.score || 0;

  if (vectorScore >= MIN_CONFIDENCE) return true;
  if (keywordScore >= 0.55 && vectorScore >= MIN_CONFIDENCE - 0.18) return true;
  if (imageScore >= 0.5 && vectorScore >= MIN_CONFIDENCE - 0.15) return true;
  return combined >= MIN_CONFIDENCE * VECTOR_WEIGHT;
}

async function searchKeywordChunks(query, { topK = 5, tenantId = null } = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("search_knowledge_chunks_keyword", {
    search_query: query,
    match_count: topK,
    filter_tenant_id: tenantId,
  });

  if (error) {
    console.warn("[hybridSearch keyword]", error.message);
    return [];
  }

  const maxScore = Math.max(...(data || []).map((r) => r.keyword_score || 0), 1);

  return (data || []).map((row) => ({
    chunk: {
      id: row.id,
      documentId: row.document_id,
      documentName: row.document_name,
      documentTitle: row.document_name,
      category: row.category,
      chunkIndex: row.chunk_index,
      pageNumber: row.page_number,
      sectionTitle: row.section_title,
      text: row.chunk_text,
    },
    score: (row.keyword_score || 0) / maxScore,
    method: "keyword",
  }));
}

function mergeAndRerank(vectorHits, keywordHits, imageHits, topK) {
  const scoreMap = new Map();

  for (const hit of vectorHits) {
    const id = hit.chunk.id;
    const prev = scoreMap.get(id) || { chunk: hit.chunk, vectorScore: 0, keywordScore: 0, imageScore: 0 };
    prev.vectorScore = Math.max(prev.vectorScore, hit.score);
    prev.chunk = hit.chunk;
    scoreMap.set(id, prev);
  }

  for (const hit of keywordHits) {
    const id = hit.chunk.id;
    const prev = scoreMap.get(id) || { chunk: hit.chunk, vectorScore: 0, keywordScore: 0, imageScore: 0 };
    prev.keywordScore = Math.max(prev.keywordScore, hit.score);
    prev.chunk = hit.chunk;
    scoreMap.set(id, prev);
  }

  const imageBoostByDocPage = new Map();
  for (const hit of imageHits) {
    const key = `${hit.image.documentId}:${hit.image.pageNumber ?? ""}`;
    imageBoostByDocPage.set(key, Math.max(imageBoostByDocPage.get(key) || 0, hit.score));
  }

  for (const entry of scoreMap.values()) {
    const key = `${entry.chunk.documentId}:${entry.chunk.pageNumber ?? ""}`;
    entry.imageScore = imageBoostByDocPage.get(key) || 0;
    entry.combinedScore =
      entry.vectorScore * VECTOR_WEIGHT +
      entry.keywordScore * KEYWORD_WEIGHT +
      entry.imageScore * IMAGE_WEIGHT;
  }

  const ranked = [...scoreMap.values()]
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .map((entry) => ({
      chunk: entry.chunk,
      score: entry.combinedScore,
      vectorScore: entry.vectorScore,
      keywordScore: entry.keywordScore,
      imageScore: entry.imageScore,
      method: "hybrid",
    }));

  return diversifyHits(ranked, topK);
}

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

export function passesConfidenceThreshold(confidence) {
  return confidence >= MIN_CONFIDENCE || confidence >= MIN_CONFIDENCE * VECTOR_WEIGHT;
}

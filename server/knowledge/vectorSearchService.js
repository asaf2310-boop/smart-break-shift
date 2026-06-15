/** pgvector similarity search via Supabase RPC. */

import { getSupabaseAdmin } from "./supabaseAdmin.js";

export const RETRIEVAL_TOP_K_MIN = 3;
export const RETRIEVAL_TOP_K_MAX = 6;
export const RETRIEVAL_TOP_K_DEFAULT = 5;
export const MIN_EMBEDDING_SCORE = 0.58;
export const MIN_EMBEDDING_RELATIVE_RATIO = 0.72;
export const MAX_CHUNKS_PER_DOCUMENT = 2;

/**
 * @param {number[]} queryEmbedding
 * @param {{ topK?: number, tenantId?: string | null, threshold?: number }} [options]
 */
export async function searchKnowledgeChunks(queryEmbedding, options = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { hits: [], error: "supabase_not_configured" };
  }

  const topK = Math.min(
    RETRIEVAL_TOP_K_MAX,
    Math.max(RETRIEVAL_TOP_K_MIN, options.topK ?? RETRIEVAL_TOP_K_DEFAULT),
  );
  const threshold = options.threshold ?? MIN_EMBEDDING_SCORE - 0.06;

  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: queryEmbedding,
    match_count: topK * 3,
    match_threshold: threshold,
    filter_tenant_id: options.tenantId ?? null,
  });

  if (error) {
    console.error("[vectorSearchService]", error.message);
    return { hits: [], error: error.message };
  }

  const ranked = (data || [])
    .map((row) => ({
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
      score: row.similarity,
      method: "pgvector",
    }))
    .filter((row) => row.score >= MIN_EMBEDDING_SCORE)
    .sort((a, b) => b.score - a.score);

  const diversified = diversifyHits(ranked, topK);
  return { hits: diversified, error: null };
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

export function passesRelevanceThreshold(hits) {
  if (!hits.length) return false;
  const best = hits[0].score;
  const minRelative = best * MIN_EMBEDDING_RELATIVE_RATIO;
  return hits.some((h) => h.score >= MIN_EMBEDDING_SCORE && h.score >= minRelative);
}

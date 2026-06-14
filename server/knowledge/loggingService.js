/** Persist knowledge query logs to Supabase. */

import { getSupabaseAdmin } from "./supabaseAdmin.js";

/**
 * @param {{ question: string, tenantId?: string | null, retrievalMethod: string, hits: Array, answer: string }} payload
 */
export async function logKnowledgeQuery(payload) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.log("[knowledge RAG]", {
      question: payload.question,
      retrievalMethod: payload.retrievalMethod,
      retrievedChunks: payload.hits?.map((h) => ({
        documentName: h.chunk?.documentName,
        score: Number(h.score?.toFixed?.(4) ?? h.score),
        pageNumber: h.chunk?.pageNumber,
        sectionTitle: h.chunk?.sectionTitle,
      })),
      modelAnswer: payload.answer,
    });
    return;
  }

  const retrievedChunks = (payload.hits || []).map((h) => ({
    documentName: h.chunk?.documentName || h.chunk?.documentTitle,
    documentId: h.chunk?.documentId,
    chunkIndex: h.chunk?.chunkIndex,
    pageNumber: h.chunk?.pageNumber,
    sectionTitle: h.chunk?.sectionTitle,
    score: Number((h.score ?? 0).toFixed(4)),
    snippet: String(h.chunk?.text || "").slice(0, 160),
  }));

  const row = {
    tenant_id: payload.tenantId ?? null,
    question: payload.question,
    retrieval_method: payload.retrievalMethod,
    retrieved_chunks: retrievedChunks,
    model_answer: payload.answer,
  };

  const { error } = await supabase.from("knowledge_query_logs").insert(row);
  if (error) {
    console.warn("[knowledgeQueryLog]", error.message);
  }

  console.log("[knowledge RAG]", {
    question: payload.question,
    retrievalMethod: payload.retrievalMethod,
    chunkCount: retrievedChunks.length,
    topScore: retrievedChunks[0]?.score ?? null,
  });
}

/** Cohere cross-encoder rerank for RAG retrieval (Hebrew + English). */

export const COHERE_RERANK_MODEL = "rerank-multilingual-v3.0";
export const COHERE_RERANK_URL = "https://api.cohere.com/v1/rerank";

function getCohereApiKey() {
  return String(process.env.COHERE_API_KEY || "").trim();
}

export function isCohereRerankConfigured() {
  return Boolean(getCohereApiKey());
}

/**
 * Rerank hybrid search hits by semantic relevance to the user query.
 * Falls back to score-sorted slice when Cohere is not configured or the API fails.
 *
 * @param {string} query
 * @param {Array<{ chunk: object, score?: number, vectorScore?: number, keywordScore?: number }>} hits
 * @param {{ topN?: number }} [options]
 */
export async function rerankKnowledgeHits(query, hits, options = {}) {
  const topN = Math.max(1, options.topN ?? 3);
  const pool = (hits || []).filter((h) => String(h?.chunk?.text || "").trim());
  if (!pool.length) {
    return { hits: [], reranked: false, rerankModel: null, error: null };
  }

  if (pool.length <= topN) {
    return { hits: pool.slice(0, topN), reranked: false, rerankModel: null, error: null };
  }

  const apiKey = getCohereApiKey();
  if (!apiKey) {
    return { hits: pool.slice(0, topN), reranked: false, rerankModel: null, error: null };
  }

  const model = String(process.env.COHERE_RERANK_MODEL || COHERE_RERANK_MODEL).trim();

  try {
    const response = await fetch(COHERE_RERANK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        query: String(query || "").trim(),
        documents: pool.map((h) => h.chunk.text),
        top_n: Math.min(topN, pool.length),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.warn("[cohereRerank]", response.status, detail.slice(0, 240));
      return {
        hits: pool.slice(0, topN),
        reranked: false,
        rerankModel: model,
        error: `cohere_rerank_${response.status}`,
      };
    }

    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];
    const reranked = results
      .map((row) => {
        const hit = pool[row.index];
        if (!hit) return null;
        return {
          ...hit,
          score: row.relevance_score ?? hit.score,
          rerankScore: row.relevance_score ?? null,
          method: "cohere_rerank",
        };
      })
      .filter(Boolean);

    if (!reranked.length) {
      return { hits: pool.slice(0, topN), reranked: false, rerankModel: model, error: "cohere_empty" };
    }

    return { hits: reranked, reranked: true, rerankModel: model, error: null };
  } catch (err) {
    console.warn("[cohereRerank]", err?.message || err);
    return {
      hits: pool.slice(0, topN),
      reranked: false,
      rerankModel: model,
      error: err?.message || "cohere_rerank_failed",
    };
  }
}

/**
 * Broad vector retrieval + Cohere rerank → context string for LLM (debug / tooling).
 * @param {string} userQuery
 * @param {Array<{ chunk: { text: string } }>} initialHits
 * @param {{ topN?: number }} [options]
 */
export async function getContextWithRerank(userQuery, initialHits, options = {}) {
  const { hits } = await rerankKnowledgeHits(userQuery, initialHits, {
    topN: options.topN ?? 3,
  });
  return hits.map((h) => h.chunk.text).join("\n\n");
}

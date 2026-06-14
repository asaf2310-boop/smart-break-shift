/** Vercel serverless — vector similarity search (debug / admin). */

import { json, readJsonBody, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { isPgVectorConfigured } from "../server/knowledge/supabaseAdmin.js";
import { embedQuery, isEmbeddingConfigured } from "../server/knowledge/embeddingService.js";
import { searchKnowledgeChunks } from "../server/knowledge/vectorSearchService.js";
import { truncateSnippet } from "../server/knowledge/chatAnswerService.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden" }, req);
  }

  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.searchParams.get("health") === "1") {
      return json(
        res,
        200,
        {
          ok: isPgVectorConfigured() && isEmbeddingConfigured(),
          pgvector: isPgVectorConfigured(),
          embeddings: isEmbeddingConfigured(),
        },
        req,
      );
    }
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (!isPgVectorConfigured()) {
    return json(res, 503, { error: "pgvector_not_configured" }, req);
  }

  if (!isEmbeddingConfigured()) {
    return json(res, 503, { error: "ai_not_configured" }, req);
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: "invalid_json" }, req);
  }

  const query = String(body.query || "").trim();
  if (!query) return json(res, 400, { error: "query_required" }, req);

  const { embedding, error: embedErr, retryAfterSec } = await embedQuery(query);
  if (embedErr || !embedding) {
    return json(
      res,
      embedErr?.includes("429") ? 429 : 503,
      { error: embedErr || "embedding_failed", retryAfterSec },
      req,
    );
  }

  const topK = body.topK ?? 5;
  const tenantId = body.tenantId ?? null;
  const { hits, error: searchErr } = await searchKnowledgeChunks(embedding, { topK, tenantId });
  if (searchErr) {
    return json(res, 500, { error: "search_failed", detail: searchErr }, req);
  }

  return json(
    res,
    200,
    {
      hits: hits.map((h) => ({
        documentId: h.chunk.documentId,
        documentName: h.chunk.documentName,
        chunkIndex: h.chunk.chunkIndex,
        pageNumber: h.chunk.pageNumber,
        sectionTitle: h.chunk.sectionTitle,
        score: Number(h.score.toFixed(4)),
        snippet: truncateSnippet(h.chunk.text, 200),
      })),
      method: "pgvector",
    },
    req,
  );
}

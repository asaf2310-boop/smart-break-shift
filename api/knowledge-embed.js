/** Vercel serverless — AI embeddings for knowledge RAG (Gemini / OpenAI) */

import { embedTexts, getEmbedModelName, isEmbeddingConfigured } from "../server/knowledge/embeddingService.js";
import { getAiProvider, getEmbeddingDimensions } from "../server/ai/aiProvider.js";
import { json, readJsonBody, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { requireKnowledgeAccess } from "../server/knowledge/requireKnowledgeAccess.js";

const MAX_BATCH = 64;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.searchParams.get("health") === "1") {
      return json(
        res,
        200,
        {
          ok: isEmbeddingConfigured(),
          provider: getAiProvider(),
          model: isEmbeddingConfigured() ? getEmbedModelName() : null,
          dimensions: getEmbeddingDimensions(),
        },
        req,
      );
    }
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden" }, req);
  }

  if (!(await requireKnowledgeAccess(req, res))) return;

  if (!isEmbeddingConfigured()) {
    return json(
      res,
      503,
      {
        code: "ai_not_configured",
        error: "ai_not_configured",
        message: "הגדר GEMINI_API_KEY (או OPENAI_API_KEY) ב-Vercel ופרוס מחדש.",
      },
      req,
    );
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: "invalid_json" }, req);
  }

  const inputs = Array.isArray(body.inputs)
    ? body.inputs.map((t) => String(t || "").trim()).filter(Boolean)
    : [];
  if (!inputs.length) {
    return json(res, 400, { error: "inputs_required" }, req);
  }
  if (inputs.length > MAX_BATCH) {
    return json(res, 400, { error: "batch_too_large", max: MAX_BATCH }, req);
  }

  const { embeddings, error, retryAfterSec } = await embedTexts(inputs);

  if (error || !embeddings) {
    const rateLimited = String(error || "").includes("429");
    return json(
      res,
      rateLimited ? 429 : 503,
      {
        error: error || "embedding_failed",
        retryAfterSec,
        rateLimited,
      },
      req,
    );
  }

  return json(
    res,
    200,
    { embeddings, model: getEmbedModelName(), mode: getAiProvider(), dimensions: getEmbeddingDimensions() },
    req,
  );
}

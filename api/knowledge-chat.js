/** Vercel serverless — full server-side RAG: hybrid search → Gemini multimodal. */

import { json, readJsonBody, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { isPgVectorConfigured } from "../server/knowledge/supabaseAdmin.js";
import { isEmbeddingConfigured } from "../server/knowledge/embeddingService.js";
import { MIN_CONFIDENCE } from "../server/knowledge/hybridSearchService.js";
import { buildKnowledgeSources } from "../server/knowledge/geminiChatService.js";
import { generateAgentResponse } from "../server/knowledge/generateAgentResponse.js";
import {
  getAiProvider,
  isAiConfigured,
  getChatModel,
  getEmbedModel,
  getEmbeddingDimensions,
  generateText,
} from "../server/ai/aiProvider.js";
import {
  KNOWLEDGE_SYSTEM_PROMPT,
  KNOWLEDGE_ANSWER_FORMAT_HINT,
  KNOWLEDGE_NO_CONTEXT_ANSWER,
} from "../server/knowledge/chatAnswerService.js";

function buildAgentResponse({
  answer,
  citations = [],
  sources = null,
  images = [],
  chunks = [],
  confidence = null,
  mode,
  grounded = true,
  debug = null,
}) {
  const normalizedImages = (images || []).map((img) => ({
    id: img.id ?? null,
    url: img.url || img.src,
    src: img.src || img.url,
    documentId: img.documentId,
    documentName: img.documentName || img.documentTitle,
    documentTitle: img.documentTitle || img.documentName,
    pageNumber: img.pageNumber ?? null,
    caption: img.caption || img.description || null,
    label: img.label ?? null,
  }));

  const normalizedSources =
    sources ||
    buildKnowledgeSources(citations, normalizedImages);

  return {
    answer,
    grounded,
    confidence,
    mode,
    sources: normalizedSources,
    citations,
    images: normalizedImages,
    chunks,
    debug,
  };
}

function resolveTenantId(body) {
  const fromBody = body.tenantId ?? body.tenant_id ?? null;
  if (fromBody) return fromBody;
  const envTenant = String(process.env.DEFAULT_TENANT || "").trim();
  return envTenant || null;
}

function isHowToQuestion(query) {
  const q = String(query || "").replace(/\s+/g, " ").trim();
  return /^(איך|כיצד|מהן?\s+השלבים|מה\s+התהליך|תהליך|הסבר\s+איך)/u.test(q);
}

function rejectsFullDocumentPayload(body) {
  if (Array.isArray(body.documents) && body.documents.length) return true;
  if (typeof body.content === "string" && body.content.length > 500) return true;
  const legacyChunks = Array.isArray(body.chunks) ? body.chunks : [];
  if (legacyChunks.some((c) => typeof c?.content === "string" && c.content.length > 600)) {
    return true;
  }
  return false;
}

/** Legacy mode: client sends pre-retrieved context (demo / fallback). */
async function handleLegacyChat(req, res, body) {
  const query = String(body.query || "").trim();
  const context = String(body.context || "").trim();

  if (!query || !context) {
    return json(res, 400, { error: "query_and_context_required" }, req);
  }

  if (!isAiConfigured()) {
    return json(res, 503, { error: "ai_not_configured" }, req);
  }

  const howTo = isHowToQuestion(query);
  const user = `קטעי הקשר (היחידים המותרים לשימוש):\n${context}\n\nשאלת הנציג: ${query}\n\n${KNOWLEDGE_ANSWER_FORMAT_HINT}${
    howTo ? "\n\nסוג שאלה: הדרכה / תהליך — השתמש בפירוט לפי סעיפים." : ""
  }`;

  const result = await generateText({
    system: `${KNOWLEDGE_SYSTEM_PROMPT}\n\n${KNOWLEDGE_ANSWER_FORMAT_HINT}`,
    user,
    maxTokens: howTo ? 480 : 380,
    temperature: 0.2,
  });

  if (result.error) {
    return json(
      res,
      result.rateLimited ? 429 : 503,
      {
        error: result.error,
        retryAfterSec: result.retryAfterSec,
        rateLimited: result.rateLimited,
      },
      req,
    );
  }

  const answer = result.text?.trim() || KNOWLEDGE_NO_CONTEXT_ANSWER;
  return json(
    res,
    200,
    buildAgentResponse({
      answer,
      citations: [],
      images: [],
      chunks: [],
      confidence: null,
      mode: getAiProvider(),
      grounded: true,
    }),
    req,
  );
}

async function handleServerRag(req, res, body) {
  const query = String(body.query || "").trim();
  const tenantId = resolveTenantId(body);
  const topK = body.topK ?? undefined;

  if (!query) {
    return json(res, 400, { error: "query_required" }, req);
  }

  const result = await generateAgentResponse(query, { tenantId, topK });

  if (result.error === "query_required") {
    return json(res, 400, { error: "query_required" }, req);
  }

  if (result.error === "pgvector_not_configured") {
    return json(res, 503, { error: "pgvector_not_configured" }, req);
  }

  if (result.error === "ai_not_configured") {
    return json(res, 503, { error: "ai_not_configured" }, req);
  }

  if (result.error === "embedding_failed" || (result.error && result.error !== "search_failed")) {
    const is429 = String(result.error || "").includes("429");
    return json(
      res,
      is429 ? 429 : 503,
      {
        error: result.error,
        retryAfterSec: result.retryAfterSec,
        rateLimited: is429,
        debug: result.debug,
      },
      req,
    );
  }

  if (result.error === "search_failed") {
    return json(res, 500, { error: "search_failed", detail: result.detail }, req);
  }

  if (result.error) {
    return json(
      res,
      result.rateLimited ? 429 : 503,
      {
        error: result.error,
        retryAfterSec: result.retryAfterSec,
        rateLimited: result.rateLimited,
        debug: result.debug,
      },
      req,
    );
  }

  return json(
    res,
    200,
    buildAgentResponse({
      answer: result.answer,
      citations: result.citations,
      sources: result.sources,
      images: result.images,
      chunks: result.chunks,
      confidence: result.confidence,
      mode: result.mode || getAiProvider(),
      grounded: result.grounded !== false,
      debug: result.debug,
    }),
    req,
  );
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  const provider = getAiProvider();

  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.searchParams.get("health") === "1") {
      return json(
        res,
        200,
        {
          ok: isAiConfigured(),
          provider,
          model: isAiConfigured() ? getChatModel() : null,
          embedModel: isAiConfigured() ? getEmbedModel() : null,
          embeddingDimensions: getEmbeddingDimensions(),
          pgvector: isPgVectorConfigured(),
          embeddings: isEmbeddingConfigured(),
          minConfidence: MIN_CONFIDENCE,
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
    return json(res, 403, { error: "forbidden", message: "CORS: same origin only" }, req);
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: "invalid_json" }, req);
  }

  const query = String(body.query || "").trim();
  const context = String(body.context || "").trim();
  const ragMode = body.rag === true || body.mode === "rag" || (!context && query);

  if (rejectsFullDocumentPayload(body)) {
    return json(res, 400, { error: "full_documents_not_allowed" }, req);
  }

  if (ragMode && query && !context) {
    if (!isPgVectorConfigured()) {
      return json(
        res,
        503,
        {
          error: "pgvector_not_configured",
          message: "הגדר SUPABASE_SERVICE_ROLE_KEY והרץ knowledge_pgvector.sql",
          fallback: "client",
        },
        req,
      );
    }
    return handleServerRag(req, res, body);
  }

  if (!isAiConfigured()) {
    return json(
      res,
      503,
      {
        code: "ai_not_configured",
        error: "ai_not_configured",
        message: "הגדר GEMINI_API_KEY (או OPENAI_API_KEY) ב-Vercel → Environment Variables ופרוס מחדש.",
      },
      req,
    );
  }

  return handleLegacyChat(req, res, body);
}

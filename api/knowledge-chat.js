/** Vercel serverless — full server-side RAG: hybrid search → OpenAI (chunks only). */

import { json, readJsonBody, handleOptions, isSameOrigin } from "./lib/knowledge/httpUtils.js";
import { isPgVectorConfigured } from "./lib/knowledge/supabaseAdmin.js";
import { embedQuery, isEmbeddingConfigured } from "./lib/knowledge/embeddingService.js";
import { RETRIEVAL_TOP_K_DEFAULT } from "./lib/knowledge/vectorSearchService.js";
import {
  hybridSearch,
  MIN_CONFIDENCE,
  KNOWLEDGE_NO_SOURCE_ANSWER,
} from "./lib/knowledge/hybridSearchService.js";
import { fetchImagesForChunks } from "./lib/knowledge/imageIngestService.js";
import { logKnowledgeGap } from "./lib/knowledge/gapFeedbackService.js";
import {
  generateChatAnswer,
  buildContextBlocks,
  KNOWLEDGE_LOW_RELEVANCE_ANSWER,
  truncateSnippet,
} from "./lib/knowledge/chatAnswerService.js";
import { logKnowledgeQuery } from "./lib/knowledge/loggingService.js";
import { fetchOpenAiWithRetry, getRetryAfterSec } from "./openaiRetry.js";
import {
  KNOWLEDGE_SYSTEM_PROMPT,
  KNOWLEDGE_ANSWER_FORMAT_HINT,
  KNOWLEDGE_NO_CONTEXT_ANSWER,
} from "./lib/knowledge/chatAnswerService.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

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
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  const query = String(body.query || "").trim();
  const context = String(body.context || "").trim();

  if (!query || !context) {
    return json(res, 400, { error: "query_and_context_required" }, req);
  }

  const howTo = isHowToQuestion(query);
  const user = `קטעי הקשר (היחידים המותרים לשימוש):\n${context}\n\nשאלת הנציג: ${query}\n\n${KNOWLEDGE_ANSWER_FORMAT_HINT}${
    howTo ? "\n\nסוג שאלה: הדרכה / תהליך — השתמש בפירוט לפי סעיפים." : ""
  }`;

  const openaiRes = await fetchOpenAiWithRetry(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: howTo ? 480 : 380,
      messages: [
        {
          role: "system",
          content: `${KNOWLEDGE_SYSTEM_PROMPT}\n\n${KNOWLEDGE_ANSWER_FORMAT_HINT}`,
        },
        { role: "user", content: user },
      ],
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => "");
    const retryAfterSec = openaiRes.status === 429 ? getRetryAfterSec(openaiRes) : null;
    return json(
      res,
      openaiRes.status,
      {
        error: `openai_error:${openaiRes.status}`,
        detail: errText.slice(0, 200),
        retryAfterSec,
        rateLimited: openaiRes.status === 429,
      },
      req,
    );
  }

  const data = await openaiRes.json();
  const answer =
    data.choices?.[0]?.message?.content?.trim() || KNOWLEDGE_NO_CONTEXT_ANSWER;

  return json(res, 200, { answer, mode: "openai" }, req);
}

async function handleServerRag(req, res, body) {
  const query = String(body.query || "").trim();
  const tenantId = resolveTenantId(body);
  const topK = body.topK ?? RETRIEVAL_TOP_K_DEFAULT;

  if (!query) {
    return json(res, 400, { error: "query_required" }, req);
  }

  if (!isPgVectorConfigured()) {
    return json(res, 503, { error: "pgvector_not_configured" }, req);
  }

  if (!isEmbeddingConfigured()) {
    return json(res, 503, { error: "openai_not_configured" }, req);
  }

  const { embedding, error: embedErr, retryAfterSec } = await embedQuery(query);
  if (embedErr || !embedding) {
    return json(
      res,
      embedErr?.includes("429") ? 429 : 503,
      { error: embedErr || "embedding_failed", retryAfterSec },
      req,
    );
  }

  const searchResult = await hybridSearch(query, embedding, { topK, tenantId });
  if (searchResult.error) {
    return json(res, 500, { error: "search_failed", detail: searchResult.error }, req);
  }

  const hits = searchResult.hits;
  const confidence = searchResult.confidence;
  const chunks = hits.map((h) => h.chunk);
  const contextBlocks = buildContextBlocks(chunks);
  const context = contextBlocks.join("\n\n");

  const debug = {
    question: query,
    retrievalMethod: searchResult.retrievalMethod,
    confidence: Number(confidence.toFixed(4)),
    minConfidence: MIN_CONFIDENCE,
    retrievedChunks: hits.map((h) => ({
      documentName: h.chunk.documentName,
      chunkIndex: h.chunk.chunkIndex,
      pageNumber: h.chunk.pageNumber,
      sectionTitle: h.chunk.sectionTitle,
      score: Number(h.score.toFixed(4)),
      vectorScore: h.vectorScore != null ? Number(h.vectorScore.toFixed(4)) : null,
      keywordScore: h.keywordScore != null ? Number(h.keywordScore.toFixed(4)) : null,
      snippet: truncateSnippet(h.chunk.text, 160),
    })),
    contextSent: context,
  };

  const lowConfidenceAnswer = KNOWLEDGE_NO_SOURCE_ANSWER;

  if (!chunks.length || !searchResult.passesThreshold) {
    await logKnowledgeQuery({
      question: query,
      tenantId,
      retrievalMethod: "hybrid_low_confidence",
      hits,
      answer: lowConfidenceAnswer,
    });

    await logKnowledgeGap({
      question: query,
      tenantId,
      confidence,
      retrievalMethod: "hybrid_low_confidence",
    });

    return json(
      res,
      200,
      {
        answer: lowConfidenceAnswer,
        citations: [],
        chunks: [],
        images: [],
        confidence,
        mode: "low_relevance",
        debug,
      },
      req,
    );
  }

  const result = await generateChatAnswer(query, chunks);
  if (result.error) {
    return json(
      res,
      result.rateLimited ? 429 : 503,
      {
        error: result.error,
        detail: result.detail,
        retryAfterSec: result.retryAfterSec,
        rateLimited: result.rateLimited,
        debug,
      },
      req,
    );
  }

  if (!result.citations?.length) {
    return json(
      res,
      200,
      {
        answer: lowConfidenceAnswer,
        citations: [],
        chunks: [],
        images: [],
        confidence,
        mode: "no_citation",
        debug,
      },
      req,
    );
  }

  const chunkRefs = chunks.map((c) => ({
    documentId: c.documentId,
    pageNumber: c.pageNumber,
  }));
  const images = await fetchImagesForChunks(chunkRefs, { tenantId, limit: 3 });

  await logKnowledgeQuery({
    question: query,
    tenantId,
    retrievalMethod: "hybrid",
    hits,
    answer: result.answer,
  });

  return json(
    res,
    200,
    {
      answer: result.answer,
      citations: result.citations,
      chunks: chunks.map((c) => ({
        documentId: c.documentId,
        documentName: c.documentName,
        pageNumber: c.pageNumber,
        sectionTitle: c.sectionTitle,
      })),
      images,
      confidence,
      mode: "openai",
      debug,
    },
    req,
  );
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.searchParams.get("health") === "1") {
      return json(
        res,
        200,
        {
          ok: Boolean(apiKey),
          model: apiKey ? model : null,
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

  if (ragMode && isPgVectorConfigured() && query && !context) {
    return handleServerRag(req, res, body);
  }

  if (!apiKey) {
    return json(
      res,
      503,
      {
        code: "openai_not_configured",
        error: "openai_not_configured",
        message: "הגדר OPENAI_API_KEY ב-Vercel (Environment Variables) ופרוס מחדש.",
      },
      req,
    );
  }

  return handleLegacyChat(req, res, body);
}

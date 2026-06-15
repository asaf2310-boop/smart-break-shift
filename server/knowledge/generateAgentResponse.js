/** Hybrid RAG + Gemini multimodal orchestration for agent knowledge chat. */

import { embedQuery, isEmbeddingConfigured } from "./embeddingService.js";
import { hybridSearch, MIN_CONFIDENCE } from "./hybridSearchService.js";
import { directChunkSearch } from "./simpleRetrievalService.js";
import { fetchImagesForChunks } from "./imageIngestService.js";
import { generateGeminiKnowledgeAnswer, mergeRelevantImages } from "./geminiChatService.js";
import { buildContextBlocks, truncateSnippet, uniqueCitations } from "./chatAnswerService.js";
import { KNOWLEDGE_MISSING_ANSWER, isMissingKnowledgeAnswer } from "./geminiKnowledgePrompt.js";
import { logKnowledgeGap } from "./gapFeedbackService.js";
import { logKnowledgeQuery } from "./loggingService.js";
import { RETRIEVAL_TOP_K_DEFAULT } from "./vectorSearchService.js";
import { isPgVectorConfigured } from "./supabaseAdmin.js";

function buildRetrievalDebug(query, searchResult, hits, context, extra = {}) {
  return {
    question: query,
    retrievalMethod: searchResult.retrievalMethod,
    confidence: Number(searchResult.confidence.toFixed(4)),
    minConfidence: MIN_CONFIDENCE,
    passesThreshold: searchResult.passesThreshold,
    searchTerms: searchResult.searchTerms || [],
    embeddingAvailable: searchResult.embeddingAvailable !== false,
    embeddingError: extra.embeddingError ?? null,
    missReason: extra.missReason ?? null,
    imageHitCount: (searchResult.imageHits || []).length,
    hitCount: hits.length,
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
}

function emptyAgentResult(overrides = {}) {
  return {
    answer: KNOWLEDGE_MISSING_ANSWER,
    citations: [],
    sources: [],
    images: [],
    chunks: [],
    confidence: null,
    grounded: false,
    mode: "low_relevance",
    debug: null,
    error: null,
    retryAfterSec: null,
    rateLimited: false,
    ...overrides,
  };
}

/**
 * Full retrieval + Gemini multimodal generation pipeline.
 * @param {string} userQuery
 * @param {{ tenantId?: string | null, topK?: number }} [options]
 */
export async function generateAgentResponse(userQuery, options = {}) {
  const query = String(userQuery || "").replace(/\s+/g, " ").trim();
  const tenantId = options.tenantId ?? null;
  const topK = options.topK ?? RETRIEVAL_TOP_K_DEFAULT;

  if (!query) {
    return emptyAgentResult({ error: "query_required", mode: "empty" });
  }

  if (!isPgVectorConfigured()) {
    return emptyAgentResult({ error: "pgvector_not_configured" });
  }

  if (!isEmbeddingConfigured()) {
    return emptyAgentResult({ error: "ai_not_configured" });
  }

  const { embedding, error: embedErr, retryAfterSec } = await embedQuery(query);
  const embeddingFailed = Boolean(embedErr || !embedding);
  if (embeddingFailed && embedErr?.includes("429")) {
    return {
      ...emptyAgentResult({ error: embedErr || "embedding_failed", retryAfterSec }),
      answer: null,
    };
  }

  const searchResult = await hybridSearch(query, embedding, { topK, tenantId });

  let hits = searchResult.hits || [];
  let passesThreshold = searchResult.passesThreshold;
  let retrievalMethod = searchResult.retrievalMethod;

  if (!passesThreshold || !hits.length) {
    const direct = await directChunkSearch(query, { topK, tenantId });
    if (direct.hits?.length) {
      hits = direct.hits;
      passesThreshold = direct.passesThreshold;
      retrievalMethod = direct.passesThreshold ? "direct" : retrievalMethod;
      searchResult.searchTerms = direct.searchTerms;
    }
  }

  if (searchResult.error && !hits.length) {
    return { ...emptyAgentResult({ error: "search_failed" }), detail: searchResult.error };
  }

  const confidence = hits[0]
    ? Math.max(hits[0].vectorScore || 0, hits[0].keywordScore || 0, hits[0].score || 0)
    : searchResult.confidence;
  const chunks = hits.map((h) => h.chunk);
  const contextBlocks = buildContextBlocks(chunks);
  const context = contextBlocks.join("\n\n");
  let missReason = null;
  if (!chunks.length) {
    missReason = embeddingFailed ? "no_hits_embedding_failed" : "no_hits";
  } else if (!passesThreshold) {
    missReason = "below_threshold";
  }

  const debug = buildRetrievalDebug(
    query,
    { ...searchResult, confidence, passesThreshold, retrievalMethod },
    hits,
    context,
    {
      missReason,
      embeddingError: embeddingFailed ? embedErr || "embedding_failed" : null,
    },
  );

  const chunkRefs = chunks.map((c) => ({
    documentId: c.documentId,
    pageNumber: c.pageNumber,
  }));
  const fetchedImages = await fetchImagesForChunks(chunkRefs, { tenantId, limit: topK });
  const relevantImages = mergeRelevantImages(fetchedImages, searchResult.imageHits || [], topK);

  if (!chunks.length || !passesThreshold) {
    if (process.env.NODE_ENV !== "production" || process.env.KNOWLEDGE_DEBUG === "1") {
      console.warn("[generateAgentResponse] retrieval_miss", {
        query,
        hitCount: hits.length,
        missReason,
        embeddingFailed,
        passesThreshold,
        confidence,
        searchTerms: searchResult.searchTerms,
        top: hits[0]
          ? {
              vectorScore: hits[0].vectorScore,
              keywordScore: hits[0].keywordScore,
              combined: hits[0].score,
              snippet: truncateSnippet(hits[0].chunk?.text, 80),
            }
          : null,
      });
    }
    await logKnowledgeQuery({
      question: query,
      tenantId,
      retrievalMethod: "hybrid_low_confidence",
      hits,
      answer: KNOWLEDGE_MISSING_ANSWER,
    });
    await logKnowledgeGap({
      question: query,
      tenantId,
      confidence,
      retrievalMethod: "hybrid_low_confidence",
    });

    return emptyAgentResult({ confidence, debug });
  }

  const result = await generateGeminiKnowledgeAnswer(query, chunks, {
    images: relevantImages,
    confidence,
  });

  if (result.error) {
    return {
      answer: null,
      citations: result.citations || [],
      sources: result.sources || [],
      images: [],
      chunks: [],
      confidence,
      grounded: false,
      mode: result.mode || "gemini",
      debug,
      error: result.error,
      retryAfterSec: result.retryAfterSec,
      rateLimited: result.rateLimited,
    };
  }

  if (!result.citations?.length && chunks.length) {
    result.citations = uniqueCitations(chunks);
  }

  if (
    !result.citations?.length &&
    (!result.answer || isMissingKnowledgeAnswer(result.answer))
  ) {
    return emptyAgentResult({
      confidence,
      mode: "no_citation",
      debug,
    });
  }

  if (!result.citations?.length) {
    result.citations = uniqueCitations(chunks);
  }

  await logKnowledgeQuery({
    question: query,
    tenantId,
    retrievalMethod: "hybrid",
    hits,
    answer: result.answer,
  });

  return {
    answer: result.answer,
    citations: result.citations,
    sources: result.sources,
    images: result.images?.length ? result.images : [],
    chunks: chunks.map((c) => ({
      documentId: c.documentId,
      documentName: c.documentName,
      pageNumber: c.pageNumber,
      sectionTitle: c.sectionTitle,
    })),
    confidence,
    grounded: result.grounded !== false,
    mode: result.mode || "gemini",
    debug,
    error: null,
    retryAfterSec: null,
    rateLimited: false,
    retrieval: {
      textHits: hits.length,
      imageHits: (searchResult.imageHits || []).length,
      imagesProvided: relevantImages.length,
    },
  };
}

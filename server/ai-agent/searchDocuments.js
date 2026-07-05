/** Read-only document search for AI Agent tool calling. */

import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";
import { embedQuery, isEmbeddingConfigured } from "../knowledge/embeddingService.js";
import {
  extractSearchTerms,
  scoreChunkKeywordMatch,
  normalizeKeywordScore,
} from "../knowledge/queryTermsService.js";
import {
  AI_AGENT_DOCUMENTS_UNAVAILABLE_HE,
  isAiAgentSchemaError,
} from "./schemaErrors.js";

const MAX_TOP_K = 8;
const DEFAULT_TOP_K = 5;
const MIN_VECTOR_SCORE = 0.48;
const MAX_KEYWORD_CHUNKS = 200;

function documentsUnavailableResult(query, reason = AI_AGENT_DOCUMENTS_UNAVAILABLE_HE) {
  return {
    ok: true,
    query,
    method: "none",
    count: 0,
    snippets: [],
    documentsUnavailable: true,
    message: reason,
  };
}

async function isDocumentsSchemaAvailable(supabase) {
  const { error } = await supabase.from("ai_agent_documents").select("id").limit(1);
  if (!error) return true;
  if (isAiAgentSchemaError(error)) return false;
  return true;
}

function truncate(text, max = 600) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

async function vectorSearch(supabase, query, topK) {
  const { embedding, error: embedErr } = await embedQuery(query);
  if (embedErr || !embedding) {
    return { hits: [], error: embedErr || "embedding_failed" };
  }

  const { data, error } = await supabase.rpc("match_ai_agent_document_chunks", {
    query_embedding: embedding,
    match_count: topK * 2,
    match_threshold: MIN_VECTOR_SCORE - 0.08,
  });

  if (error) return { hits: [], error: error.message };

  const hits = (data || [])
    .filter((row) => row.similarity >= MIN_VECTOR_SCORE)
    .slice(0, topK)
    .map((row) => ({
      documentId: row.document_id,
      documentTitle: row.document_title,
      chunkIndex: row.chunk_index,
      sectionTitle: row.section_title,
      text: row.chunk_text,
      score: row.similarity,
      method: "vector",
    }));

  return { hits, error: null };
}

async function keywordSearch(supabase, query, topK) {
  const terms = extractSearchTerms(query);
  if (!terms.length) return { hits: [], error: null };

  const { data: chunks, error: chunkErr } = await supabase
    .from("ai_agent_document_chunks")
    .select("id, document_id, document_title, chunk_text, chunk_index, section_title")
    .limit(MAX_KEYWORD_CHUNKS);

  if (chunkErr) return { hits: [], error: chunkErr.message };
  if (!chunks?.length) return { hits: [], error: null };

  const scored = [];
  for (const row of chunks) {
    const chunk = {
      documentName: row.document_title,
      text: row.chunk_text,
      sectionTitle: row.section_title,
    };
    const raw = scoreChunkKeywordMatch(chunk, terms);
    const score = normalizeKeywordScore(raw, terms);
    if (score > 0.08) {
      scored.push({
        documentId: row.document_id,
        documentTitle: row.document_title,
        chunkIndex: row.chunk_index,
        sectionTitle: row.section_title,
        text: row.chunk_text,
        score,
        method: "keyword",
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return { hits: scored.slice(0, topK), error: null };
}

async function fullTextFallback(supabase, query, topK) {
  const terms = extractSearchTerms(query);
  if (!terms.length) return { hits: [], error: null };

  const { data: docs, error } = await supabase
    .from("ai_agent_documents")
    .select("id, title, content_text")
    .eq("status", "ready")
    .limit(50);

  if (error || !docs?.length) return { hits: [], error: error?.message || null };

  const scored = [];
  for (const doc of docs) {
    const hay = `${doc.title}\n${doc.content_text}`.toLowerCase();
    let matches = 0;
    for (const term of terms) {
      if (hay.includes(term)) matches += 1;
    }
    if (matches > 0) {
      scored.push({
        documentId: doc.id,
        documentTitle: doc.title,
        chunkIndex: 0,
        sectionTitle: null,
        text: truncate(doc.content_text, 1200),
        score: matches / terms.length,
        method: "fulltext",
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return { hits: scored.slice(0, topK), error: null };
}

/**
 * @param {{ query: string, topK?: number }} args
 */
export async function searchDocuments(args) {
  const query = String(args?.query || "").trim();
  if (!query) {
    return { ok: false, error: "query_required", message: "נדרשת שאילתת חיפוש" };
  }
  if (query.length > 500) {
    return { ok: false, error: "query_too_long", message: "שאילתת החיפוש ארוכה מדי" };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return documentsUnavailableResult(query);
  }

  try {
    const schemaOk = await isDocumentsSchemaAvailable(supabase);
    if (!schemaOk) {
      return documentsUnavailableResult(query);
    }

    const topK = Math.min(MAX_TOP_K, Math.max(1, Number(args?.topK) || DEFAULT_TOP_K));

    let hits = [];
    let method = "none";
    let searchError = null;

    if (isEmbeddingConfigured()) {
      const vectorResult = await vectorSearch(supabase, query, topK);
      if (vectorResult.hits.length) {
        hits = vectorResult.hits;
        method = "vector";
      } else if (vectorResult.error) {
        searchError = vectorResult.error;
      }
    }

    if (!hits.length) {
      const kwResult = await keywordSearch(supabase, query, topK);
      if (kwResult.hits.length) {
        hits = kwResult.hits;
        method = "keyword";
      } else if (kwResult.error) {
        searchError = kwResult.error;
      }
    }

    if (!hits.length) {
      const ftResult = await fullTextFallback(supabase, query, topK);
      if (ftResult.hits.length) {
        hits = ftResult.hits;
        method = "fulltext";
      } else if (ftResult.error) {
        searchError = ftResult.error;
      }
    }

    if (!hits.length) {
      if (searchError && isAiAgentSchemaError(searchError)) {
        return documentsUnavailableResult(query);
      }
      return {
        ok: true,
        query,
        method,
        count: 0,
        snippets: [],
        message: "לא נמצאו קטעים רלוונטיים במסמכי הידע.",
      };
    }

    return {
      ok: true,
      query,
      method,
      count: hits.length,
      snippets: hits.map((h) => ({
        documentTitle: h.documentTitle,
        sectionTitle: h.sectionTitle,
        chunkIndex: h.chunkIndex,
        score: Number(h.score?.toFixed?.(3) ?? h.score),
        excerpt: truncate(h.text, 700),
      })),
    };
  } catch {
    return documentsUnavailableResult(query);
  }
}

export const SEARCH_DOCUMENTS_TOOL = {
  type: "function",
  function: {
    name: "searchDocuments",
    description:
      "חיפוש במסמכי ידע שהועלו על ידי המנהל (PDF, TXT, MD, DOCX). השתמש כשהנציג שואל על נהלים, מדריכים, מדיניות או מידע שאינו בטבלאות העסקיות. סכם בעברית על בסיס הקטעים שנמצאו — אל תמציא.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "שאילתת חיפוש בעברית או באנגלית — מילות מפתח או שאלה",
        },
        topK: {
          type: "integer",
          description: "מספר קטעים מקסימלי (1–8)",
          minimum: 1,
          maximum: 8,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

/** Ingest / list / delete documents for AI Agent RAG. */

import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";
import { chunkDocument } from "../knowledge/chunkingService.js";
import { normalizeExtractedDocumentText } from "../knowledge/textExtractionNormalize.js";
import { buildEmbeddingInput, embedTexts, isEmbeddingConfigured } from "../knowledge/embeddingService.js";
import { getEmbeddingDimensions } from "../ai/aiProvider.js";

const MAX_CONTENT_CHARS = 500_000;
const BATCH = 40;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSchemaError(message) {
  return /relation.*does not exist|column|vector|dimension/i.test(String(message || ""));
}

async function insertChunkBatches(supabase, rows, documentId) {
  for (let offset = 0; offset < rows.length; offset += BATCH) {
    const batch = rows.slice(offset, offset + BATCH);
    const { error } = await supabase.from("ai_agent_document_chunks").insert(batch);
    if (error) return error.message;
    if (offset + BATCH < rows.length) await sleep(150);
  }
  return null;
}

/**
 * @param {{ title: string, content: string, fileName?: string, mimeType?: string, filePath?: string }} input
 */
export async function ingestAiAgentDocument(input) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, error: "supabase_not_configured" };
  }

  const title = String(input?.title || "").trim();
  const content = normalizeExtractedDocumentText(String(input?.content || ""));
  if (!title) return { ok: false, error: "title_required" };
  if (!content.trim()) return { ok: false, error: "content_required" };
  if (content.length > MAX_CONTENT_CHARS) {
    return { ok: false, error: "content_too_large" };
  }

  const documentId = randomUUID();
  const now = new Date().toISOString();

  const { error: insertErr } = await supabase.from("ai_agent_documents").insert({
    id: documentId,
    title,
    file_name: input.fileName || null,
    file_path: input.filePath || null,
    mime_type: input.mimeType || null,
    content_text: content,
    chunk_count: 0,
    status: "processing",
    created_at: now,
    updated_at: now,
  });

  if (insertErr) {
    return {
      ok: false,
      error: isSchemaError(insertErr.message) ? "schema_not_migrated" : insertErr.message,
    };
  }

  const chunks = chunkDocument({
    id: documentId,
    title,
    category: "סוכן AI",
    content,
  });

  if (!chunks.length) {
    await supabase
      .from("ai_agent_documents")
      .update({ status: "ready", chunk_count: 0, updated_at: new Date().toISOString() })
      .eq("id", documentId);
    return { ok: true, id: documentId, chunkCount: 0 };
  }

  let embeddingCount = 0;
  let embeddingError = null;

  if (isEmbeddingConfigured()) {
    const embedInputs = chunks.map((c) =>
      buildEmbeddingInput({
        documentName: title,
        documentTitle: title,
        sectionTitle: c.sectionTitle,
        text: c.text,
      }),
    );
    const { embeddings, error: embedErr } = await embedTexts(embedInputs);
    embeddingError = embedErr || null;
    const expectedDims = getEmbeddingDimensions();

    const rows = chunks.map((chunk, i) => {
      const vec = embeddings?.[i];
      const embedding =
        Array.isArray(vec) && vec.length === expectedDims ? vec : null;
      if (embedding) embeddingCount += 1;
      return {
        document_id: documentId,
        document_title: title,
        chunk_text: chunk.text,
        chunk_index: chunk.chunkIndex,
        section_title: chunk.sectionTitle,
        embedding,
      };
    });

    const chunkInsertErr = await insertChunkBatches(supabase, rows, documentId);
    if (chunkInsertErr) {
      await supabase.from("ai_agent_documents").delete().eq("id", documentId);
      return {
        ok: false,
        error: isSchemaError(chunkInsertErr) ? "schema_not_migrated" : chunkInsertErr,
      };
    }
  } else {
    const rows = chunks.map((chunk) => ({
      document_id: documentId,
      document_title: title,
      chunk_text: chunk.text,
      chunk_index: chunk.chunkIndex,
      section_title: chunk.sectionTitle,
      embedding: null,
    }));
    const chunkInsertErr = await insertChunkBatches(supabase, rows, documentId);
    if (chunkInsertErr) {
      await supabase.from("ai_agent_documents").delete().eq("id", documentId);
      return { ok: false, error: chunkInsertErr };
    }
  }

  await supabase
    .from("ai_agent_documents")
    .update({
      status: "ready",
      chunk_count: chunks.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  return {
    ok: true,
    id: documentId,
    chunkCount: chunks.length,
    embeddingCount,
    embeddingError,
  };
}

export async function listAiAgentDocuments() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { documents: [], error: "supabase_not_configured" };

  const { data, error } = await supabase
    .from("ai_agent_documents")
    .select("id, title, file_name, mime_type, chunk_count, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    if (isSchemaError(error.message)) return { documents: [], error: "schema_not_migrated" };
    return { documents: [], error: error.message };
  }

  return {
    documents: (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      fileName: row.file_name,
      mimeType: row.mime_type,
      chunkCount: row.chunk_count ?? 0,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    error: null,
  };
}

export async function deleteAiAgentDocument(documentId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const id = String(documentId || "").trim();
  if (!id) return { ok: false, error: "document_id_required" };

  const { data: doc } = await supabase
    .from("ai_agent_documents")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  if (doc?.file_path) {
    await supabase.storage.from("ai-agent-docs").remove([doc.file_path]).catch(() => {});
  }

  await supabase.from("ai_agent_document_chunks").delete().eq("document_id", id);
  const { error } = await supabase.from("ai_agent_documents").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getAiAgentDocumentCount() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { count: 0, error: "supabase_not_configured" };

  const { count, error } = await supabase
    .from("ai_agent_documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "ready");

  if (error) {
    if (isSchemaError(error.message)) return { count: 0, error: "schema_not_migrated" };
    return { count: 0, error: error.message };
  }
  return { count: count ?? 0, error: null };
}

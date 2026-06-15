/** Document ingest: chunk, embed, store in pgvector. */

import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { chunkDocument } from "./chunkingService.js";
import { buildEmbeddingInput, embedTexts } from "./embeddingService.js";
import { ingestDocumentImages, deleteDocumentImages } from "./imageIngestService.js";

function mapDocToDb(doc) {
  const now = new Date().toISOString();
  return {
    id: doc.id,
    title: doc.title,
    category: doc.category || "כללי",
    content: doc.content,
    source_type: doc.sourceType || doc.source_type || "text",
    file_name: doc.fileName || doc.file_name || null,
    pages: doc.pages || null,
    tenant_id: doc.tenantId ?? doc.tenant_id ?? null,
    created_at: doc.createdAt || doc.created_at || now,
    updated_at: doc.updatedAt || doc.updated_at || now,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Store page metadata in knowledge_documents; binary thumbnails go to knowledge_images. */
function pagesForDocumentRow(pages) {
  if (!Array.isArray(pages) || !pages.length) return null;
  return pages.map((p) => ({
    pageNumber: p.pageNumber ?? p.page_number ?? null,
    sectionTitle: p.sectionTitle ?? p.section_title ?? null,
    text: p.text || "",
    hasThumbnail: Boolean(p.thumbnail || p.hasThumbnail || p.imageData),
  }));
}

/**
 * Ingest or reprocess a document into pgvector.
 * @param {object} document
 * @returns {Promise<{ ok: boolean, chunkCount: number, embeddingError?: string }>}
 */
export async function ingestDocument(document) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, error: "supabase_not_configured", chunkCount: 0 };
  }

  const dbDoc = mapDocToDb(document);
  const pagesForChunking = dbDoc.pages;
  const chunks = chunkDocument({
    id: dbDoc.id,
    title: dbDoc.title,
    category: dbDoc.category,
    content: dbDoc.content,
    pages: pagesForChunking,
  });

  const dbDocRow = { ...dbDoc, pages: pagesForDocumentRow(pagesForChunking) };

  const { error: upsertErr } = await supabase.from("knowledge_documents").upsert(dbDocRow, {
    onConflict: "id",
  });
  if (upsertErr) {
    return { ok: false, error: upsertErr.message, chunkCount: 0 };
  }

  await supabase.from("knowledge_chunks").delete().eq("document_id", dbDoc.id);

  if (!chunks.length) {
    await supabase
      .from("knowledge_documents")
      .update({ chunk_count: 0, updated_at: new Date().toISOString() })
      .eq("id", dbDoc.id);

    const imageResult = document.skipImages
      ? { imageCount: 0 }
      : await ingestDocumentImages({
          id: dbDoc.id,
          title: dbDoc.title,
          fileName: dbDoc.file_name,
          pages: document.pages,
          images: document.images,
          tenantId: dbDoc.tenant_id,
          skipOcr: true,
        });

    return {
      ok: true,
      chunkCount: 0,
      imageCount: imageResult.imageCount ?? 0,
      imageError: imageResult.error || null,
    };
  }

  const embedInputs = chunks.map(buildEmbeddingInput);
  const { embeddings, error: embedErr } = await embedTexts(embedInputs);

  const rows = chunks.map((chunk, i) => ({
    tenant_id: dbDoc.tenant_id,
    document_id: dbDoc.id,
    document_name: chunk.documentName,
    chunk_text: chunk.text,
    chunk_index: chunk.chunkIndex,
    page_number: chunk.pageNumber,
    section_title: chunk.sectionTitle,
    category: chunk.category,
    embedding: embeddings?.[i] ?? null,
  }));

  const BATCH = 40;
  for (let offset = 0; offset < rows.length; offset += BATCH) {
    const batch = rows.slice(offset, offset + BATCH);
    const { error: insertErr } = await supabase.from("knowledge_chunks").insert(batch);
    if (insertErr) {
      return { ok: false, error: insertErr.message, chunkCount: 0 };
    }
    if (offset + BATCH < rows.length) await sleep(200);
  }

  const embeddedCount = rows.filter((r) => r.embedding).length;
  await supabase
    .from("knowledge_documents")
    .update({
      chunk_count: rows.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dbDoc.id);

  const imageResult = document.skipImages
    ? { imageCount: 0 }
    : await ingestDocumentImages({
        id: dbDoc.id,
        title: dbDoc.title,
        fileName: dbDoc.file_name,
        pages: document.pages,
        images: document.images,
        tenantId: dbDoc.tenant_id,
        skipOcr: true,
      });

  return {
    ok: true,
    chunkCount: rows.length,
    embeddingCount: embeddedCount,
    imageCount: imageResult.imageCount ?? 0,
    imageError: imageResult.error || null,
    embeddingError: embedErr || (embeddedCount < rows.length ? "partial_embeddings" : null),
  };
}

export async function deleteDocument(documentId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);
  await deleteDocumentImages(documentId);
  const { error } = await supabase.from("knowledge_documents").delete().eq("id", documentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listDocumentsWithChunkCounts() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { documents: [], error: "supabase_not_configured" };

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id, title, category, source_type, file_name, chunk_count, tenant_id, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return { documents: [], error: error.message };

  return {
    documents: (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category || "כללי",
      sourceType: row.source_type || "text",
      fileName: row.file_name,
      chunkCount: row.chunk_count ?? 0,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    error: null,
  };
}

export async function getTotalChunkCount() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

export async function reprocessDocument(documentId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message || "not_found" };

  return ingestDocument({
    id: data.id,
    title: data.title,
    category: data.category,
    content: data.content,
    sourceType: data.source_type,
    fileName: data.file_name,
    pages: data.pages,
    tenantId: data.tenant_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}

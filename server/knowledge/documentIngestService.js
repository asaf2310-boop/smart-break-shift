/** Document ingest: chunk, embed, store in pgvector. */

import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { chunkDocument } from "./chunkingService.js";
import { buildEmbeddingInput, embedTexts } from "./embeddingService.js";
import { getEmbeddingDimensions } from "../ai/aiProvider.js";
import { ingestDocumentImages, deleteDocumentImages } from "./imageIngestService.js";
import { buildPdfDocumentContent, cleanPdfPageText } from "./pdfTextQuality.js";

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

function isSchemaColumnError(message) {
  return /column|chunk_count|tenant_id|does not exist|relation.*knowledge_/i.test(String(message || ""));
}

function isVectorDimensionError(message) {
  return /dimension|vector|expected.*dimensions/i.test(String(message || ""));
}

async function upsertKnowledgeDocumentRow(supabase, dbDocRow) {
  let payload = { ...dbDocRow };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await supabase.from("knowledge_documents").upsert(payload, { onConflict: "id" });
    if (!error) return null;
    if (!isSchemaColumnError(error.message)) return error.message;
    if ("tenant_id" in payload) {
      const { tenant_id, ...rest } = payload;
      payload = rest;
      continue;
    }
    return error.message;
  }
  return "schema_upsert_failed";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function insertChunkBatches(supabase, rows, documentId) {
  const BATCH = 40;

  async function runInsert(batchRows) {
    for (let offset = 0; offset < batchRows.length; offset += BATCH) {
      const batch = batchRows.slice(offset, offset + BATCH);
      const { error } = await supabase.from("knowledge_chunks").insert(batch);
      if (error) return error;
      if (offset + BATCH < batchRows.length) await sleep(200);
    }
    return null;
  }

  let err = await runInsert(rows);
  if (!err) return null;
  if (!isVectorDimensionError(err.message)) return err.message;

  await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);
  const withoutEmbeddings = rows.map((row) => ({ ...row, embedding: null }));
  err = await runInsert(withoutEmbeddings);
  return err?.message || null;
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

  const upsertErr = await upsertKnowledgeDocumentRow(supabase, dbDocRow);
  if (upsertErr) {
    return {
      ok: false,
      error: isSchemaColumnError(upsertErr) ? "knowledge_schema_not_migrated" : upsertErr,
      chunkCount: 0,
    };
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
  const expectedDims = getEmbeddingDimensions();

  const rows = chunks.map((chunk, i) => {
    const vec = embeddings?.[i];
    const embedding =
      Array.isArray(vec) && vec.length === expectedDims ? vec : null;
    return {
      tenant_id: dbDoc.tenant_id,
      document_id: dbDoc.id,
      document_name: chunk.documentName,
      chunk_text: chunk.text,
      chunk_index: chunk.chunkIndex,
      page_number: chunk.pageNumber,
      section_title: chunk.sectionTitle,
      category: chunk.category,
      embedding,
    };
  });

  const insertErr = await insertChunkBatches(supabase, rows, dbDoc.id);
  if (insertErr) {
    return {
      ok: false,
      error: isSchemaColumnError(insertErr) ? "knowledge_schema_not_migrated" : insertErr,
      chunkCount: 0,
    };
  }

  const embeddedCount = rows.filter((r) => r.embedding).length;
  const updatePayload = { updated_at: new Date().toISOString(), chunk_count: rows.length };
  const { error: countErr } = await supabase
    .from("knowledge_documents")
    .update(updatePayload)
    .eq("id", dbDoc.id);
  if (countErr && isSchemaColumnError(countErr.message)) {
    await supabase
      .from("knowledge_documents")
      .update({ updated_at: updatePayload.updated_at })
      .eq("id", dbDoc.id);
  }

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

export async function ensureKnowledgeDocumentParent(documentId, meta = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const id = String(documentId || "").trim();
  if (!id) return { ok: false, error: "document_id_required" };

  const { data } = await supabase.from("knowledge_documents").select("id").eq("id", id).maybeSingle();
  if (data?.id) return { ok: true };

  const now = new Date().toISOString();
  const { error } = await supabase.from("knowledge_documents").upsert(
    {
      id,
      title: String(meta.title || "מסמך").trim() || "מסמך",
      category: meta.category || "כללי",
      content: String(meta.content || " ").trim() || " ",
      source_type: meta.sourceType || meta.source_type || "upload",
      file_name: meta.fileName || meta.file_name || null,
      tenant_id: meta.tenantId ?? meta.tenant_id ?? null,
      created_at: meta.createdAt || now,
      updated_at: now,
    },
    { onConflict: "id" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
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

  const fullSelect =
    "id, title, category, source_type, file_name, chunk_count, tenant_id, created_at, updated_at";
  const baseSelect = "id, title, category, source_type, file_name, created_at, updated_at";

  let data;
  let error;
  ({ data, error } = await supabase
    .from("knowledge_documents")
    .select(fullSelect)
    .order("updated_at", { ascending: false }));

  if (error && isSchemaColumnError(error.message)) {
    ({ data, error } = await supabase
      .from("knowledge_documents")
      .select(baseSelect)
      .order("updated_at", { ascending: false }));
  }

  if (error) {
    if (/relation.*does not exist/i.test(error.message)) {
      return { documents: [], error: "knowledge_schema_not_migrated" };
    }
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(error.message)) {
      return { documents: [], error: "supabase_connection_failed" };
    }
    return { documents: [], error: error.message };
  }

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
  if (error) {
    if (/relation.*does not exist/i.test(error.message)) return 0;
    return 0;
  }
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

/**
 * Merge OCR text from knowledge_images into document pages and rebuild text chunks.
 */
export async function syncDocumentChunksFromOcr(documentId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured", chunkCount: 0 };

  const { data: doc, error: docErr } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();

  if (docErr || !doc) return { ok: false, error: docErr?.message || "not_found", chunkCount: 0 };

  const { data: images, error: imgErr } = await supabase
    .from("knowledge_images")
    .select("page_number, ocr_text, description")
    .eq("document_id", documentId)
    .order("page_number", { ascending: true });

  if (imgErr) return { ok: false, error: imgErr.message, chunkCount: 0 };

  const pages = Array.isArray(doc.pages) ? doc.pages.map((p) => ({ ...p })) : [];
  let changed = false;

  for (const img of images || []) {
    const ocr = String(img.ocr_text || "").trim();
    if (!ocr) continue;
    const pageNumber = img.page_number;
    let page = pages.find((p) => (p.pageNumber ?? p.page_number) === pageNumber);
    if (!page) {
      page = {
        pageNumber,
        sectionTitle: pageNumber != null ? `עמוד ${pageNumber}` : null,
        text: "",
        hasThumbnail: true,
      };
      pages.push(page);
      changed = true;
    }
    const existing = cleanPdfPageText(page.text || "");
    if (!existing) {
      page.text = ocr;
      changed = true;
    } else {
      const ocrSnippet = ocr.slice(0, Math.min(48, ocr.length)).toLowerCase();
      const existingLower = existing.toLowerCase();
      const hebrewInOcr = (ocr.match(/[\u0590-\u05FF]/g) || []).length;
      const hebrewInExisting = (existing.match(/[\u0590-\u05FF]/g) || []).length;
      // Corrupted PDF extract may pass length checks but lack real Hebrew — prefer OCR.
      if (hebrewInOcr >= 8 && hebrewInExisting < hebrewInOcr * 0.35) {
        page.text = ocr;
        changed = true;
      } else if (ocrSnippet && !existingLower.includes(ocrSnippet)) {
        page.text = `${existing}\n\n${ocr}`;
        changed = true;
      }
    }
    page.hasThumbnail = true;
  }

  if (!changed) {
    return { ok: true, chunkCount: doc.chunk_count ?? 0, ocrMerged: false };
  }

  const content = buildPdfDocumentContent(
    pages.map((p) => ({
      pageNumber: p.pageNumber ?? p.page_number ?? null,
      text: p.text || "",
    })),
    doc.title,
  );

  return ingestDocument({
    id: doc.id,
    title: doc.title,
    category: doc.category,
    content,
    sourceType: doc.source_type,
    fileName: doc.file_name,
    pages,
    tenantId: doc.tenant_id,
    createdAt: doc.created_at,
    updatedAt: new Date().toISOString(),
    skipImages: true,
  });
}

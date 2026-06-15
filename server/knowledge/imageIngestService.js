/** Persist PDF page thumbnails and uploaded images with OCR + embeddings. */

import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { ocrImage, isOcrConfigured } from "./ocrService.js";
import { embedTexts } from "./embeddingService.js";

function buildImageEmbeddingInput(row) {
  const parts = [
    row.document_name,
    row.page_number != null ? `עמוד ${row.page_number}` : null,
    row.description,
    row.ocr_text,
  ].filter(Boolean);
  return parts.join("\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object} document — id, title, fileName, pages, tenantId, images[]
 */
export async function ingestDocumentImages(document, options = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured", imageCount: 0 };

  const replaceAll = options.replaceAll !== false;
  const skipOcr = document.skipOcr === true || options.skipOcr === true;

  const docId = document.id;
  const docName = document.title || document.fileName || "מסמך";
  const tenantId = document.tenantId ?? document.tenant_id ?? null;
  const fileName = document.fileName || document.file_name || null;

  const candidates = [];

  const pages = Array.isArray(document.pages) ? document.pages : [];
  for (const page of pages) {
    const thumb = page?.thumbnail || page?.imageData || page?.image_data;
    if (!thumb) continue;
    candidates.push({
      pageNumber: page.pageNumber ?? page.page_number ?? null,
      imageData: thumb,
      fileName: fileName || null,
    });
  }

  const extraImages = Array.isArray(document.images) ? document.images : [];
  for (const img of extraImages) {
    const data = img?.imageData || img?.image_data || img?.src;
    if (!data) continue;
    candidates.push({
      pageNumber: img.pageNumber ?? img.page_number ?? null,
      imageData: data,
      fileName: img.fileName || img.file_name || fileName,
    });
  }

  if (!candidates.length) {
    return { ok: true, imageCount: 0 };
  }

  if (replaceAll) {
    await supabase.from("knowledge_images").delete().eq("document_id", docId);
  } else {
    for (const cand of candidates) {
      if (cand.pageNumber == null) continue;
      await supabase
        .from("knowledge_images")
        .delete()
        .eq("document_id", docId)
        .eq("page_number", cand.pageNumber);
    }
  }

  const rows = [];
  for (const cand of candidates) {
    let ocrText = "";
    let description = "";

    if (isOcrConfigured() && !skipOcr) {
      const ocr = await ocrImage(cand.imageData, {
        fileName: cand.fileName || fileName,
        pageNumber: cand.pageNumber,
      });
      ocrText = ocr.ocrText || "";
      description = ocr.description || "";
      if (ocr.error && !ocrText) {
        description = description || `עמוד ${cand.pageNumber ?? "?"}`;
      }
      await sleep(150);
    } else {
      description = cand.fileName
        ? `תמונה: ${cand.fileName}`
        : cand.pageNumber != null
          ? `עמוד ${cand.pageNumber}`
          : "תמונה";
    }

    rows.push({
      tenant_id: tenantId,
      document_id: docId,
      document_name: docName,
      page_number: cand.pageNumber,
      file_name: cand.fileName || fileName,
      ocr_text: ocrText || null,
      image_data: cand.imageData?.startsWith("data:") ? cand.imageData : null,
      storage_url: cand.imageData?.startsWith("http") ? cand.imageData : null,
      description: description || null,
      metadata: {
        file_name: cand.fileName || fileName,
        page_number: cand.pageNumber,
        document_id: docId,
        document_name: docName,
        tenant_id: tenantId,
      },
      embedding: null,
    });
  }

  const embedInputs = rows.map(buildImageEmbeddingInput);
  const { embeddings } = await embedTexts(embedInputs);
  rows.forEach((row, i) => {
    row.embedding = embeddings?.[i] ?? null;
  });

  const BATCH = 20;
  for (let offset = 0; offset < rows.length; offset += BATCH) {
    const batch = rows.slice(offset, offset + BATCH);
    const { error } = await supabase.from("knowledge_images").insert(batch);
    if (error) return { ok: false, error: error.message, imageCount: 0 };
  }

  return { ok: true, imageCount: rows.length };
}

export async function deleteDocumentImages(documentId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("knowledge_images").delete().eq("document_id", documentId);
}

/**
 * Fetch up to `limit` page screenshots matching chunk document+page pairs.
 * @param {Array<{ documentId: string, pageNumber?: number }>} chunkRefs
 */
export async function fetchImagesForChunks(chunkRefs, { tenantId = null, limit = 3 } = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !chunkRefs?.length) return [];

  const seen = new Set();
  const images = [];

  for (const ref of chunkRefs) {
    if (images.length >= limit) break;
    if (ref.pageNumber == null) continue;
    const key = `${ref.documentId}:${ref.pageNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let query = supabase
      .from("knowledge_images")
      .select("id, document_id, document_name, page_number, image_data, storage_url, description")
      .eq("document_id", ref.documentId)
      .eq("page_number", ref.pageNumber)
      .limit(1);

    if (tenantId) {
      query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
    }

    const { data } = await query.maybeSingle();
    if (!data) continue;

    const src = data.storage_url || data.image_data;
    if (!src) continue;

    images.push({
      id: data.id,
      documentId: data.document_id,
      documentTitle: data.document_name,
      documentName: data.document_name,
      pageNumber: data.page_number,
      description: data.description,
      src,
    });
  }

  return images;
}

/**
 * Vector search on image embeddings.
 */
export async function searchKnowledgeImages(queryEmbedding, options = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { hits: [], error: "supabase_not_configured" };

  const topK = options.topK ?? 3;
  const threshold = options.threshold ?? 0.50;

  const { data, error } = await supabase.rpc("match_knowledge_images", {
    query_embedding: queryEmbedding,
    match_count: topK,
    match_threshold: threshold,
    filter_tenant_id: options.tenantId ?? null,
  });

  if (error) return { hits: [], error: error.message };

  const hits = (data || []).map((row) => ({
    image: {
      id: row.id,
      documentId: row.document_id,
      documentName: row.document_name,
      pageNumber: row.page_number,
      fileName: row.file_name,
      ocrText: row.ocr_text,
      description: row.description,
      src: row.storage_url || row.image_data,
    },
    score: row.similarity,
    method: "image_vector",
  }));

  return { hits, error: null };
}

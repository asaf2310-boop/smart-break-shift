/** Vercel serverless — document ingest / delete / list for pgvector RAG. */

import { json, readJsonBody, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { isPgVectorConfigured } from "../server/knowledge/supabaseAdmin.js";
import {
  ingestDocument,
  deleteDocument,
  listDocumentsWithChunkCounts,
  reprocessDocument,
  getTotalChunkCount,
  syncDocumentChunksFromOcr,
} from "../server/knowledge/documentIngestService.js";
import { ingestDocumentImages } from "../server/knowledge/imageIngestService.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden" }, req);
  }

  if (!isPgVectorConfigured()) {
    return json(
      res,
      503,
      {
        error: "pgvector_not_configured",
        message: "הגדר VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ב-Vercel והרץ supabase/knowledge_pgvector.sql",
      },
      req,
    );
  }

  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.searchParams.get("health") === "1") {
      return json(res, 200, { ok: true, pgvector: true }, req);
    }

    const { documents, error } = await listDocumentsWithChunkCounts();
    const totalChunks = await getTotalChunkCount();
    if (error) return json(res, 500, { error }, req);
    return json(res, 200, { documents, totalChunks }, req);
  }

  if (req.method === "DELETE") {
    let body = {};
    try {
      body = await readJsonBody(req);
    } catch {
      return json(res, 400, { error: "invalid_json" }, req);
    }
    const documentId = String(body.documentId || body.id || "").trim();
    if (!documentId) return json(res, 400, { error: "document_id_required" }, req);

    const result = await deleteDocument(documentId);
    if (!result.ok) return json(res, 500, { error: result.error }, req);
    return json(res, 200, { ok: true, documentId }, req);
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: "invalid_json" }, req);
  }

  const action = String(body.action || "ingest").trim();

  if (action === "delete") {
    const documentId = String(body.documentId || body.id || "").trim();
    if (!documentId) return json(res, 400, { error: "document_id_required" }, req);
    const result = await deleteDocument(documentId);
    if (!result.ok) return json(res, 500, { error: result.error }, req);
    return json(res, 200, { ok: true, documentId }, req);
  }

  if (action === "reprocess") {
    const documentId = String(body.documentId || body.id || "").trim();
    if (!documentId) return json(res, 400, { error: "document_id_required" }, req);
    try {
      const result = await reprocessDocument(documentId);
      if (!result.ok) return json(res, 500, { error: result.error, ...result }, req);
      return json(res, 200, result, req);
    } catch (err) {
      console.error("[knowledge-upload] reprocess", err);
      return json(res, 500, { error: err?.message || "ingest_exception" }, req);
    }
  }

  if (action === "ingest_pages") {
    const documentId = String(body.documentId || "").trim();
    if (!documentId) return json(res, 400, { error: "document_id_required" }, req);
    const pages = Array.isArray(body.pages) ? body.pages : [];
    if (!pages.length) return json(res, 400, { error: "pages_required" }, req);

    const pageBodyBytes = Buffer.byteLength(JSON.stringify(body), "utf8");
    if (pageBodyBytes > 3_500_000) {
      return json(res, 413, { error: "document_too_large" }, req);
    }

    try {
      const runOcr = body.runOcr !== false;
      const result = await ingestDocumentImages(
        {
          id: documentId,
          title: body.title,
          fileName: body.fileName,
          tenantId: body.tenantId ?? null,
          pages,
          skipOcr: !runOcr,
        },
        { replaceAll: body.replaceAll === true, skipOcr: !runOcr },
      );
      if (!result.ok) return json(res, 500, { error: result.error }, req);

      let chunkCount = null;
      if (runOcr && result.imageCount > 0) {
        const merged = await syncDocumentChunksFromOcr(documentId);
        if (merged.ok) chunkCount = merged.chunkCount;
      }

      return json(res, 200, { ...result, chunkCount }, req);
    } catch (err) {
      console.error("[knowledge-upload] ingest_pages", err);
      return json(res, 500, { error: err?.message || "ingest_exception" }, req);
    }
  }

  const doc = body.document;
  if (!doc?.id || !doc?.title || !doc?.content) {
    return json(res, 400, { error: "document_id_title_content_required" }, req);
  }

  if (typeof doc.content === "string" && doc.content.length > 2_000_000) {
    return json(res, 400, { error: "document_too_large" }, req);
  }

  const bodyBytes = Buffer.byteLength(JSON.stringify(body), "utf8");
  if (bodyBytes > 4_500_000) {
    return json(res, 413, { error: "document_too_large" }, req);
  }

  try {
    const result = await ingestDocument(doc);
    if (!result.ok) return json(res, 500, { error: result.error, ...result }, req);
    return json(res, 200, result, req);
  } catch (err) {
    console.error("[knowledge-upload] ingest", err);
    return json(res, 500, { error: err?.message || "ingest_exception" }, req);
  }
}

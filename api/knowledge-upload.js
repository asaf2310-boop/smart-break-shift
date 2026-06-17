/** Vercel serverless — document ingest / delete / list for pgvector RAG. */

import { json, readJsonBody, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { isPgVectorConfigured, getSupabaseUrl, getSupabaseAdmin } from "../server/knowledge/supabaseAdmin.js";
import { verifyKnowledgeAccess } from "../server/agent/agentAuthService.js";
import {
  ingestDocument,
  deleteDocument,
  getDocumentForView,
  listDocumentsWithChunkCounts,
  reprocessDocument,
  getTotalChunkCount,
  syncDocumentChunksFromOcr,
  ensureKnowledgeDocumentParent,
} from "../server/knowledge/documentIngestService.js";
import { ingestDocumentImages, listDocumentPageImages } from "../server/knowledge/imageIngestService.js";
import { importHypPayPackage } from "../server/knowledge/hypPayPackageImport.js";
import { logSecurityEvent } from "../server/security/auditLog.js";
import {
  checkRateLimit,
  getRateLimitKey,
  recordRateLimit,
} from "../server/http/rateLimit.js";

const knowledgeUploadRateByUser = new Map();
const KNOWLEDGE_UPLOAD_RATE_MAX = 120;

function enforceKnowledgeRateLimit(res, req, auth) {
  const key = getRateLimitKey(req, auth?.agent?.id);
  const check = checkRateLimit(knowledgeUploadRateByUser, key, KNOWLEDGE_UPLOAD_RATE_MAX);
  if (!check.allowed) {
    json(
      res,
      429,
      {
        error: "rate_limited",
        retryAfterSec: check.retryAfterSec,
        message: `יותר מדי בקשות — נסו שוב בעוד ${check.retryAfterSec} שניות`,
      },
      req
    );
    return false;
  }
  recordRateLimit(check.entry);
  return true;
}

async function requireKnowledgeAccess(req, res, { rateLimit = false } = {}) {
  const auth = await verifyKnowledgeAccess(req);
  if (!auth?.agent) {
    json(res, 401, { error: "unauthorized", message: "נדרשת התחברות עם הרשאת ידע" }, req);
    return null;
  }
  if (rateLimit && !enforceKnowledgeRateLimit(res, req, auth)) {
    return null;
  }
  return auth;
}

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
      let dbOk = false;
      let dbError = null;
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const { error } = await supabase.from("knowledge_documents").select("id").limit(1);
          dbOk = !error;
          dbError = error?.message || null;
        }
      } catch (err) {
        dbError = err?.message || "db_probe_failed";
      }
      return json(
        res,
        200,
        {
          ok: isPgVectorConfigured() && dbOk,
          pgvector: isPgVectorConfigured(),
          db: dbOk,
          dbError,
          supabaseUrl: getSupabaseUrl() ? `${getSupabaseUrl().slice(0, 28)}…` : null,
        },
        req,
      );
    }

    if (!(await requireKnowledgeAccess(req, res))) return;

    const documentId = String(url.searchParams.get("documentId") || "").trim();
    if (documentId && url.searchParams.get("view") === "1") {
      const { document, error } = await getDocumentForView(documentId);
      if (error === "not_found") return json(res, 404, { error }, req);
      if (error) return json(res, 500, { error }, req);
      const { pages, error: imgErr } = await listDocumentPageImages(documentId);
      if (imgErr) return json(res, 500, { error: imgErr }, req);
      return json(res, 200, { document, pages: pages || [] }, req);
    }
    if (documentId && url.searchParams.get("images") === "1") {
      const { pages, error } = await listDocumentPageImages(documentId);
      if (error) return json(res, 500, { error }, req);
      return json(res, 200, { pages }, req);
    }

    const { documents, error } = await listDocumentsWithChunkCounts();
    const totalChunks = await getTotalChunkCount();
    if (error === "knowledge_schema_not_migrated") {
      return json(
        res,
        200,
        {
          documents: [],
          totalChunks: 0,
          schemaWarning: error,
          message: "הרץ supabase/knowledge.sql ואז knowledge_pgvector.sql ב-Supabase",
        },
        req,
      );
    }
    if (error === "supabase_connection_failed") {
      return json(
        res,
        503,
        {
          error,
          documents: [],
          totalChunks: 0,
          message:
            "לא ניתן להתחבר ל-Supabase מהשרת. בדקו ב-Vercel: SUPABASE_URL (או VITE_SUPABASE_URL) ו-SUPABASE_SERVICE_ROLE_KEY — מפתח service_role, לא anon.",
        },
        req,
      );
    }
    if (error) return json(res, 500, { error }, req);
    return json(res, 200, { documents, totalChunks }, req);
  }

  if (req.method === "DELETE") {
    const auth = await requireKnowledgeAccess(req, res, { rateLimit: true });
    if (!auth) return;

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
    void logSecurityEvent({
      action: "knowledge_delete",
      actorAgentId: auth.agent.id,
      resourceType: "knowledge_document",
      resourceId: documentId,
      req,
    });
    return json(res, 200, { ok: true, documentId }, req);
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  const auth = await requireKnowledgeAccess(req, res, { rateLimit: true });
  if (!auth) return;

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
    void logSecurityEvent({
      action: "knowledge_delete",
      actorAgentId: auth.agent.id,
      resourceType: "knowledge_document",
      resourceId: documentId,
      req,
    });
    return json(res, 200, { ok: true, documentId }, req);
  }

  if (action === "reprocess") {
    const documentId = String(body.documentId || body.id || "").trim();
    if (!documentId) return json(res, 400, { error: "document_id_required" }, req);
    try {
      const result = await reprocessDocument(documentId);
      if (!result.ok) return json(res, 500, { error: result.error, ...result }, req);
      return json(res, 200, { ...result, ocrMerged: result.ocrMerged ?? false }, req);
    } catch (err) {
      console.error("[knowledge-upload] reprocess", err);
      return json(res, 500, { error: err?.message || "ingest_exception" }, req);
    }
  }

  if (action === "import_hyp_pay") {
    try {
      const result = await importHypPayPackage({
        tenantId: body.tenantId ?? null,
      });
      if (!result.ok) {
        const status = result.error === "knowledge_schema_not_migrated" ? 503 : 500;
        return json(
          res,
          status,
          {
            error: result.error,
            message:
              result.error === "knowledge_schema_not_migrated"
                ? "הרץ supabase/knowledge.sql, knowledge_pgvector.sql ו-knowledge_gemini_migration.sql ב-Supabase SQL Editor"
                : undefined,
            ...result,
          },
          req,
        );
      }
      return json(res, 200, result, req);
    } catch (err) {
      console.error("[knowledge-upload] import_hyp_pay", err);
      return json(res, 500, { error: err?.message || "import_exception" }, req);
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
      const parent = await ensureKnowledgeDocumentParent(documentId, {
        title: body.title,
        category: body.category,
        content: body.content,
        fileName: body.fileName,
        tenantId: body.tenantId,
        sourceType: "upload",
      });
      if (!parent.ok) {
        return json(res, 500, { error: parent.error || "document_parent_missing" }, req);
      }

      const result = await ingestDocumentImages(
        {
          id: documentId,
          title: body.title,
          fileName: body.fileName,
          tenantId: body.tenantId ?? null,
          pages,
          skipOcr: !runOcr,
        },
        { replaceAll: body.replaceAll === true, skipOcr: !runOcr, skipEmbeddings: true },
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
    if (!result.ok) {
      const status = result.error === "knowledge_schema_not_migrated" ? 503 : 500;
      return json(
        res,
        status,
        {
          error: result.error,
          message:
            result.error === "knowledge_schema_not_migrated"
              ? "הרץ supabase/knowledge.sql, knowledge_pgvector.sql ו-knowledge_gemini_migration.sql ב-Supabase SQL Editor"
              : undefined,
          ...result,
        },
        req,
      );
    }
    void logSecurityEvent({
      action: "knowledge_upload",
      actorAgentId: auth.agent.id,
      resourceType: "knowledge_document",
      resourceId: doc.id,
      metadata: { title: doc.title, fileName: doc.fileName || null },
      req,
    });
    return json(res, 200, result, req);
  } catch (err) {
    console.error("[knowledge-upload] ingest", err);
    return json(res, 500, { error: err?.message || "ingest_exception" }, req);
  }
}

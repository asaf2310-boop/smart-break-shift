/** Admin CRUD for AI Agent document knowledge base. */

import { json, readJsonBody, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { verifyAdminAgent } from "../server/agent/agentAuthService.js";
import { isPgVectorConfigured } from "../server/knowledge/supabaseAdmin.js";
import { isEmbeddingConfigured } from "../server/knowledge/embeddingService.js";
import {
  ingestAiAgentDocument,
  listAiAgentDocuments,
  deleteAiAgentDocument,
} from "../server/ai-agent/documentIngestService.js";
import {
  AI_AGENT_SCHEMA_MIGRATION_MESSAGE_HE,
} from "../server/ai-agent/schemaErrors.js";
import {
  checkRateLimit,
  getRateLimitKey,
  rateLimitHebrewMessage,
  recordRateLimit,
  setRateLimitHeaders,
} from "../server/http/rateLimit.js";

const uploadRateByUser = new Map();
const UPLOAD_RATE_MAX = 30;
const UPLOAD_RATE_WINDOW_MS = 60 * 60 * 1000;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function enforceUploadRateLimit(res, req, auth) {
  const key = getRateLimitKey(req, auth?.agent?.id);
  const check = checkRateLimit(uploadRateByUser, key, UPLOAD_RATE_MAX, UPLOAD_RATE_WINDOW_MS);
  if (!check.allowed) {
    const sec = setRateLimitHeaders(res, check.retryAfterSec);
    json(
      res,
      429,
      { error: "rate_limited", retryAfterSec: sec, message: rateLimitHebrewMessage(sec) },
      req,
    );
    return false;
  }
  recordRateLimit(check.entry);
  return true;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden" }, req);
  }

  const auth = await verifyAdminAgent(req, {});
  if (!auth) {
    return json(res, 403, { error: "forbidden", message: "נדרשת הרשאת מנהל" }, req);
  }

  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.searchParams.get("health") === "1") {
      return json(
        res,
        200,
        {
          ok: isPgVectorConfigured(),
          supabase: isPgVectorConfigured(),
          embeddings: isEmbeddingConfigured(),
        },
        req,
      );
    }

    const { documents, error } = await listAiAgentDocuments();
    if (error === "schema_not_migrated") {
      return json(
        res,
        503,
        { error, message: AI_AGENT_SCHEMA_MIGRATION_MESSAGE_HE },
        req,
      );
    }
    if (error) return json(res, 500, { error }, req);
    return json(res, 200, { documents }, req);
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (!enforceUploadRateLimit(res, req, auth)) return;

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: "invalid_json" }, req);
  }

  const action = String(body.action || "ingest").trim();

  if (action === "delete") {
    const documentId = String(body.documentId || "").trim();
    if (!documentId) return json(res, 400, { error: "document_id_required" }, req);
    const result = await deleteAiAgentDocument(documentId);
    if (!result.ok) return json(res, 500, { error: result.error }, req);
    return json(res, 200, { ok: true }, req);
  }

  if (action === "ingest") {
    const title = String(body.title || "").trim();
    const content = String(body.content || "");
    const fileName = String(body.fileName || "").trim() || null;
    const mimeType = String(body.mimeType || "").trim() || null;

    if (mimeType && !ALLOWED_MIME.has(mimeType)) {
      return json(res, 400, { error: "mime_not_allowed" }, req);
    }

    const contentBytes = Buffer.byteLength(content, "utf8");
    if (contentBytes > 5_000_000) {
      return json(res, 413, { error: "content_too_large", message: "תוכן המסמך גדול מדי (מקסימום ~5MB)" }, req);
    }

    const result = await ingestAiAgentDocument({ title, content, fileName, mimeType });
    if (!result.ok) {
      const status = result.error === "schema_not_migrated" ? 503 : 400;
      return json(
        res,
        status,
        {
          error: result.error,
          message:
            result.error === "schema_not_migrated"
              ? AI_AGENT_SCHEMA_MIGRATION_MESSAGE_HE
              : undefined,
        },
        req,
      );
    }
    return json(res, 200, result, req);
  }

  return json(res, 400, { error: "unknown_action" }, req);
}

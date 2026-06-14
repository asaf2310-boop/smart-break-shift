/** Vercel serverless — knowledge gaps + agent feedback. */

import { json, readJsonBody, handleOptions, isSameOrigin } from "./lib/knowledge/httpUtils.js";
import { isPgVectorConfigured } from "./lib/knowledge/supabaseAdmin.js";
import {
  logKnowledgeGap,
  submitKnowledgeFeedback,
  listKnowledgeGaps,
  updateKnowledgeGap,
  listKnowledgeFeedback,
} from "./lib/knowledge/gapFeedbackService.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden" }, req);
  }

  if (!isPgVectorConfigured()) {
    return json(res, 503, { error: "pgvector_not_configured" }, req);
  }

  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const listType = url.searchParams.get("type") || "gaps";
    const tenantId = url.searchParams.get("tenantId") || null;
    const status = url.searchParams.get("status") || null;

    if (listType === "feedback") {
      const { feedback, error } = await listKnowledgeFeedback();
      if (error) return json(res, 500, { error }, req);
      return json(res, 200, { feedback }, req);
    }

    const { gaps, error } = await listKnowledgeGaps({ status, tenantId });
    if (error) return json(res, 500, { error }, req);
    return json(res, 200, { gaps }, req);
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

  const action = String(body.action || "feedback").trim();
  const tenantId = body.tenantId ?? body.tenant_id ?? null;

  if (action === "log_gap") {
    const result = await logKnowledgeGap({
      question: body.question,
      tenantId,
      confidence: body.confidence,
      retrievalMethod: body.retrievalMethod || body.retrieval_method,
    });
    if (!result.ok) return json(res, 400, { error: result.error }, req);
    return json(res, 200, result, req);
  }

  if (action === "update_gap") {
    const gapId = String(body.gapId || body.id || "").trim();
    if (!gapId) return json(res, 400, { error: "gap_id_required" }, req);
    const result = await updateKnowledgeGap(gapId, {
      manualAnswer: body.manualAnswer ?? body.manual_answer,
      status: body.status,
    });
    if (!result.ok) return json(res, 500, { error: result.error }, req);
    return json(res, 200, result, req);
  }

  const helpful = body.helpful === true || body.rating === "helpful";
  const notHelpful = body.helpful === false || body.rating === "not_helpful";

  if (!helpful && !notHelpful) {
    return json(res, 400, { error: "helpful_required" }, req);
  }

  const result = await submitKnowledgeFeedback({
    question: body.question,
    answer: body.answer,
    helpful,
    tenantId,
    confidence: body.confidence,
    queryLogId: body.queryLogId ?? body.query_log_id,
  });

  if (!result.ok) return json(res, 500, { error: result.error }, req);
  return json(res, 200, result, req);
}

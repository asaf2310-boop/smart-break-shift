/** Knowledge gaps and agent feedback persistence. */

import { getSupabaseAdmin } from "./supabaseAdmin.js";

export async function logKnowledgeGap({ question, tenantId, confidence, retrievalMethod }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const row = {
    tenant_id: tenantId ?? null,
    question: String(question || "").trim(),
    confidence: confidence ?? null,
    retrieval_method: retrievalMethod || "hybrid",
    status: "open",
    updated_at: new Date().toISOString(),
  };

  if (!row.question) return { ok: false, error: "question_required" };

  const { data, error } = await supabase.from("knowledge_gaps").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

export async function submitKnowledgeFeedback({
  question,
  answer,
  helpful,
  tenantId,
  confidence,
  queryLogId,
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const row = {
    tenant_id: tenantId ?? null,
    question: String(question || "").trim(),
    answer: answer ? String(answer).slice(0, 8000) : null,
    helpful: helpful === true,
    confidence: confidence ?? null,
    query_log_id: queryLogId ?? null,
  };

  if (!row.question) return { ok: false, error: "question_required" };

  const { data, error } = await supabase.from("knowledge_feedback").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };

  if (!helpful) {
    await logKnowledgeGap({
      question: row.question,
      tenantId,
      confidence,
      retrievalMethod: "feedback_not_helpful",
    });
  }

  return { ok: true, id: data?.id };
}

export async function listKnowledgeGaps({ status = null, tenantId = null, limit = 100 } = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { gaps: [], error: "supabase_not_configured" };

  let query = supabase
    .from("knowledge_gaps")
    .select("id, tenant_id, question, manual_answer, status, confidence, retrieval_method, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 200));

  if (status) query = query.eq("status", status);
  if (tenantId) query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);

  const { data, error } = await query;
  if (error) return { gaps: [], error: error.message };
  return { gaps: data || [], error: null };
}

export async function updateKnowledgeGap(gapId, { manualAnswer, status }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const updates = { updated_at: new Date().toISOString() };
  if (manualAnswer !== undefined) updates.manual_answer = manualAnswer || null;
  if (status) updates.status = status;
  if (manualAnswer && !status) updates.status = "answered";

  const { error } = await supabase.from("knowledge_gaps").update(updates).eq("id", gapId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listKnowledgeFeedback({ limit = 50 } = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { feedback: [], error: "supabase_not_configured" };

  const { data, error } = await supabase
    .from("knowledge_feedback")
    .select("id, question, answer, helpful, confidence, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 100));

  if (error) return { feedback: [], error: error.message };
  return { feedback: data || [], error: null };
}

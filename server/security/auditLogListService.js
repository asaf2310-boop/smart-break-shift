import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * List security audit log entries (service role — admin API only).
 */
export async function listSecurityAuditLog({
  limit = DEFAULT_LIMIT,
  offset = 0,
  action = null,
} = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const actionFilter = String(action || "").trim();

  let query = supabase
    .from("security_audit_log")
    .select(
      "id, actor_agent_id, action, resource_type, resource_id, metadata, ip, created_at, agents(display_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (actionFilter) {
    query = query.eq("action", actionFilter);
  }

  const { data, error, count } = await query;
  if (error) {
    console.warn("[auditLogListService] list failed", error.message);
    return { ok: false, error: "load_failed", message: "לא הצלחנו לטעון את יומן הביקורת" };
  }

  const entries = (data || []).map((row) => ({
    id: row.id,
    actorAgentId: row.actor_agent_id,
    actorDisplayName: row.agents?.display_name || null,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    metadata: row.metadata || {},
    ip: row.ip,
    createdAt: row.created_at,
  }));

  return {
    ok: true,
    entries,
    total: count ?? entries.length,
    limit: safeLimit,
    offset: safeOffset,
  };
}

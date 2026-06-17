import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";
import { getClientIp } from "../http/rateLimit.js";

/**
 * Persist a security audit event (service role — bypasses RLS INSERT revoke).
 * Fire-and-forget safe: logs warnings on failure, never throws.
 */
export async function logSecurityEvent({
  action,
  actorAgentId = null,
  resourceType = null,
  resourceId = null,
  metadata = null,
  req = null,
  ip = null,
} = {}) {
  const supabase = getSupabaseAdmin();
  const actionName = String(action || "").trim();
  if (!supabase || !actionName) return { ok: false, error: "not_configured" };

  const row = {
    actor_agent_id: actorAgentId || null,
    action: actionName.slice(0, 120),
    resource_type: resourceType ? String(resourceType).slice(0, 80) : null,
    resource_id: resourceId ? String(resourceId).slice(0, 120) : null,
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {},
    ip: ip || (req ? getClientIp(req) : null),
  };

  const { error } = await supabase.from("security_audit_log").insert(row);
  if (error) {
    console.warn("[auditLog]", actionName, error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

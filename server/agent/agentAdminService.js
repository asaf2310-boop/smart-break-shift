import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";
import { getAgentById } from "./agentAuthService.js";

/**
 * Soft-delete an agent via service role.
 * Client PATCH + Prefer:return=representation fails after soft-delete because
 * SELECT RLS only allows active agents — the RETURNING row is invisible.
 */
export async function adminSoftDeleteAgent(agentId, { actorAgentId = null } = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("supabase_not_configured");
  }

  const id = String(agentId || "").trim();
  if (!id) {
    throw new Error("invalid_id");
  }

  if (actorAgentId && String(actorAgentId) === id) {
    throw new Error("cannot_delete_self");
  }

  const existing = await getAgentById(id);
  if (!existing) {
    throw new Error("not_found");
  }

  if (!existing.active) {
    return { id, alreadyDeleted: true, displayName: existing.displayName };
  }

  const deletedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("agents")
    .update({
      active: false,
      deleted_at: deletedAt,
      blocked: true,
    })
    .eq("id", id)
    .select("id, display_name, deleted_at");

  if (error) throw error;
  if (!data?.length) {
    throw new Error("delete_no_rows");
  }

  // Ban linked Auth user so existing sessions cannot keep working.
  if (existing.authUserId) {
    try {
      await supabase.auth.admin.updateUserById(existing.authUserId, {
        ban_duration: "876000h",
      });
    } catch (banErr) {
      console.warn(
        "[agentAdminService] ban auth user failed",
        existing.authUserId,
        banErr?.message || banErr
      );
    }
  }

  return {
    id: data[0].id,
    alreadyDeleted: false,
    displayName: data[0].display_name,
    deletedAt: data[0].deleted_at,
  };
}

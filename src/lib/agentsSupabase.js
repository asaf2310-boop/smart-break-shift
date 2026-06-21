import { supabase, supabaseConfigured } from "@/api/supabase";

export const AGENT_ROW_COLUMNS =
  "id,email,display_name,auth_user_id,active,blocked,needs_password_setup,deleted_at,phone,modules,crm_role,created_at,updated_at";

export function withAgentsQueryTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("agents_query_timeout")), ms);
    }),
  ]);
}

/** List agents via Supabase client (no full-table REST list). */
export async function fetchAgentsFromSupabase({ activeOnly = false, limit = 500 } = {}) {
  if (!supabaseConfigured || !supabase) return [];

  let query = supabase
    .from("agents")
    .select(AGENT_ROW_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (activeOnly) {
    query = query.eq("active", true).is("deleted_at", null);
  }

  const { data, error } = await withAgentsQueryTimeout(query);
  if (error) throw error;
  return data || [];
}

export async function fetchAgentByIdFromSupabase(id) {
  if (!id || !supabase) return null;
  const { data, error } = await withAgentsQueryTimeout(
    supabase.from("agents").select(AGENT_ROW_COLUMNS).eq("id", id).maybeSingle()
  );
  if (error) throw error;
  return data;
}

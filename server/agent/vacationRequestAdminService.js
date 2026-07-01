import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";

const ALLOWED_STATUSES = new Set(["approved", "rejected"]);

export async function adminUpdateVacationRequestStatus({ id, status }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("supabase_not_configured");
  }

  const requestId = String(id || "").trim();
  const nextStatus = String(status || "").trim();

  if (!requestId) {
    throw new Error("invalid_id");
  }
  if (!ALLOWED_STATUSES.has(nextStatus)) {
    throw new Error("invalid_status");
  }

  const { data, error } = await supabase
    .from("vacation_requests")
    .update({ status: nextStatus })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id, agent_name, date, note, status, created_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("not_found_or_not_pending");
  }

  return data;
}

import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";

export async function adminDeleteBreakRegistration(id) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("supabase_not_configured");
  }

  const registrationId = String(id || "").trim();
  if (!registrationId) {
    throw new Error("invalid_id");
  }

  const { data, error } = await supabase
    .from("break_registrations")
    .delete()
    .eq("id", registrationId)
    .select("id");

  if (error) throw error;
  if (!data?.length) {
    throw new Error("not_found");
  }

  return data[0];
}

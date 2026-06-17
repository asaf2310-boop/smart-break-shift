import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";

function normalizeAgentName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function mapBreakRegistrationInsertError(err) {
  const message = String(err?.message || "");
  if (message.includes("break_slot_full")) {
    return "המשבצת מלאה — אין מקום נוסף";
  }
  if (message.includes("break_agent_already_registered")) {
    return "הנציג כבר נרשם להפסקה מסוג זה להיום";
  }
  if (message.includes("duplicate key") || message.includes("idx_break_reg_unique")) {
    return "הנציג כבר נרשם להפסקה מסוג זה להיום";
  }
  return null;
}

export async function adminCreateBreakRegistration(payload) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("supabase_not_configured");
  }

  const agent_name = normalizeAgentName(payload?.agent_name);
  const break_type = String(payload?.break_type || "").trim();
  const time_slot = String(payload?.time_slot || "").trim();
  const date = String(payload?.date || "").trim();

  if (!agent_name || !break_type || !time_slot || !date) {
    throw new Error("invalid_fields");
  }

  if (!["lunch", "short"].includes(break_type)) {
    throw new Error("invalid_break_type");
  }

  const { data, error } = await supabase
    .from("break_registrations")
    .insert({ agent_name, break_type, time_slot, date })
    .select("id, agent_name, break_type, time_slot, date, created_at")
    .single();

  if (error) {
    const mapped = mapBreakRegistrationInsertError(error);
    if (mapped) {
      const mappedError = new Error(mapped);
      mappedError.code = "insert_rejected";
      throw mappedError;
    }
    throw error;
  }

  return data;
}

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

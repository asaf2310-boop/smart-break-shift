import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

async function loadSession(sessionId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const { data, error } = await supabase
    .from("support_sessions")
    .select("id, status, agent_name, session_type")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.warn("[supportSessionEndService] load failed", error.message);
    return { ok: false, error: "load_failed" };
  }
  if (!data?.id) return { ok: false, error: "not_found" };
  return { ok: true, session: data };
}

function agentOwnsSession(agent, session) {
  if (!agent || !session) return false;
  if (agent.isAdmin === true) return true;
  const agentName = normalizeName(agent.displayName);
  const sessionAgent = normalizeName(session.agent_name);
  return Boolean(agentName && sessionAgent && agentName === sessionAgent);
}

/**
 * End a support session (screen share / rustdesk) — agent JWT required.
 */
export async function endSupportSessionByAgent({ sessionId, agent, endedReason = "agent_ended" }) {
  const sid = String(sessionId || "").trim();
  if (!sid || !agent?.id) {
    return { ok: false, error: "invalid_request" };
  }

  const loaded = await loadSession(sid);
  if (!loaded.ok) return loaded;

  if (!agentOwnsSession(agent, loaded.session)) {
    return { ok: false, error: "forbidden" };
  }

  if (loaded.session.status === "ended") {
    return { ok: true, alreadyEnded: true, sessionId: sid };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const now = new Date().toISOString();
  const reason = String(endedReason || "agent_ended").trim().slice(0, 80);

  const { error } = await supabase
    .from("support_sessions")
    .update({
      status: "ended",
      ended_at: now,
      ended_reason: reason,
      updated_at: now,
    })
    .eq("id", sid);

  if (error) {
    console.warn("[supportSessionEndService] update failed", error.message);
    return { ok: false, error: "update_failed" };
  }

  return {
    ok: true,
    sessionId: sid,
    sessionType: loaded.session.session_type,
    endedReason: reason,
  };
}

import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";
import { verifyGuestLinkToken } from "./guestLinkToken.js";

const MAX_GUEST_CHAT_BODY = 4000;
const MAX_GUEST_CHAT_LABEL = 120;

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function verifyGuestTokenForSession(token, sessionId) {
  const verified = verifyGuestLinkToken(token);
  if (!verified.ok) return verified;
  const sid = String(sessionId || verified.sessionId).trim();
  if (!sid || verified.sessionId !== sid) {
    return { ok: false, error: "session_mismatch" };
  }
  return { ok: true, sessionId: sid, kind: verified.kind };
}

async function loadActiveSession(sessionId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const { data, error } = await supabase
    .from("support_sessions")
    .select(
      "id, session_type, status, created_at, agent_name, customer_email, crm_customer_id, agent_peer_id, consent_at, recording_consent_at, recording_active_at, ended_at, ended_reason, short_code"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.warn("[guestSupportService] session load failed", error.message);
    return { ok: false, error: "load_failed" };
  }
  if (!data?.id) return { ok: false, error: "not_found" };
  if (data.status === "ended") {
    return { ok: false, error: "ended", session: data };
  }
  return { ok: true, session: data };
}

export function mapGuestSessionState(row) {
  if (!row?.id) return null;
  return {
    sessionId: row.id,
    sessionType: row.session_type === "rustdesk" ? "consent" : "screen",
    status: row.status === "ended" ? "ended" : "active",
    createdAt: row.created_at,
    agentName: row.agent_name || "",
    customerEmail: row.customer_email || "",
    crmCustomerId: row.crm_customer_id || null,
    agentPeerId: row.agent_peer_id || null,
    consentAt: row.consent_at || null,
    recordingConsentAt: row.recording_consent_at || null,
    recordingActiveAt: row.recording_active_at || null,
    endedAt: row.ended_at || null,
    endedReason: row.ended_reason || null,
  };
}

/**
 * Guest-safe session poll (agent peer id, consent, end status) — requires signed guest token.
 */
export async function fetchGuestSessionState({ token, sessionId }) {
  const authz = verifyGuestTokenForSession(token, sessionId);
  if (!authz.ok) return authz;

  const loaded = await loadActiveSession(authz.sessionId);
  if (!loaded.ok) {
    if (loaded.error === "ended" && loaded.session) {
      return {
        ok: true,
        session: mapGuestSessionState(loaded.session),
        ended: true,
      };
    }
    return loaded;
  }

  return { ok: true, session: mapGuestSessionState(loaded.session) };
}

export async function listGuestSessionChatMessages({ token, sessionId, limit = 500 }) {
  const authz = verifyGuestTokenForSession(token, sessionId);
  if (!authz.ok) return authz;

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const sessionCheck = await loadActiveSession(authz.sessionId);
  if (!sessionCheck.ok && sessionCheck.error !== "ended") return sessionCheck;

  const capped = Math.min(500, Math.max(1, Number(limit) || 500));
  const { data, error } = await supabase
    .from("support_session_messages")
    .select("id, session_id, sender_type, sender_label, body, created_at")
    .eq("session_id", authz.sessionId)
    .order("created_at", { ascending: true })
    .limit(capped);

  if (error) {
    console.warn("[guestSupportService] chat list failed", error.message);
    return { ok: false, error: "load_failed" };
  }

  const messages = (data || []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    senderType: row.sender_type === "guest" ? "guest" : "agent",
    senderLabel: row.sender_label || "",
    body: row.body || "",
    createdAt: row.created_at,
  }));

  return { ok: true, messages };
}

export async function insertGuestSessionChatMessage({
  token,
  sessionId,
  messageId,
  body,
  senderLabel = "לקוח",
}) {
  const authz = verifyGuestTokenForSession(token, sessionId);
  if (!authz.ok) return authz;

  const trimmedBody = String(body || "").trim();
  if (!trimmedBody) return { ok: false, error: "empty_body" };
  if (trimmedBody.length > MAX_GUEST_CHAT_BODY) {
    return { ok: false, error: "body_too_long" };
  }

  const id = String(messageId || "").trim();
  if (!id) return { ok: false, error: "invalid_message_id" };

  const sessionCheck = await loadActiveSession(authz.sessionId);
  if (!sessionCheck.ok) return sessionCheck;

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const row = {
    id,
    session_id: authz.sessionId,
    sender_type: "guest",
    sender_label: String(senderLabel || "לקוח").trim().slice(0, MAX_GUEST_CHAT_LABEL),
    body: trimmedBody,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("support_session_messages").insert(row);
  if (error) {
    if (String(error.message || "").includes("duplicate")) {
      return { ok: true, message: row };
    }
    console.warn("[guestSupportService] chat insert failed", error.message);
    return { ok: false, error: "insert_failed" };
  }

  return {
    ok: true,
    message: {
      id: row.id,
      sessionId: row.session_id,
      senderType: "guest",
      senderLabel: row.sender_label,
      body: row.body,
      createdAt: row.created_at,
    },
  };
}

export function auditGuestAccess(event, { req, sessionId, extra } = {}) {
  const ip = req?.headers?.["x-forwarded-for"]?.split?.(",")?.[0]?.trim() || "unknown";
  const sid = String(sessionId || "").slice(0, 12);
  console.info(`[guest-support] ${event}`, { sessionId: sid, ip, ...extra });
}

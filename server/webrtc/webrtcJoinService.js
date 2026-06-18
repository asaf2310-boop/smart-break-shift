import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";
import { verifyGuestLinkToken } from "../guest/guestLinkToken.js";
import { verifyOrBindGuestTokenFingerprint } from "../guest/guestLinkRedemption.js";
import { computeClientFingerprint } from "../guest/guestSessionFingerprint.js";
import {
  getWebrtcJoinTtlSec,
  signWebrtcJoinToken,
  verifyWebrtcJoinToken,
} from "./webrtcJoinToken.js";

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

async function loadActiveSession(sessionId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const { data, error } = await supabase
    .from("support_sessions")
    .select("id, status, agent_name")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.warn("[webrtcJoinService] session load failed", error.message);
    return { ok: false, error: "load_failed" };
  }
  if (!data?.id) return { ok: false, error: "not_found" };
  if (data.status === "ended") return { ok: false, error: "ended" };
  return { ok: true, session: data };
}

function verifyAgentOwnsSession(agent, sessionRow) {
  const owns =
    normalizeName(sessionRow.agent_name) === normalizeName(agent.displayName);
  const isAdmin = agent.isAdmin === true;
  if (!owns && !isAdmin) return { ok: false, error: "forbidden" };
  return { ok: true };
}

export async function mintWebrtcJoinToken({ sessionId, role, agent, guestToken, req }) {
  const sid = String(sessionId || "").trim();
  if (!sid) return { ok: false, error: "invalid_session" };

  const normalizedRole = role === "agent" ? "agent" : role === "guest" ? "guest" : null;
  if (!normalizedRole) return { ok: false, error: "invalid_role" };

  const loaded = await loadActiveSession(sid);
  if (!loaded.ok) return loaded;

  let fingerprint = null;

  if (normalizedRole === "agent") {
    if (!agent?.id) return { ok: false, error: "unauthorized" };
    const authz = verifyAgentOwnsSession(agent, loaded.session);
    if (!authz.ok) return authz;
  } else {
    const token = String(guestToken || "").trim();
    const authz = verifyGuestLinkToken(token);
    if (!authz.ok) return authz;
    if (authz.sessionId !== sid) return { ok: false, error: "session_mismatch" };

    const bind = await verifyOrBindGuestTokenFingerprint(token, sid, req);
    if (!bind.ok) return bind;
    fingerprint = bind.fingerprint || computeClientFingerprint(req);
  }

  try {
    const joinToken = signWebrtcJoinToken({
      sessionId: sid,
      role: normalizedRole,
      fingerprint: normalizedRole === "guest" ? fingerprint : null,
      agentId: normalizedRole === "agent" ? agent.id : null,
    });
    return {
      ok: true,
      joinToken,
      expiresInSec: getWebrtcJoinTtlSec(),
      role: normalizedRole,
    };
  } catch (err) {
    console.warn("[webrtcJoinService] sign failed", err);
    return { ok: false, error: "sign_failed" };
  }
}

export async function authorizeWebrtcJoin({
  joinToken,
  sessionId,
  role,
  agent = null,
  req,
}) {
  const verified = verifyWebrtcJoinToken(joinToken);
  if (!verified.ok) return verified;

  const sid = String(sessionId || "").trim();
  if (!sid || verified.sessionId !== sid) {
    return { ok: false, error: "session_mismatch" };
  }

  const normalizedRole = role === "agent" ? "agent" : role === "guest" ? "guest" : null;
  if (!normalizedRole) return { ok: false, error: "invalid_role" };
  if (verified.role !== normalizedRole) {
    return { ok: false, error: "role_mismatch" };
  }

  if (normalizedRole === "guest" && verified.fingerprint) {
    const fp = computeClientFingerprint(req);
    if (verified.fingerprint !== fp) {
      return { ok: false, error: "fingerprint_mismatch" };
    }
  }

  if (normalizedRole === "agent" && verified.agentId && agent?.id) {
    if (verified.agentId !== agent.id) {
      return { ok: false, error: "agent_mismatch" };
    }
  }

  const loaded = await loadActiveSession(sid);
  if (!loaded.ok) return loaded;

  if (normalizedRole === "agent" && agent) {
    const authz = verifyAgentOwnsSession(agent, loaded.session);
    if (!authz.ok) return authz;
  }

  return { ok: true, sessionId: sid, role: normalizedRole };
}

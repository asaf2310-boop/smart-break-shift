import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";
import {
  getGuestLinkTtlSec,
  guestLinkSecretConfigured,
  signGuestLinkToken,
  verifyGuestLinkToken,
} from "./guestLinkToken.js";
import { auditGuestAccess } from "./guestSupportService.js";
import {
  guestLinkOneTimeEnabled,
  isGuestLinkTokenConsumed,
  markGuestLinkTokenConsumed,
} from "./guestLinkOneTime.js";

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function mapSessionRow(row) {
  if (!row?.id) return null;
  return {
    sessionId: row.id,
    kind: row.session_type === "rustdesk" ? "consent" : "screen",
    createdAt: row.created_at,
    agentName: row.agent_name || "",
    customerEmail: row.customer_email || "",
    crmCustomerId: row.crm_customer_id || null,
    status: row.status === "ended" ? "ended" : "active",
    shortCode: row.short_code || null,
  };
}

export function guestLinkApiReady() {
  return Boolean(getSupabaseAdmin()) && guestLinkSecretConfigured();
}

export async function mintGuestLinkForSession({ sessionId, kind, agent }) {
  if (!guestLinkApiReady()) {
    return { ok: false, error: "guest_link_not_configured" };
  }

  const id = String(sessionId || "").trim();
  if (!id) {
    return { ok: false, error: "invalid_session" };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("support_sessions")
    .select(
      "id, session_type, created_at, agent_name, customer_email, crm_customer_id, status, short_code"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("[guestLinkService] mint load failed", error.message);
    return { ok: false, error: "load_failed" };
  }

  if (!data || data.status === "ended") {
    return { ok: false, error: "not_found" };
  }

  if (!agent?.displayName) {
    return { ok: false, error: "forbidden" };
  }
  const ownsSession = normalizeName(data.agent_name) === normalizeName(agent.displayName);
  const isAdmin = agent.isAdmin === true;
  if (!ownsSession && !isAdmin) {
    return { ok: false, error: "forbidden" };
  }

  const sessionKind = data.session_type === "rustdesk" ? "consent" : "screen";
  const resolvedKind = kind === "consent" || kind === "screen" ? kind : sessionKind;

  try {
    const ttlSec = getGuestLinkTtlSec();
    const token = signGuestLinkToken({
      sessionId: data.id,
      shortCode: data.short_code,
      kind: resolvedKind,
      ttlSec,
    });
    return { ok: true, token, expiresInSec: ttlSec };
  } catch (err) {
    console.warn("[guestLinkService] mint sign failed", err);
    return { ok: false, error: "sign_failed" };
  }
}

export async function resolveGuestLinkFromToken(token, { req } = {}) {
  if (!guestLinkApiReady()) {
    return { ok: false, error: "guest_link_not_configured" };
  }

  const verified = verifyGuestLinkToken(token);
  if (!verified.ok) {
    return verified;
  }

  if (isGuestLinkTokenConsumed(token)) {
    return {
      ok: false,
      error: "already_used",
      message: "קישור זה כבר נוצל (שימוש חד-פעמי)",
      oneTime: guestLinkOneTimeEnabled(),
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("support_sessions")
    .select(
      "id, session_type, created_at, agent_name, customer_email, crm_customer_id, status, short_code"
    )
    .eq("id", verified.sessionId)
    .maybeSingle();

  if (error) {
    console.warn("[guestLinkService] resolve load failed", error.message);
    return { ok: false, error: "load_failed" };
  }

  const session = mapSessionRow(data);
  if (!session) {
    return { ok: false, error: "not_found" };
  }

  if (session.status === "ended") {
    return { ok: false, error: "ended", session };
  }

  if (verified.shortCode && session.shortCode && verified.shortCode !== session.shortCode) {
    return { ok: false, error: "invalid_token" };
  }

  markGuestLinkTokenConsumed(token);
  auditGuestAccess("resolve_ok", { req, sessionId: session.sessionId });

  return {
    ok: true,
    session,
    kind: verified.kind,
    oneTime: guestLinkOneTimeEnabled(),
  };
}

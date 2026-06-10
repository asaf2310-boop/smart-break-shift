import { supabase, cleanEnvValue } from "@/api/supabase";
import { cloudSessionSyncEnabled } from "@/lib/supportSessionsSync";
import {
  encodeCompactGuestToken,
  decodeCompactGuestToken,
  encodeGuestBootstrapPayload,
  GUEST_BOOTSTRAP_QUERY_KEY,
} from "@/lib/guestLinkCodec";

function getPublicAppOrigin() {
  const fromEnv = cleanEnvValue(import.meta.env.VITE_APP_URL)?.replace(/\/$/, "") || "";
  if (typeof window === "undefined") return fromEnv;
  const origin = window.location.origin;
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
  if (isLocal && fromEnv) return fromEnv;
  return fromEnv || origin;
}

/** @typedef {'screen' | 'consent'} GuestLinkKind */

export { generateShortCode, encodeGuestBootstrapPayload, GUEST_BOOTSTRAP_QUERY_KEY } from "@/lib/guestLinkCodec";

/**
 * @param {{ id: string, createdAt?: string, shortCode?: string, agentName?: string, customerEmail?: string, crmCustomerId?: string|null }} session
 * @param {{ kind?: GuestLinkKind, origin?: string }} [options]
 */
export function buildShortGuestUrl(session, { kind = "screen", origin } = {}) {
  const base = (origin || getPublicAppOrigin()).replace(/\/$/, "");
  if (!session?.id) return "";
  if (session.shortCode && cloudSessionSyncEnabled()) {
    return `${base}/j/${session.shortCode}`;
  }
  const token = encodeCompactGuestToken(session, kind);
  return token ? `${base}/j/${token}` : "";
}

export function buildFullGuestPath(sessionId, kind, bootstrap) {
  const encodedId = encodeURIComponent(sessionId);
  if (kind === "consent") {
    const path = `/support/consent/${encodedId}`;
    return bootstrap ? `${path}?${GUEST_BOOTSTRAP_QUERY_KEY}=${bootstrap}` : path;
  }
  const path = `/support/screen/${encodedId}`;
  return bootstrap ? `${path}?${GUEST_BOOTSTRAP_QUERY_KEY}=${bootstrap}` : path;
}

function looksLikeShortCode(token) {
  const t = String(token || "").trim();
  return t.length >= 4 && t.length <= 8 && /^[A-Za-z0-9]+$/.test(t) && !t.includes(".");
}

function bootstrapPayloadFromDecoded(decoded) {
  return encodeGuestBootstrapPayload({
    id: decoded.sessionId,
    createdAt: decoded.createdAt,
    agentName: decoded.agentName,
    customerEmail: decoded.customerEmail,
    crmCustomerId: decoded.crmCustomerId,
  });
}

export function resolveGuestFromToken(
  token,
  { bootstrapScreen, bootstrapConsent, getScreenByShortCode, getConsentByShortCode } = {}
) {
  const trimmed = String(token || "").trim();
  if (!trimmed) return null;

  if (looksLikeShortCode(trimmed)) {
    const screen = getScreenByShortCode?.(trimmed);
    if (screen) {
      return {
        kind: "screen",
        sessionId: screen.id,
        bootstrap: encodeGuestBootstrapPayload(screen),
      };
    }
    const consent = getConsentByShortCode?.(trimmed);
    if (consent) {
      return {
        kind: "consent",
        sessionId: consent.id,
        bootstrap: encodeGuestBootstrapPayload({
          id: consent.id,
          createdAt: consent.createdAt,
          agentName: consent.agentName,
          customerEmail: consent.customerEmail,
          crmCustomerId: consent.crmCustomerId,
        }),
      };
    }
    return { kind: null, sessionId: null, bootstrap: null, pendingCloud: true, shortCode: trimmed };
  }

  const decoded = decodeCompactGuestToken(trimmed);
  if (!decoded) return null;

  const bootstrap = bootstrapPayloadFromDecoded(decoded);
  if (decoded.kind === "consent") {
    bootstrapConsent?.(decoded.sessionId, bootstrap);
  } else {
    bootstrapScreen?.(decoded.sessionId, bootstrap);
  }

  return {
    kind: decoded.kind,
    sessionId: decoded.sessionId,
    bootstrap,
    pendingCloud: false,
  };
}

export async function fetchGuestSessionByShortCode(shortCode) {
  if (!cloudSessionSyncEnabled() || !shortCode) return null;
  try {
    const { data, error } = await supabase
      .from("support_sessions")
      .select("id, session_type, created_at, agent_name, customer_email, crm_customer_id, status")
      .eq("short_code", shortCode)
      .maybeSingle();
    if (error || !data?.id) return null;
    return {
      sessionId: data.id,
      kind: data.session_type === "rustdesk" ? "consent" : "screen",
      createdAt: data.created_at,
      agentName: data.agent_name || "",
      customerEmail: data.customer_email || "",
      crmCustomerId: data.crm_customer_id || null,
      status: data.status,
    };
  } catch {
    return null;
  }
}

export async function resolveGuestFromTokenAsync(
  token,
  { bootstrapScreen, bootstrapConsent, getScreenByShortCode, getConsentByShortCode } = {}
) {
  const local = resolveGuestFromToken(token, {
    bootstrapScreen,
    bootstrapConsent,
    getScreenByShortCode,
    getConsentByShortCode,
  });
  if (!local?.pendingCloud) return local;

  const cloud = await fetchGuestSessionByShortCode(local.shortCode);
  if (!cloud) return null;

  const bootstrap = encodeGuestBootstrapPayload({
    id: cloud.sessionId,
    createdAt: cloud.createdAt,
    agentName: cloud.agentName,
    customerEmail: cloud.customerEmail,
    crmCustomerId: cloud.crmCustomerId,
  });

  if (cloud.kind === "consent") {
    bootstrapConsent?.(cloud.sessionId, bootstrap);
  } else {
    bootstrapScreen?.(cloud.sessionId, bootstrap);
  }

  return {
    kind: cloud.kind,
    sessionId: cloud.sessionId,
    bootstrap,
    pendingCloud: false,
  };
}

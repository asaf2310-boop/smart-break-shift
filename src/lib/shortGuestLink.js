import { supabase, cleanEnvValue } from "@/api/supabase";
import { cloudSessionSyncEnabled } from "@/lib/supportSessionsSync";
import {
  encodeCompactGuestToken,
  decodeCompactGuestToken,
  encodeGuestBootstrapPayload,
  decodeGuestBootstrapPayload,
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

export const GUEST_LINK_ERROR = {
  INVALID: "invalid",
  NOT_FOUND: "not_found",
  EXPIRED: "expired",
  ENDED: "ended",
};

export function messageForGuestLinkError(code) {
  switch (code) {
    case GUEST_LINK_ERROR.ENDED:
      return "סשן התמיכה הסתיים. בקשו מהנציג קישור חדש לסשן פעיל.";
    case GUEST_LINK_ERROR.NOT_FOUND:
      return "קישור לא נמצא. ודאו שהעתקתם את הקישור המלא או בקשו קישור חדש מהנציג.";
    case GUEST_LINK_ERROR.EXPIRED:
      return "פג תוקף הקישור. בקשו מהנציג קישור חדש.";
    default:
      return "קישור לא תקין. בקשו מהנציג קישור חדש.";
  }
}

export { generateShortCode, encodeGuestBootstrapPayload, GUEST_BOOTSTRAP_QUERY_KEY } from "@/lib/guestLinkCodec";

/**
 * @param {{ id: string, createdAt?: string, shortCode?: string, agentName?: string, customerEmail?: string, crmCustomerId?: string|null }} session
 * @param {{ kind?: GuestLinkKind, origin?: string }} [options]
 */
export function buildShortGuestUrl(session, { kind = "screen", origin } = {}) {
  const base = (origin || getPublicAppOrigin()).replace(/\/$/, "");
  if (!session?.id) return "";
  if (session.status === "ended") return "";
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
  }, decoded.kind);
}

function resolveFromUrlBootstrap(urlBootstrap, { bootstrapScreen, bootstrapConsent } = {}) {
  const payload = decodeGuestBootstrapPayload(urlBootstrap);
  if (!payload?.sessionId || !payload.createdAt) return null;

  const kind = payload.kind || "screen";
  const bootstrap = urlBootstrap;

  if (kind === "consent") {
    bootstrapConsent?.(payload.sessionId, bootstrap);
  } else {
    bootstrapScreen?.(payload.sessionId, bootstrap);
  }

  return {
    kind,
    sessionId: payload.sessionId,
    bootstrap,
    pendingCloud: false,
  };
}

export function resolveGuestFromToken(
  token,
  { bootstrapScreen, bootstrapConsent, getScreenByShortCode, getConsentByShortCode, urlBootstrap } = {}
) {
  const trimmed = String(token || "").trim();
  if (!trimmed) return { error: GUEST_LINK_ERROR.INVALID };

  if (looksLikeShortCode(trimmed)) {
    const screen = getScreenByShortCode?.(trimmed);
    if (screen) {
      return {
        kind: "screen",
        sessionId: screen.id,
        bootstrap: encodeGuestBootstrapPayload(screen, "screen"),
      };
    }
    const consent = getConsentByShortCode?.(trimmed);
    if (consent) {
      return {
        kind: "consent",
        sessionId: consent.id,
        bootstrap: encodeGuestBootstrapPayload(
          {
            id: consent.id,
            createdAt: consent.createdAt,
            agentName: consent.agentName,
            customerEmail: consent.customerEmail,
            crmCustomerId: consent.crmCustomerId,
          },
          "consent"
        ),
      };
    }

    if (urlBootstrap) {
      const fromBootstrap = resolveFromUrlBootstrap(urlBootstrap, {
        bootstrapScreen,
        bootstrapConsent,
      });
      if (fromBootstrap) return fromBootstrap;
    }

    return { kind: null, sessionId: null, bootstrap: null, pendingCloud: true, shortCode: trimmed };
  }

  const decoded = decodeCompactGuestToken(trimmed);
  if (!decoded) return { error: GUEST_LINK_ERROR.INVALID };

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

const SHORT_CODE_LOOKUP_ATTEMPTS = 8;
const SHORT_CODE_LOOKUP_BASE_DELAY_MS = 400;

function isPermanentShortCodeLookupError(message) {
  if (!message) return false;
  const m = String(message).toLowerCase();
  return (
    (m.includes("column") && m.includes("short_code")) ||
    (m.includes("relation") && m.includes("support_sessions"))
  );
}

async function fetchGuestSessionByShortCodeOnce(shortCode) {
  const { data, error } = await supabase
    .from("support_sessions")
    .select("id, session_type, created_at, agent_name, customer_email, crm_customer_id, status")
    .eq("short_code", shortCode)
    .maybeSingle();
  if (error) {
    console.warn("[shortGuestLink] short_code lookup failed", error.message);
    return { row: null, error: error.message };
  }
  if (!data?.id) return { row: null, error: null };
  return {
    row: {
      sessionId: data.id,
      kind: data.session_type === "rustdesk" ? "consent" : "screen",
      createdAt: data.created_at,
      agentName: data.agent_name || "",
      customerEmail: data.customer_email || "",
      crmCustomerId: data.crm_customer_id || null,
      status: data.status,
    },
    error: null,
  };
}

async function lookupShortCodeWithRetries(shortCode, { attempts = SHORT_CODE_LOOKUP_ATTEMPTS } = {}) {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    const result = await fetchGuestSessionByShortCodeOnce(shortCode);
    if (result.row) return result;
    if (result.error) {
      lastError = result.error;
      if (isPermanentShortCodeLookupError(result.error)) {
        return result;
      }
    }
    if (i < attempts - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, SHORT_CODE_LOOKUP_BASE_DELAY_MS * (i + 1))
      );
    }
  }
  return { row: null, error: lastError };
}

/** Verify short_code is readable from Supabase before sharing a /j/ link. */
export async function waitForShortCodeInCloud(shortCode) {
  if (!cloudSessionSyncEnabled() || !shortCode) return true;
  const result = await lookupShortCodeWithRetries(shortCode);
  if (!result.row) {
    console.warn(
      "[shortGuestLink] short_code not visible in cloud",
      shortCode,
      result.error || "not found after retries"
    );
  }
  return Boolean(result.row);
}

export async function fetchGuestSessionByShortCode(shortCode) {
  if (!cloudSessionSyncEnabled() || !shortCode) return null;
  try {
    const result = await lookupShortCodeWithRetries(shortCode);
    return result.row;
  } catch (err) {
    console.warn("[shortGuestLink] short_code fetch error", err);
    return null;
  }
}

export async function resolveGuestFromTokenAsync(
  token,
  {
    bootstrapScreen,
    bootstrapConsent,
    getScreenByShortCode,
    getConsentByShortCode,
    urlBootstrap,
  } = {}
) {
  const local = resolveGuestFromToken(token, {
    bootstrapScreen,
    bootstrapConsent,
    getScreenByShortCode,
    getConsentByShortCode,
    urlBootstrap,
  });

  if (local?.error) return local;
  if (!local?.pendingCloud) return local;

  const cloud = await fetchGuestSessionByShortCode(local.shortCode);

  if (cloud?.status === "ended") {
    return { error: GUEST_LINK_ERROR.ENDED, sessionId: cloud.sessionId, kind: cloud.kind };
  }

  if (cloud) {
    const bootstrap = encodeGuestBootstrapPayload(
      {
        id: cloud.sessionId,
        createdAt: cloud.createdAt,
        agentName: cloud.agentName,
        customerEmail: cloud.customerEmail,
        crmCustomerId: cloud.crmCustomerId,
      },
      cloud.kind
    );

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

  if (urlBootstrap) {
    const fromBootstrap = resolveFromUrlBootstrap(urlBootstrap, {
      bootstrapScreen,
      bootstrapConsent,
    });
    if (fromBootstrap) return fromBootstrap;
  }

  return { error: GUEST_LINK_ERROR.NOT_FOUND };
}

import { cleanEnvValue } from "@/api/supabase";
import { demoModeEnabled } from "@/api/demoClient";
import { cloudSessionSyncEnabled } from "@/lib/supportSessionsSync";
import { apiMintGuestLink, apiResolveGuestLink } from "@/lib/guestLinkClient";
import { saveGuestLinkToken } from "@/lib/guestLinkTokenStore";
import {
  encodeCompactGuestToken,
  decodeCompactGuestToken,
  encodeGuestBootstrapPayload,
  decodeGuestBootstrapPayload,
  GUEST_BOOTSTRAP_QUERY_KEY,
  generateShortCode,
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
  ALREADY_USED: "already_used",
  FINGERPRINT_MISMATCH: "fingerprint_mismatch",
};

export const SIGNED_GUEST_LINK_PREFIX = "g1.";

export function isSignedGuestLinkToken(token) {
  return String(token || "").startsWith(SIGNED_GUEST_LINK_PREFIX);
}

export function messageForGuestLinkError(code) {
  switch (code) {
    case GUEST_LINK_ERROR.ENDED:
      return "סשן התמיכה הסתיים. בקשו מהנציג קישור חדש לסשן פעיל.";
    case GUEST_LINK_ERROR.NOT_FOUND:
      return "קישור לא נמצא. ודאו שהעתקתם את הקישור המלא או בקשו קישור חדש מהנציג.";
    case GUEST_LINK_ERROR.EXPIRED:
      return "פג תוקף הקישור. בקשו מהנציג קישור חדש.";
    case GUEST_LINK_ERROR.ALREADY_USED:
      return "קישור זה כבר נוצל. בקשו מהנציג קישור חדש.";
    case GUEST_LINK_ERROR.FINGERPRINT_MISMATCH:
      return "קישור זה נפתח ממכשיר אחר. בקשו מהנציג קישור חדש.";
    default:
      return "קישור לא תקין. בקשו מהנציג קישור חדש.";
  }
}

export { generateShortCode, encodeGuestBootstrapPayload, GUEST_BOOTSTRAP_QUERY_KEY } from "@/lib/guestLinkCodec";

/**
 * @param {{ id: string, createdAt?: string, shortCode?: string, guestLinkToken?: string, agentName?: string, customerEmail?: string, crmCustomerId?: string|null, status?: string }} session
 * @param {{ kind?: GuestLinkKind, origin?: string }} [options]
 */
export function buildShortGuestUrl(session, { kind = "screen", origin } = {}) {
  const base = (origin || getPublicAppOrigin()).replace(/\/$/, "");
  if (!session?.id) return "";
  if (session.status === "ended") return "";

  if (cloudSessionSyncEnabled() && session.guestLinkToken) {
    return `${base}/j/${session.guestLinkToken}`;
  }

  if (session.shortCode && !cloudSessionSyncEnabled()) {
    return `${base}/j/${session.shortCode}`;
  }

  if (!cloudSessionSyncEnabled()) {
    const token = encodeCompactGuestToken(session, kind);
    return token ? `${base}/j/${token}` : "";
  }

  return "";
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
  return (
    !isSignedGuestLinkToken(t) &&
    t.length >= 4 &&
    t.length <= 8 &&
    /^[A-Za-z0-9]+$/.test(t) &&
    !t.includes(".")
  );
}

function bootstrapPayloadFromDecoded(decoded) {
  return encodeGuestBootstrapPayload(
    {
      id: decoded.sessionId,
      createdAt: decoded.createdAt,
      agentName: decoded.agentName,
      customerEmail: decoded.customerEmail,
      crmCustomerId: decoded.crmCustomerId,
    },
    decoded.kind
  );
}

function bootstrapPayloadFromCloudSession(session, kind) {
  return encodeGuestBootstrapPayload(
    {
      id: session.sessionId,
      createdAt: session.createdAt,
      agentName: session.agentName,
      customerEmail: session.customerEmail,
      crmCustomerId: session.crmCustomerId,
    },
    kind
  );
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

function mapApiError(error) {
  if (error === "expired") return GUEST_LINK_ERROR.EXPIRED;
  if (error === "ended") return GUEST_LINK_ERROR.ENDED;
  if (error === "already_used") return GUEST_LINK_ERROR.ALREADY_USED;
  if (error === "fingerprint_mismatch") return GUEST_LINK_ERROR.FINGERPRINT_MISMATCH;
  if (error === "not_found") return GUEST_LINK_ERROR.NOT_FOUND;
  return GUEST_LINK_ERROR.INVALID;
}

async function resolveSignedGuestToken(
  token,
  { bootstrapScreen, bootstrapConsent, urlBootstrap } = {}
) {
  const api = await apiResolveGuestLink(token);
  if (!api.ok) {
    if (urlBootstrap && !cloudSessionSyncEnabled()) {
      const fromBootstrap = resolveFromUrlBootstrap(urlBootstrap, {
        bootstrapScreen,
        bootstrapConsent,
      });
      if (fromBootstrap) return fromBootstrap;
    }
    return { error: mapApiError(api.error) };
  }

  const kind = api.kind === "consent" ? "consent" : "screen";
  const session = api.session;
  const bootstrap = bootstrapPayloadFromCloudSession(session, kind);

  if (kind === "consent") {
    bootstrapConsent?.(session.sessionId, bootstrap);
  } else {
    bootstrapScreen?.(session.sessionId, bootstrap);
  }

  saveGuestLinkToken(session.sessionId, token);

  return {
    kind,
    sessionId: session.sessionId,
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

  if (isSignedGuestLinkToken(trimmed)) {
    return { pendingSigned: true, token: trimmed };
  }

  if (!demoModeEnabled && cloudSessionSyncEnabled()) {
    return { error: GUEST_LINK_ERROR.INVALID };
  }

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

    return { error: GUEST_LINK_ERROR.NOT_FOUND };
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

/**
 * Sync session to cloud and mint a signed guest link token (production).
 */
export async function finalizeCloudGuestLink(session, { kind, updateSession, syncToCloud }) {
  if (!session?.id) return { ok: false, error: "missing session", cloudSynced: false };
  if (!cloudSessionSyncEnabled()) return { ok: true, session, cloudSynced: true };

  let workingSession = session;
  if (!workingSession.shortCode) {
    const updated = updateSession(workingSession.id, { shortCode: generateShortCode(6) });
    if (updated) workingSession = updated;
  }
  if (!workingSession.shortCode) {
    return { ok: false, error: "missing short code", cloudSynced: false };
  }

  const syncResult = await syncToCloud(workingSession);
  if (!syncResult.ok) {
    return {
      ok: false,
      session: workingSession,
      cloudSynced: false,
      cloudError: syncResult.error || "cloud sync failed",
    };
  }

  const mint = await apiMintGuestLink({ sessionId: workingSession.id, kind });
  if (!mint.ok || !mint.token) {
    return {
      ok: false,
      session: workingSession,
      cloudSynced: false,
      cloudError: mint.error || "mint_failed",
    };
  }

  const verified = updateSession(workingSession.id, {
    guestLinkToken: mint.token,
    shortCodeCloudSynced: true,
  });
  if (verified) workingSession = verified;

  return { ok: true, session: workingSession, cloudSynced: true };
}

/** @deprecated שלב 4 — השתמש ב-finalizeCloudGuestLink */
export async function waitForShortCodeInCloud(shortCode) {
  if (!cloudSessionSyncEnabled() || !shortCode) return true;
  return false;
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
  const trimmed = String(token || "").trim();
  if (isSignedGuestLinkToken(trimmed)) {
    return resolveSignedGuestToken(trimmed, {
      bootstrapScreen,
      bootstrapConsent,
      urlBootstrap,
    });
  }

  const local = resolveGuestFromToken(token, {
    bootstrapScreen,
    bootstrapConsent,
    getScreenByShortCode,
    getConsentByShortCode,
    urlBootstrap,
  });

  if (local?.pendingSigned) {
    return resolveSignedGuestToken(local.token, {
      bootstrapScreen,
      bootstrapConsent,
      urlBootstrap,
    });
  }

  if (local?.error) return local;
  return local;
}

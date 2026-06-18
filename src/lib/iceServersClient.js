import { supabase } from "@/api/supabase";
import { getGuestLinkToken } from "@/lib/guestLinkTokenStore";
import { getWebrtcJoinToken } from "@/lib/webrtcJoinTokenStore";

const ICE_SERVERS_TTL_MS = 5 * 60 * 1000;

/** @type {{ iceServers: RTCIceServer[], iceTransportPolicy: 'all'|'relay', turnConfigured: boolean, fetchedAt: number } | null} */
let cache = null;
/** @type {Promise<{ iceServers: RTCIceServer[], iceTransportPolicy: 'all'|'relay', turnConfigured: boolean }> | null} */
let inFlight = null;

const STUN_ONLY_FALLBACK = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

function fallbackResult() {
  return {
    iceServers: [...STUN_ONLY_FALLBACK],
    iceTransportPolicy: /** @type {'all'} */ ("all"),
    turnConfigured: false,
  };
}

/**
 * @param {{ sessionId?: string, guestToken?: string }} [options]
 * @returns {Promise<{ iceServers: RTCIceServer[], iceTransportPolicy: 'all'|'relay', turnConfigured: boolean }>}
 */
export async function fetchIceServers(options = {}) {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < ICE_SERVERS_TTL_MS) {
    return {
      iceServers: cache.iceServers,
      iceTransportPolicy: cache.iceTransportPolicy,
      turnConfigured: cache.turnConfigured,
    };
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const sessionId = options.sessionId;
      const guestToken =
        options.guestToken || (sessionId ? getGuestLinkToken(sessionId) : null);
      const joinToken =
        options.joinToken || (sessionId ? getWebrtcJoinToken(sessionId) : null);

      const headers = { "Content-Type": "application/json" };
      if (supabase && !guestToken) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.access_token) {
            headers.Authorization = `Bearer ${data.session.access_token}`;
          }
        } catch {
          /* ignore */
        }
      }

      const response = await fetch("/api/agent-auth", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({
          action: "ice_servers",
          ...(sessionId ? { sessionId } : {}),
          ...(guestToken ? { guestToken } : {}),
          ...(joinToken ? { joinToken } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !Array.isArray(data.iceServers)) {
        console.warn("[iceServersClient] fetch failed", data?.error || response.status);
        return fallbackResult();
      }

      const result = {
        iceServers: data.iceServers,
        iceTransportPolicy:
          data.iceTransportPolicy === "relay" ? /** @type {'relay'} */ ("relay") : "all",
        turnConfigured: Boolean(data.turnConfigured),
      };
      cache = { ...result, fetchedAt: Date.now() };
      return result;
    } catch (err) {
      console.warn("[iceServersClient] network error", err);
      return fallbackResult();
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** @returns {{ iceServers: RTCIceServer[], iceTransportPolicy: 'all'|'relay', turnConfigured: boolean } | null} */
export function getCachedIceServers() {
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt >= ICE_SERVERS_TTL_MS) return null;
  return {
    iceServers: cache.iceServers,
    iceTransportPolicy: cache.iceTransportPolicy,
    turnConfigured: cache.turnConfigured,
  };
}

export function getStunOnlyFallback() {
  return fallbackResult();
}

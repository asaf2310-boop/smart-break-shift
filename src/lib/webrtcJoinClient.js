import { supabase } from "@/api/supabase";
import { getGuestLinkToken } from "@/lib/guestLinkTokenStore";
import { saveWebrtcJoinToken } from "@/lib/webrtcJoinTokenStore";

async function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }
    } catch {
      /* ignore */
    }
  }
  return headers;
}

/**
 * Mint a short-lived WebRTC join token (agent JWT or guest link token).
 * @param {{ sessionId: string, role: 'agent'|'guest', guestToken?: string }} params
 */
export async function apiMintWebrtcJoinToken({ sessionId, role, guestToken }) {
  try {
    const headers =
      role === "agent" ? await authHeaders() : { "Content-Type": "application/json" };
    const token = guestToken || (role === "guest" ? getGuestLinkToken(sessionId) : null);

    const response = await fetch("/api/agent-auth", {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({
        action: "webrtc_join_mint",
        sessionId,
        role,
        ...(token ? { guestToken: token } : {}),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || !data.joinToken) {
      return { ok: false, error: data.error || "join_mint_failed", message: data.message };
    }

    saveWebrtcJoinToken(sessionId, data.joinToken);
    return {
      ok: true,
      joinToken: data.joinToken,
      expiresInSec: data.expiresInSec,
    };
  } catch (err) {
    console.warn("[webrtcJoinClient] mint failed", err);
    return { ok: false, error: "network_error" };
  }
}

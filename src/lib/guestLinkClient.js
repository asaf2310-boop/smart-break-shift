import { supabase } from "@/api/supabase";

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

export async function apiMintGuestLink({ sessionId, kind }) {
  try {
    const response = await fetch("/api/guest-link", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        action: "mint",
        sessionId,
        kind,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: data.error || "mint_failed", message: data.message };
    }
    return { ok: true, token: data.token, expiresInSec: data.expiresInSec };
  } catch (err) {
    console.warn("[guestLinkClient] mint failed", err);
    return { ok: false, error: "network_error" };
  }
}

export async function apiResolveGuestLink(token) {
  try {
    const response = await fetch("/api/guest-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "resolve",
        token,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: data.error || "resolve_failed" };
    }
    return { ok: true, session: data.session, kind: data.kind };
  } catch (err) {
    console.warn("[guestLinkClient] resolve failed", err);
    return { ok: false, error: "network_error" };
  }
}

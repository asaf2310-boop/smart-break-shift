import { supabase } from "@/api/supabase";
import { getGuestLinkToken } from "@/lib/guestLinkTokenStore";
import {
  isStaleGuestAuthError,
  purgeStaleGuestSessionTokens,
} from "@/lib/guestSessionTokenCleanup";

function handleStaleGuestApiError(error, sessionId) {
  if (!isStaleGuestAuthError(error)) return;
  purgeStaleGuestSessionTokens(sessionId);
}

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
    const response = await fetch("/api/agent-auth", {
      method: "POST",
      headers: await authHeaders(),
      credentials: "same-origin",
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
    const response = await fetch("/api/agent-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        action: "resolve",
        token,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = data.error || "resolve_failed";
      handleStaleGuestApiError(error);
      return { ok: false, error };
    }
    return { ok: true, session: data.session, kind: data.kind };
  } catch (err) {
    console.warn("[guestLinkClient] resolve failed", err);
    return { ok: false, error: "network_error" };
  }
}

export async function apiGuestSessionState({ sessionId, token }) {
  try {
    const response = await fetch("/api/agent-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        action: "guest_session",
        sessionId,
        token,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = data.error || "guest_session_failed";
      handleStaleGuestApiError(error, sessionId);
      return { ok: false, error };
    }
    return { ok: true, session: data.session, ended: data.ended === true };
  } catch (err) {
    console.warn("[guestLinkClient] guest_session failed", err);
    return { ok: false, error: "network_error" };
  }
}

export async function apiGuestChatList({ sessionId, token }) {
  try {
    const response = await fetch("/api/agent-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        action: "guest_chat_list",
        sessionId,
        token,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = data.error || "guest_chat_list_failed";
      handleStaleGuestApiError(error, sessionId);
      return { ok: false, error };
    }
    return { ok: true, messages: data.messages || [] };
  } catch (err) {
    console.warn("[guestLinkClient] guest_chat_list failed", err);
    return { ok: false, error: "network_error" };
  }
}

export async function apiGuestChatSend({ sessionId, token, messageId, body, senderLabel }) {
  try {
    const response = await fetch("/api/agent-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        action: "guest_chat_send",
        sessionId,
        token,
        messageId,
        body,
        senderLabel,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = data.error || "guest_chat_send_failed";
      handleStaleGuestApiError(error, sessionId);
      return { ok: false, error };
    }
    return { ok: true, message: data.message };
  } catch (err) {
    console.warn("[guestLinkClient] guest_chat_send failed", err);
    return { ok: false, error: "network_error" };
  }
}

export function getGuestTokenForSession(sessionId) {
  return getGuestLinkToken(sessionId);
}

/** Production: end support session via server (audit log + RLS-safe update). */
export async function apiEndSupportSession({ sessionId, endedReason }) {
  try {
    const response = await fetch("/api/agent-auth", {
      method: "POST",
      headers: await authHeaders(),
      credentials: "same-origin",
      body: JSON.stringify({
        action: "end_support_session",
        sessionId,
        endedReason,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: data.error || "end_failed", message: data.message };
    }
    return { ok: true, ...data };
  } catch (err) {
    console.warn("[guestLinkClient] end_support_session failed", err);
    return { ok: false, error: "network_error" };
  }
}

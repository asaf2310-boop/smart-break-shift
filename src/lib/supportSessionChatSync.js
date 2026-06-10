import { demoModeEnabled } from "@/api/demoClient";
import { supabase, supabaseConfigured } from "@/api/supabase";

export function cloudSupportSessionChatEnabled() {
  if (demoModeEnabled || !supabaseConfigured || !supabase) return false;
  return import.meta.env.VITE_SUPPORT_SESSION_CHAT_CLOUD !== "false";
}

function mapCloudChatRow(row) {
  if (!row?.id) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    senderType: row.sender_type === "guest" ? "guest" : "agent",
    senderLabel: row.sender_label || "",
    body: row.body || "",
    createdAt: row.created_at,
    fromCloud: true,
  };
}

export async function fetchCloudSessionChatMessages(sessionId) {
  if (!cloudSupportSessionChatEnabled() || !sessionId) return [];
  try {
    const { data, error } = await supabase
      .from("support_session_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) {
      console.warn("[supportSessionChatSync] fetch failed", error.message);
      return [];
    }
    return (data || []).map(mapCloudChatRow).filter(Boolean);
  } catch (err) {
    console.warn("[supportSessionChatSync] fetch error", err);
    return [];
  }
}

export async function insertCloudSessionChatMessage(message = {}) {
  if (!cloudSupportSessionChatEnabled() || !message.sessionId || !message.id) {
    return { ok: false, error: "cloud_disabled" };
  }
  const row = {
    id: message.id,
    session_id: message.sessionId,
    sender_type: message.senderType === "guest" ? "guest" : "agent",
    sender_label: String(message.senderLabel || "").trim(),
    body: String(message.body || "").trim(),
    created_at: message.createdAt || new Date().toISOString(),
  };
  const { error } = await supabase.from("support_session_messages").insert(row);
  if (error) {
    console.warn("[supportSessionChatSync] insert failed", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export function mergeSessionChatMessages(local = [], cloud = []) {
  const byId = new Map();
  for (const msg of cloud) {
    if (msg?.id) byId.set(msg.id, { ...msg });
  }
  for (const msg of local) {
    if (!msg?.id) continue;
    const existing = byId.get(msg.id);
    byId.set(msg.id, existing ? { ...existing, ...msg } : msg);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
}

export function subscribeCloudSessionChat(sessionId, onMessage) {
  if (!cloudSupportSessionChatEnabled() || !sessionId || !supabase) {
    return () => {};
  }
  const channel = supabase
    .channel(`support-session-chat-${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "support_session_messages",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        const mapped = mapCloudChatRow(payload.new);
        if (mapped) onMessage(mapped);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

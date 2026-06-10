import {
  appendLocalSessionChatMessage,
  listLocalSessionChatMessages,
} from "@/lib/supportSessionChatStore";
import {
  cloudSupportSessionChatEnabled,
  fetchCloudSessionChatMessages,
  insertCloudSessionChatMessage,
  mergeSessionChatMessages,
} from "@/lib/supportSessionChatSync";

export async function loadSessionChatMessages(sessionId) {
  if (!sessionId) return [];
  const local = listLocalSessionChatMessages(sessionId);
  if (!cloudSupportSessionChatEnabled()) return local;
  const cloud = await fetchCloudSessionChatMessages(sessionId);
  return mergeSessionChatMessages(local, cloud);
}

export async function sendSessionChatMessage(sessionId, { senderType, senderLabel, body }) {
  const trimmed = String(body || "").trim();
  if (!sessionId || !trimmed) return null;

  const local = appendLocalSessionChatMessage(sessionId, {
    senderType,
    senderLabel,
    body: trimmed,
  });
  if (!local) return null;

  if (cloudSupportSessionChatEnabled()) {
    const result = await insertCloudSessionChatMessage(local);
    if (!result.ok) {
      console.warn("[supportSessionChat] cloud insert failed", result.error);
    }
  }

  return local;
}

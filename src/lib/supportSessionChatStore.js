import { remoteSupportEnabled } from "@/api/demoClient";
import { generateShortCode } from "@/lib/guestLinkCodec";
import { demoModeEnabled } from "@/api/demoMode";
import { getSessionScopedStorage } from "@/lib/browserStoragePolicy";

export const SUPPORT_CHAT_STORAGE_KEY = "smart-break-shift-support-chat-v1";
export const SUPPORT_CHAT_CHANGE_EVENT = "support-session-chat-changed";

function makeMessageId() {
  return `ss_chat_${generateShortCode(8)}`;
}

function getStorage() {
  return getSessionScopedStorage(demoModeEnabled);
}

function readStore() {
  if (!remoteSupportEnabled || typeof window === "undefined") {
    return { messages: [] };
  }
  try {
    const raw = getStorage()?.getItem(SUPPORT_CHAT_STORAGE_KEY);
    if (!raw) return { messages: [] };
    const parsed = JSON.parse(raw);
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch {
    return { messages: [] };
  }
}

function writeStore({ messages }) {
  if (!remoteSupportEnabled || typeof window === "undefined") return;
  const storage = getStorage();
  if (storage) {
    storage.setItem(SUPPORT_CHAT_STORAGE_KEY, JSON.stringify({ messages }));
  }
  window.dispatchEvent(new CustomEvent(SUPPORT_CHAT_CHANGE_EVENT));
}

export function listLocalSessionChatMessages(sessionId) {
  if (!sessionId) return [];
  return readStore()
    .messages.filter((m) => m.sessionId === sessionId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export function appendLocalSessionChatMessage(sessionId, meta = {}) {
  if (!sessionId) return null;
  const body = String(meta.body || "").trim();
  if (!body) return null;
  const now = new Date().toISOString();
  const entry = {
    id: meta.id || makeMessageId(),
    sessionId,
    senderType: meta.senderType === "guest" ? "guest" : "agent",
    senderLabel: String(meta.senderLabel || "").trim(),
    body,
    createdAt: now,
    fromLocal: true,
  };
  writeStore({ messages: [...readStore().messages, entry] });
  return entry;
}

export function subscribeSupportSessionChat(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(SUPPORT_CHAT_CHANGE_EVENT, handler);
  window.addEventListener("storage", (e) => {
    if (e.key === SUPPORT_CHAT_STORAGE_KEY) handler();
  });
  return () => window.removeEventListener(SUPPORT_CHAT_CHANGE_EVENT, handler);
}

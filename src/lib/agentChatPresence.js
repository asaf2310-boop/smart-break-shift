import { dataClient } from "@/api/client";
import { getChatEntities } from "@/api/localChatStore";
import { getStoredAgentName } from "@/constants/scheduling";

export const CHAT_STATUS = {
  available: { key: "available", label: "זמין", tone: "emerald" },
  break: { key: "break", label: "בהפסקה", tone: "amber" },
  offline: { key: "offline", label: "לא מחובר", tone: "red" },
};

export const CHAT_STATUS_OPTIONS = Object.values(CHAT_STATUS);

/** אפשרויות בחירה לנציג — בלי "לא מחובר" */
export const CHAT_STATUS_SELECT_OPTIONS = [
  CHAT_STATUS.available,
  CHAT_STATUS.break,
];

const SESSION_KEY = "agent_chat_connected";

export function isAgentChatConnected() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SESSION_KEY) !== "false";
}

export function setAgentChatConnected(connected) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, connected ? "true" : "false");
  window.dispatchEvent(new CustomEvent("agent-chat-connection", { detail: { connected } }));
}

export async function upsertAgentPresence(agentName, { status, touchSeen = true }) {
  if (!agentName) return null;
  const timestamp = new Date().toISOString();
  const chatEntities = getChatEntities() || dataClient.entities;
  const existing = await chatEntities.ChatPresence.filter({ agent_name: agentName });
  const row = existing[0];
  const payload = {
    status,
    updated_at: timestamp,
    ...(touchSeen && status !== CHAT_STATUS.offline.key
      ? { last_seen_at: timestamp }
      : { last_seen_at: row?.last_seen_at || "1970-01-01T00:00:00.000Z" }),
  };

  if (row?.id) {
    return chatEntities.ChatPresence.update(row.id, payload);
  }
  return chatEntities.ChatPresence.create({
    agent_name: agentName,
    ...payload,
    last_seen_at: touchSeen ? timestamp : "1970-01-01T00:00:00.000Z",
  });
}

export async function setAgentStatus(agentName, statusKey, { syncSession } = {}) {
  const shouldSyncSession = syncSession ?? agentName === getStoredAgentName();
  if (statusKey === CHAT_STATUS.offline.key) {
    if (shouldSyncSession) setAgentChatConnected(false);
    return upsertAgentPresence(agentName, { status: statusKey, touchSeen: false });
  }
  if (shouldSyncSession) setAgentChatConnected(true);
  return upsertAgentPresence(agentName, { status: statusKey, touchSeen: true });
}

export async function connectAgentAsAvailable(agentName) {
  setAgentChatConnected(true);
  return upsertAgentPresence(agentName, { status: CHAT_STATUS.available.key, touchSeen: true });
}

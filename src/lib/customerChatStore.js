import { demoModeEnabled } from "@/api/demoClient";
import { getChatEntities } from "@/api/localChatStore";
import { CHAT_STATUS } from "@/lib/agentChatPresence";

export const CUSTOMER_CHAT_STORAGE_KEY = "smart-break-shift-customer-chat-v1";
export const CUSTOMER_CHAT_CHANGE_EVENT = "customer-chat-changed";

const SESSION_STATUS = {
  waiting: "waiting",
  active: "active",
  closed: "closed",
};

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function makeToken() {
  return `tok_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function readStore() {
  try {
    const raw = localStorage.getItem(CUSTOMER_CHAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1) return parsed;
    }
  } catch {
    // ignore
  }
  const store = { version: 1, nextAgentIndex: 0, sessions: [], messages: [] };
  writeStore(store);
  return store;
}

function writeStore(store) {
  localStorage.setItem(CUSTOMER_CHAT_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(CUSTOMER_CHAT_CHANGE_EVENT));
}

export function customerChatDemoAvailable() {
  return demoModeEnabled;
}

export function subscribeCustomerChatStore(callback) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e) => {
    if (e.key === CUSTOMER_CHAT_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CUSTOMER_CHAT_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CUSTOMER_CHAT_CHANGE_EVENT, callback);
  };
}

export function getSessionStatusLabel(status) {
  if (status === SESSION_STATUS.waiting) return "ממתין לנציג";
  if (status === SESSION_STATUS.active) return "בשיחה";
  if (status === SESSION_STATUS.closed) return "הסתיים";
  return status;
}

export async function listAvailableAgents() {
  const chatEntities = getChatEntities();
  if (!chatEntities) return [];
  const rows = await chatEntities.ChatPresence.list("-updated_at", 50);
  return rows.filter((row) => row.status === CHAT_STATUS.available.key);
}

export async function pickNextAvailableAgent() {
  const available = await listAvailableAgents();
  if (!available.length) return null;
  const store = readStore();
  const index = store.nextAgentIndex % available.length;
  store.nextAgentIndex = (store.nextAgentIndex + 1) % available.length;
  writeStore(store);
  return available[index]?.agent_name || null;
}

export function getSessionByToken(token) {
  if (!token) return null;
  const store = readStore();
  return store.sessions.find((s) => s.token === token) || null;
}

export function getSessionById(id) {
  if (!id) return null;
  const store = readStore();
  return store.sessions.find((s) => s.id === id) || null;
}

export function listWaitingSessions() {
  const store = readStore();
  return store.sessions
    .filter((s) => s.status === SESSION_STATUS.waiting)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export function listActiveSessions({ agentName } = {}) {
  const store = readStore();
  return store.sessions
    .filter((s) => {
      if (s.status !== SESSION_STATUS.active) return false;
      if (agentName) return s.assigned_agent === agentName;
      return true;
    })
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

export function listRecentClosedSessions(limit = 20) {
  const store = readStore();
  return store.sessions
    .filter((s) => s.status === SESSION_STATUS.closed)
    .sort((a, b) => new Date(b.closed_at || b.updated_at) - new Date(a.closed_at || a.updated_at))
    .slice(0, limit);
}

export function listMessages(sessionId) {
  const store = readStore();
  return store.messages
    .filter((m) => m.session_id === sessionId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function appendMessage(store, { sessionId, senderType, senderName, body }) {
  const message = {
    id: makeId("cm"),
    session_id: sessionId,
    sender_type: senderType,
    sender_name: senderName || null,
    body: String(body || "").trim(),
    created_at: new Date().toISOString(),
  };
  if (!message.body) return null;
  store.messages.push(message);
  return message;
}

function touchSession(store, sessionId, patch = {}) {
  const idx = store.sessions.findIndex((s) => s.id === sessionId);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  store.sessions[idx] = {
    ...store.sessions[idx],
    ...patch,
    updated_at: now,
  };
  return store.sessions[idx];
}

export function createGuestSession({ guestName } = {}) {
  const store = readStore();
  const now = new Date().toISOString();
  const name = String(guestName || "").trim() || "אורח";
  const session = {
    id: makeId("cs"),
    token: makeToken(),
    guest_name: name,
    status: SESSION_STATUS.waiting,
    assigned_agent: null,
    created_at: now,
    updated_at: now,
    closed_at: null,
  };
  store.sessions.push(session);
  appendMessage(store, {
    sessionId: session.id,
    senderType: "system",
    senderName: null,
    body: `${name} הצטרף/ה לצ'אט — ממתין/ה לנציג`,
  });
  writeStore(store);
  return session;
}

export function sendGuestMessage(token, body) {
  const store = readStore();
  const session = store.sessions.find((s) => s.token === token);
  if (!session || session.status === SESSION_STATUS.closed) return null;
  const message = appendMessage(store, {
    sessionId: session.id,
    senderType: "guest",
    senderName: session.guest_name,
    body,
  });
  if (!message) return null;
  touchSession(store, session.id);
  writeStore(store);
  return message;
}

export function sendAgentMessage(sessionId, agentName, body) {
  const store = readStore();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session || session.status !== SESSION_STATUS.active) return null;
  const message = appendMessage(store, {
    sessionId,
    senderType: "agent",
    senderName: agentName,
    body,
  });
  if (!message) return null;
  touchSession(store, sessionId);
  writeStore(store);
  return message;
}

export async function acceptSession(sessionId, agentName) {
  if (!agentName) return null;
  const store = readStore();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session || session.status !== SESSION_STATUS.waiting) return null;

  touchSession(store, sessionId, {
    status: SESSION_STATUS.active,
    assigned_agent: agentName,
  });
  appendMessage(store, {
    sessionId,
    senderType: "system",
    senderName: null,
    body: `${agentName} מטפל/ת בפנייה`,
  });
  writeStore(store);
  return getSessionById(sessionId);
}

export async function autoAssignWaitingSession(sessionId) {
  const agentName = await pickNextAvailableAgent();
  if (!agentName) return null;
  return acceptSession(sessionId, agentName);
}

export function closeSession(sessionId, { closedBy } = {}) {
  const store = readStore();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session || session.status === SESSION_STATUS.closed) return null;
  const now = new Date().toISOString();
  touchSession(store, sessionId, {
    status: SESSION_STATUS.closed,
    closed_at: now,
  });
  const closer = closedBy === "guest" ? "הלקוח" : closedBy || "הנציג";
  appendMessage(store, {
    sessionId,
    senderType: "system",
    senderName: null,
    body: `השיחה הסתיימה (${closer})`,
  });
  writeStore(store);
  return getSessionById(sessionId);
}

export function buildGuestChatUrl(origin, token) {
  const base = (origin || "").replace(/\/$/, "");
  if (token) return `${base}/chat/guest?token=${encodeURIComponent(token)}`;
  return `${base}/chat/guest`;
}

export const GUEST_CHAT_TOKEN_KEY = "customer-chat-guest-token";

export function persistGuestToken(token) {
  if (typeof sessionStorage === "undefined") return;
  if (token) sessionStorage.setItem(GUEST_CHAT_TOKEN_KEY, token);
  else sessionStorage.removeItem(GUEST_CHAT_TOKEN_KEY);
}

export function readPersistedGuestToken() {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(GUEST_CHAT_TOKEN_KEY);
}

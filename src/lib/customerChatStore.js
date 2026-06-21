import { customerChatEnabled } from "@/api/customerChatMode";
import { getChatEntities } from "@/api/localChatStore";
import { CHAT_STATUS } from "@/lib/agentChatPresence";
import { isAutoAssignMode } from "@/lib/customerChatAssignmentConfig";
import { findCustomerByContactValue } from "@/lib/crmStore";

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

export function isCustomerChatModuleEnabled() {
  return customerChatEnabled;
}

/** @deprecated use isCustomerChatModuleEnabled */
export function customerChatDemoAvailable() {
  return customerChatEnabled;
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

export function listBotMessages(sessionId) {
  return listMessages(sessionId).filter((m) => m.sender_type === "bot");
}

function appendMessage(store, { sessionId, senderType, senderName, body, imageUrl }) {
  const text = String(body || "").trim();
  const image_url = imageUrl ? String(imageUrl) : null;
  if (!text && !image_url) return null;
  const message = {
    id: makeId("cm"),
    session_id: sessionId,
    sender_type: senderType,
    sender_name: senderName || null,
    body: text,
    image_url,
    created_at: new Date().toISOString(),
  };
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
    merchant_ref: null,
    guest_email: null,
    guest_phone: null,
    crm_customer_id: null,
    status: SESSION_STATUS.waiting,
    assigned_agent: null,
    created_at: now,
    updated_at: now,
    closed_at: null,
  };
  store.sessions.push(session);
  writeStore(store);
  return session;
}

export function appendBotMessage(sessionId, body) {
  const store = readStore();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session || session.status === SESSION_STATUS.closed) return null;
  const message = appendMessage(store, {
    sessionId,
    senderType: "bot",
    senderName: "בוט",
    body,
  });
  if (!message) return null;
  touchSession(store, sessionId);
  writeStore(store);
  return message;
}

export function appendGuestJoinedSystemMessage(sessionId) {
  const store = readStore();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const already = store.messages.some(
    (m) => m.session_id === sessionId && m.sender_type === "system" && m.body.includes("הצטרף")
  );
  if (already) return null;
  const message = appendMessage(store, {
    sessionId,
    senderType: "system",
    senderName: null,
    body: `${session.guest_name} הצטרף/ה לצ'אט — ממתין/ה לנציג`,
  });
  if (!message) return null;
  touchSession(store, sessionId);
  writeStore(store);
  tryAutoAssignSession(sessionId).catch(() => {});
  return message;
}

export function getLastGuestMessageWithMeta(sessionId) {
  const messages = listMessages(sessionId);
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_type === "guest") {
      return {
        id: messages[i].id,
        body: messages[i].body,
        image_url: messages[i].image_url || null,
      };
    }
  }
  return null;
}

export function sendGuestMessage(token, body, { imageUrl } = {}) {
  const store = readStore();
  const session = store.sessions.find((s) => s.token === token);
  if (!session || session.status === SESSION_STATUS.closed) return null;
  const message = appendMessage(store, {
    sessionId: session.id,
    senderType: "guest",
    senderName: session.guest_name,
    body,
    imageUrl,
  });
  if (!message) return null;
  const patch = {};
  if (!session.merchant_ref && message.body) {
    patch.merchant_ref = message.body;
  }
  touchSession(store, session.id, patch);
  writeStore(store);
  tryLinkSessionToCrmCustomer(session.id);
  return message;
}

export function updateSessionFields(sessionId, patch = {}) {
  const store = readStore();
  const session = touchSession(store, sessionId, patch);
  if (!session) return null;
  writeStore(store);
  return session;
}

function inferCaptureFieldFromStep(step) {
  const type = step?.validationType || "none";
  if (type === "email") return "guest_email";
  if (type === "phone") return "guest_phone";
  return null;
}

/** שמירת ערכים מה-flow (אימייל, טלפון, מסוף/ח.פ) על השיחה */
export function applyFlowInputCapture(sessionId, step, text) {
  const value = String(text || "").trim();
  if (!value) return null;

  const captureField = step?.captureField || inferCaptureFieldFromStep(step);
  if (!captureField) return null;

  const patch = {};
  if (captureField === "merchant_ref") patch.merchant_ref = value;
  else if (captureField === "guest_email") patch.guest_email = value;
  else if (captureField === "guest_phone") patch.guest_phone = value;
  else return null;

  return updateSessionFields(sessionId, patch);
}

export function tryLinkSessionToCrmCustomer(sessionId) {
  const session = getSessionById(sessionId);
  if (!session || session.crm_customer_id) return session?.crm_customer_id || null;

  const candidates = [
    session.guest_email,
    session.guest_phone,
    session.merchant_ref,
  ].filter(Boolean);

  for (const value of candidates) {
    const customer = findCustomerByContactValue(value);
    if (customer) {
      updateSessionFields(sessionId, { crm_customer_id: customer.id });
      return customer.id;
    }
  }

  return null;
}

export function formatChatTranscript(messages) {
  const labelFor = (msg) => {
    if (msg.sender_type === "guest") return msg.sender_name || "לקוח";
    if (msg.sender_type === "agent") return msg.sender_name || "נציג";
    if (msg.sender_type === "bot") return "בוט";
    return msg.sender_type;
  };

  return (messages || [])
    .filter((m) => m.sender_type !== "system")
    .map((m) => {
      let time = "";
      try {
        time = new Date(m.created_at).toLocaleString("he-IL", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        // ignore
      }
      const body = m.body || (m.image_url ? "[תמונה]" : "");
      return `[${time}] ${labelFor(m)}: ${body}`;
    })
    .join("\n");
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
  tryLinkSessionToCrmCustomer(sessionId);
  return getSessionById(sessionId);
}

export async function autoAssignWaitingSession(sessionId) {
  const agentName = await pickNextAvailableAgent();
  if (!agentName) return null;
  return acceptSession(sessionId, agentName);
}

export async function tryAutoAssignSession(sessionId) {
  if (!isAutoAssignMode()) return null;
  const session = getSessionById(sessionId);
  if (!session || session.status !== SESSION_STATUS.waiting || session.assigned_agent) return null;
  return autoAssignWaitingSession(sessionId);
}

export async function tryAutoAssignAllWaiting() {
  if (!isAutoAssignMode()) return [];
  const assigned = [];
  for (const session of listWaitingSessions()) {
    const result = await tryAutoAssignSession(session.id);
    if (result) assigned.push(result);
  }
  return assigned;
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

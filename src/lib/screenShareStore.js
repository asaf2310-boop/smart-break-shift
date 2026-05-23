import { demoModeEnabled } from "@/api/demoClient";

export const SCREEN_SHARE_STORAGE_KEY = "smart-break-shift-screen-share-v1";
export const SCREEN_SHARE_CHANGE_EVENT = "screen-share-changed";

const EMAIL_SUBJECT_SCREEN =
  "שיתוף מסך לתמיכה טכנית (צפייה בלבד) — באישורך";

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function readStore() {
  if (!demoModeEnabled || typeof window === "undefined") {
    return { sessions: [], emailLogs: [] };
  }
  try {
    const raw = localStorage.getItem(SCREEN_SHARE_STORAGE_KEY);
    if (!raw) return { sessions: [], emailLogs: [] };
    const parsed = JSON.parse(raw);
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      emailLogs: Array.isArray(parsed.emailLogs) ? parsed.emailLogs : [],
    };
  } catch {
    return { sessions: [], emailLogs: [] };
  }
}

function readSessions() {
  return readStore().sessions;
}

function writeStore({ sessions, emailLogs }) {
  if (!demoModeEnabled || typeof window === "undefined") return;
  const current = readStore();
  localStorage.setItem(
    SCREEN_SHARE_STORAGE_KEY,
    JSON.stringify({
      sessions: sessions ?? current.sessions,
      emailLogs: emailLogs ?? current.emailLogs,
    })
  );
  window.dispatchEvent(new CustomEvent(SCREEN_SHARE_CHANGE_EVENT));
}

function writeSessions(sessions) {
  writeStore({ sessions });
}

export function screenShareDemoAvailable() {
  return demoModeEnabled;
}

/** alias — אותה דרישת דמו כמו remoteSupport */
export function screenShareFeaturesAvailable() {
  return demoModeEnabled;
}

export function getSession(id) {
  return readSessions().find((s) => s.id === id) || null;
}

export function listSessions() {
  return readSessions().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function listSessionsForCustomer(crmCustomerId) {
  return listSessions().filter((s) => s.crmCustomerId === crmCustomerId);
}

export function createScreenSession({
  crmCustomerId,
  agentName,
  customerEmail = "",
} = {}) {
  const now = new Date().toISOString();
  const id = makeId("ss");
  const session = {
    id,
    crmCustomerId: crmCustomerId || null,
    agentName: String(agentName || "").trim(),
    customerEmail: String(customerEmail || "").trim(),
    status: "active",
    createdAt: now,
    consentAt: null,
    endedAt: null,
  };
  const sessions = [...readSessions(), session];
  writeSessions(sessions);
  return session;
}

export function updateSession(id, patch) {
  let updated = null;
  const sessions = readSessions().map((s) => {
    if (s.id !== id) return s;
    updated = { ...s, ...patch };
    return updated;
  });
  writeSessions(sessions);
  return updated;
}

export function logScreenConsent(id) {
  const now = new Date().toISOString();
  return updateSession(id, { consentAt: now, status: "active" });
}

export function endSession(id) {
  const now = new Date().toISOString();
  return updateSession(id, { status: "ended", endedAt: now });
}

export function buildScreenShareGuestUrl(sessionId, origin) {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/support/screen/${sessionId}`;
}

export function buildScreenShareEmailBody({
  customerName,
  agentName,
  guestUrl,
} = {}) {
  const greeting = customerName ? `שלום ${customerName},` : "שלום,";
  const agentLine = agentName
    ? `נציג התמיכה (${agentName}) מבקש לצפות במסך המחשב שלך בדפדפן — לצורך טיפול בתקלה בלבד.`
    : "נציג התמיכה מבקש לצפות במסך המחשב שלך בדפדפן — לצורך טיפול בתקלה בלבד.";
  return `${greeting}

${agentLine}

**חשוב:** זו צפייה בלבד — אין שליטה בעכבר או במקלדת.

לחצו על הקישור, אשרו שיתוף מסך, ובחרו את החלון שברצונכם לשתף (מומלץ Chrome או Edge):

${guestUrl}

הוראות:
1. פתחו את הקישור בדפדפן
2. סמנו את תיבת האישור
3. לחצו «אני מאשר ומשתף מסך»
4. בחרו מסך / חלון / לשונית לשיתוף

בברכה,
צוות התמיכה`;
}

export function buildScreenShareMailtoUrl({ to, customerName, agentName, guestUrl }) {
  const email = String(to || "").trim();
  if (!email) return null;
  const body = buildScreenShareEmailBody({ customerName, agentName, guestUrl });
  const params = new URLSearchParams({
    subject: EMAIL_SUBJECT_SCREEN,
    body,
  });
  return `mailto:${email}?${params.toString()}`;
}

export function listScreenShareEmails() {
  return readStore().emailLogs.sort(
    (a, b) => new Date(b.sentAt) - new Date(a.sentAt)
  );
}

/** דמו: רישום שליחת מייל עם קישור שיתוף מסך — ללא SMTP */
export function sendScreenShareEmail({
  to,
  sessionId = null,
  crmCustomerId = null,
  agentName = "",
  customerName = "",
  guestUrl = null,
}) {
  const toEmail = String(to || "").trim();
  if (!toEmail || !toEmail.includes("@")) {
    throw new Error("כתובת מייל לא תקינה");
  }
  const url =
    guestUrl || (sessionId ? buildScreenShareGuestUrl(sessionId) : null);
  if (!url) throw new Error("חסר קישור ללקוח");
  const subject = EMAIL_SUBJECT_SCREEN;
  const body = buildScreenShareEmailBody({
    customerName,
    agentName,
    guestUrl: url,
  });
  const now = new Date().toISOString();
  const log = {
    id: makeId("ss_email"),
    to: toEmail,
    subject,
    body,
    sessionId,
    crmCustomerId,
    agentName: String(agentName || "").trim(),
    guestUrl: url,
    sentAt: now,
    status: "simulated",
  };
  const store = readStore();
  writeStore({ emailLogs: [...store.emailLogs, log] });
  return log;
}

export function subscribeScreenShare(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(SCREEN_SHARE_CHANGE_EVENT, handler);
  return () => window.removeEventListener(SCREEN_SHARE_CHANGE_EVENT, handler);
}

import { demoModeEnabled } from "@/api/demoClient";

export const REMOTE_SUPPORT_STORAGE_KEY = "smart-break-shift-remote-support-v1";
export const REMOTE_SUPPORT_CHANGE_EVENT = "remote-support-changed";
export const RUSTDESK_DOWNLOAD_URL = "https://rustdesk.com/download";

const EMAIL_SUBJECT_RUSTDESK =
  "קישור להורדת RustDesk — תמיכה מרחוק (באישורך בלבד)";

const CONSENT_TEXT_DEFAULT =
  "הלקוח אישר בקול רם כי נציג התמיכה יקבל גישה מרחוק למחשבו באמצעות RustDesk לצורך טיפול בתקלה.";

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function readStore() {
  if (!demoModeEnabled || typeof window === "undefined") {
    return { sessions: [], emailLogs: [] };
  }
  try {
    const raw = localStorage.getItem(REMOTE_SUPPORT_STORAGE_KEY);
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
    REMOTE_SUPPORT_STORAGE_KEY,
    JSON.stringify({
      sessions: sessions ?? current.sessions,
      emailLogs: emailLogs ?? current.emailLogs,
    })
  );
  window.dispatchEvent(new CustomEvent(REMOTE_SUPPORT_CHANGE_EVENT));
}

function writeSessions(sessions) {
  writeStore({ sessions });
}

export function remoteSupportDemoAvailable() {
  return demoModeEnabled;
}

/** צפייה בדפדפן + RustDesk — זמין בדמו (VITE_DEMO_MODE=true) */
export function remoteSupportFeaturesAvailable() {
  return demoModeEnabled;
}

export function getSession(id) {
  return readSessions().find((s) => s.id === id || s.consentToken === id) || null;
}

/** בדמו: הטוקן ב-URL הוא מזהה הסשן */
export function getSessionByToken(token) {
  return getSession(token);
}

export function listSessions() {
  return readSessions().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function listSessionsForCustomer(crmCustomerId) {
  return listSessions().filter((s) => s.crmCustomerId === crmCustomerId);
}

export function createSession({ crmCustomerId, agentName, rustDeskId, password }) {
  const now = new Date().toISOString();
  const id = makeId("rs");
  const session = {
    id,
    consentToken: id,
    crmCustomerId: crmCustomerId || null,
    agentName: String(agentName || "").trim(),
    rustDeskId: String(rustDeskId || "").replace(/\D/g, "").slice(0, 12),
    password: password ? String(password).trim() : null,
    consentAt: null,
    consentText: null,
    consentSource: null,
    status: "active",
    createdAt: now,
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
    updated = {
      ...s,
      ...patch,
      rustDeskId:
        patch.rustDeskId !== undefined
          ? String(patch.rustDeskId).replace(/\D/g, "").slice(0, 12)
          : s.rustDeskId,
      password:
        patch.password !== undefined
          ? patch.password
            ? String(patch.password).trim()
            : null
          : s.password,
    };
    return updated;
  });
  writeSessions(sessions);
  return updated;
}

export function logConsent(id, { consentText, source = "agent" } = {}) {
  const now = new Date().toISOString();
  return updateSession(id, {
    consentAt: now,
    consentText: String(consentText || CONSENT_TEXT_DEFAULT).trim(),
    consentSource: source,
    status: "active",
  });
}

export function endSession(id) {
  const now = new Date().toISOString();
  return updateSession(id, {
    status: "ended",
    endedAt: now,
    password: null,
  });
}

export function buildConsentUrl(sessionId, origin) {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/support/consent/${sessionId}`;
}

export function buildRustDeskEmailBody({
  customerName,
  agentName,
  consentUrl,
} = {}) {
  const greeting = customerName ? `שלום ${customerName},` : "שלום,";
  const agentLine = agentName
    ? `נציג התמיכה (${agentName}) יבקש גישה מרחוק למחשבך — רק לאחר אישורך המפורש — לצורך טיפול בתקלה.`
    : "נציג התמיכה יבקש גישה מרחוק למחשבך — רק לאחר אישורך המפורש — לצורך טיפול בתקלה.";
  const consentBlock = consentUrl
    ? `\nלאישור מפורש (אופציונלי):\n${consentUrl}\n`
    : "";
  return `${greeting}

${agentLine}

להורדה והתקנה של RustDesk:
${RUSTDESK_DOWNLOAD_URL}
${consentBlock}
לאחר ההתקנה:
1. פתחו את RustDesk
2. שתפו את מזהה המכשיר (9 ספרות) עם הנציג
3. הגדירו סיסמה חד-פעמית לפי הוראת הנציג

בברכה,
צוות התמיכה`;
}

export function buildRustDeskMailtoUrl({ to, customerName, agentName, consentUrl }) {
  const email = String(to || "").trim();
  if (!email) return null;
  const body = buildRustDeskEmailBody({ customerName, agentName, consentUrl });
  const params = new URLSearchParams({
    subject: EMAIL_SUBJECT_RUSTDESK,
    body,
  });
  return `mailto:${email}?${params.toString()}`;
}

export function listRemoteSupportEmails() {
  return readStore().emailLogs.sort(
    (a, b) => new Date(b.sentAt) - new Date(a.sentAt)
  );
}

export function listRemoteSupportEmailsForSession(sessionId) {
  return listRemoteSupportEmails().filter((e) => e.sessionId === sessionId);
}

/** דמו: רישום שליחת מייל עם קישור הורדה — ללא SMTP */
export function sendRustDeskDownloadEmail({
  to,
  sessionId = null,
  crmCustomerId = null,
  agentName = "",
  customerName = "",
  consentUrl = null,
}) {
  const toEmail = String(to || "").trim();
  if (!toEmail || !toEmail.includes("@")) {
    throw new Error("כתובת מייל לא תקינה");
  }
  const subject = EMAIL_SUBJECT_RUSTDESK;
  const body = buildRustDeskEmailBody({
    customerName,
    agentName,
    consentUrl: consentUrl || (sessionId ? buildConsentUrl(sessionId) : null),
  });
  const now = new Date().toISOString();
  const log = {
    id: makeId("rs_email"),
    to: toEmail,
    subject,
    body,
    sessionId,
    crmCustomerId,
    agentName: String(agentName || "").trim(),
    downloadUrl: RUSTDESK_DOWNLOAD_URL,
    consentUrl: consentUrl || (sessionId ? buildConsentUrl(sessionId) : null),
    sentAt: now,
    status: "simulated",
  };
  const store = readStore();
  writeStore({ emailLogs: [...store.emailLogs, log] });
  return log;
}

export function buildRustDeskDeepLink(rustDeskId, password) {
  const id = String(rustDeskId || "").replace(/\D/g, "");
  if (!id) return null;
  const params = new URLSearchParams({ id });
  if (password) params.set("password", String(password).trim());
  return `rustdesk://connect?${params.toString()}`;
}

export function formatConnectionDetails(session) {
  if (!session) return "";
  const lines = [`מזהה RustDesk: ${session.rustDeskId}`];
  if (session.password) lines.push(`סיסמה חד-פעמית: ${session.password}`);
  if (session.consentAt) lines.push(`אישור: ${new Date(session.consentAt).toLocaleString("he-IL")}`);
  return lines.join("\n");
}

export function subscribeRemoteSupport(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(REMOTE_SUPPORT_CHANGE_EVENT, handler);
  return () => window.removeEventListener(REMOTE_SUPPORT_CHANGE_EVENT, handler);
}

export { CONSENT_TEXT_DEFAULT };

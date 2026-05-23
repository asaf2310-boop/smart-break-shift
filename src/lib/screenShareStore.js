import { demoModeEnabled } from "@/api/demoClient";
import { escapeHtml, postSendEmail } from "@/lib/emailApi";

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

export function buildScreenShareEmailHtml({
  customerName,
  agentName,
  guestUrl,
} = {}) {
  const greeting = customerName
    ? `שלום ${escapeHtml(customerName)},`
    : "שלום,";
  const agentLine = agentName
    ? `נציג התמיכה (<strong>${escapeHtml(agentName)}</strong>) מבקש לצפות במסך המחשב שלך בדפדפן — לצורך טיפול בתקלה בלבד.`
    : "נציג התמיכה מבקש לצפות במסך המחשב שלך בדפדפן — לצורך טיפול בתקלה בלבד.";
  const url = escapeHtml(guestUrl || "");
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
        <tr><td style="padding:24px 20px;color:#0f172a;font-size:15px;line-height:1.7;text-align:right;">
          <p style="margin:0 0 16px;">${greeting}</p>
          <p style="margin:0 0 16px;">${agentLine}</p>
          <p style="margin:0 0 12px;padding:12px;background:#ecfdf5;border-radius:8px;color:#115e59;font-size:14px;">
            <strong>חשוב:</strong> זו צפייה בלבד — אין שליטה בעכבר או במקלדת.
          </p>
          <p style="margin:0 0 20px;text-align:center;">
            <a href="${url}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;">פתיחת קישור שיתוף מסך</a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#64748b;">או העתיקו את הקישור:</p>
          <p style="margin:0 0 20px;word-break:break-all;font-size:13px;direction:ltr;text-align:left;"><a href="${url}" style="color:#0d9488;">${url}</a></p>
          <ol style="margin:0 0 20px;padding-right:20px;color:#334155;font-size:14px;">
            <li>פתחו את הקישור בדפדפן (מומלץ Chrome או Edge)</li>
            <li>סמנו את תיבת האישור</li>
            <li>לחצו «אני מאשר ומשתף מסך»</li>
            <li>בחרו מסך / חלון / לשונית לשיתוף</li>
          </ol>
          <p style="margin:0;color:#64748b;font-size:13px;">בברכה,<br>צוות התמיכה</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

function appendEmailLog(log) {
  const store = readStore();
  writeStore({ emailLogs: [...store.emailLogs, log] });
  return log;
}

function buildScreenShareLogBase({
  toEmail,
  subject,
  body,
  sessionId,
  crmCustomerId,
  agentName,
  guestUrl,
  status,
  resendId = null,
}) {
  return {
    id: makeId("ss_email"),
    to: toEmail,
    subject,
    body,
    sessionId,
    crmCustomerId,
    agentName: String(agentName || "").trim(),
    guestUrl,
    sentAt: new Date().toISOString(),
    status,
    resendId,
  };
}

/**
 * שליחת מייל עם קישור שיתוף מסך — Resend דרך /api/send-email.
 * אם השרת לא מוגדר (vite בלבד): סימולציה + הודעה.
 */
export async function sendScreenShareEmail({
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
  const html = buildScreenShareEmailHtml({
    customerName,
    agentName,
    guestUrl: url,
  });

  const apiResult = await postSendEmail({ to: toEmail, subject, html, text: body });

  if (!apiResult.configured) {
    const log = buildScreenShareLogBase({
      toEmail,
      subject,
      body,
      sessionId,
      crmCustomerId,
      agentName,
      guestUrl: url,
      status: "simulated",
    });
    appendEmailLog(log);
    return {
      log,
      simulated: true,
      message:
        apiResult.message ||
        "שירות המייל לא מוגדר — נרשם בדמו בלבד. פרסמו ב-Vercel עם RESEND_API_KEY.",
    };
  }

  const log = buildScreenShareLogBase({
    toEmail,
    subject,
    body,
    sessionId,
    crmCustomerId,
    agentName,
    guestUrl: url,
    status: "sent",
    resendId: apiResult.id,
  });
  appendEmailLog(log);
  return { log, simulated: false };
}

export function subscribeScreenShare(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(SCREEN_SHARE_CHANGE_EVENT, handler);
  return () => window.removeEventListener(SCREEN_SHARE_CHANGE_EVENT, handler);
}

import { demoModeEnabled } from "@/api/demoClient";
import { escapeHtml, postSendEmail } from "@/lib/emailApi";

export const SCREEN_SHARE_STORAGE_KEY = "smart-break-shift-screen-share-v1";
export const SCREEN_SHARE_CHANGE_EVENT = "screen-share-changed";

const EMAIL_SUBJECT_SCREEN =
  "שיתוף מסך לתמיכה טכנית (צפייה בלבד) — באישורך";

export const DEMO_SCREEN_SHARE_EMAIL_MESSAGE =
  "בדמו: הקישור מוכן — העתיקו את הקישור למטה או פתחו mailto";

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function readStore() {
  if (!demoModeEnabled || typeof window === "undefined") {
    return { sessions: [], emailLogs: [], recordings: [] };
  }
  try {
    const raw = localStorage.getItem(SCREEN_SHARE_STORAGE_KEY);
    if (!raw) return { sessions: [], emailLogs: [], recordings: [] };
    const parsed = JSON.parse(raw);
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      emailLogs: Array.isArray(parsed.emailLogs) ? parsed.emailLogs : [],
      recordings: Array.isArray(parsed.recordings) ? parsed.recordings : [],
    };
  } catch {
    return { sessions: [], emailLogs: [], recordings: [] };
  }
}

function readSessions() {
  return readStore().sessions;
}

function writeStore({ sessions, emailLogs, recordings }) {
  if (!demoModeEnabled || typeof window === "undefined") return;
  const current = readStore();
  localStorage.setItem(
    SCREEN_SHARE_STORAGE_KEY,
    JSON.stringify({
      sessions: sessions ?? current.sessions,
      emailLogs: emailLogs ?? current.emailLogs,
      recordings: recordings ?? current.recordings,
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
    recordingConsentAt: null,
    recordingActiveAt: null,
    recordingStoppedAt: null,
    recordings: [],
    emailSentAt: null,
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

/** אישור הקלטת מסך (דמו) — נפרד מאישור צפייה */
export function logRecordingConsent(id) {
  const now = new Date().toISOString();
  return updateSession(id, { recordingConsentAt: now });
}

/** נציג התחיל הקלטה — מוצג לאורח (דמו) */
export function setRecordingActive(id) {
  const now = new Date().toISOString();
  return updateSession(id, { recordingActiveAt: now });
}

/** נציג עצר הקלטה */
export function setRecordingStopped(id) {
  const now = new Date().toISOString();
  return updateSession(id, { recordingActiveAt: null, recordingStoppedAt: now });
}

function mergeRecordingRows(rows) {
  const byId = new Map();
  rows.forEach((r) => {
    if (r?.id) byId.set(r.id, { ...byId.get(r.id), ...r });
  });
  return [...byId.values()].sort(
    (a, b) => new Date(b.stoppedAt || b.startedAt) - new Date(a.stoppedAt || a.startedAt)
  );
}

function enrichRecordingMeta(rec) {
  const session = getSession(rec.sessionId);
  return {
    ...rec,
    crmCustomerId: rec.crmCustomerId ?? session?.crmCustomerId ?? null,
    agentName: rec.agentName ?? session?.agentName ?? null,
    customerEmail: rec.customerEmail ?? session?.customerEmail ?? null,
  };
}

export function listRecordingsForSession(sessionId) {
  const session = getSession(sessionId);
  const fromSession = Array.isArray(session?.recordings) ? session.recordings : [];
  const global = readStore().recordings.filter((r) => r.sessionId === sessionId);
  return mergeRecordingRows([...fromSession, ...global]).map(enrichRecordingMeta);
}

/** הקלטות המשויכות ללקוח CRM (דמו) */
export function listRecordingsForCustomer(crmCustomerId) {
  if (!crmCustomerId) return [];
  return listAllRecordings().filter((r) => r.crmCustomerId === crmCustomerId);
}

/** מזהה קישור נגן (דמו): sessionId::recordingId מקודד */
export function buildRecordingPlayId(sessionId, recordingId) {
  return encodeURIComponent(`${sessionId}::${recordingId}`);
}

export function parseRecordingPlayId(encodedId) {
  if (!encodedId) return null;
  try {
    const raw = decodeURIComponent(encodedId);
    const sep = raw.indexOf("::");
    if (sep < 0) {
      const byId = listAllRecordings().find((r) => r.id === raw);
      if (byId) return { sessionId: byId.sessionId, recordingId: byId.id };
      return null;
    }
    return {
      sessionId: raw.slice(0, sep),
      recordingId: raw.slice(sep + 2),
    };
  } catch {
    return null;
  }
}

export function findRecordingByPlayId(playId) {
  const parsed = parseRecordingPlayId(playId);
  if (!parsed) return null;
  return (
    listAllRecordings().find(
      (r) => r.sessionId === parsed.sessionId && r.id === parsed.recordingId
    ) || null
  );
}

/** כל מטא-דאטה ההקלטות (דמו) — מ-localStorage */
export function listAllRecordings() {
  const store = readStore();
  const rows = [];
  store.recordings.forEach((r) => rows.push(r));
  store.sessions.forEach((s) => {
    (s.recordings || []).forEach((r) => rows.push(r));
  });
  return mergeRecordingRows(rows).map(enrichRecordingMeta);
}

export function deleteRecordingMetadata(sessionId, recordingId) {
  const store = readStore();
  const patchRemove = (list) =>
    (list || []).filter((r) => !(r.sessionId === sessionId && r.id === recordingId));
  const sessions = store.sessions.map((s) => {
    if (s.id !== sessionId) return s;
    return { ...s, recordings: patchRemove(s.recordings) };
  });
  const recordings = store.recordings.filter(
    (r) => !(r.sessionId === sessionId && r.id === recordingId)
  );
  writeStore({ sessions, recordings });
  return true;
}

/**
 * שמירת מטא-דאטה הקלטה (דמו) — ב-session ובמאגר גלובלי ל-localStorage.
 */
export function appendSessionRecording(sessionId, meta) {
  const session = getSession(sessionId);
  if (!session) return null;
  const entry = {
    id: makeId("ss_rec"),
    sessionId,
    startedAt: meta.startedAt,
    stoppedAt: meta.stoppedAt,
    durationSec: meta.durationSec ?? 0,
    fileName: meta.fileName || "",
    consentAt: meta.consentAt || session.recordingConsentAt || null,
    downloadedAt: meta.downloadedAt || null,
    fileSizeBytes: meta.fileSizeBytes ?? null,
    hasAudio: meta.hasAudio ?? null,
    crmCustomerId: session.crmCustomerId || null,
    agentName: session.agentName || null,
    customerEmail: session.customerEmail || null,
  };
  const sessionRecordings = [...(session.recordings || []), entry];
  const store = readStore();
  writeStore({
    sessions: store.sessions.map((s) =>
      s.id === sessionId ? { ...s, recordings: sessionRecordings } : s
    ),
    recordings: [...store.recordings, entry],
  });
  return entry;
}

export function markRecordingDownloaded(sessionId, recordingId) {
  const now = new Date().toISOString();
  return updateRecordingMetadata(sessionId, recordingId, { downloadedAt: now });
}

/** עדכון שדות מטא-דאטה להקלטה (דמו) */
export function updateRecordingMetadata(sessionId, recordingId, patch) {
  if (!sessionId || !recordingId || !patch) return null;
  const store = readStore();
  const patchRecording = (r) =>
    r.sessionId === sessionId && r.id === recordingId ? { ...r, ...patch } : r;
  const sessions = store.sessions.map((s) => {
    if (s.id !== sessionId) return s;
    return {
      ...s,
      recordings: (s.recordings || []).map(patchRecording),
    };
  });
  const recordings = store.recordings.map(patchRecording);
  writeStore({ sessions, recordings });
  return getSession(sessionId);
}

/**
 * ייצוא יומן אודיט הקלטות (דמו) — ללא וידאו, רק הסכמות ומטא-דאטה.
 */
export function buildDemoRecordingAuditExport() {
  if (!demoModeEnabled) {
    return { exportedAt: new Date().toISOString(), demoMode: false, sessions: [], recordings: [] };
  }
  const store = readStore();
  const allRecordings = listAllRecordings();
  const sessions = listSessions().map((s) => ({
    sessionId: s.id,
    status: s.status,
    createdAt: s.createdAt,
    endedAt: s.endedAt,
    screenConsentAt: s.consentAt,
    recordingConsentAt: s.recordingConsentAt,
    recordingActiveAt: s.recordingActiveAt,
    recordingStoppedAt: s.recordingStoppedAt,
    agentName: s.agentName,
    customerEmail: s.customerEmail,
    crmCustomerId: s.crmCustomerId,
    recordings: (s.recordings || []).map((r) => ({
      recordingId: r.id,
      startedAt: r.startedAt,
      stoppedAt: r.stoppedAt,
      durationSec: r.durationSec,
      fileName: r.fileName,
      consentAt: r.consentAt,
      downloadedAt: r.downloadedAt,
      fileSizeBytes: r.fileSizeBytes ?? null,
      hasAudio: r.hasAudio ?? null,
      demoCloudSaved: r.demoCloudSaved ?? null,
      demoCloudSavedAt: r.demoCloudSavedAt ?? null,
      demoCloudPath: r.demoCloudPath ?? null,
    })),
  }));
  return {
    exportedAt: new Date().toISOString(),
    demoMode: true,
    note: "ייצוא דמו — ללא קבצי וידאו. הסכמות ומטא-דאטה בלבד.",
    sessions,
    recordings: allRecordings.map((r) => ({
      recordingId: r.id,
      sessionId: r.sessionId,
      startedAt: r.startedAt,
      stoppedAt: r.stoppedAt,
      durationSec: r.durationSec,
      fileName: r.fileName,
      screenConsentAt: getSession(r.sessionId)?.consentAt ?? null,
      recordingConsentAt: r.consentAt,
      downloadedAt: r.downloadedAt,
      fileSizeBytes: r.fileSizeBytes ?? null,
      hasAudio: r.hasAudio ?? null,
      agentName: r.agentName,
      customerEmail: r.customerEmail,
      crmCustomerId: r.crmCustomerId,
      demoCloudSaved: r.demoCloudSaved ?? null,
      demoCloudSavedAt: r.demoCloudSavedAt ?? null,
      demoCloudPath: r.demoCloudPath ?? null,
    })),
    emailLogs: store.emailLogs.map((log) => ({
      id: log.id,
      sessionId: log.sessionId,
      to: log.to,
      sentAt: log.sentAt,
      status: log.status,
    })),
  };
}

export function endSession(id) {
  const now = new Date().toISOString();
  return updateSession(id, {
    status: "ended",
    endedAt: now,
    recordingActiveAt: null,
  });
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

  const sentAt = new Date().toISOString();

  if (demoModeEnabled) {
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
    if (sessionId) {
      updateSession(sessionId, { emailSentAt: sentAt });
    }
    return {
      log,
      simulated: true,
      message: DEMO_SCREEN_SHARE_EMAIL_MESSAGE,
    };
  }

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
    if (sessionId) {
      updateSession(sessionId, { emailSentAt: sentAt });
    }
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
  if (sessionId) {
    updateSession(sessionId, { emailSentAt: sentAt });
  }
  return { log, simulated: false };
}

export function subscribeScreenShare(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(SCREEN_SHARE_CHANGE_EVENT, handler);
  return () => window.removeEventListener(SCREEN_SHARE_CHANGE_EVENT, handler);
}

import {
  demoModeEnabled,
  demoSendRealEmailEnabled,
  remoteSupportEnabled,
} from "@/api/demoClient";
import {
  decodeGuestBootstrapPayload,
  encodeGuestBootstrapPayload,
} from "@/lib/guestLinkCodec";
import {
  getPublicAppOrigin,
  isGuestSessionExpired,
} from "@/lib/screenShareStore";
import {
  escapeHtml,
  logEmailDelivery,
  postSendEmail,
  rejectDemoRealEmailFallback,
} from "@/lib/emailApi";
import {
  simulatedReasonForApiResult,
  simulatedReasonForDemoSendDisabled,
} from "@/lib/emailSimulatedReason";
import { getStoredAgentName } from "@/constants/scheduling";
import {
  cloudSessionSyncEnabled,
  syncRustDeskSessionToCloud,
  syncRustDeskSessionToCloudAwait,
} from "@/lib/supportSessionsSync";
import { buildShortGuestUrl, finalizeCloudGuestLink } from "@/lib/shortGuestLink";
import { generateShortCode } from "@/lib/guestLinkCodec";

export const REMOTE_SUPPORT_STORAGE_KEY = "smart-break-shift-remote-support-v1";
export const REMOTE_SUPPORT_CHANGE_EVENT = "remote-support-changed";
export const RUSTDESK_DOWNLOAD_URL = "https://rustdesk.com/download";

const EMAIL_SUBJECT_RUSTDESK =
  "קישור להורדת RustDesk — תמיכה מרחוק (באישורך בלבד)";

export const DEMO_RUSTDESK_EMAIL_MESSAGE =
  "בדמו: הקישור מוכן — העתיקו את הקישור או פתחו mailto";

export const CONSENT_TEXT_DEFAULT =
  "אני מאשר/ת שנציג התמיכה יקבל גישה מרחוק למחשב שלי באמצעות RustDesk לצורך טיפול בתקלה בלבד.";

function makeId(prefix) {
  return `${prefix}${generateShortCode(8)}`;
}

function readStore() {
  if (!remoteSupportEnabled || typeof window === "undefined") {
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
  if (!remoteSupportEnabled || typeof window === "undefined") return;
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

function cloudSyncSession(session) {
  if (session) syncRustDeskSessionToCloud(session);
}

/** @deprecated use remoteSupportFeaturesAvailable */
export function remoteSupportDemoAvailable() {
  return remoteSupportFeaturesAvailable();
}

/** צפייה בדפדפן + RustDesk — זמין בפרודקשן (ברירת מחדל) ובדמו */
export function remoteSupportFeaturesAvailable() {
  return remoteSupportEnabled;
}

export function getSession(id) {
  return readSessions().find((s) => s.id === id || s.consentToken === id) || null;
}

/** בדמו: הטוקן ב-URL הוא מזהה הסשן */
export function getSessionByToken(token) {
  return getSession(token);
}

export function getSessionByShortCode(shortCode) {
  const code = String(shortCode || "").trim();
  if (!code) return null;
  const session = readSessions().find((s) => s.shortCode === code) || null;
  if (!session || session.status === "ended") return null;
  return session;
}

export function listSessions() {
  return readSessions().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function listSessionsForCustomer(crmCustomerId) {
  return listSessions().filter((s) => s.crmCustomerId === crmCustomerId);
}

export function createSession({ crmCustomerId, agentName, rustDeskId, password, customerEmail = "" }) {
  const now = new Date().toISOString();
  const id = makeId("rs");
  const session = {
    id,
    shortCode: generateShortCode(6),
    consentToken: id,
    crmCustomerId: crmCustomerId || null,
    agentName: String(agentName || getStoredAgentName() || "").trim(),
    customerEmail: String(customerEmail || "").trim(),
    rustDeskId: String(rustDeskId || "").replace(/\D/g, "").slice(0, 12),
    password: password ? String(password).trim() : null,
    consentAt: null,
    consentText: null,
    consentSource: null,
    status: "active",
    createdAt: now,
    emailSentAt: null,
    endedAt: null,
  };
  const sessions = [...readSessions(), session];
  writeSessions(sessions);
  cloudSyncSession(session);
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
  if (updated) cloudSyncSession(updated);
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
    shortCode: null,
  });
}

/**
 * יוצר סשן RustDesk ב-localStorage של הלקוח מפרמטר bootstrap (מכשיר אחר).
 */
export function bootstrapConsentSessionFromUrl(sessionId, bootstrapParam) {
  if (!remoteSupportEnabled || !sessionId || !bootstrapParam) return null;

  const payload = decodeGuestBootstrapPayload(bootstrapParam);
  if (!payload) return null;

  const existing = getSession(sessionId);
  if (existing) {
    if (existing.status === "ended") return existing;
    return existing;
  }

  const session = {
    id: sessionId,
    consentToken: sessionId,
    crmCustomerId: payload.crmCustomerId,
    agentName: payload.agentName,
    rustDeskId: "",
    password: null,
    consentAt: null,
    consentText: null,
    consentSource: null,
    status: "active",
    createdAt: payload.createdAt,
    emailSentAt: null,
    endedAt: null,
  };

  if (isGuestSessionExpired(session)) return null;

  writeSessions([...readSessions(), session]);
  return session;
}

/**
 * מחזיר סשן לאישור לקוח: localStorage → bootstrap מ-URL.
 */
export function resolveConsentSession(sessionId, bootstrapParam = null) {
  if (!sessionId) return null;

  let session = getSessionByToken(sessionId);
  if (!session && bootstrapParam) {
    session = bootstrapConsentSessionFromUrl(sessionId, bootstrapParam);
  }

  if (!session) return null;
  if (session.status !== "ended" && isGuestSessionExpired(session)) return null;
  return session;
}

export async function ensureConsentLinkReady(session) {
  if (!session?.id) return { ok: false, error: "missing session", cloudSynced: false };
  if (!cloudSessionSyncEnabled()) return { ok: true, session, cloudSynced: true };

  const result = await finalizeCloudGuestLink(session, {
    kind: "consent",
    updateSession,
    syncToCloud: syncRustDeskSessionToCloudAwait,
  });

  if (!result.cloudSynced && result.session) {
    syncRustDeskSessionToCloud(result.session);
    console.warn("[remoteSupportStore] consent link cloud sync pending", {
      sessionId: result.session.id,
      shortCode: result.session.shortCode,
      syncError: result.cloudError || "signed guest token not ready",
    });
  }

  return {
    ok: result.ok,
    session: result.session || session,
    cloudSynced: result.cloudSynced,
    cloudError: result.cloudError,
  };
}

export function buildConsentUrl(sessionIdOrSession, origin) {
  let session = null;

  if (sessionIdOrSession && typeof sessionIdOrSession === "object" && sessionIdOrSession.id) {
    session = sessionIdOrSession;
  } else {
    const sessionId = String(sessionIdOrSession || "").trim();
    session = sessionId ? getSession(sessionId) : null;
  }

  if (!session?.id) return "";
  if (!remoteSupportEnabled || !session.createdAt) {
    const base = (origin || getPublicAppOrigin()).replace(/\/$/, "");
    return `${base}/support/consent/${encodeURIComponent(session.id)}`;
  }

  return buildShortGuestUrl(session, { kind: "consent", origin });
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
    ? `\nלאישור מפורש לפני חיבור:\n${consentUrl}\n`
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

export function buildRustDeskEmailHtml({
  customerName,
  agentName,
  consentUrl,
} = {}) {
  const greeting = customerName
    ? `שלום ${escapeHtml(customerName)},`
    : "שלום,";
  const agentLine = agentName
    ? `נציג התמיכה (<strong>${escapeHtml(agentName)}</strong>) יבקש גישה מרחוק למחשבך — רק לאחר אישורך המפורש — לצורך טיפול בתקלה.`
    : "נציג התמיכה יבקש גישה מרחוק למחשבך — רק לאחר אישורך המפורש — לצורך טיפול בתקלה.";
  const downloadUrl = escapeHtml(RUSTDESK_DOWNLOAD_URL);
  const consentBlock = consentUrl
    ? `<p style="margin:16px 0 0;">לאישור מפורש לפני חיבור:<br><a href="${escapeHtml(consentUrl)}" style="color:#4f46e5;word-break:break-all;">${escapeHtml(consentUrl)}</a></p>`
    : "";
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
          <p style="margin:0 0 20px;text-align:center;">
            <a href="${downloadUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;">הורדת RustDesk</a>
          </p>
          ${consentBlock}
          <ol style="margin:20px 0;padding-right:20px;color:#334155;font-size:14px;">
            <li>התקינו ופתחו את RustDesk</li>
            <li>שתפו את מזהה המכשיר (9 ספרות) עם הנציג</li>
            <li>הגדירו סיסמה חד-פעמית לפי הוראת הנציג</li>
          </ol>
          <p style="margin:0;color:#64748b;font-size:13px;">בברכה,<br>צוות התמיכה</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

function appendRemoteEmailLog(log) {
  const store = readStore();
  writeStore({ emailLogs: [...store.emailLogs, log] });
  return log;
}

function buildRustDeskLogBase({
  toEmail,
  subject,
  body,
  sessionId,
  crmCustomerId,
  agentName,
  resolvedConsentUrl,
  status,
  resendId = null,
  errorMessage = null,
  simulatedReason = null,
  simulatedReasonHint = null,
}) {
  return {
    id: makeId("rs_email"),
    to: toEmail,
    subject,
    body,
    sessionId,
    crmCustomerId,
    agentName: String(agentName || "").trim(),
    downloadUrl: RUSTDESK_DOWNLOAD_URL,
    consentUrl: resolvedConsentUrl,
    sentAt: new Date().toISOString(),
    status,
    resendId,
    ...(errorMessage ? { errorMessage: String(errorMessage) } : {}),
    ...(simulatedReason ? { simulatedReason } : {}),
    ...(simulatedReasonHint ? { simulatedReasonHint } : {}),
  };
}

/** שליחת מייל הורדת RustDesk — Resend דרך /api/send-email (או סימולציה מקומית) */
export async function sendRustDeskDownloadEmail({
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
  const resolvedConsentUrl =
    consentUrl || (sessionId ? buildConsentUrl(sessionId) : null);
  const subject = EMAIL_SUBJECT_RUSTDESK;
  const body = buildRustDeskEmailBody({
    customerName,
    agentName,
    consentUrl: resolvedConsentUrl,
  });
  const html = buildRustDeskEmailHtml({
    customerName,
    agentName,
    consentUrl: resolvedConsentUrl,
  });

  const sentAt = new Date().toISOString();

  if (demoModeEnabled && !demoSendRealEmailEnabled) {
    const reason = simulatedReasonForDemoSendDisabled();
    logEmailDelivery("rustdesk-email", "simulated", reason.simulatedReasonHint);
    const log = buildRustDeskLogBase({
      toEmail,
      subject,
      body,
      sessionId,
      crmCustomerId,
      agentName,
      resolvedConsentUrl,
      status: "simulated",
      ...reason,
    });
    appendRemoteEmailLog(log);
    if (sessionId) {
      updateSession(sessionId, { emailSentAt: sentAt });
    }
    return {
      log,
      simulated: true,
      message: DEMO_RUSTDESK_EMAIL_MESSAGE,
    };
  }

  let apiResult;
  try {
    apiResult = await postSendEmail({ to: toEmail, subject, html, text: body });
  } catch (err) {
    logEmailDelivery("rustdesk-email", "failed", err?.message || err);
    const failedLog = buildRustDeskLogBase({
      toEmail,
      subject,
      body,
      sessionId,
      crmCustomerId,
      agentName,
      resolvedConsentUrl,
      status: "failed",
      errorMessage: err?.message || "שליחת המייל נכשלה",
    });
    appendRemoteEmailLog(failedLog);
    throw err;
  }

  rejectDemoRealEmailFallback(apiResult);

  if (!apiResult.configured) {
    const reason = simulatedReasonForApiResult(apiResult);
    logEmailDelivery("rustdesk-email", "simulated", reason.simulatedReasonHint);
    const log = buildRustDeskLogBase({
      toEmail,
      subject,
      body,
      sessionId,
      crmCustomerId,
      agentName,
      resolvedConsentUrl,
      status: "simulated",
      ...reason,
    });
    appendRemoteEmailLog(log);
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

  logEmailDelivery("rustdesk-email", "sent", { to: toEmail, id: apiResult.id });

  const log = buildRustDeskLogBase({
    toEmail,
    subject,
    body,
    sessionId,
    crmCustomerId,
    agentName,
    resolvedConsentUrl,
    status: "sent",
    resendId: apiResult.id,
  });
  appendRemoteEmailLog(log);
  if (sessionId) {
    updateSession(sessionId, { emailSentAt: sentAt });
  }
  return { log, simulated: false };
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
  const onStorage = (e) => {
    if (!e) return;
    if (e.key !== REMOTE_SUPPORT_STORAGE_KEY) return;
    callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(REMOTE_SUPPORT_CHANGE_EVENT, handler);
    window.removeEventListener("storage", onStorage);
  };
}

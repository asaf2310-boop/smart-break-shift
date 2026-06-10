<<<<<<< HEAD
import {
  demoModeEnabled,
  demoSendRealEmailEnabled,
  remoteSupportEnabled,
} from "@/api/demoClient";
=======
import { demoModeEnabled, demoSendRealEmailEnabled } from "@/api/demoClient";
>>>>>>> 842dd9e (Initial commit)
import { cleanEnvValue } from "@/api/supabase";
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
<<<<<<< HEAD
import { getStoredAgentName } from "@/constants/scheduling";
import { agentOwnsBreakRegistration } from "@/lib/breakCapacity";
import {
  cloudSessionSyncEnabled,
  syncScreenShareSessionToCloud,
  syncScreenShareSessionToCloudAwait,
} from "@/lib/supportSessionsSync";
import { buildShortGuestUrl, waitForShortCodeInCloud } from "@/lib/shortGuestLink";
import {
  decodeGuestBootstrapPayload,
  encodeGuestBootstrapPayload,
  generateShortCode,
  GUEST_BOOTSTRAP_QUERY_KEY,
} from "@/lib/guestLinkCodec";

export { GUEST_BOOTSTRAP_QUERY_KEY, encodeGuestBootstrapPayload, decodeGuestBootstrapPayload };
=======
>>>>>>> 842dd9e (Initial commit)

export const SCREEN_SHARE_STORAGE_KEY = "smart-break-shift-screen-share-v1";
export const SCREEN_SHARE_CHANGE_EVENT = "screen-share-changed";
/** דמו: תוקף קישור אורח — 72 שעות מיצירת הסשן (לא מחיקה אוטומטית מ-localStorage) */
export const DEMO_GUEST_SESSION_TTL_MS = 72 * 60 * 60 * 1000;
<<<<<<< HEAD
=======
export const GUEST_BOOTSTRAP_QUERY_KEY = "b";
>>>>>>> 842dd9e (Initial commit)

const EMAIL_SUBJECT_SCREEN =
  "שיתוף מסך לתמיכה טכנית (צפייה בלבד) — באישורך";

export const DEMO_SCREEN_SHARE_EMAIL_MESSAGE =
  "בדמו: הקישור מוכן — העתיקו את הקישור למטה או פתחו mailto";

function makeId(prefix) {
<<<<<<< HEAD
  return `${prefix}${generateShortCode(8)}`;
}

function readStore() {
  if (!remoteSupportEnabled || typeof window === "undefined") {
=======
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function readStore() {
  if (!demoModeEnabled || typeof window === "undefined") {
>>>>>>> 842dd9e (Initial commit)
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
<<<<<<< HEAD
  if (!remoteSupportEnabled || typeof window === "undefined") return;
=======
  if (!demoModeEnabled || typeof window === "undefined") return;
>>>>>>> 842dd9e (Initial commit)
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

<<<<<<< HEAD
function cloudSyncSession(session, options) {
  if (session) syncScreenShareSessionToCloud(session, options);
}

/** @deprecated use screenShareFeaturesAvailable */
export function screenShareDemoAvailable() {
  return screenShareFeaturesAvailable();
}

/** צפייה בדפדפן — זמין בפרודקשן (ברירת מחדל) ובדמו */
export function screenShareFeaturesAvailable() {
  return remoteSupportEnabled;
=======
export function screenShareDemoAvailable() {
  return demoModeEnabled;
}

/** alias — אותה דרישת דמו כמו remoteSupport */
export function screenShareFeaturesAvailable() {
  return demoModeEnabled;
>>>>>>> 842dd9e (Initial commit)
}

export function getSession(id) {
  return readSessions().find((s) => s.id === id) || null;
}

<<<<<<< HEAD
export function getSessionByShortCode(shortCode) {
  const code = String(shortCode || "").trim();
  if (!code) return null;
  const session = readSessions().find((s) => s.shortCode === code) || null;
  if (!session || session.status === "ended") return null;
  return session;
}

/** סשן שיתוף מסך פעיל של נציג — רק אחרי «פתח סשן» מפורש */
export function getActiveScreenSessionForAgent(agentName) {
  const name = String(agentName || getStoredAgentName() || "").trim();
  if (!name) return null;
  return (
    listSessions().find(
      (s) =>
        s.status === "active" &&
        s.agentPeerOpenedAt &&
        String(s.agentName || "").trim() === name
    ) || null
  );
}

/** הנציג לחץ «פתח סשן» — מתחילים Peer לפני יצירת קישור */
export function markAgentPeerOpened(id) {
  const session = getSession(id);
  if (!session || session.status === "ended") return session;
  if (session.agentPeerOpenedAt) return session;
  return updateSession(id, {
    agentPeerOpenedAt: new Date().toISOString(),
  });
}

/** PeerJS של הנציג מוכן לקבל שיחה מהלקוח */
export function markAgentPeerReady(id) {
  const session = getSession(id);
  if (!session || session.status === "ended") return session;
  if (session.agentPeerReadyAt) return session;
  return updateSession(id, {
    agentPeerReadyAt: new Date().toISOString(),
  });
}

export const REMOTE_SUPPORT_OPEN_EVENT = "remote-support-open-request";

/** הלקוח התחבר ומשתף מסך — להתראה גלובלית לנציג */
export function markGuestStreamConnected(id) {
  const session = getSession(id);
  if (!session || session.status === "ended" || session.guestStreamConnectedAt) {
    return session;
  }
  return updateSession(id, {
    guestStreamConnectedAt: new Date().toISOString(),
  });
}

=======
>>>>>>> 842dd9e (Initial commit)
/** כתובת ציבורית לקישורים במייל — VITE_APP_URL או origin; מ-localhost מעדיף env */
export function getPublicAppOrigin() {
  const fromEnv = cleanEnvValue(import.meta.env.VITE_APP_URL)?.replace(/\/$/, "") || "";
  if (typeof window === "undefined") return fromEnv;
  const origin = window.location.origin;
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
  if (isLocal && fromEnv) return fromEnv;
  return fromEnv || origin;
}

<<<<<<< HEAD
export function isGuestSessionExpired(session) {
  if (!session?.createdAt) return true;
  if (session.status === "ended") return false;
  // Production: active sessions stay valid until the agent ends them.
  if (cloudSessionSyncEnabled()) return false;
=======
function toBase64Url(str) {
  if (typeof btoa === "undefined") return "";
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded) {
  if (!encoded || typeof atob === "undefined") return null;
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    const binary = atob(padded + "=".repeat(padLen));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function encodeGuestBootstrapPayload(session) {
  if (!session?.id || !session.createdAt) return "";
  const payload = {
    c: session.createdAt,
    a: String(session.agentName || "").slice(0, 120),
    e: String(session.customerEmail || "").slice(0, 200),
    r: session.crmCustomerId || null,
  };
  return toBase64Url(JSON.stringify(payload));
}

function decodeGuestBootstrapPayload(encoded) {
  const json = fromBase64Url(encoded);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed?.c || Number.isNaN(new Date(parsed.c).getTime())) return null;
    return {
      createdAt: parsed.c,
      agentName: String(parsed.a || "").slice(0, 120),
      customerEmail: String(parsed.e || "").slice(0, 200),
      crmCustomerId: parsed.r || null,
    };
  } catch {
    return null;
  }
}

export function isGuestSessionExpired(session) {
  if (!session?.createdAt) return true;
>>>>>>> 842dd9e (Initial commit)
  const created = new Date(session.createdAt).getTime();
  if (Number.isNaN(created)) return true;
  return Date.now() - created > DEMO_GUEST_SESSION_TTL_MS;
}

<<<<<<< HEAD
export const GUEST_LINK_CLOUD_PENDING_MESSAGE =
  "הסנכרון לענן עדיין בתהליך — אם הלקוח לא מצליח לפתוח את הקישור, נסו שוב בעוד רגע";

/**
 * Ensure a local short link exists; best-effort cloud sync for /j/ resolution on guest devices.
 * Copy/email must not block on cloud verification when the URL is already buildable locally.
 */
export async function ensureGuestLinkReady(session) {
  if (!session?.id) return { ok: false, error: "missing session", cloudSynced: false };
  if (!cloudSessionSyncEnabled()) return { ok: true, session, cloudSynced: true };

  let workingSession = session;
  if (!workingSession.shortCode) {
    const updated = updateSession(workingSession.id, { shortCode: generateShortCode(6) });
    if (updated) workingSession = updated;
  }
  if (!workingSession.shortCode) {
    return { ok: false, error: "missing short code", cloudSynced: false };
  }

  const syncResult = await syncScreenShareSessionToCloudAwait(workingSession);
  let cloudSynced = false;
  if (syncResult.ok) {
    cloudSynced = await waitForShortCodeInCloud(workingSession.shortCode);
  }

  if (!cloudSynced) {
    syncScreenShareSessionToCloud(workingSession);
    console.warn("[screenShareStore] guest link cloud sync pending", {
      sessionId: workingSession.id,
      shortCode: workingSession.shortCode,
      syncError: syncResult.error || "short code not visible after verify",
    });
  }

  return {
    ok: true,
    session: workingSession,
    cloudSynced,
    cloudError: cloudSynced
      ? undefined
      : syncResult.error || "short code not synced to cloud",
  };
}

=======
>>>>>>> 842dd9e (Initial commit)
/**
 * דמו: יוצר סשן ב-localStorage של האורח מפרמטר bootstrap ב-URL (מכשיר/דפדפן אחר).
 */
export function bootstrapGuestSessionFromUrl(sessionId, bootstrapParam) {
<<<<<<< HEAD
  if (!remoteSupportEnabled || !sessionId || !bootstrapParam) return null;
=======
  if (!demoModeEnabled || !sessionId || !bootstrapParam) return null;
>>>>>>> 842dd9e (Initial commit)

  const payload = decodeGuestBootstrapPayload(bootstrapParam);
  if (!payload) return null;

  const existing = getSession(sessionId);
  if (existing) {
<<<<<<< HEAD
=======
    if (existing.status === "ended") return existing;
>>>>>>> 842dd9e (Initial commit)
    return existing;
  }

  const session = {
    id: sessionId,
    crmCustomerId: payload.crmCustomerId,
    agentName: payload.agentName,
    customerEmail: payload.customerEmail,
    status: "active",
    createdAt: payload.createdAt,
    consentAt: null,
    recordingConsentAt: null,
    recordingActiveAt: null,
    recordingStoppedAt: null,
    recordings: [],
    emailSentAt: null,
    endedAt: null,
<<<<<<< HEAD
    endedReason: null,
=======
>>>>>>> 842dd9e (Initial commit)
  };

  if (isGuestSessionExpired(session)) return null;

  writeSessions([...readSessions(), session]);
  return session;
}

/**
 * מחזיר סשן לאורח: localStorage → bootstrap מ-URL → בדיקת תוקף.
 * @param {string} sessionId
 * @param {URLSearchParams|string|null} searchParamsOrBootstrap
 */
export function resolveGuestSession(sessionId, searchParamsOrBootstrap = null) {
  if (!sessionId) return null;

  let bootstrapParam = null;
  if (typeof searchParamsOrBootstrap === "string") {
    bootstrapParam = searchParamsOrBootstrap;
  } else if (searchParamsOrBootstrap?.get) {
    bootstrapParam = searchParamsOrBootstrap.get(GUEST_BOOTSTRAP_QUERY_KEY);
  }

  let session = getSession(sessionId);
  if (!session && bootstrapParam) {
    session = bootstrapGuestSessionFromUrl(sessionId, bootstrapParam);
  }

  if (!session) return null;
  if (session.status !== "ended" && isGuestSessionExpired(session)) return null;
  return session;
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
<<<<<<< HEAD
    shortCode: null,
    agentPeerOpenedAt: null,
    agentPeerReadyAt: null,
    guestStreamConnectedAt: null,
    crmCustomerId: crmCustomerId || null,
    agentName: String(agentName || getStoredAgentName() || "").trim(),
=======
    crmCustomerId: crmCustomerId || null,
    agentName: String(agentName || "").trim(),
>>>>>>> 842dd9e (Initial commit)
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
<<<<<<< HEAD
    endedReason: null,
  };
  const sessions = [...readSessions(), session];
  writeSessions(sessions);
  cloudSyncSession(session);
=======
  };
  const sessions = [...readSessions(), session];
  writeSessions(sessions);
>>>>>>> 842dd9e (Initial commit)
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
<<<<<<< HEAD
  if (updated) cloudSyncSession(updated);
=======
>>>>>>> 842dd9e (Initial commit)
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

<<<<<<< HEAD
/**
 * סנכרון מצב מהאורח (PeerJS) ל-localStorage של הנציג — מכשירים נפרדים.
 * מעדכן רק שדות שחסרים אצל הנציג (לא דורס ערכים קיימים).
 */
export function applyGuestPeerSync(id, { consentAt, recordingConsentAt } = {}) {
  if (!id) return null;
  const session = getSession(id);
  if (!session) return null;
  const patch = {};
  if (consentAt && !session.consentAt) patch.consentAt = consentAt;
  if (recordingConsentAt && !session.recordingConsentAt) {
    patch.recordingConsentAt = recordingConsentAt;
  }
  if (Object.keys(patch).length === 0) return session;
  return updateSession(id, patch);
}

=======
>>>>>>> 842dd9e (Initial commit)
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
<<<<<<< HEAD
  cloudSyncSession(getSession(sessionId), {
    recordingCount: sessionRecordings.length,
  });
=======
>>>>>>> 842dd9e (Initial commit)
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

<<<<<<< HEAD
export function endSession(id, { endedReason = "agent_ended" } = {}) {
=======
export function endSession(id) {
>>>>>>> 842dd9e (Initial commit)
  const now = new Date().toISOString();
  return updateSession(id, {
    status: "ended",
    endedAt: now,
    recordingActiveAt: null,
<<<<<<< HEAD
    endedReason: endedReason || null,
    shortCode: null,
    agentPeerOpenedAt: null,
    agentPeerReadyAt: null,
    guestStreamConnectedAt: null,
  });
}

/** סוגר את כל סשני שיתוף המסך הפעילים של הנציג (או כולם אם ללא agentName) */
export function endAllActiveScreenSessions({ agentName } = {}) {
  const now = new Date().toISOString();
  let closed = 0;
  const sessions = readSessions().map((s) => {
    if (s.status !== "active") return s;
    if (agentName && !agentOwnsBreakRegistration({ agent_name: s.agentName }, agentName)) {
      return s;
    }
    closed += 1;
    const ended = {
      ...s,
      status: "ended",
      endedAt: now,
      endedReason: "agent_ended",
      shortCode: null,
      recordingActiveAt: null,
      agentPeerOpenedAt: null,
      agentPeerReadyAt: null,
      guestStreamConnectedAt: null,
    };
    cloudSyncSession(ended);
    return ended;
  });
  writeSessions(sessions);
  return closed;
}

/** סשני צפייה של הנציג — ממוינים מהחדש לישן */
export function listScreenSessionsForAgent(agentName, { limit } = {}) {
  const name = String(agentName || "").trim();
  const filtered = listSessions().filter((s) =>
    name ? agentOwnsBreakRegistration({ agent_name: s.agentName }, name) : true
  );
  if (typeof limit === "number" && limit > 0) return filtered.slice(0, limit);
  return filtered;
}

=======
  });
}

>>>>>>> 842dd9e (Initial commit)
/**
 * @param {string|{ id: string, createdAt?: string, agentName?: string, customerEmail?: string, crmCustomerId?: string|null }} sessionOrId
 * @param {string} [origin] — ברירת מחדל getPublicAppOrigin()
 */
export function buildScreenShareGuestUrl(sessionOrId, origin) {
<<<<<<< HEAD
=======
  const base = (origin || getPublicAppOrigin()).replace(/\/$/, "");
  let sessionId;
>>>>>>> 842dd9e (Initial commit)
  let session = null;

  if (sessionOrId && typeof sessionOrId === "object" && sessionOrId.id) {
    session = sessionOrId;
<<<<<<< HEAD
  } else {
    const sessionId = String(sessionOrId || "").trim();
    session = sessionId ? getSession(sessionId) : null;
  }

  if (!session?.id) return "";
  if (session.status === "ended") return "";
  if (!remoteSupportEnabled || !session.createdAt) {
    const base = (origin || getPublicAppOrigin()).replace(/\/$/, "");
    return `${base}/support/screen/${encodeURIComponent(session.id)}`;
  }

  return buildShortGuestUrl(session, { kind: "screen", origin });
=======
    sessionId = session.id;
  } else {
    sessionId = String(sessionOrId || "").trim();
    session = sessionId ? getSession(sessionId) : null;
  }

  if (!sessionId) return "";

  const path = `${base}/support/screen/${encodeURIComponent(sessionId)}`;
  if (!demoModeEnabled || !session?.createdAt) return path;

  const bootstrap = encodeGuestBootstrapPayload(session);
  if (!bootstrap) return path;

  const params = new URLSearchParams();
  params.set(GUEST_BOOTSTRAP_QUERY_KEY, bootstrap);
  return `${path}?${params.toString()}`;
>>>>>>> 842dd9e (Initial commit)
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

export function getLastEmailLogForSession(sessionId) {
  if (!sessionId) return null;
  const logs = readStore().emailLogs.filter((log) => log.sessionId === sessionId);
  if (!logs.length) return null;
  return logs.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0];
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
  errorMessage = null,
  simulatedReason = null,
  simulatedReasonHint = null,
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
    ...(errorMessage ? { errorMessage: String(errorMessage) } : {}),
    ...(simulatedReason ? { simulatedReason } : {}),
    ...(simulatedReasonHint ? { simulatedReasonHint } : {}),
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
  const sessionForUrl = sessionId ? getSession(sessionId) : null;
  const url =
    guestUrl || (sessionId ? buildScreenShareGuestUrl(sessionForUrl || sessionId) : null);
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

  if (demoModeEnabled && !demoSendRealEmailEnabled) {
    const reason = simulatedReasonForDemoSendDisabled();
    logEmailDelivery("screen-share-email", "simulated", reason.simulatedReasonHint);
    const log = buildScreenShareLogBase({
      toEmail,
      subject,
      body,
      sessionId,
      crmCustomerId,
      agentName,
      guestUrl: url,
      status: "simulated",
      ...reason,
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

  let apiResult;
  try {
    apiResult = await postSendEmail({ to: toEmail, subject, html, text: body });
  } catch (err) {
    logEmailDelivery("screen-share-email", "failed", err?.message || err);
    const failedLog = buildScreenShareLogBase({
      toEmail,
      subject,
      body,
      sessionId,
      crmCustomerId,
      agentName,
      guestUrl: url,
      status: "failed",
      errorMessage: err?.message || "שליחת המייל נכשלה",
    });
    appendEmailLog(failedLog);
    throw err;
  }

  rejectDemoRealEmailFallback(apiResult);

  if (!apiResult.configured) {
    const reason = simulatedReasonForApiResult(apiResult);
    logEmailDelivery("screen-share-email", "simulated", reason.simulatedReasonHint);
    const log = buildScreenShareLogBase({
      toEmail,
      subject,
      body,
      sessionId,
      crmCustomerId,
      agentName,
      guestUrl: url,
      status: "simulated",
      ...reason,
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

  logEmailDelivery("screen-share-email", "sent", { to: toEmail, id: apiResult.id });

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
<<<<<<< HEAD
  // Cross-tab sync: localStorage write triggers `storage` events in other tabs.
  const onStorage = (e) => {
    if (!e) return;
    if (e.key !== SCREEN_SHARE_STORAGE_KEY) return;
    callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SCREEN_SHARE_CHANGE_EVENT, handler);
    window.removeEventListener("storage", onStorage);
  };
=======
  return () => window.removeEventListener(SCREEN_SHARE_CHANGE_EVENT, handler);
>>>>>>> 842dd9e (Initial commit)
}

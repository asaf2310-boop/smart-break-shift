import { demoModeEnabled } from "@/api/demoClient";
import { getCustomerById } from "@/lib/crmStore";
import {
  listRemoteSupportEmailsForSession,
  listSessions as listRustDeskSessions,
  subscribeRemoteSupport,
} from "@/lib/remoteSupportStore";
import {
  listAllRecordings,
  listSessions as listScreenShareSessions,
  subscribeScreenShare,
} from "@/lib/screenShareStore";
import {
  cloudSessionSyncEnabled,
  fetchCloudSupportSessions,
  mergeLocalAndCloudSessions,
} from "@/lib/supportSessionsSync";

export const SESSION_TYPES = {
  SCREEN_SHARE: "screen_share",
  RUSTDESK: "rustdesk",
};

const SESSION_TYPE_LABELS = {
  [SESSION_TYPES.SCREEN_SHARE]: "שיתוף מסך",
  [SESSION_TYPES.RUSTDESK]: "RustDesk",
};

export function sessionTypeLabel(sessionType) {
  return SESSION_TYPE_LABELS[sessionType] || sessionType;
}

function resolveCustomerEmail(session, emailLogs = []) {
  const direct = String(session?.customerEmail || "").trim();
  if (direct) return direct;
  const fromLog = emailLogs.find((log) => log?.to)?.to;
  if (fromLog) return String(fromLog).trim();
  if (demoModeEnabled && session?.crmCustomerId) {
    const customer = getCustomerById(session.crmCustomerId);
    if (customer?.email) return String(customer.email).trim();
  }
  return "";
}

function mapRecordingsForSession(sessionId, allRecordings) {
  return allRecordings
    .filter((rec) => rec.sessionId === sessionId)
    .map((rec) => ({
      id: rec.id,
      startedAt: rec.startedAt,
      stoppedAt: rec.stoppedAt,
      durationSec: rec.durationSec ?? 0,
      fileName: rec.fileName || "",
      fileSizeBytes: rec.fileSizeBytes ?? null,
      hasAudio: rec.hasAudio ?? null,
      storagePath: rec.storagePath || null,
      cloudUploadStatus: rec.cloudUploadStatus || null,
      cloudReady: rec.cloudReady === true,
      cloudPlaceholder: rec.cloudPlaceholder === true,
    }));
}

/**
 * Flat list of support sessions (screen share + RustDesk) for admin views.
 */
export function listSupportSessionsFlat() {
  const allRecordings = listAllRecordings();

  const screenSessions = listScreenShareSessions().map((session) => ({
    id: session.id,
    sessionType: SESSION_TYPES.SCREEN_SHARE,
    agentName: String(session.agentName || "").trim() || "ללא שם נציג",
    customerEmail: resolveCustomerEmail(session),
    crmCustomerId: session.crmCustomerId || null,
    status: session.status || "active",
    createdAt: session.createdAt,
    endedAt: session.endedAt || null,
    consentAt: session.consentAt || null,
    recordingConsentAt: session.recordingConsentAt || null,
    recordingActiveAt: session.recordingActiveAt || null,
    recordings: mapRecordingsForSession(session.id, allRecordings),
  }));

  const rustSessions = listRustDeskSessions().map((session) => {
    const emailLogs = listRemoteSupportEmailsForSession(session.id);
    return {
      id: session.id,
      sessionType: SESSION_TYPES.RUSTDESK,
      agentName: String(session.agentName || "").trim() || "ללא שם נציג",
      customerEmail: resolveCustomerEmail(session, emailLogs),
      crmCustomerId: session.crmCustomerId || null,
      status: session.status || "active",
      createdAt: session.createdAt,
      endedAt: session.endedAt || null,
      consentAt: session.consentAt || null,
      recordingConsentAt: null,
      recordings: [],
      rustDeskId: session.rustDeskId || null,
    };
  });

  return [...screenSessions, ...rustSessions].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

/** Local sessions merged with Supabase (when configured). */
export async function listSupportSessionsFlatMerged() {
  const local = listSupportSessionsFlat();
  if (!cloudSessionSyncEnabled()) return local;
  const cloud = await fetchCloudSupportSessions();
  return mergeLocalAndCloudSessions(local, cloud);
}

/**
 * Sessions grouped by agent name (newest session first within each group).
 */
export function groupSupportSessionsByAgent(sessions = listSupportSessionsFlat()) {
  const groups = new Map();
  for (const session of sessions) {
    const key = session.agentName || "ללא שם נציג";
    if (!groups.has(key)) {
      groups.set(key, { agentName: key, sessions: [] });
    }
    groups.get(key).sessions.push(session);
  }
  return [...groups.values()].sort((a, b) =>
    a.agentName.localeCompare(b.agentName, "he")
  );
}

export async function groupSupportSessionsByAgentMerged() {
  const sessions = await listSupportSessionsFlatMerged();
  return groupSupportSessionsByAgent(sessions);
}

export function subscribeSupportSessions(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  const unsubScreen = subscribeScreenShare(handler);
  const unsubRemote = subscribeRemoteSupport(handler);
  return () => {
    unsubScreen();
    unsubRemote();
  };
}

import { demoModeEnabled } from "@/api/demoClient";
import { supabase, supabaseConfigured } from "@/api/supabase";
import {
  fetchCloudScreenRecordings,
  groupCloudRecordingsBySession,
  mergeSessionRecordings,
} from "@/lib/screenRecordingsSync";

const SESSION_TYPE_SCREEN = "screen_share";
const SESSION_TYPE_RUSTDESK = "rustdesk";

/** Sync session metadata to Supabase in production (not demo). */
export function cloudSessionSyncEnabled() {
  return supabaseConfigured && !demoModeEnabled && Boolean(supabase);
}

function toIso(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function mapScreenShareRow(session, recordingCount = null) {
  const recCount =
    recordingCount ??
    (Array.isArray(session.recordings) ? session.recordings.length : 0);
  return {
    id: session.id,
    session_type: SESSION_TYPE_SCREEN,
    agent_name: String(session.agentName || "").trim(),
    customer_email: String(session.customerEmail || "").trim(),
    crm_customer_id: session.crmCustomerId || null,
    status: session.status === "ended" ? "ended" : "active",
    created_at: toIso(session.createdAt) || new Date().toISOString(),
    ended_at: toIso(session.endedAt),
    consent_at: toIso(session.consentAt),
    recording_consent_at: toIso(session.recordingConsentAt),
    recording_active_at: toIso(session.recordingActiveAt),
    recording_count: recCount,
    rust_desk_id: null,
    short_code: session.shortCode || null,
    updated_at: new Date().toISOString(),
  };
}

function mapRustDeskRow(session) {
  return {
    id: session.id,
    session_type: SESSION_TYPE_RUSTDESK,
    agent_name: String(session.agentName || "").trim(),
    customer_email: String(session.customerEmail || "").trim(),
    crm_customer_id: session.crmCustomerId || null,
    status: session.status === "ended" ? "ended" : "active",
    created_at: toIso(session.createdAt) || new Date().toISOString(),
    ended_at: toIso(session.endedAt),
    consent_at: toIso(session.consentAt),
    recording_consent_at: null,
    recording_active_at: null,
    recording_count: 0,
    rust_desk_id: session.rustDeskId || null,
    short_code: session.shortCode || null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Fire-and-forget upsert — never blocks UI.
 */
export function syncScreenShareSessionToCloud(session, { recordingCount } = {}) {
  if (!cloudSessionSyncEnabled() || !session?.id) return;
  const row = mapScreenShareRow(session, recordingCount);
  void supabase
    .from("support_sessions")
    .upsert(row, { onConflict: "id" })
    .then(({ error }) => {
      if (error) console.warn("[supportSessionsSync] screen share upsert failed", error.message);
    });
}

/** Upsert ממתין — לפני FK של screen_recordings. */
export async function syncScreenShareSessionToCloudAwait(session, options = {}) {
  if (!cloudSessionSyncEnabled() || !session?.id) return { ok: true };
  const row = mapScreenShareRow(session, options.recordingCount);
  const { error } = await supabase.from("support_sessions").upsert(row, { onConflict: "id" });
  if (error) {
    console.warn("[supportSessionsSync] screen share upsert failed", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export function syncRustDeskSessionToCloud(session) {
  if (!cloudSessionSyncEnabled() || !session?.id) return;
  const row = mapRustDeskRow(session);
  void supabase
    .from("support_sessions")
    .upsert(row, { onConflict: "id" })
    .then(({ error }) => {
      if (error) console.warn("[supportSessionsSync] rustdesk upsert failed", error.message);
    });
}

export async function syncRustDeskSessionToCloudAwait(session) {
  if (!cloudSessionSyncEnabled() || !session?.id) return { ok: true };
  const row = mapRustDeskRow(session);
  const { error } = await supabase.from("support_sessions").upsert(row, { onConflict: "id" });
  if (error) {
    console.warn("[supportSessionsSync] rustdesk upsert failed", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export function mapCloudRowToFlatSession(row, cloudRecordingsBySession = null) {
  const sessionType =
    row.session_type === SESSION_TYPE_RUSTDESK
      ? SESSION_TYPE_RUSTDESK
      : SESSION_TYPE_SCREEN;
  const recordingCount = Number(row.recording_count) || 0;
  const cloudRecs =
    cloudRecordingsBySession?.get?.(row.id) ||
    cloudRecordingsBySession?.[row.id] ||
    null;

  let recordings = [];
  if (sessionType === SESSION_TYPE_SCREEN) {
    if (Array.isArray(cloudRecs) && cloudRecs.length > 0) {
      recordings = cloudRecs;
    } else if (recordingCount > 0) {
      recordings = Array.from({ length: recordingCount }, (_, i) => ({
        id: `cloud_${row.id}_${i}`,
        startedAt: row.created_at,
        stoppedAt: row.ended_at || row.created_at,
        durationSec: 0,
        fileName: "",
        fileSizeBytes: null,
        hasAudio: null,
        cloudPlaceholder: true,
        cloudUploadStatus: "pending",
      }));
    }
  }

  return {
    id: row.id,
    sessionType,
    agentName: String(row.agent_name || "").trim() || "ללא שם נציג",
    customerEmail: String(row.customer_email || "").trim(),
    crmCustomerId: row.crm_customer_id || null,
    status: row.status || "active",
    createdAt: row.created_at,
    endedAt: row.ended_at || null,
    consentAt: row.consent_at || null,
    recordingConsentAt: row.recording_consent_at || null,
    recordingActiveAt: row.recording_active_at || null,
    recordings,
    rustDeskId: row.rust_desk_id || null,
    fromCloud: true,
  };
}

/** Fetch recent sessions from Supabase for admin views. */
export async function fetchCloudSupportSessions(limit = 500) {
  if (!cloudSessionSyncEnabled()) return [];
  try {
    const [sessionsResult, cloudRecordings] = await Promise.all([
      supabase
        .from("support_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit),
      fetchCloudScreenRecordings(limit * 4),
    ]);

    const { data, error } = sessionsResult;
    if (error) {
      console.warn("[supportSessionsSync] fetch failed", error.message);
      return [];
    }

    const recordingsBySession = groupCloudRecordingsBySession(cloudRecordings);
    return (data || []).map((row) =>
      mapCloudRowToFlatSession(row, recordingsBySession)
    );
  } catch (err) {
    console.warn("[supportSessionsSync] fetch error", err);
    return [];
  }
}

/**
 * Merge local + cloud sessions (local wins for recording details).
 */
export function mergeLocalAndCloudSessions(localSessions, cloudSessions) {
  const byId = new Map();

  for (const session of cloudSessions) {
    if (session?.id) byId.set(session.id, session);
  }

  for (const session of localSessions) {
    if (!session?.id) continue;
    const cloud = byId.get(session.id);
    if (!cloud) {
      byId.set(session.id, session);
      continue;
    }
    const localRecordings = session.recordings || [];
    const cloudRecordings = cloud.recordings || [];
    byId.set(session.id, {
      ...cloud,
      ...session,
      fromCloud: false,
      recordings: mergeSessionRecordings(localRecordings, cloudRecordings),
    });
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

import { demoModeEnabled } from "@/api/demoClient";
import { supabase, supabaseConfigured } from "@/api/supabase";
import { getAgentSession } from "@/lib/agentAuth";
import { apiGetSupportFileSignedUrl } from "@/lib/storageApiClient";

export const SCREEN_RECORDINGS_BUCKET = "screen-recordings";

/** הקלטות בשרת נשמרות 7 ימים — מחיקה אוטומטית ב-Supabase (screen_recordings_retention.sql). */
export const CLOUD_RECORDING_RETENTION_DAYS = 7;

const SIGNED_URL_TTL_SEC = 3600;

export function cloudRecordingRetentionCutoffIso(
  retentionDays = CLOUD_RECORDING_RETENTION_DAYS
) {
  const ms = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export function isCloudRecordingWithinRetention(
  rec,
  retentionDays = CLOUD_RECORDING_RETENTION_DAYS
) {
  if (!rec) return false;
  const iso = rec.cloudUploadedAt || rec.stoppedAt || rec.startedAt || rec.createdAt;
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return true;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

/** העלאה לשרת פעילה בפרודקשן עם Supabase (לא בדמו). */
export function cloudRecordingUploadEnabled() {
  if (demoModeEnabled || !supabaseConfigured || !supabase) return false;
  return import.meta.env.VITE_SCREEN_RECORDING_CLOUD_UPLOAD !== "false";
}

export function buildRecordingStoragePath(sessionId, recordingId) {
  return `${sessionId}/${recordingId}.webm`;
}

function toIso(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function mapCloudRecordingRow(row) {
  if (!row?.id) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    startedAt: row.started_at,
    stoppedAt: row.stopped_at,
    durationSec: Number(row.duration_sec) || 0,
    fileName: row.file_name || "",
    fileSizeBytes: row.file_size_bytes ?? null,
    hasAudio: row.has_audio ?? null,
    storagePath: row.storage_path || null,
    cloudUploadStatus: row.upload_status || "pending",
    cloudReady: row.upload_status === "ready",
    cloudUploadError: row.upload_error || null,
    cloudUploadedAt: row.uploaded_at || null,
    agentName: row.agent_name || null,
    customerEmail: row.customer_email || null,
    crmCustomerId: row.crm_customer_id || null,
    fromCloud: true,
  };
}

function mapRecordingToDbRow(meta = {}) {
  const sessionId = meta.sessionId;
  const recordingId = meta.recordingId || meta.id;
  const storagePath =
    meta.storagePath || buildRecordingStoragePath(sessionId, recordingId);
  const agentSession = getAgentSession();

  return {
    id: recordingId,
    session_id: sessionId,
    storage_path: storagePath,
    agent_name: String(meta.agentName || agentSession?.displayName || "").trim(),
    customer_email: String(meta.customerEmail || "").trim(),
    crm_customer_id: meta.crmCustomerId || null,
    started_at: toIso(meta.startedAt),
    stopped_at: toIso(meta.stoppedAt),
    duration_sec: Math.max(0, Math.round(meta.durationSec || 0)),
    file_size_bytes: meta.fileSizeBytes ?? null,
    file_name: meta.fileName || null,
    has_audio: meta.hasAudio ?? null,
    mime_type: meta.mimeType || "video/webm",
    upload_status: meta.uploadStatus || "pending",
    upload_error: meta.uploadError || null,
    uploaded_at: meta.uploadedAt ? toIso(meta.uploadedAt) : null,
    updated_at: new Date().toISOString(),
  };
}

export function isStorageBucketMissingError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return msg.includes("bucket not found") || msg.includes("not found");
}

export function isStoragePolicyDeniedError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("row-level security") ||
    msg.includes("violates policy") ||
    msg.includes("unauthorized") ||
    msg.includes("permission denied") ||
    msg.includes("not allowed")
  );
}

/** הודעת שגיאה בעברית להעלאת Storage (bucket / RLS / גודל). */
export function formatRecordingStorageError(error) {
  if (isStorageBucketMissingError(error)) {
    return `bucket «${SCREEN_RECORDINGS_BUCKET}» לא קיים — הריצו supabase/screen_recordings_storage.sql`;
  }
  if (isStoragePolicyDeniedError(error)) {
    return `העלאה נחסמה ב-Supabase Storage (RLS) — הריצו supabase/screen_recordings_rls_fix.sql ב-SQL Editor`;
  }
  const msg = String(error?.message || error || "").trim();
  if (/payload too large|file size|413|exceeded/i.test(msg)) {
    return "הקובץ גדול מדי — מקסימום 200MB לקובץ (Supabase bucket screen-recordings)";
  }
  if (/mime|content type|invalid file type/i.test(msg)) {
    return "סוג קובץ לא נתמך — נדרש video/webm";
  }
  return msg || "שגיאה בהעלאה ל-Storage";
}

/** רישום / עדכון מטא-דאטה בטבלת screen_recordings. */
export async function upsertCloudRecordingMeta(meta = {}) {
  if (!cloudRecordingUploadEnabled() || !meta.sessionId || !meta.recordingId) {
    return { ok: false, error: "cloud_disabled" };
  }

  const row = mapRecordingToDbRow(meta);
  const { error } = await supabase.from("screen_recordings").upsert(row, {
    onConflict: "id",
  });

  if (error) {
    console.warn("[screenRecordingsSync] upsert failed", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, storagePath: row.storage_path };
}

/** שליפת הקלטה בודדת מהענן (לנגן בדף נפרד). */
export async function fetchCloudRecordingById(recordingId) {
  if (!cloudRecordingUploadEnabled() || !recordingId) return null;
  try {
    const { data, error } = await supabase
      .from("screen_recordings")
      .select("*")
      .eq("id", recordingId)
      .maybeSingle();
    if (error) {
      console.warn("[screenRecordingsSync] fetch one failed", error.message);
      return null;
    }
    return mapCloudRecordingRow(data);
  } catch (err) {
    console.warn("[screenRecordingsSync] fetch one error", err);
    return null;
  }
}

/** שליפת הקלטות ענן לתצוגת מנהל (רק 7 ימים אחרונים). */
export async function fetchCloudScreenRecordings(limit = 1000) {
  if (!cloudRecordingUploadEnabled()) return [];
  const cutoffIso = cloudRecordingRetentionCutoffIso();
  try {
    const { data, error } = await supabase
      .from("screen_recordings")
      .select("*")
      .gte("created_at", cutoffIso)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[screenRecordingsSync] fetch failed", error.message);
      return [];
    }
    return (data || []).map(mapCloudRecordingRow).filter(Boolean);
  } catch (err) {
    console.warn("[screenRecordingsSync] fetch error", err);
    return [];
  }
}

/** URL חתום לנגינה (מנהל / נציג מחובר) — דרך API + service role. */
export async function getSignedRecordingUrl(storagePath, expiresIn = SIGNED_URL_TTL_SEC) {
  if (!cloudRecordingUploadEnabled() || !storagePath) return null;
  const sessionId = String(storagePath).split("/")[0] || "";
  try {
    const result = await apiGetSupportFileSignedUrl({
      sessionId,
      storagePath,
      bucket: SCREEN_RECORDINGS_BUCKET,
      expiresIn,
    });
    if (!result.ok) {
      console.warn("[screenRecordingsSync] signed url failed", result.error || result.message);
      return null;
    }
    return result.signedUrl || null;
  } catch (err) {
    console.warn("[screenRecordingsSync] signed url error", err);
    return null;
  }
}

/** מפת sessionId → recordings[] מענן. */
export function groupCloudRecordingsBySession(cloudRecordings = []) {
  const bySession = new Map();
  for (const rec of cloudRecordings) {
    if (!rec?.sessionId) continue;
    if (!bySession.has(rec.sessionId)) bySession.set(rec.sessionId, []);
    bySession.get(rec.sessionId).push(rec);
  }
  return bySession;
}

export function mergeSessionRecordings(localRecordings = [], cloudRecordings = []) {
  const byId = new Map();

  for (const rec of cloudRecordings) {
    if (rec?.id) byId.set(rec.id, { ...rec });
  }

  for (const rec of localRecordings) {
    if (!rec?.id) continue;
    const cloud = byId.get(rec.id);
    if (!cloud) {
      byId.set(rec.id, rec);
      continue;
    }
    byId.set(rec.id, {
      ...cloud,
      ...rec,
      storagePath: cloud.storagePath || rec.storagePath,
      cloudUploadStatus: cloud.cloudUploadStatus || rec.cloudUploadStatus,
      cloudReady: cloud.cloudReady || rec.cloudReady,
      fromCloud: cloud.fromCloud,
    });
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.stoppedAt || b.startedAt) - new Date(a.stoppedAt || a.startedAt)
  );
}

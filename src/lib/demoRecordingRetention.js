import { remoteSupportEnabled } from "@/api/demoClient";
import { deleteRecordingBlob } from "@/lib/demoRecordingStorage";
import { deleteRecordingMetadata, listAllRecordings } from "@/lib/screenShareStore";

export const DEMO_RECORDING_RETENTION_KEY = "demo-recording-retention-days";
export const RETENTION_DAY_OPTIONS = [7, 30, 90];
const DEFAULT_RETENTION_DAYS = 30;

export function getRecordingRetentionDays() {
  if (typeof window === "undefined") return DEFAULT_RETENTION_DAYS;
  try {
    const raw = localStorage.getItem(DEMO_RECORDING_RETENTION_KEY);
    const n = Number(raw);
    if (RETENTION_DAY_OPTIONS.includes(n)) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_RETENTION_DAYS;
}

export function setRecordingRetentionDays(days) {
  if (!RETENTION_DAY_OPTIONS.includes(days)) return false;
  if (typeof window === "undefined") return false;
  localStorage.setItem(DEMO_RECORDING_RETENTION_KEY, String(days));
  return true;
}

function recordingTimestampMs(rec) {
  const iso = rec.stoppedAt || rec.startedAt;
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** הקלטות שמועדן עבר את תקופת השמירה */
export function findExpiredRecordings(recordings, retentionDays = getRecordingRetentionDays()) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  return (recordings || []).filter((rec) => {
    const ts = recordingTimestampMs(rec);
    return ts > 0 && ts < cutoff;
  });
}

/**
 * מוחק הקלטות שעברו את תקופת השמירה (מטא-דאטה + IndexedDB).
 * @returns {Promise<number>} מספר הרשומות שנמחקו
 */
export async function purgeExpiredRecordings(recordings, retentionDays = getRecordingRetentionDays()) {
  if (!remoteSupportEnabled) return 0;
  const expired = findExpiredRecordings(recordings, retentionDays);
  let removed = 0;
  for (const rec of expired) {
    try {
      await deleteRecordingBlob(rec.sessionId, rec.id);
      deleteRecordingMetadata(rec.sessionId, rec.id);
      removed += 1;
    } catch {
      /* continue */
    }
  }
  return removed;
}

export async function purgeAllExpiredByRetention() {
  const all = listAllRecordings();
  return purgeExpiredRecordings(all);
}
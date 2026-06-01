import { demoModeEnabled } from "@/api/demoClient";
import { supabase, supabaseConfigured } from "@/api/supabase";
import { updateRecordingMetadata } from "@/lib/screenShareStore";

/** העלאה אמיתית ל-Supabase — רק כשמוגדר במפורש (לא בדמו). */
const REAL_CLOUD_UPLOAD_ENABLED =
  import.meta.env.VITE_SCREEN_RECORDING_CLOUD_UPLOAD === "true";

/**
 * העלאת הקלטה לענן.
 * דמו: סימון מטא-דאטה כ«נשמר בענן (מדומה)» — ללא קריאת API.
 * פרודקשן: שלד Supabase Storage (bucket `screen-recordings`) — רק עם מפתחות + דגל מפורש.
 *
 * @param {Blob} blob
 * @param {object} meta — sessionId, recordingId, fileName, וכו'
 * @returns {Promise<{ ok: boolean, message: string, cloudPath?: string }>}
 */
export async function uploadRecordingToCloud(blob, meta = {}) {
  const sessionId = meta.sessionId;
  const recordingId = meta.recordingId || meta.id;

  if (!demoModeEnabled) {
    void blob;
    void meta;
    void sessionId;
    void recordingId;
    // TODO(production): Supabase Storage bucket `screen-recordings` — only when
    // supabaseConfigured && REAL_CLOUD_UPLOAD_ENABLED; never enable from demo UI.
    if (REAL_CLOUD_UPLOAD_ENABLED && supabaseConfigured && supabase) {
      return { ok: false, message: "העלאה לענן — בפיתוח (Supabase Storage)" };
    }
    return { ok: false, message: "זמין רק בדמו" };
  }

  if (!blob?.size) {
    return { ok: false, message: "אין קובץ להעלאה — ההקלטה לא נשמרה ב-IndexedDB" };
  }
  if (!sessionId || !recordingId) {
    return { ok: false, message: "חסר מזהה סשן או הקלטה" };
  }

  const now = new Date().toISOString();
  const cloudPath = `demo/recordings/${recordingId}.webm`;
  updateRecordingMetadata(sessionId, recordingId, {
    demoCloudSaved: true,
    demoCloudSavedAt: now,
    demoCloudPath: cloudPath,
  });

  return {
    ok: true,
    message: "נשמר בדמו (ענן מדומה)",
    cloudPath,
  };
}

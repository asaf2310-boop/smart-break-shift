import { demoModeEnabled } from "@/api/demoClient";
import { supabase } from "@/api/supabase";
import { getAgentSession } from "@/lib/agentAuth";
import { getSession, updateRecordingMetadata } from "@/lib/screenShareStore";
import { syncScreenShareSessionToCloudAwait } from "@/lib/supportSessionsSync";
import {
  buildRecordingStoragePath,
  cloudRecordingUploadEnabled,
  isStorageBucketMissingError,
  SCREEN_RECORDINGS_BUCKET,
  upsertCloudRecordingMeta,
} from "@/lib/screenRecordingsSync";

export { cloudRecordingUploadEnabled };

const UPLOAD_STATUS_LABELS = {
  pending: "ממתין להעלאה",
  uploading: "מעלה לשרת…",
  ready: "זמין בשרת",
  failed: "העלאה נכשלה",
};

export function recordingUploadStatusLabel(status) {
  return UPLOAD_STATUS_LABELS[status] || status || UPLOAD_STATUS_LABELS.pending;
}

/**
 * העלאת הקלטה ל-Supabase Storage + מטא-דאטה ב-screen_recordings.
 * דמו: סימון מטא-דאטה כ«נשמר בענן (מדומה)» — ללא קריאת API.
 *
 * @param {Blob} blob
 * @param {object} meta — sessionId, recordingId, fileName, durationSec, וכו'
 * @param {{ onStatus?: (status: string) => void }} [options]
 * @returns {Promise<{ ok: boolean, message: string, cloudPath?: string, uploadStatus?: string }>}
 */
export async function uploadRecordingToCloud(blob, meta = {}, options = {}) {
  const sessionId = meta.sessionId;
  const recordingId = meta.recordingId || meta.id;
  const onStatus = options.onStatus;

  if (!sessionId || !recordingId) {
    return { ok: false, message: "חסר מזהה סשן או הקלטה", uploadStatus: "failed" };
  }

  if (!blob?.size) {
    return {
      ok: false,
      message: "אין קובץ להעלאה — ההקלטה לא נשמרה",
      uploadStatus: "failed",
    };
  }

  if (demoModeEnabled) {
    const now = new Date().toISOString();
    const cloudPath = `demo/recordings/${recordingId}.webm`;
    updateRecordingMetadata(sessionId, recordingId, {
      demoCloudSaved: true,
      demoCloudSavedAt: now,
      demoCloudPath: cloudPath,
      cloudUploadStatus: "ready",
    });
    onStatus?.("ready");
    return {
      ok: true,
      message: "נשמר בדמו (ענן מדומה)",
      cloudPath,
      uploadStatus: "ready",
    };
  }

  if (!cloudRecordingUploadEnabled()) {
    return {
      ok: false,
      message: "העלאה לשרת אינה מוגדרת (Supabase / VITE_SCREEN_RECORDING_CLOUD_UPLOAD)",
      uploadStatus: "pending",
    };
  }

  const session = getSession(sessionId);
  const agentSession = getAgentSession();
  const agentName = String(
    meta.agentName || session?.agentName || agentSession?.displayName || ""
  ).trim();

  if (!agentName) {
    return {
      ok: false,
      message: "יש להתחבר כנציג לפני העלאה לשרת",
      uploadStatus: "failed",
    };
  }

  if (session?.agentName && agentName !== String(session.agentName).trim()) {
    return {
      ok: false,
      message: "ניתן להעלות רק הקלטות מהסשנים שלך",
      uploadStatus: "failed",
    };
  }

  const storagePath = buildRecordingStoragePath(sessionId, recordingId);
  const mimeType = blob.type || "video/webm";

  if (session) {
    const recCount = (session.recordings || []).length;
    await syncScreenShareSessionToCloudAwait(session, {
      recordingCount: Math.max(recCount, 1),
    });
  }

  const patchUploading = {
    cloudUploadStatus: "uploading",
    storagePath,
    cloudUploadError: null,
  };
  updateRecordingMetadata(sessionId, recordingId, patchUploading);
  onStatus?.("uploading");

  await upsertCloudRecordingMeta({
    sessionId,
    recordingId,
    storagePath,
    agentName,
    customerEmail: meta.customerEmail || session?.customerEmail,
    crmCustomerId: meta.crmCustomerId || session?.crmCustomerId,
    startedAt: meta.startedAt,
    stoppedAt: meta.stoppedAt,
    durationSec: meta.durationSec,
    fileSizeBytes: blob.size,
    fileName: meta.fileName,
    hasAudio: meta.hasAudio,
    mimeType,
    uploadStatus: "uploading",
  });

  const { error: uploadError } = await supabase.storage
    .from(SCREEN_RECORDINGS_BUCKET)
    .upload(storagePath, blob, {
      upsert: true,
      contentType: mimeType,
      cacheControl: "3600",
    });

  if (uploadError) {
    const bucketMissing = isStorageBucketMissingError(uploadError);
    const message = bucketMissing
      ? `bucket «${SCREEN_RECORDINGS_BUCKET}» לא קיים — הריצו supabase/screen_recordings_storage.sql`
      : uploadError.message || "שגיאה בהעלאה ל-Storage";

    updateRecordingMetadata(sessionId, recordingId, {
      cloudUploadStatus: "failed",
      cloudUploadError: message,
      storagePath,
    });

    await upsertCloudRecordingMeta({
      sessionId,
      recordingId,
      storagePath,
      agentName,
      uploadStatus: "failed",
      uploadError: message,
      fileSizeBytes: blob.size,
    });

    onStatus?.("failed");
    return { ok: false, message, uploadStatus: "failed" };
  }

  const now = new Date().toISOString();
  updateRecordingMetadata(sessionId, recordingId, {
    cloudUploadStatus: "ready",
    cloudUploadedAt: now,
    storagePath,
    cloudUploadError: null,
    demoCloudSaved: false,
  });

  await upsertCloudRecordingMeta({
    sessionId,
    recordingId,
    storagePath,
    agentName,
    customerEmail: meta.customerEmail || session?.customerEmail,
    crmCustomerId: meta.crmCustomerId || session?.crmCustomerId,
    startedAt: meta.startedAt,
    stoppedAt: meta.stoppedAt,
    durationSec: meta.durationSec,
    fileSizeBytes: blob.size,
    fileName: meta.fileName,
    hasAudio: meta.hasAudio,
    mimeType,
    uploadStatus: "ready",
    uploadedAt: now,
  });

  onStatus?.("ready");
  return {
    ok: true,
    message: recordingUploadStatusLabel("ready"),
    cloudPath: storagePath,
    uploadStatus: "ready",
  };
}

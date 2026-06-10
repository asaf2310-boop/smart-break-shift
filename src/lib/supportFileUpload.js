import { demoModeEnabled } from "@/api/demoClient";
import { supabase } from "@/api/supabase";
import {
  downloadSupportFileBlob,
  getSupportFileBlob,
  saveSupportFileBlob,
} from "@/lib/demoSupportFileStorage";
import { getSession } from "@/lib/screenShareStore";
import { syncScreenShareSessionToCloudAwait } from "@/lib/supportSessionsSync";
import {
  appendLocalSessionFile,
  MAX_SUPPORT_FILE_BYTES,
  sanitizeOriginalName,
  updateLocalSessionFile,
} from "@/lib/supportFilesStore";
import {
  buildSupportFileStoragePath,
  cloudSupportFilesEnabled,
  fetchCloudSessionFiles,
  getSignedSupportFileUrl,
  isSupportFilesBucketMissingError,
  mergeSessionFiles,
  SUPPORT_FILES_BUCKET,
  upsertCloudSupportFileMeta,
} from "@/lib/supportFilesSync";
import { generateShortCode } from "@/lib/guestLinkCodec";

export { cloudSupportFilesEnabled, MAX_SUPPORT_FILE_BYTES, mergeSessionFiles, fetchCloudSessionFiles };

const UPLOAD_STATUS_LABELS = {
  pending: "ממתין להעלאה",
  uploading: "מעלה…",
  ready: "זמין",
  failed: "העלאה נכשלה",
};

export function supportFileUploadStatusLabel(status) {
  return UPLOAD_STATUS_LABELS[status] || status || UPLOAD_STATUS_LABELS.pending;
}

function makeFileId() {
  return `ss_file_${generateShortCode(8)}`;
}

export function formatSupportFileSize(bytes) {
  if (!bytes || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function validateFile(file) {
  if (!file) return "לא נבחר קובץ";
  if (file.size > MAX_SUPPORT_FILE_BYTES) {
    return `הקובץ גדול מדי — מקסימום ${formatSupportFileSize(MAX_SUPPORT_FILE_BYTES)}`;
  }
  if (file.size <= 0) return "הקובץ ריק";
  return null;
}

/**
 * @param {File} file
 * @param {{ sessionId: string, uploadedBy: 'agent'|'guest', uploaderLabel?: string }} options
 */
export async function uploadSupportSessionFile(file, options = {}) {
  const sessionId = options.sessionId;
  const uploadedBy = options.uploadedBy === "guest" ? "guest" : "agent";
  const uploaderLabel = String(options.uploaderLabel || "").trim();

  if (!sessionId) {
    return { ok: false, message: "חסר מזהה סשן", uploadStatus: "failed" };
  }

  const validationError = validateFile(file);
  if (validationError) {
    return { ok: false, message: validationError, uploadStatus: "failed" };
  }

  const originalName = sanitizeOriginalName(file.name);
  const fileId = makeFileId();
  const mimeType = file.type || "application/octet-stream";
  const storagePath = buildSupportFileStoragePath(sessionId, fileId, originalName);

  if (demoModeEnabled || !cloudSupportFilesEnabled()) {
    const entry = appendLocalSessionFile(sessionId, {
      id: fileId,
      originalName,
      mimeType,
      fileSizeBytes: file.size,
      uploadedBy,
      uploaderLabel: uploaderLabel || (uploadedBy === "guest" ? "לקוח" : "נציג"),
      storagePath,
      uploadStatus: "ready",
    });
    try {
      await saveSupportFileBlob({
        sessionId,
        fileId,
        blob: file,
        meta: { originalName, fileSizeBytes: file.size },
      });
    } catch {
      updateLocalSessionFile(sessionId, fileId, {
        uploadStatus: "failed",
        uploadError: "שמירה מקומית נכשלה",
      });
      return {
        ok: false,
        message: "לא ניתן לשמור את הקובץ בדפדפן",
        uploadStatus: "failed",
        fileId,
      };
    }
    return {
      ok: true,
      message: demoModeEnabled ? "הקובץ נשמר (דמו)" : "הקובץ נשמר מקומית",
      fileId,
      entry,
      uploadStatus: "ready",
    };
  }

  const session = getSession(sessionId);
  if (session) {
    await syncScreenShareSessionToCloudAwait(session);
  }

  await upsertCloudSupportFileMeta({
    sessionId,
    fileId,
    storagePath,
    originalName,
    mimeType,
    fileSizeBytes: file.size,
    uploadedBy,
    uploaderLabel: uploaderLabel || (uploadedBy === "guest" ? "לקוח" : session?.agentName || "נציג"),
    uploadStatus: "uploading",
  });

  const { error: uploadError } = await supabase.storage
    .from(SUPPORT_FILES_BUCKET)
    .upload(storagePath, file, {
      upsert: true,
      contentType: mimeType,
      cacheControl: "3600",
    });

  if (uploadError) {
    const bucketMissing = isSupportFilesBucketMissingError(uploadError);
    const message = bucketMissing
      ? `bucket «${SUPPORT_FILES_BUCKET}» לא קיים — הריצו supabase/support_files_storage.sql`
      : uploadError.message || "שגיאה בהעלאה";

    await upsertCloudSupportFileMeta({
      sessionId,
      fileId,
      storagePath,
      originalName,
      uploadedBy,
      uploaderLabel,
      uploadStatus: "failed",
      uploadError: message,
      fileSizeBytes: file.size,
    });

    return { ok: false, message, uploadStatus: "failed", fileId };
  }

  const now = new Date().toISOString();
  await upsertCloudSupportFileMeta({
    sessionId,
    fileId,
    storagePath,
    originalName,
    mimeType,
    fileSizeBytes: file.size,
    uploadedBy,
    uploaderLabel: uploaderLabel || (uploadedBy === "guest" ? "לקוח" : session?.agentName || "נציג"),
    uploadStatus: "ready",
    uploadedAt: now,
  });

  return {
    ok: true,
    message: "הקובץ הועלה בהצלחה",
    fileId,
    storagePath,
    uploadStatus: "ready",
  };
}

export async function downloadSupportSessionFile(fileMeta) {
  if (!fileMeta?.id || !fileMeta?.sessionId) {
    return { ok: false, message: "קובץ לא נמצא" };
  }

  if (demoModeEnabled || !cloudSupportFilesEnabled() || fileMeta.fromLocal) {
    const blob = await getSupportFileBlob(fileMeta.sessionId, fileMeta.id);
    if (!blob?.size) {
      return {
        ok: false,
        message: "הקובץ לא זמין בדפדפן זה — הועלה ממכשיר אחר",
      };
    }
    downloadSupportFileBlob(blob, fileMeta.originalName || "file");
    return { ok: true };
  }

  const storagePath =
    fileMeta.storagePath ||
    buildSupportFileStoragePath(fileMeta.sessionId, fileMeta.id, fileMeta.originalName);
  const signedUrl = await getSignedSupportFileUrl(storagePath);
  if (!signedUrl) {
    return { ok: false, message: "לא ניתן ליצור קישור הורדה" };
  }

  const anchor = document.createElement("a");
  anchor.href = signedUrl;
  anchor.download = fileMeta.originalName || "file";
  anchor.rel = "noopener";
  anchor.target = "_blank";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return { ok: true };
}

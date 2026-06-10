import { demoModeEnabled } from "@/api/demoClient";
import { supabase, supabaseConfigured } from "@/api/supabase";
import { getFileExtension } from "@/lib/supportFilesStore";

export const SUPPORT_FILES_BUCKET = "support-files";

const SIGNED_URL_TTL_SEC = 3600;

export function cloudSupportFilesEnabled() {
  if (demoModeEnabled || !supabaseConfigured || !supabase) return false;
  return import.meta.env.VITE_SUPPORT_FILES_CLOUD_UPLOAD !== "false";
}

export function buildSupportFileStoragePath(sessionId, fileId, originalName) {
  const ext = getFileExtension(originalName) || ".bin";
  return `${sessionId}/${fileId}${ext}`;
}

function toIso(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function mapCloudSupportFileRow(row) {
  if (!row?.id) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    originalName: row.original_name || "file",
    mimeType: row.mime_type || "application/octet-stream",
    fileSizeBytes: row.file_size_bytes ?? null,
    uploadedBy: row.uploaded_by || "agent",
    uploaderLabel: row.uploader_label || "",
    storagePath: row.storage_path || null,
    uploadStatus: row.upload_status || "pending",
    uploadError: row.upload_error || null,
    uploadedAt: row.uploaded_at || row.created_at,
    createdAt: row.created_at,
    fromCloud: true,
  };
}

function mapFileToDbRow(meta = {}) {
  const sessionId = meta.sessionId;
  const fileId = meta.fileId || meta.id;
  const storagePath =
    meta.storagePath || buildSupportFileStoragePath(sessionId, fileId, meta.originalName);

  return {
    id: fileId,
    session_id: sessionId,
    storage_path: storagePath,
    original_name: String(meta.originalName || "file").trim(),
    mime_type: meta.mimeType || "application/octet-stream",
    file_size_bytes: meta.fileSizeBytes ?? null,
    uploaded_by: meta.uploadedBy || "agent",
    uploader_label: String(meta.uploaderLabel || "").trim(),
    upload_status: meta.uploadStatus || "pending",
    upload_error: meta.uploadError || null,
    uploaded_at: meta.uploadedAt ? toIso(meta.uploadedAt) : null,
    updated_at: new Date().toISOString(),
  };
}

export function isSupportFilesBucketMissingError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return msg.includes("bucket not found") || msg.includes("not found");
}

export async function upsertCloudSupportFileMeta(meta = {}) {
  if (!cloudSupportFilesEnabled() || !meta.sessionId || !meta.fileId) {
    return { ok: false, error: "cloud_disabled" };
  }

  const row = mapFileToDbRow(meta);
  const { error } = await supabase.from("support_session_files").upsert(row, {
    onConflict: "id",
  });

  if (error) {
    console.warn("[supportFilesSync] upsert failed", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, storagePath: row.storage_path };
}

export async function fetchCloudSessionFiles(sessionId) {
  if (!cloudSupportFilesEnabled() || !sessionId) return [];
  try {
    const { data, error } = await supabase
      .from("support_session_files")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("[supportFilesSync] fetch failed", error.message);
      return [];
    }
    return (data || []).map(mapCloudSupportFileRow).filter(Boolean);
  } catch (err) {
    console.warn("[supportFilesSync] fetch error", err);
    return [];
  }
}

export async function getSignedSupportFileUrl(storagePath, expiresIn = SIGNED_URL_TTL_SEC) {
  if (!cloudSupportFilesEnabled() || !storagePath) return null;
  try {
    const { data, error } = await supabase.storage
      .from(SUPPORT_FILES_BUCKET)
      .createSignedUrl(storagePath, expiresIn);
    if (error) {
      console.warn("[supportFilesSync] signed url failed", error.message);
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.warn("[supportFilesSync] signed url error", err);
    return null;
  }
}

export function mergeSessionFiles(localFiles = [], cloudFiles = []) {
  const byId = new Map();

  for (const file of cloudFiles) {
    if (file?.id) byId.set(file.id, { ...file });
  }

  for (const file of localFiles) {
    if (!file?.id) continue;
    const cloud = byId.get(file.id);
    if (!cloud) {
      byId.set(file.id, file);
      continue;
    }
    byId.set(file.id, {
      ...cloud,
      ...file,
      storagePath: cloud.storagePath || file.storagePath,
      uploadStatus: cloud.uploadStatus || file.uploadStatus,
      fromCloud: cloud.fromCloud,
    });
  }

  return [...byId.values()].sort(
    (a, b) => new Date(a.uploadedAt || a.createdAt) - new Date(b.uploadedAt || b.createdAt)
  );
}

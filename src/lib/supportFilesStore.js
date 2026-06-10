import { remoteSupportEnabled } from "@/api/demoClient";
import { generateShortCode } from "@/lib/guestLinkCodec";

export const SUPPORT_FILES_STORAGE_KEY = "smart-break-shift-support-files-v1";
export const SUPPORT_FILES_CHANGE_EVENT = "support-files-changed";

export const MAX_SUPPORT_FILE_BYTES = 20 * 1024 * 1024;

function makeFileId() {
  return `ss_file_${generateShortCode(8)}`;
}

function readStore() {
  if (!remoteSupportEnabled || typeof window === "undefined") {
    return { files: [] };
  }
  try {
    const raw = localStorage.getItem(SUPPORT_FILES_STORAGE_KEY);
    if (!raw) return { files: [] };
    const parsed = JSON.parse(raw);
    return {
      files: Array.isArray(parsed.files) ? parsed.files : [],
    };
  } catch {
    return { files: [] };
  }
}

function writeStore({ files }) {
  if (!remoteSupportEnabled || typeof window === "undefined") return;
  localStorage.setItem(SUPPORT_FILES_STORAGE_KEY, JSON.stringify({ files }));
  window.dispatchEvent(new CustomEvent(SUPPORT_FILES_CHANGE_EVENT));
}

export function listLocalSessionFiles(sessionId) {
  if (!sessionId) return [];
  return readStore()
    .files.filter((f) => f.sessionId === sessionId)
    .sort((a, b) => new Date(b.uploadedAt || b.createdAt) - new Date(a.uploadedAt || a.createdAt));
}

export function getLocalSessionFile(sessionId, fileId) {
  return (
    readStore().files.find((f) => f.sessionId === sessionId && f.id === fileId) || null
  );
}

export function appendLocalSessionFile(sessionId, meta = {}) {
  if (!sessionId) return null;
  const now = new Date().toISOString();
  const entry = {
    id: meta.id || makeFileId(),
    sessionId,
    originalName: meta.originalName || "file",
    mimeType: meta.mimeType || "application/octet-stream",
    fileSizeBytes: meta.fileSizeBytes ?? null,
    uploadedBy: meta.uploadedBy || "agent",
    uploaderLabel: meta.uploaderLabel || "",
    storagePath: meta.storagePath || null,
    uploadStatus: meta.uploadStatus || "ready",
    uploadError: meta.uploadError || null,
    uploadedAt: meta.uploadedAt || now,
    createdAt: now,
    fromLocal: true,
  };
  const files = [...readStore().files, entry];
  writeStore({ files });
  return entry;
}

export function updateLocalSessionFile(sessionId, fileId, patch) {
  if (!sessionId || !fileId || !patch) return null;
  let updated = null;
  const files = readStore().files.map((f) => {
    if (f.sessionId !== sessionId || f.id !== fileId) return f;
    updated = { ...f, ...patch };
    return updated;
  });
  writeStore({ files });
  return updated;
}

export function subscribeSupportFiles(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(SUPPORT_FILES_CHANGE_EVENT, handler);
  const onStorage = (e) => {
    if (!e || e.key !== SUPPORT_FILES_STORAGE_KEY) return;
    callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SUPPORT_FILES_CHANGE_EVENT, handler);
    window.removeEventListener("storage", onStorage);
  };
}

export function getFileExtension(fileName) {
  const base = String(fileName || "").trim();
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot).toLowerCase();
}

export function sanitizeOriginalName(fileName) {
  const base = String(fileName || "file").replace(/[/\\]/g, "_").trim();
  return base.slice(0, 200) || "file";
}

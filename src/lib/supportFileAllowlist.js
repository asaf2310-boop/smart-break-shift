/** Allowed support-session file types (client — keep in sync with server/storage/supportFileAllowlist.js). */

export const SUPPORT_FILE_ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".zip",
]);

export const SUPPORT_FILE_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);

const BLOCKED_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".svg",
  ".js",
  ".mjs",
  ".exe",
  ".bat",
  ".cmd",
  ".msi",
  ".scr",
  ".php",
  ".sh",
  ".ps1",
]);

function extensionFromName(fileName) {
  const base = String(fileName || "").trim().toLowerCase();
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot);
}

/** `accept` attribute for file inputs. */
export const SUPPORT_FILE_INPUT_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip";

export const SUPPORT_FILE_TYPE_HINT =
  "PDF, תמונות, Word/Excel, CSV, TXT או ZIP";

export function validateSupportFileType({ fileName, mimeType } = {}) {
  const ext = extensionFromName(fileName);
  if (!ext) {
    return { ok: false, message: "לקובץ חייבת להיות סיומת מוכרת" };
  }
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, message: "סוג קובץ זה אינו מותר להעלאה" };
  }
  if (!SUPPORT_FILE_ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      message: `סוג קובץ לא נתמך — ${SUPPORT_FILE_TYPE_HINT}`,
    };
  }

  const mime = String(mimeType || "").trim().toLowerCase();
  if (mime && mime !== "application/octet-stream" && !SUPPORT_FILE_ALLOWED_MIME_TYPES.has(mime)) {
    return { ok: false, message: "סוג התוכן של הקובץ אינו מותר" };
  }

  return { ok: true };
}

/** Allowed support-session file types (server + keep in sync with src/lib/supportFileAllowlist.js). */

import { validateSupportZipBuffer, SUPPORT_ZIP_MAX_COMPRESSED_BYTES } from "./supportZipValidation.js";

export { SUPPORT_ZIP_MAX_COMPRESSED_BYTES };

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

function extensionFromPath(storagePath) {
  const fileName = String(storagePath || "").split("/").pop() || "";
  return extensionFromName(fileName);
}

export function validateSupportFileType({ fileName, storagePath, mimeType } = {}) {
  const ext = extensionFromName(fileName) || extensionFromPath(storagePath);
  if (!ext) {
    return { ok: false, error: "missing_extension", message: "לקובץ חייבת להיות סיומת מוכרת" };
  }
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, error: "blocked_type", message: "סוג קובץ זה אינו מותר להעלאה" };
  }
  if (!SUPPORT_FILE_ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: "unsupported_type",
      message: "סוג קובץ לא נתמך — PDF, תמונות, Office, CSV, TXT או ZIP",
    };
  }

  const mime = String(mimeType || "").trim().toLowerCase();
  if (mime && mime !== "application/octet-stream" && !SUPPORT_FILE_ALLOWED_MIME_TYPES.has(mime)) {
    return { ok: false, error: "unsupported_mime", message: "סוג התוכן של הקובץ אינו מותר" };
  }

  return { ok: true, extension: ext };
}

function bufferStartsWith(buf, bytes) {
  if (!buf || buf.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buf[i] !== bytes[i]) return false;
  }
  return true;
}

function bufferStartsWithAscii(buf, text) {
  return bufferStartsWith(buf, Buffer.from(text, "ascii"));
}

const MAGIC_BYTE_CHECKS = {
  ".pdf": (buf) => bufferStartsWithAscii(buf, "%PDF"),
  ".png": (buf) => bufferStartsWith(buf, [0x89, 0x50, 0x4e, 0x47]),
  ".jpg": (buf) => bufferStartsWith(buf, [0xff, 0xd8, 0xff]),
  ".jpeg": (buf) => bufferStartsWith(buf, [0xff, 0xd8, 0xff]),
  ".gif": (buf) => bufferStartsWithAscii(buf, "GIF8"),
  ".webp": (buf) =>
    buf.length >= 12 &&
    bufferStartsWithAscii(buf, "RIFF") &&
    bufferStartsWithAscii(buf.subarray(8, 12), "WEBP"),
  ".doc": (buf) => bufferStartsWith(buf, [0xd0, 0xcf, 0x11, 0xe0]),
  ".xls": (buf) => bufferStartsWith(buf, [0xd0, 0xcf, 0x11, 0xe0]),
  ".docx": (buf) => bufferStartsWith(buf, [0x50, 0x4b, 0x03, 0x04]),
  ".xlsx": (buf) => bufferStartsWith(buf, [0x50, 0x4b, 0x03, 0x04]),
  ".zip": (buf) =>
    bufferStartsWith(buf, [0x50, 0x4b, 0x03, 0x04]) ||
    bufferStartsWith(buf, [0x50, 0x4b, 0x05, 0x06]) ||
    bufferStartsWith(buf, [0x50, 0x4b, 0x07, 0x08]),
  ".heic": (buf) =>
    buf.length >= 12 &&
    bufferStartsWithAscii(buf.subarray(4), "ftyp") &&
    (bufferStartsWithAscii(buf.subarray(8), "heic") ||
      bufferStartsWithAscii(buf.subarray(8), "heix") ||
      bufferStartsWithAscii(buf.subarray(8), "mif1")),
  ".heif": (buf) =>
    buf.length >= 12 &&
    bufferStartsWithAscii(buf.subarray(4), "ftyp") &&
    (bufferStartsWithAscii(buf.subarray(8), "heic") ||
      bufferStartsWithAscii(buf.subarray(8), "heix") ||
      bufferStartsWithAscii(buf.subarray(8), "mif1")),
};

/**
 * Magic-byte + ZIP structure validation when buffer is available (direct upload).
 */
export function validateSupportFileContent({ extension, buffer } = {}) {
  const ext = String(extension || "").toLowerCase();
  if (!buffer?.length) {
    return { ok: true, skipped: true };
  }

  const magicCheck = MAGIC_BYTE_CHECKS[ext];
  if (magicCheck && !magicCheck(buffer)) {
    return {
      ok: false,
      error: "magic_mismatch",
      message: "תוכן הקובץ אינו תואם לסיומת",
    };
  }

  if (ext === ".zip") {
    return validateSupportZipBuffer(buffer);
  }

  return { ok: true };
}

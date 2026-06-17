/** ZIP bomb / nested-archive guards for support-file uploads. */

const LOCAL_FILE_HEADER = 0x04034b50;
const END_OF_CENTRAL_DIR = 0x06054b50;
const CENTRAL_DIR_HEADER = 0x02014b50;

const NESTED_ARCHIVE_EXTENSIONS = new Set([
  ".zip",
  ".7z",
  ".rar",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".jar",
  ".apk",
]);

export const SUPPORT_ZIP_MAX_COMPRESSED_BYTES = 20 * 1024 * 1024;
export const SUPPORT_ZIP_MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const SUPPORT_ZIP_MAX_FILE_COUNT = 200;

function extensionFromEntryName(name) {
  const base = String(name || "").trim().toLowerCase().replace(/\\/g, "/");
  const leaf = base.split("/").pop() || base;
  const dot = leaf.lastIndexOf(".");
  if (dot <= 0 || dot === leaf.length - 1) return "";
  return leaf.slice(dot);
}

function isUnsafeEntryPath(name) {
  const normalized = String(name || "").replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || /(^|\/)\.\.(\/|$)/.test(normalized)) {
    return true;
  }
  return false;
}

/**
 * @param {Buffer} buffer
 */
export function validateSupportZipBuffer(buffer) {
  if (!buffer?.length) {
    return { ok: false, error: "empty_zip", message: "קובץ ZIP ריק" };
  }
  if (buffer.length > SUPPORT_ZIP_MAX_COMPRESSED_BYTES) {
    return {
      ok: false,
      error: "zip_too_large",
      message: "קובץ ZIP גדול מדי",
    };
  }
  if (buffer.readUInt32LE(0) !== LOCAL_FILE_HEADER) {
    return { ok: false, error: "invalid_zip", message: "קובץ ZIP לא תקין" };
  }

  let offset = 0;
  let fileCount = 0;
  let totalUncompressed = 0;

  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature === END_OF_CENTRAL_DIR || signature === CENTRAL_DIR_HEADER) {
      break;
    }
    if (signature !== LOCAL_FILE_HEADER) {
      return { ok: false, error: "invalid_zip", message: "מבנה ZIP לא תקין" };
    }

    fileCount += 1;
    if (fileCount > SUPPORT_ZIP_MAX_FILE_COUNT) {
      return {
        ok: false,
        error: "zip_too_many_files",
        message: "יותר מדי קבצים ב-ZIP",
      };
    }

    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      return {
        ok: false,
        error: "zip64_not_allowed",
        message: "ZIP64 אינו נתמך",
      };
    }

    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > buffer.length) {
      return { ok: false, error: "invalid_zip", message: "מבנה ZIP לא תקין" };
    }

    const entryName = buffer.toString("utf8", nameStart, nameEnd);
    if (isUnsafeEntryPath(entryName)) {
      return {
        ok: false,
        error: "zip_unsafe_path",
        message: "נתיב קובץ ב-ZIP אינו מותר",
      };
    }

    const entryExt = extensionFromEntryName(entryName);
    if (NESTED_ARCHIVE_EXTENSIONS.has(entryExt)) {
      return {
        ok: false,
        error: "nested_archive",
        message: "ארכיונים מקוננים אינם מותרים ב-ZIP",
      };
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > SUPPORT_ZIP_MAX_UNCOMPRESSED_BYTES) {
      return {
        ok: false,
        error: "zip_uncompressed_too_large",
        message: "גודל לא דחוס של ZIP חורג מהמותר",
      };
    }

    const dataStart = nameEnd + extraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) {
      return { ok: false, error: "invalid_zip", message: "מבנה ZIP לא תקין" };
    }

    offset = dataEnd;
  }

  if (fileCount === 0) {
    return { ok: false, error: "empty_zip", message: "קובץ ZIP ריק" };
  }

  return { ok: true, fileCount, totalUncompressed };
}

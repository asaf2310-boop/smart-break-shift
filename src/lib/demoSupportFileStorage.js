import { remoteSupportEnabled } from "@/api/demoClient";

const DB_NAME = "smart-break-shift-demo-support-files-v1";
const STORE_NAME = "blobs";
const DB_VERSION = 1;

function compositeKey(sessionId, fileId) {
  return `${sessionId}::${fileId}`;
}

function fileStorageAvailable() {
  return remoteSupportEnabled && typeof indexedDB !== "undefined";
}

function openDb() {
  if (!fileStorageAvailable()) {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("sessionId", "sessionId", { unique: false });
        store.createIndex("fileId", "fileId", { unique: false });
      }
    };
  });
}

export async function saveSupportFileBlob({ sessionId, fileId, blob, meta = {} }) {
  if (!fileStorageAvailable() || !sessionId || !fileId || !blob) return false;
  const db = await openDb();
  const key = compositeKey(sessionId, fileId);
  const record = {
    key,
    sessionId,
    fileId,
    blob,
    mimeType: blob.type || "application/octet-stream",
    savedAt: new Date().toISOString(),
    ...meta,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.objectStore(STORE_NAME).put(record);
  });
}

export async function getSupportFileBlob(sessionId, fileId) {
  if (!fileStorageAvailable() || !sessionId || !fileId) return null;
  const db = await openDb();
  const key = compositeKey(sessionId, fileId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => {
      db.close();
      resolve(request.result?.blob || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function hasSupportFileBlob(sessionId, fileId) {
  const blob = await getSupportFileBlob(sessionId, fileId);
  return Boolean(blob?.size);
}

export function downloadSupportFileBlob(blob, fileName) {
  if (!blob?.size) return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName || "file";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

import { remoteSupportEnabled } from "@/api/demoClient";

const DB_NAME = "smart-break-shift-demo-recordings-v1";
const STORE_NAME = "blobs";
const DB_VERSION = 1;

function compositeKey(sessionId, recordingId) {
  return `${sessionId}::${recordingId}`;
}

function recordingStorageAvailable() {
  return remoteSupportEnabled && typeof indexedDB !== "undefined";
}

function openDb() {
  if (!recordingStorageAvailable()) {
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
        store.createIndex("recordingId", "recordingId", { unique: false });
      }
    };
  });
}

/**
 * @param {{ sessionId: string, recordingId: string, blob: Blob, meta?: object }} payload
 */
export async function saveRecordingBlob({ sessionId, recordingId, blob, meta = {} }) {
  if (!recordingStorageAvailable() || !sessionId || !recordingId || !blob) return false;
  const db = await openDb();
  const key = compositeKey(sessionId, recordingId);
  const record = {
    key,
    sessionId,
    recordingId,
    blob,
    mimeType: blob.type || "video/webm",
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

export async function getRecordingBlob(sessionId, recordingId) {
  if (!recordingStorageAvailable() || !sessionId || !recordingId) return null;
  const db = await openDb();
  const key = compositeKey(sessionId, recordingId);
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

export async function hasRecordingBlob(sessionId, recordingId) {
  const blob = await getRecordingBlob(sessionId, recordingId);
  return Boolean(blob && blob.size > 0);
}

export async function deleteRecordingBlob(sessionId, recordingId) {
  if (!recordingStorageAvailable() || !sessionId || !recordingId) return false;
  const db = await openDb();
  const key = compositeKey(sessionId, recordingId);
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
    tx.objectStore(STORE_NAME).delete(key);
  });
}

/** @returns {Promise<Array<{ sessionId: string, recordingId: string, savedAt?: string }>>} */
export async function listStoredRecordingRefs() {
  if (!recordingStorageAvailable()) return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      db.close();
      const rows = Array.isArray(request.result) ? request.result : [];
      resolve(
        rows.map((row) => ({
          sessionId: row.sessionId,
          recordingId: row.recordingId,
          savedAt: row.savedAt,
        }))
      );
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function downloadRecordingBlob(blob, fileName) {
  if (!blob?.size) return false;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName || "recording.webm";
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

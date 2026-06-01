const DB_NAME = "smart-break-shift-training-docs-v1";
const STORE_NAME = "pdfs";
const DB_VERSION = 1;

function openDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
      }
    };
  });
}

/**
 * @param {string} sessionId
 * @param {Blob} blob — application/pdf
 */
export async function saveTrainingPdfBlob(sessionId, blob) {
  if (!sessionId || !blob?.size) return false;
  const db = await openDb();
  const record = {
    sessionId,
    blob,
    mimeType: blob.type || "application/pdf",
    savedAt: new Date().toISOString(),
    fileName: `${sessionId}.pdf`,
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

export async function getTrainingPdfBlob(sessionId) {
  if (!sessionId) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(sessionId);
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

export async function hasTrainingPdfBlob(sessionId) {
  const blob = await getTrainingPdfBlob(sessionId);
  return Boolean(blob && blob.size > 0);
}

export async function deleteTrainingPdfBlob(sessionId) {
  if (!sessionId) return false;
  const db = await openDb();
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
    tx.objectStore(STORE_NAME).delete(sessionId);
  });
}

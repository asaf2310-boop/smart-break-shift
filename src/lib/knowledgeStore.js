import { demoModeEnabled } from "@/api/demoClient";
import { dataClient } from "@/api/client";
import { isSupabaseBackend } from "@/api/dataClient";
import { shouldUseServerRag } from "@/lib/knowledge/knowledgeClient";

export const KNOWLEDGE_STORAGE_KEY = "smart-break-shift-knowledge-v1";
export const KNOWLEDGE_CHUNKS_KEY = "smart-break-shift-knowledge-chunks-v1";
export const KNOWLEDGE_CHANGE_EVENT = "knowledge-store-changed";
const KNOWLEDGE_LOCAL_DIRTY_KEY = "smart-break-shift-knowledge-local-dirty";

const DEFAULT_CATEGORIES = ["כללי", "מוצר", "נהלים", "תמיכה"];
const INDEX_ROW_ID = "default";

let memoryStore = null;
let memoryChunkIndex = undefined;
let hydratePromise = null;

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function seedDocuments() {
  const now = new Date().toISOString();
  return [
    {
      id: makeId("doc"),
      title: "מדיניות החזרות",
      category: "נהלים",
      content:
        "החזרות כספיות מתבצעות תוך 14 ימי עסקים ממועד אישור הבקשה. יש להציג חשבונית מקורית או אישור רכישה דיגיטלי. מוצרים פגומים — החזרה מלאה ללא עלות משלוח. שינוי דעת תוך 30 יום — דמי טיפול של 5% או מינימום 15 ש״ח.",
      sourceType: "text",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId("doc"),
      title: "שעות פעילות מוקד",
      category: "תמיכה",
      content:
        "מוקד טלפוני: א׳–ה׳ 08:00–20:00, ו׳ 08:00–13:00. צ'אט באתר: 24/7 עם בוט; נציג אנושי באותן שעות המוקד. חגים וערבי חג — סגור מהצהריים.",
      sourceType: "text",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId("doc"),
      title: "אפליקציית מובייל",
      category: "מוצר",
      content:
        "האפליקציה זמינה ב-iOS 15+ וב-Android 10+. התחברות עם OTP לנייד או סיסמה. ניתן לעקוב אחר משלוחים, לפתוח פניות ולשלם בכרטיס אשראי או Apple Pay / Google Pay.",
      sourceType: "text",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function mapDbRow(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category || "כללי",
    content: row.content,
    sourceType: row.source_type || "text",
    fileName: row.file_name || null,
    pages: row.pages || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocToDb(doc) {
  return {
    id: doc.id,
    title: doc.title,
    category: doc.category || "כללי",
    content: doc.content,
    source_type: doc.sourceType || "text",
    file_name: doc.fileName || null,
    pages: doc.pages || null,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

function readLocalStorageRaw() {
  try {
    const raw = localStorage.getItem(KNOWLEDGE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && Array.isArray(parsed.documents)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return {
    version: 1,
    documents: demoModeEnabled ? seedDocuments() : [],
  };
}

function readRaw() {
  if (memoryStore) return memoryStore;
  memoryStore = readLocalStorageRaw();
  return memoryStore;
}

function markKnowledgeLocalDirty() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KNOWLEDGE_LOCAL_DIRTY_KEY, Date.now().toString());
  } catch {
    // ignore
  }
}

function clearKnowledgeLocalDirty() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KNOWLEDGE_LOCAL_DIRTY_KEY);
  } catch {
    // ignore
  }
}

function isKnowledgeLocalDirty() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(localStorage.getItem(KNOWLEDGE_LOCAL_DIRTY_KEY));
  } catch {
    return false;
  }
}

function mergeKnowledgeDocuments(localDocs, cloudDocs) {
  const localMap = new Map((localDocs || []).map((doc) => [doc.id, doc]));
  const merged = new Map();

  for (const cloud of cloudDocs || []) {
    const local = localMap.get(cloud.id);
    if (!local) {
      merged.set(cloud.id, cloud);
      continue;
    }
    merged.set(
      cloud.id,
      new Date(local.updatedAt) >= new Date(cloud.updatedAt) ? local : cloud,
    );
    localMap.delete(cloud.id);
  }

  for (const local of localMap.values()) {
    merged.set(local.id, local);
  }

  return dedupeDocumentsByFileName([...merged.values()]);
}

function normalizeFileNameKey(fileName) {
  return String(fileName || "").trim().toLowerCase();
}

/** Keep newest upload per file name — prevents duplicate rows from retries. */
export function dedupeDocumentsByFileName(documents) {
  const withoutFile = [];
  const byFile = new Map();

  for (const doc of documents || []) {
    const key = normalizeFileNameKey(doc.fileName);
    if (!key) {
      withoutFile.push(doc);
      continue;
    }
    const existing = byFile.get(key);
    if (!existing || new Date(doc.updatedAt) >= new Date(existing.updatedAt)) {
      byFile.set(key, doc);
    }
  }

  return [...withoutFile, ...byFile.values()];
}

export function findKnowledgeDocumentByFileName(fileName) {
  const key = normalizeFileNameKey(fileName);
  if (!key) return null;
  return listKnowledgeDocuments().find((d) => normalizeFileNameKey(d.fileName) === key) || null;
}

function writeRaw(store) {
  memoryStore = { version: 1, documents: store.documents || [] };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(memoryStore));
    } catch (err) {
      if (err?.name === "QuotaExceededError") {
        throw new Error("local_storage_quota");
      }
      throw err;
    }
    markKnowledgeLocalDirty();
    window.dispatchEvent(new CustomEvent(KNOWLEDGE_CHANGE_EVENT));
  }
  persistDocumentsToCloud(memoryStore.documents)
    .catch((err) => {
      console.warn("[knowledgeStore] cloud persist failed", err);
    })
    .finally(() => {
      clearKnowledgeLocalDirty();
    });
}

async function persistDocumentsToCloud(documents) {
  if (demoModeEnabled || !isSupabaseBackend() || !dataClient.entities.KnowledgeDocument) {
    return;
  }

  // Production RAG writes knowledge_documents via /api/knowledge-upload — skip client POST to avoid 409 races.
  if (shouldUseServerRag()) {
    return;
  }

  const existing = await dataClient.entities.KnowledgeDocument.list("-updated_at", 500);
  const existingIds = new Set((existing || []).map((r) => r.id));
  const nextIds = new Set((documents || []).map((d) => d.id));

  for (const row of existing || []) {
    if (!nextIds.has(row.id)) {
      await dataClient.entities.KnowledgeDocument.delete(row.id);
    }
  }

  for (const doc of documents || []) {
    const payload = mapDocToDb(doc);
    if (existingIds.has(doc.id)) {
      await dataClient.entities.KnowledgeDocument.update(doc.id, payload);
      continue;
    }
    try {
      await dataClient.entities.KnowledgeDocument.create(payload);
      existingIds.add(doc.id);
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes("23505") || msg.includes("409") || /duplicate key/i.test(msg)) {
        await dataClient.entities.KnowledgeDocument.update(doc.id, payload);
        existingIds.add(doc.id);
        continue;
      }
      throw err;
    }
  }
}

async function persistChunkIndexToCloud(payload) {
  if (demoModeEnabled || !isSupabaseBackend() || !dataClient.entities.KnowledgeIndex) {
    return;
  }

  const row = {
    id: INDEX_ROW_ID,
    payload,
    updated_at: new Date().toISOString(),
  };

  const existing = await dataClient.entities.KnowledgeIndex.filter({ id: INDEX_ROW_ID });
  if (existing?.length) {
    await dataClient.entities.KnowledgeIndex.update(INDEX_ROW_ID, row);
  } else {
    await dataClient.entities.KnowledgeIndex.create(row);
  }
}

async function loadFromCloud() {
  if (demoModeEnabled || !isSupabaseBackend() || !dataClient.entities.KnowledgeDocument) {
    memoryStore = readLocalStorageRaw();
    memoryChunkIndex = readChunkIndexLocal();
    return { store: memoryStore, chunkIndex: memoryChunkIndex };
  }

  const local = readLocalStorageRaw();
  const localChunks = readChunkIndexLocal();

  try {
    const rows = await dataClient.entities.KnowledgeDocument.list("-updated_at", 500);
    const docs = (rows || []).map(mapDbRow);

    if (isKnowledgeLocalDirty()) {
      memoryStore = local;
    } else if (docs.length > 0 || local.documents.length > 0) {
      const merged = mergeKnowledgeDocuments(local.documents, docs);
      memoryStore = { version: 1, documents: merged };
      localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(memoryStore));
      const mergedFingerprint = getKnowledgeDocumentsFingerprint(merged);
      const cloudFingerprint = getKnowledgeDocumentsFingerprint(docs);
      if (mergedFingerprint !== cloudFingerprint) {
        markKnowledgeLocalDirty();
        try {
          await persistDocumentsToCloud(merged);
        } finally {
          clearKnowledgeLocalDirty();
        }
      }
    } else {
      memoryStore = { version: 1, documents: [] };
    }

    const indexRows = await dataClient.entities.KnowledgeIndex.filter({ id: INDEX_ROW_ID });
    const cloudIndex = indexRows?.[0]?.payload;
    if (isKnowledgeLocalDirty()) {
      memoryChunkIndex = localChunks;
    } else if (cloudIndex?.version === 1 && Array.isArray(cloudIndex.chunks)) {
      memoryChunkIndex = cloudIndex;
      localStorage.setItem(KNOWLEDGE_CHUNKS_KEY, JSON.stringify(cloudIndex));
    } else if (localChunks) {
      memoryChunkIndex = localChunks;
      await persistChunkIndexToCloud(localChunks);
    } else {
      memoryChunkIndex = null;
    }

    return { store: memoryStore, chunkIndex: memoryChunkIndex };
  } catch (err) {
    console.warn("[knowledgeStore] cloud load failed", err);
    memoryStore = local;
    memoryChunkIndex = localChunks;
    return { store: memoryStore, chunkIndex: memoryChunkIndex };
  }
}

function readChunkIndexLocal() {
  try {
    const raw = localStorage.getItem(KNOWLEDGE_CHUNKS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1 && Array.isArray(parsed.chunks)) return parsed;
  } catch {
    // ignore
  }
  return null;
}

/** טוען מסמכים ואינדקס RAG מ-Supabase */
export function hydrateKnowledgeStore() {
  if (!hydratePromise) {
    hydratePromise = loadFromCloud().finally(() => {
      window.dispatchEvent(new CustomEvent(KNOWLEDGE_CHANGE_EVENT));
    });
  }
  return hydratePromise;
}

export function invalidateKnowledgeStoreCache() {
  memoryStore = null;
  memoryChunkIndex = undefined;
  hydratePromise = null;
  return hydrateKnowledgeStore();
}

export function subscribeKnowledgeStore(callback) {
  const onStorage = (e) => {
    if (e.key === KNOWLEDGE_STORAGE_KEY || e.key === KNOWLEDGE_CHUNKS_KEY) {
      memoryStore = null;
      memoryChunkIndex = undefined;
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(KNOWLEDGE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(KNOWLEDGE_CHANGE_EVENT, callback);
  };
}

export function listKnowledgeDocuments() {
  const { documents } = readRaw();
  const deduped = dedupeDocumentsByFileName(documents);
  if (deduped.length !== documents.length && typeof window !== "undefined") {
    writeRaw({ version: 1, documents: deduped });
  }
  return [...deduped].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getKnowledgeDocument(id) {
  return readRaw().documents.find((d) => d.id === id) ?? null;
}

export function listKnowledgeCategories() {
  const docs = listKnowledgeDocuments();
  const fromDocs = new Set(docs.map((d) => d.category).filter(Boolean));
  DEFAULT_CATEGORIES.forEach((c) => fromDocs.add(c));
  return [...fromDocs].sort((a, b) => a.localeCompare(b, "he"));
}

export function upsertKnowledgeDocument({ id, title, content, category, sourceType, fileName, pages }) {
  const store = readRaw();
  const trimmedTitle = String(title || "").trim();
  const trimmedContent = String(content || "").trim();
  if (!trimmedTitle || !trimmedContent) {
    throw new Error("title_and_content_required");
  }

  const now = new Date().toISOString();
  const payload = {
    title: trimmedTitle,
    content: trimmedContent,
    category: category?.trim() || "כללי",
    sourceType: sourceType || "text",
    fileName: fileName || null,
    pages: Array.isArray(pages) && pages.length ? pages : null,
    updatedAt: now,
  };

  if (id) {
    const idx = store.documents.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error("not_found");
    store.documents[idx] = { ...store.documents[idx], ...payload };
  } else {
    store.documents.push({
      id: makeId("doc"),
      createdAt: now,
      ...payload,
    });
  }

  writeRaw(store);
  clearKnowledgeChunkIndex();
  return id ? store.documents.find((d) => d.id === id) : store.documents[store.documents.length - 1];
}

export function deleteKnowledgeDocument(id) {
  const store = readRaw();
  const before = store.documents.length;
  store.documents = store.documents.filter((d) => d.id !== id);
  if (store.documents.length === before) throw new Error("not_found");
  writeRaw(store);
  clearKnowledgeChunkIndex();

  if (!demoModeEnabled && isSupabaseBackend() && dataClient.entities.KnowledgeDocument) {
    dataClient.entities.KnowledgeDocument.delete(id).catch(() => {});
  }
}

export function resetKnowledgeToSeed() {
  const store = { version: 1, documents: demoModeEnabled ? seedDocuments() : [] };
  writeRaw(store);
  clearKnowledgeChunkIndex();
}

/** Bump when chunking / ingest logic changes so indexes rebuild automatically. */
const KNOWLEDGE_INDEX_VERSION = "rag-v4";

export function getKnowledgeDocumentsFingerprint(documents = listKnowledgeDocuments()) {
  const pageThumbCount = (d) =>
    Array.isArray(d.pages) ? d.pages.filter((p) => p?.thumbnail).length : 0;
  return `${KNOWLEDGE_INDEX_VERSION}|${documents
    .map((d) => `${d.id}:${d.updatedAt}:${(d.content || "").length}:${pageThumbCount(d)}`)
    .join("|")}`;
}

function readChunkIndexRaw() {
  if (memoryChunkIndex !== undefined) return memoryChunkIndex;
  memoryChunkIndex = readChunkIndexLocal();
  return memoryChunkIndex;
}

export function readKnowledgeChunkIndex() {
  return readChunkIndexRaw();
}

export function writeKnowledgeChunkIndex(chunks, fingerprint) {
  const payload = {
    version: 1,
    fingerprint: fingerprint || getKnowledgeDocumentsFingerprint(),
    updatedAt: new Date().toISOString(),
    chunks,
  };
  memoryChunkIndex = payload;
  localStorage.setItem(KNOWLEDGE_CHUNKS_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(KNOWLEDGE_CHANGE_EVENT));
  persistChunkIndexToCloud(payload).catch((err) => {
    console.warn("[knowledgeStore] chunk index cloud persist failed", err);
  });
}

export function clearKnowledgeChunkIndex() {
  memoryChunkIndex = null;
  try {
    localStorage.removeItem(KNOWLEDGE_CHUNKS_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(KNOWLEDGE_CHANGE_EVENT));
}

export function patchKnowledgeDocumentsContent(contentPatcher) {
  const store = readRaw();
  let changed = false;
  const now = new Date().toISOString();

  store.documents = store.documents.map((doc) => {
    const next = contentPatcher(doc.content);
    if (next === doc.content) return doc;
    changed = true;
    return { ...doc, content: next, updatedAt: now };
  });

  if (changed) writeRaw(store);
}

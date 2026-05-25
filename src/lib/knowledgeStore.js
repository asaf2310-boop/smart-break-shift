export const KNOWLEDGE_STORAGE_KEY = "smart-break-shift-knowledge-v1";
export const KNOWLEDGE_CHANGE_EVENT = "knowledge-store-changed";

const DEFAULT_CATEGORIES = ["כללי", "מוצר", "נהלים", "תמיכה"];

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

function readRaw() {
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
  const store = { version: 1, documents: seedDocuments() };
  writeRaw(store);
  return store;
}

function writeRaw(store) {
  localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(KNOWLEDGE_CHANGE_EVENT));
}

export function subscribeKnowledgeStore(callback) {
  const onStorage = (e) => {
    if (e.key === KNOWLEDGE_STORAGE_KEY) callback();
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
  return [...documents].sort(
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

export function upsertKnowledgeDocument({ id, title, content, category, sourceType, fileName }) {
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
  return id ? store.documents.find((d) => d.id === id) : store.documents[store.documents.length - 1];
}

export function deleteKnowledgeDocument(id) {
  const store = readRaw();
  const before = store.documents.length;
  store.documents = store.documents.filter((d) => d.id !== id);
  if (store.documents.length === before) throw new Error("not_found");
  writeRaw(store);
}

export function resetKnowledgeToSeed() {
  const store = { version: 1, documents: seedDocuments() };
  writeRaw(store);
}

/** One-time re-sanitize of stored document bodies (called from knowledgeAi on first chunk read). */
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

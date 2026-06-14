import presentationsSeed from "@/data/trainingPresentations.json";
import { demoModeEnabled } from "@/api/demoClient";
import { dataClient } from "@/api/client";
import { isSupabaseBackend } from "@/api/dataClient";
import { supabase, supabaseConfigured } from "@/api/supabase";
import {
  deleteTrainingPdfBlob,
  getTrainingPdfBlob,
  hasTrainingPdfBlob,
  saveTrainingPdfBlob,
} from "@/lib/trainingDocStore";

export const TRAINING_PRESENTATION_META_CHANGE_EVENT = "training-presentation-meta-changed";

export const TRAINING_DOCS_BUCKET = "training-docs";

/** הוראות כשה-bucket חסר בפרויקט Supabase (פרודקשן) */
export const TRAINING_BUCKET_SETUP_HINT =
  "צרו bucket בשם training-docs: Supabase → Storage → New bucket (Public), או הריצו supabase/training_docs_storage.sql ב-SQL Editor. פירוט: docs/TRAINING_STORAGE_SETUP.md";

const META_STORAGE_KEY = "training-presentation-meta-v1";
const DEFAULT_PUBLIC_SLIDE_BASE = "/training/slides";

let metaMapCache = null;
let metaHydratePromise = null;

function readMetaMapLocal() {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMetaMapLocal(map) {
  localStorage.setItem(META_STORAGE_KEY, JSON.stringify(map));
}

function notifyMetaChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TRAINING_PRESENTATION_META_CHANGE_EVENT));
  }
}

function readMetaMap() {
  if (metaMapCache) return metaMapCache;
  metaMapCache = readMetaMapLocal();
  return metaMapCache;
}

async function persistMetaRowToCloud(sessionId, meta) {
  if (demoModeEnabled || !isSupabaseBackend() || !dataClient.entities.TrainingPresentationMeta) {
    return;
  }

  const payload = {
    id: sessionId,
    meta,
    updated_at: new Date().toISOString(),
  };

  const existing = await dataClient.entities.TrainingPresentationMeta.filter({ id: sessionId });
  if (existing?.length) {
    await dataClient.entities.TrainingPresentationMeta.update(sessionId, payload);
  } else {
    await dataClient.entities.TrainingPresentationMeta.create(payload);
  }
}

async function deleteMetaRowFromCloud(sessionId) {
  if (demoModeEnabled || !isSupabaseBackend() || !dataClient.entities.TrainingPresentationMeta) {
    return;
  }
  try {
    await dataClient.entities.TrainingPresentationMeta.delete(sessionId);
  } catch {
    // row may not exist
  }
}

async function loadMetaFromCloud() {
  if (demoModeEnabled || !isSupabaseBackend() || !dataClient.entities.TrainingPresentationMeta) {
    metaMapCache = readMetaMapLocal();
    return metaMapCache;
  }

  const local = readMetaMapLocal();
  const localKeys = Object.keys(local);

  try {
    const rows = await dataClient.entities.TrainingPresentationMeta.list("-updated_at", 500);
    const map = {};
    for (const row of rows || []) {
      if (row?.id && row.meta) map[row.id] = row.meta;
    }

    if (Object.keys(map).length > 0) {
      metaMapCache = map;
      writeMetaMapLocal(map);
      return map;
    }

    if (localKeys.length > 0) {
      metaMapCache = local;
      await Promise.all(
        localKeys.map((sessionId) => persistMetaRowToCloud(sessionId, local[sessionId]))
      );
      return local;
    }

    metaMapCache = map;
    return map;
  } catch (err) {
    console.warn("[trainingPresentations] cloud meta load failed", err);
    metaMapCache = readMetaMapLocal();
    return metaMapCache;
  }
}

/** טוען קישורים ומטא-דאטה למצגות מ-Supabase */
export function hydrateTrainingPresentationMeta() {
  if (!metaHydratePromise) {
    metaHydratePromise = loadMetaFromCloud().finally(() => notifyMetaChanged());
  }
  return metaHydratePromise;
}

/** רענון מ-Supabase Realtime */
export function invalidateTrainingPresentationCache() {
  metaMapCache = null;
  metaHydratePromise = null;
  return hydrateTrainingPresentationMeta();
}

function writeMetaMap(map) {
  metaMapCache = { ...map };
  writeMetaMapLocal(metaMapCache);
  notifyMetaChanged();
}

/** @param {{ message?: string; statusCode?: number; status?: number }} | null | undefined error */
export function isStorageBucketMissingError(error) {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const status = error.statusCode ?? error.status;
  return (
    msg.includes("bucket not found") ||
    msg.includes("bucket does not exist") ||
    (status === 404 && msg.includes("bucket"))
  );
}

async function savePresentationLocally(sessionId, file) {
  await saveTrainingPdfBlob(sessionId, file);
  setPresentationMeta(sessionId, {
    source: "indexeddb",
    fileName: file.name,
  });
}

export function getStaticPresentationPath(sessionId) {
  const fromSeed = presentationsSeed.presentations?.[sessionId];
  if (fromSeed) return fromSeed;
  return `${DEFAULT_PUBLIC_SLIDE_BASE}/${sessionId}.pdf`;
}

export function getPresentationMeta(sessionId) {
  const map = readMetaMap();
  return map[sessionId] ?? null;
}

export function setPresentationMeta(sessionId, meta) {
  const map = readMetaMap();
  const next = { ...(map[sessionId] ?? {}), ...meta, updatedAt: new Date().toISOString() };
  map[sessionId] = next;
  writeMetaMap(map);
  persistMetaRowToCloud(sessionId, next).catch((err) => {
    console.warn("[trainingPresentations] cloud meta persist failed", err);
  });
}

export function clearPresentationMeta(sessionId) {
  const map = readMetaMap();
  delete map[sessionId];
  writeMetaMap(map);
  deleteMetaRowFromCloud(sessionId).catch((err) => {
    console.warn("[trainingPresentations] cloud meta delete failed", err);
  });
}

const HTTP_URL_PATTERN = /^https?:\/\/.+/i;

export function isValidTrainingUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!HTTP_URL_PATTERN.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getExternalLink(sessionId) {
  if (!sessionId) return null;
  const meta = getPresentationMeta(sessionId);
  if (meta?.externalUrl && isValidTrainingUrl(meta.externalUrl)) {
    return meta.externalUrl.trim();
  }
  const fromSeed = presentationsSeed.links?.[sessionId];
  if (fromSeed && isValidTrainingUrl(fromSeed)) {
    return String(fromSeed).trim();
  }
  return null;
}

export function setExternalLink(sessionId, url) {
  if (!sessionId) {
    return { ok: false, message: "חסר מזהה מפגש" };
  }
  const trimmed = String(url || "").trim();
  if (!trimmed) {
    return { ok: false, message: "הזינו כתובת קישור" };
  }
  if (!isValidTrainingUrl(trimmed)) {
    return {
      ok: false,
      message: "כתובת לא תקינה",
      description: "רק קישורי http או https נתמכים (לדוגמה: https://example.com)",
    };
  }
  setPresentationMeta(sessionId, { externalUrl: trimmed });
  return { ok: true, message: "הקישור נשמר" };
}

export function removeExternalLink(sessionId) {
  if (!sessionId) return { ok: false };
  const meta = getPresentationMeta(sessionId);
  if (!meta) return { ok: true };
  const { externalUrl: _removed, ...rest } = meta;
  const map = readMetaMap();
  if (Object.keys(rest).filter((k) => k !== "updatedAt").length === 0) {
    delete map[sessionId];
    writeMetaMap(map);
    deleteMetaRowFromCloud(sessionId).catch(() => {});
  } else {
    const next = { ...rest, updatedAt: new Date().toISOString() };
    map[sessionId] = next;
    writeMetaMap(map);
    persistMetaRowToCloud(sessionId, next).catch(() => {});
  }
  return { ok: true, message: "הקישור הוסר" };
}

export async function listPresentationAvailability(sessionIds) {
  const result = {};
  await Promise.all(
    sessionIds.map(async (sessionId) => {
      const [hasPdf, hasUrl] = await Promise.all([
        hasPresentationSource(sessionId),
        Promise.resolve(Boolean(getExternalLink(sessionId))),
      ]);
      result[sessionId] = { hasPdf, hasUrl };
    })
  );
  return result;
}

export async function hasPresentationSource(sessionId) {
  if (!sessionId) return false;
  const meta = getPresentationMeta(sessionId);
  if (meta?.source === "indexeddb") {
    return hasTrainingPdfBlob(sessionId);
  }
  if (meta?.source === "supabase" && meta?.storagePath) {
    return true;
  }
  if (presentationsSeed.presentations?.[sessionId]) {
    return true;
  }
  const blob = await getTrainingPdfBlob(sessionId);
  if (blob?.size) return true;
  if (await probeSupabasePublicPdf(sessionId)) return true;
  return probePublicPdf(sessionId);
}

async function probeSupabasePublicPdf(sessionId) {
  if (!supabaseConfigured || !supabase) return false;
  const storagePath = `${sessionId}.pdf`;
  const { data } = supabase.storage.from(TRAINING_DOCS_BUCKET).getPublicUrl(storagePath);
  if (!data?.publicUrl) return false;
  try {
    const res = await fetch(data.publicUrl, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function probePublicPdf(sessionId) {
  const url = getStaticPresentationPath(sessionId);
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve PDF for viewer: { kind: 'url'|'blob', url?, blob?, fileName? }
 */
export async function resolvePresentationSource(sessionId) {
  if (!sessionId) return null;

  const meta = getPresentationMeta(sessionId);

  if (meta?.source === "indexeddb" || (!meta && (await hasTrainingPdfBlob(sessionId)))) {
    const blob = await getTrainingPdfBlob(sessionId);
    if (blob?.size) {
      return { kind: "blob", blob, fileName: meta?.fileName || `${sessionId}.pdf` };
    }
  }

  if (meta?.source === "supabase" && meta.storagePath && supabaseConfigured && supabase) {
    const { data } = supabase.storage.from(TRAINING_DOCS_BUCKET).getPublicUrl(meta.storagePath);
    if (data?.publicUrl) {
      return { kind: "url", url: data.publicUrl, fileName: meta.fileName };
    }
  }

  if (supabaseConfigured && supabase) {
    const storagePath = `${sessionId}.pdf`;
    const { data } = supabase.storage.from(TRAINING_DOCS_BUCKET).getPublicUrl(storagePath);
    if (data?.publicUrl && (await probeSupabasePublicPdf(sessionId))) {
      return { kind: "url", url: data.publicUrl, fileName: `${sessionId}.pdf` };
    }
  }

  const staticPath = presentationsSeed.presentations?.[sessionId] || getStaticPresentationPath(sessionId);
  if (await probePublicPdf(sessionId)) {
    return { kind: "url", url: staticPath, fileName: `${sessionId}.pdf` };
  }

  return null;
}

/**
 * Browser URL for opening the training PDF in a new tab (agents).
 * Supports Supabase public URLs, static paths, and IndexedDB blob URLs (same session).
 */
export async function resolvePresentationOpenUrl(sessionId) {
  const resolved = await resolvePresentationSource(sessionId);
  if (!resolved) return null;

  if (resolved.kind === "url" && resolved.url) {
    const url = resolved.url;
    if (/^https?:\/\//i.test(url) || url.startsWith("blob:")) {
      return url;
    }
    try {
      return new URL(url, typeof window !== "undefined" ? window.location.origin : undefined).href;
    } catch {
      return url;
    }
  }

  if (resolved.kind === "blob" && resolved.blob?.size) {
    return URL.createObjectURL(resolved.blob);
  }

  return null;
}

export async function uploadTrainingPresentation(sessionId, file) {
  if (!sessionId || !file) {
    return { ok: false, message: "חסר מזהה מפגש או קובץ" };
  }

  const name = String(file.name || "").toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isPptx =
    name.endsWith(".pptx") ||
    name.endsWith(".ppt") ||
    file.type.includes("presentation");

  if (isPptx && !isPdf) {
    return {
      ok: false,
      message: "ייצוא ל-PDF נדרש",
      description:
        "העלאת PowerPoint אינה נתמכת בדפדפן. ייצאו את המצגת כ-PDF (קובץ → שמירה בשם → PDF) והעלו מחדש.",
    };
  }

  if (!isPdf) {
    return { ok: false, message: "רק קובצי PDF נתמכים כרגע" };
  }

  if (supabaseConfigured && supabase) {
    const storagePath = `${sessionId}.pdf`;
    const { error } = await supabase.storage
      .from(TRAINING_DOCS_BUCKET)
      .upload(storagePath, file, { upsert: true, contentType: "application/pdf" });

    if (error) {
      if (isStorageBucketMissingError(error)) {
        await savePresentationLocally(sessionId, file);
        return {
          ok: true,
          message: "נשמר בדפדפן זה בלבד — bucket לא קיים",
          description: `ה-bucket «${TRAINING_DOCS_BUCKET}» לא נמצא ב-Supabase. הנציגים לא יראו את הקובץ עד שייווצר. ${TRAINING_BUCKET_SETUP_HINT}`,
          source: "indexeddb",
          storageWarning: "bucket_missing",
        };
      }
      return {
        ok: false,
        message: "שגיאה בהעלאה ל-Supabase",
        description: error.message || TRAINING_BUCKET_SETUP_HINT,
      };
    }

    setPresentationMeta(sessionId, {
      source: "supabase",
      storagePath,
      fileName: file.name,
    });
    await saveTrainingPdfBlob(sessionId, file);

    return { ok: true, message: "המצגת נשמרה בענן (Supabase)", source: "supabase" };
  }

  await savePresentationLocally(sessionId, file);

  return {
    ok: true,
    message: "נשמר בדפדפן (מקומי). לפריסה קבועה: העתיקו ל-public/training/slides או הגדירו Supabase.",
    source: "indexeddb",
  };
}

export async function removeTrainingPresentation(sessionId) {
  await deleteTrainingPdfBlob(sessionId);

  const meta = getPresentationMeta(sessionId);
  if (meta) {
    const { source: _s, storagePath: _p, fileName: _f, ...rest } = meta;
    const map = readMetaMap();
    const kept = Object.keys(rest).filter((k) => k !== "updatedAt");
    if (kept.length === 0) {
      delete map[sessionId];
    } else {
      map[sessionId] = { ...rest, updatedAt: new Date().toISOString() };
    }
    writeMetaMap(map);
  }

  if (supabaseConfigured && supabase) {
    const storagePath = `${sessionId}.pdf`;
    await supabase.storage.from(TRAINING_DOCS_BUCKET).remove([storagePath]);
  }

  return { ok: true, message: "המצגת הוסרה (קובץ סטטי ב-public לא נמחק)" };
}

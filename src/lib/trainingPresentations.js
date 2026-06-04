import presentationsSeed from "@/data/trainingPresentations.json";
import { supabase, supabaseConfigured } from "@/api/supabase";
import {
  deleteTrainingPdfBlob,
  getTrainingPdfBlob,
  hasTrainingPdfBlob,
  saveTrainingPdfBlob,
} from "@/lib/trainingDocStore";

export const TRAINING_DOCS_BUCKET = "training-docs";

/** הוראות כשה-bucket חסר בפרויקט Supabase (פרודקשן) */
export const TRAINING_BUCKET_SETUP_HINT =
  "צרו bucket בשם training-docs: Supabase → Storage → New bucket (Public), או הריצו supabase/training_docs_storage.sql ב-SQL Editor. פירוט: docs/TRAINING_STORAGE_SETUP.md";

const META_STORAGE_KEY = "training-presentation-meta-v1";
const DEFAULT_PUBLIC_SLIDE_BASE = "/training/slides";

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

function readMetaMap() {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMetaMap(map) {
  localStorage.setItem(META_STORAGE_KEY, JSON.stringify(map));
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
  map[sessionId] = { ...(map[sessionId] ?? {}), ...meta, updatedAt: new Date().toISOString() };
  writeMetaMap(map);
}

export function clearPresentationMeta(sessionId) {
  const map = readMetaMap();
  delete map[sessionId];
  writeMetaMap(map);
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
  } else {
    map[sessionId] = { ...rest, updatedAt: new Date().toISOString() };
  }
  writeMetaMap(map);
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
  return probePublicPdf(sessionId);
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

  const staticPath = presentationsSeed.presentations?.[sessionId] || getStaticPresentationPath(sessionId);
  if (await probePublicPdf(sessionId)) {
    return { kind: "url", url: staticPath, fileName: `${sessionId}.pdf` };
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

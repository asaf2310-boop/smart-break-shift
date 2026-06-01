import presentationsSeed from "@/data/trainingPresentations.json";
import { supabase, supabaseConfigured } from "@/api/supabase";
import {
  deleteTrainingPdfBlob,
  getTrainingPdfBlob,
  hasTrainingPdfBlob,
  saveTrainingPdfBlob,
} from "@/lib/trainingDocStore";

export const TRAINING_DOCS_BUCKET = "training-docs";
const META_STORAGE_KEY = "training-presentation-meta-v1";
const DEFAULT_PUBLIC_SLIDE_BASE = "/training/slides";

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
  map[sessionId] = { ...meta, updatedAt: new Date().toISOString() };
  writeMetaMap(map);
}

export function clearPresentationMeta(sessionId) {
  const map = readMetaMap();
  delete map[sessionId];
  writeMetaMap(map);
}

export async function listPresentationAvailability(sessionIds) {
  const result = {};
  await Promise.all(
    sessionIds.map(async (sessionId) => {
      result[sessionId] = await hasPresentationSource(sessionId);
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
      return { ok: false, message: error.message || "שגיאה בהעלאה ל-Supabase" };
    }

    setPresentationMeta(sessionId, {
      source: "supabase",
      storagePath,
      fileName: file.name,
    });
    await saveTrainingPdfBlob(sessionId, file);

    return { ok: true, message: "המצגת נשמרה בענן (Supabase)", source: "supabase" };
  }

  await saveTrainingPdfBlob(sessionId, file);
  setPresentationMeta(sessionId, {
    source: "indexeddb",
    fileName: file.name,
  });

  return {
    ok: true,
    message: "נשמר בדפדפן (מקומי). לפריסה קבועה: העתיקו ל-public/training/slides או הגדירו Supabase.",
    source: "indexeddb",
  };
}

export async function removeTrainingPresentation(sessionId) {
  await deleteTrainingPdfBlob(sessionId);
  clearPresentationMeta(sessionId);

  if (supabaseConfigured && supabase) {
    const storagePath = `${sessionId}.pdf`;
    await supabase.storage.from(TRAINING_DOCS_BUCKET).remove([storagePath]);
  }

  return { ok: true, message: "הקישור המקומי הוסר (קובץ סטטי ב-public לא נמחק)" };
}

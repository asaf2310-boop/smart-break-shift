/** Document upload orchestration — local store + optional pgvector ingest. */

import { upsertKnowledgeDocument, deleteKnowledgeDocument } from "@/lib/knowledgeStore";
import { sanitizeMarkdownIngestText } from "@/lib/knowledgeAi";
import {
  slimPageThumbnailsForUpload,
  stripPageThumbnailsForStorage,
} from "@/lib/knowledge/textExtractionService";
import {
  shouldUseServerRag,
  ingestServerDocument,
  ingestServerDocumentPages,
  deleteServerDocument,
  reprocessServerDocument,
  getKnowledgeTenantId,
  PAGE_INGEST_BATCH,
  importHypPayPackage as importHypPayServer,
} from "@/lib/knowledge/knowledgeClient";

export function formatKnowledgeIngestError(err) {
  const msg = String(err?.message || err || "");
  if (msg === "ingest_timeout" || msg.includes("aborted")) {
    return "העיבוד בשרת ארך זמן רב מדי. נסו שוב או המתינו דקה ולחצו «עיבוד מחדש».";
  }
  if (msg === "ingest_network" || msg.includes("fetch failed") || msg === "network") {
    return "שגיאת רשת בשמירה לשרת. בדקו חיבור, נסו שוב, או לחצו «עיבוד מחדש». אם הבעיה חוזרת — ודאו ש-GEMINI_API_KEY ו-SUPABASE_SERVICE_ROLE_KEY מוגדרים ב-Vercel.";
  }
  if (msg === "supabase_connection_failed") {
    return "לא ניתן להתחבר ל-Supabase מהשרת. ב-Vercel הגדירו SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (מפתח service_role) ופרסו מחדש.";
  }
  if (msg === "knowledge_schema_not_migrated") {
    return "טבלאות בסיס הידע חסרות ב-Supabase — הרץ knowledge.sql, knowledge_pgvector.sql ו-knowledge_gemini_migration.sql ב-SQL Editor.";
  }
  if (msg === "forbidden" || msg === "pgvector_not_configured") {
    return "שרת הידע לא מוגדר או נחסם (בדקו משתני סביבה ב-Vercel ופריסה מחדש).";
  }
  if (msg.startsWith("ingest_http_403")) {
    return "הגישה לשרת נחסמה — רעננו את הדף ונסו שוב.";
  }
  if (msg.includes("foreign key constraint") || msg.includes("knowledge_images_document_id_fkey")) {
    return "שמירת תמונות העמודים נכשלה — נסו «עיבוד מחדש» מהרשימה.";
  }
  if (msg === "ingest_pages_failed") {
    return "טקסט נשמר בשרת אך העלאת תמונות העמודים נכשלה. נסו «עיבוד מחדש».";
  }
  if (msg === "document_too_large") {
    return "המסמך גדול מדי לשרת (הקטינו PDF או פצלו לקבצים קטנים יותר).";
  }
  if (msg === "local_storage_quota") {
    return "אין מספיק מקום בדפדפן. מחקו מסמכים ישנים ונסו שוב.";
  }
  if (msg === "pgvector_not_configured") {
    return "שרת RAG לא מוגדר (SUPABASE_SERVICE_ROLE_KEY ב-Vercel).";
  }
  return msg || "לא ניתן לעבד בשרת";
}

let saveInFlight = null;

async function uploadPageThumbnailsToServer(doc, pagesWithThumbs, { runOcr = true, content = "" } = {}) {
  if (!pagesWithThumbs?.length) return { imageCount: 0, chunkCount: null };

  const tenantId = doc.tenantId ?? getKnowledgeTenantId();
  let totalImages = 0;
  let lastChunkCount = null;

  for (let offset = 0; offset < pagesWithThumbs.length; offset += PAGE_INGEST_BATCH) {
    const batch = pagesWithThumbs.slice(offset, offset + PAGE_INGEST_BATCH);
    const result = await ingestServerDocumentPages({
      documentId: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      category: doc.category,
      content,
      tenantId,
      pages: batch,
      replaceAll: offset === 0,
      runOcr,
    });
    totalImages += result?.imageCount ?? 0;
    if (result?.chunkCount != null) lastChunkCount = result.chunkCount;
  }

  return { imageCount: totalImages, chunkCount: lastChunkCount };
}

/**
 * Save document locally and ingest to pgvector when server RAG is active.
 */
export async function saveKnowledgeDocument(payload) {
  if (saveInFlight) {
    return saveInFlight;
  }

  saveInFlight = (async () => {
  const pagesForIngest = payload.pages?.length
    ? await slimPageThumbnailsForUpload(payload.pages)
    : null;
  const pagesForStorage = stripPageThumbnailsForStorage(pagesForIngest || payload.pages);
  const pagesWithThumbs = pagesForIngest?.filter((p) => p?.thumbnail) || [];
  const sanitizedContent = sanitizeMarkdownIngestText(payload.content);

  const doc = upsertKnowledgeDocument({
    ...payload,
    pages: pagesForStorage,
    content: sanitizedContent,
  });

  const needsServerOcr = payload.needsServerOcr === true;

  if (!shouldUseServerRag()) {
    return { doc, ingestResult: null, ingestError: null };
  }

  try {
    const ingestResult = await ingestServerDocument({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      category: doc.category,
      sourceType: doc.sourceType,
      fileName: doc.fileName,
      pages: pagesForStorage,
      images: payload.images,
      tenantId: payload.tenantId ?? getKnowledgeTenantId(),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      skipImages: true,
    });

    if (pagesWithThumbs.length) {
      try {
        const pageUpload = await uploadPageThumbnailsToServer(
          { ...doc, needsServerOcr },
          pagesWithThumbs,
          { runOcr: needsServerOcr, content: sanitizedContent },
        );
        ingestResult.imageCount = pageUpload.imageCount;
        if (pageUpload.chunkCount != null) {
          ingestResult.chunkCount = pageUpload.chunkCount;
        }
      } catch (pageErr) {
        return { doc, ingestResult, ingestError: pageErr };
      }
    }

    return { doc, ingestResult, ingestError: null };
  } catch (err) {
    return { doc, ingestResult: null, ingestError: err };
  }
  })();

  try {
    return await saveInFlight;
  } finally {
    saveInFlight = null;
  }
}

export async function removeKnowledgeDocument(id) {
  let serverWarning = null;

  if (shouldUseServerRag()) {
    try {
      await deleteServerDocument(id);
    } catch (err) {
      const msg = String(err?.message || err || "");
      const serverUnavailable =
        msg.includes("pgvector_not_configured") ||
        msg.includes("delete_failed") ||
        msg.includes("503") ||
        msg.includes("network") ||
        msg.includes("fetch");
      if (!serverUnavailable) throw err;
      serverWarning =
        "המסמך נמחק מהממשק. שרת RAG לא זמין — הגדר SUPABASE_SERVICE_ROLE_KEY ב-Vercel.";
    }
  }

  deleteKnowledgeDocument(id);
  return { serverWarning };
}

export async function reprocessKnowledgeDocument(id, docFromStore, { pagesWithThumbnails } = {}) {
  if (shouldUseServerRag()) {
    if (docFromStore) {
      const pagesForStorage = stripPageThumbnailsForStorage(
        pagesWithThumbnails || docFromStore.pages,
      );
      const result = await ingestServerDocument({
        id: docFromStore.id,
        title: docFromStore.title,
        content: docFromStore.content,
        category: docFromStore.category,
        sourceType: docFromStore.sourceType,
        fileName: docFromStore.fileName,
        pages: pagesForStorage,
        createdAt: docFromStore.createdAt,
        updatedAt: docFromStore.updatedAt,
        skipImages: true,
      });

      const thumbs = pagesWithThumbnails?.filter((p) => p?.thumbnail) || [];
      if (thumbs.length) {
        const slim = await slimPageThumbnailsForUpload(thumbs);
        result.imageCount = await uploadPageThumbnailsToServer(docFromStore, slim);
      }

      return result;
    }
    return reprocessServerDocument(id);
  }
  return null;
}

const HYP_PAY_DOC_ID = "hyp-pay-api-documentation";

export async function importHypPayKnowledgePackage() {
  if (!shouldUseServerRag()) {
    throw new Error("pgvector_not_configured");
  }

  const ingestResult = await importHypPayServer();
  const doc = upsertKnowledgeDocument({
    id: HYP_PAY_DOC_ID,
    title: "HYP Pay — מדריך API",
    category: "תשלומים",
    content: "מדריך HYP Pay API — תוכן מלא בשרת.",
    sourceType: "package",
    fileName: "HYP_Pay_RAG_Clean_RTL_Fixed.json",
  });

  return { doc, ingestResult };
}

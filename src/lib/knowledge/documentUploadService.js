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
} from "@/lib/knowledge/knowledgeClient";

export function formatKnowledgeIngestError(err) {
  const msg = String(err?.message || err || "");
  if (msg === "ingest_timeout" || msg.includes("aborted")) {
    return "העיבוד בשרת ארך זמן רב מדי. נסו שוב או המתינו דקה ולחצו «עיבוד מחדש».";
  }
  if (msg === "ingest_network" || msg.includes("fetch failed") || msg === "network") {
    return "שגיאת רשת בשמירה לשרת. המסמך נשמר מקומית — נסו «עיבוד מחדש» מהרשימה.";
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

async function uploadPageThumbnailsToServer(doc, pagesWithThumbs) {
  if (!pagesWithThumbs?.length) return 0;

  const tenantId = doc.tenantId ?? getKnowledgeTenantId();
  let totalImages = 0;

  for (let offset = 0; offset < pagesWithThumbs.length; offset += PAGE_INGEST_BATCH) {
    const batch = pagesWithThumbs.slice(offset, offset + PAGE_INGEST_BATCH);
    const result = await ingestServerDocumentPages({
      documentId: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      tenantId,
      pages: batch,
      replaceAll: offset === 0,
    });
    totalImages += result?.imageCount ?? 0;
  }

  return totalImages;
}

/**
 * Save document locally and ingest to pgvector when server RAG is active.
 */
export async function saveKnowledgeDocument(payload) {
  const pagesForIngest = payload.pages?.length
    ? await slimPageThumbnailsForUpload(payload.pages)
    : null;
  const pagesForStorage = stripPageThumbnailsForStorage(pagesForIngest || payload.pages);
  const pagesWithThumbs = pagesForIngest?.filter((p) => p?.thumbnail) || [];

  const doc = upsertKnowledgeDocument({
    ...payload,
    pages: pagesForStorage,
    content: sanitizeMarkdownIngestText(payload.content),
  });

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
        ingestResult.imageCount = await uploadPageThumbnailsToServer(doc, pagesWithThumbs);
      } catch (pageErr) {
        return { doc, ingestResult, ingestError: pageErr };
      }
    }

    return { doc, ingestResult, ingestError: null };
  } catch (err) {
    return { doc, ingestResult: null, ingestError: err };
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

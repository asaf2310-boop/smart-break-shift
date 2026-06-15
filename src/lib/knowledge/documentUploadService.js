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
  deleteServerDocument,
  reprocessServerDocument,
  getKnowledgeTenantId,
} from "@/lib/knowledge/knowledgeClient";

export function formatKnowledgeIngestError(err) {
  const msg = String(err?.message || err || "");
  if (msg === "ingest_timeout" || msg.includes("aborted")) {
    return "העיבוד בשרת ארך זמן רב מדי. נסו שוב או המתינו דקה ולחצו «עיבוד מחדש».";
  }
  if (msg === "ingest_network" || msg.includes("fetch failed") || msg === "network") {
    return "שגיאת רשת בשמירה לשרת. המסמך נשמר מקומית — נסו «עיבוד מחדש» מהרשימה.";
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

/**
 * Save document locally and ingest to pgvector when server RAG is active.
 */
export async function saveKnowledgeDocument(payload) {
  const pagesForIngest = payload.pages?.length
    ? await slimPageThumbnailsForUpload(payload.pages)
    : null;
  const pagesForStorage = stripPageThumbnailsForStorage(pagesForIngest || payload.pages);

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
      pages: pagesForIngest,
      images: payload.images,
      tenantId: payload.tenantId ?? getKnowledgeTenantId(),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
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

export async function reprocessKnowledgeDocument(id, docFromStore) {
  if (shouldUseServerRag()) {
    if (docFromStore) {
      return ingestServerDocument({
        id: docFromStore.id,
        title: docFromStore.title,
        content: docFromStore.content,
        category: docFromStore.category,
        sourceType: docFromStore.sourceType,
        fileName: docFromStore.fileName,
        pages: docFromStore.pages,
        createdAt: docFromStore.createdAt,
        updatedAt: docFromStore.updatedAt,
      });
    }
    return reprocessServerDocument(id);
  }
  return null;
}

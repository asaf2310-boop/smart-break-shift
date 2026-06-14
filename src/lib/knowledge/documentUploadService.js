/** Document upload orchestration — local store + optional pgvector ingest. */

import { upsertKnowledgeDocument, deleteKnowledgeDocument } from "@/lib/knowledgeStore";
import { sanitizeMarkdownIngestText } from "@/lib/knowledgeAi";
import {
  shouldUseServerRag,
  ingestServerDocument,
  deleteServerDocument,
  reprocessServerDocument,
  getKnowledgeTenantId,
} from "@/lib/knowledge/knowledgeClient";

/**
 * Save document locally and ingest to pgvector when server RAG is active.
 */
export async function saveKnowledgeDocument(payload) {
  const doc = upsertKnowledgeDocument({
    ...payload,
    content: sanitizeMarkdownIngestText(payload.content),
  });

  if (shouldUseServerRag()) {
    const ingestResult = await ingestServerDocument({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      category: doc.category,
      sourceType: doc.sourceType,
      fileName: doc.fileName,
      pages: doc.pages,
      images: payload.images,
      tenantId: payload.tenantId ?? getKnowledgeTenantId(),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
    return { doc, ingestResult };
  }

  return { doc, ingestResult: null };
}

export async function removeKnowledgeDocument(id) {
  if (shouldUseServerRag()) {
    await deleteServerDocument(id);
  }
  deleteKnowledgeDocument(id);
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

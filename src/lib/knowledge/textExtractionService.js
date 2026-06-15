/** Re-export text extraction for modular knowledge ingest. */
export {
  extractTextFromFile,
  sanitizeKnowledgeText,
  buildPdfDocumentContent,
  stripPageThumbnailsForStorage,
  slimPageThumbnailsForUpload,
  MAX_KNOWLEDGE_FILE_BYTES,
} from "@/lib/knowledgeFileExtract";

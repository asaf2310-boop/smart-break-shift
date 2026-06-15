/**
 * Chunking service — re-exports from knowledgeAi (client-side index builder).
 * Server mirror: server/knowledge/chunkingService.js
 */
export {
  chunkDocument,
  splitIntoSemanticBlocks,
  sanitizeChunkText,
  normalizeHebrewText,
  sanitizeMarkdownIngestText,
} from "@/lib/knowledgeAi";
export { normalizeExtractedDocumentText } from "@/lib/knowledge/textExtractionNormalize";

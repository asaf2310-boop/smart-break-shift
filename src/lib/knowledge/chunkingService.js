/**
 * Chunking service — re-exports from knowledgeAi (client-side index builder).
 * Server mirror: api/lib/knowledge/chunkingService.js
 */
export {
  chunkDocument,
  sanitizeChunkText,
  normalizeHebrewText,
  sanitizeMarkdownIngestText,
} from "@/lib/knowledgeAi";

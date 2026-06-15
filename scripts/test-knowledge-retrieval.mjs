/**
 * Local retrieval smoke test — run with env vars from Vercel/Supabase:
 *   node scripts/test-knowledge-retrieval.mjs "מה זה 3DS?"
 */
import { embedQuery } from "../server/knowledge/embeddingService.js";
import { hybridSearch } from "../server/knowledge/hybridSearchService.js";
import { extractSearchTerms, scoreChunkKeywordMatch } from "../server/knowledge/queryTermsService.js";
import { isPgVectorConfigured } from "../server/knowledge/supabaseAdmin.js";
import { isEmbeddingConfigured } from "../server/knowledge/embeddingService.js";

const query = process.argv[2] || "מה זה 3DS?";

async function main() {
  console.log("Query:", query);
  console.log("Terms:", extractSearchTerms(query));
  console.log("pgvector:", isPgVectorConfigured(), "embeddings:", isEmbeddingConfigured());

  if (!isPgVectorConfigured() || !isEmbeddingConfigured()) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY or GEMINI_API_KEY");
    process.exit(1);
  }

  const { embedding, error: embedErr } = await embedQuery(query);
  if (embedErr || !embedding) {
    console.error("embed failed:", embedErr);
    process.exit(1);
  }
  console.log("Embedding dims:", embedding.length);

  const result = await hybridSearch(query, embedding, { topK: 5, tenantId: null });
  console.log("\n--- hybrid result ---");
  console.log("passesThreshold:", result.passesThreshold);
  console.log("confidence:", result.confidence);
  console.log("searchTerms:", result.searchTerms);
  console.log("error:", result.error);

  for (const [i, hit] of (result.hits || []).entries()) {
    const rawKw = scoreChunkKeywordMatch(hit.chunk, result.searchTerms || extractSearchTerms(query));
    console.log(`\n[${i}] ${hit.chunk.documentName} p.${hit.chunk.pageNumber ?? "?"}`);
    console.log(
      `  vector=${hit.vectorScore?.toFixed(3)} keyword=${hit.keywordScore?.toFixed(3)} combined=${hit.score?.toFixed(3)} rawKw=${rawKw}`,
    );
    console.log(`  snippet: ${String(hit.chunk.text || "").slice(0, 120)}…`);
  }

  if (!result.hits?.length) {
    console.warn("\nNo hits — check embeddings (reprocess after Gemini migration) and chunk text.");
    process.exit(2);
  }
  if (!result.passesThreshold) {
    console.warn("\nHits found but below threshold — review scores above.");
    process.exit(3);
  }
  console.log("\nOK — retrieval would proceed to Gemini.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

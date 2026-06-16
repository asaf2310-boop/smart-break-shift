/**
 * CLI — import bundled HYP Pay RAG package into knowledge_documents + knowledge_chunks.
 *   npm run import:hyp-pay
 *   node scripts/import-hyp-pay-rag-package.mjs [path/to/package.json]
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { importHypPayPackage } from "../server/knowledge/hypPayPackageImport.js";
import { isPgVectorConfigured } from "../server/knowledge/supabaseAdmin.js";
import { isEmbeddingConfigured } from "../server/knowledge/embeddingService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEFAULT_JSON = join(ROOT, "data/hyp-pay/HYP_Pay_RAG_Clean_RTL_Fixed.json");

function loadEnvFile() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

async function main() {
  loadEnvFile();

  const jsonPath = resolve(process.argv[2] || DEFAULT_JSON);
  if (!existsSync(jsonPath)) {
    console.error("JSON not found:", jsonPath);
    process.exit(1);
  }

  console.log("Importing HYP Pay package from:", jsonPath);
  console.log("pgvector:", isPgVectorConfigured(), "embeddings:", isEmbeddingConfigured());

  if (!isPgVectorConfigured()) {
    console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!isEmbeddingConfigured()) {
    console.error("Missing GEMINI_API_KEY (or OPENAI_API_KEY)");
    process.exit(1);
  }

  const result = await importHypPayPackage({ jsonPath });
  if (!result.ok) {
    console.error("Import failed:", result.error || result);
    process.exit(1);
  }

  console.log("Import OK:", {
    chunkCount: result.chunkCount,
    embeddingCount: result.embeddingCount ?? null,
    embeddingError: result.embeddingError ?? null,
  });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

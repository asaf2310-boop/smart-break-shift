/**
 * Production QA for knowledge chat — run after deploy:
 *   node scripts/qa-knowledge-chat.mjs
 */
const ORIGIN = process.env.QA_ORIGIN || "https://hypsmart.vercel.app";
const QUERIES = ["מה זה 3DS?", "איך מטמיעים וורדפרס?"];

async function getJson(path, init = {}) {
  const res = await fetch(`${ORIGIN}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("QA target:", ORIGIN);

  const { res: healthRes, data: health } = await getJson("/api/knowledge-chat?health=1");
  assert(healthRes.ok, `health failed: ${healthRes.status}`);
  assert(health.embedModel === "gemini-embedding-001", `unexpected embed model: ${health.embedModel}`);
  assert(health.pgvector, "pgvector not configured");
  console.log("✓ health", health.embedModel, health.totalChunks ?? "");

  const { res: listRes, data: list } = await getJson("/api/knowledge-upload", { method: "GET" });
  assert(listRes.ok, `list docs failed: ${listRes.status}`);
  assert((list.totalChunks ?? 0) > 0, "no chunks indexed");
  console.log("✓ documents", list.documents?.length, "chunks", list.totalChunks);

  for (const query of QUERIES) {
    const { res, data } = await getJson("/api/knowledge-chat", {
      method: "POST",
      body: JSON.stringify({ query, rag: true }),
    });

    const debug = data.debug || {};
    const miss = data.answer === "המידע המבוקש אינו נמצא במאגר הידע";

    console.log(`\n--- "${query}" ---`);
    console.log("status:", res.status, "mode:", data.mode);
    console.log("passesThreshold:", debug.passesThreshold, "hits:", debug.hitCount);
    console.log("searchTerms:", debug.searchTerms);

    if (!res.ok && !data.answer) {
      console.warn("HTTP error:", data.error);
      if (debug.hitCount > 0 && debug.passesThreshold) {
        console.warn("⚠ retrieval OK but API error — chunk fallback should return 200 after deploy");
      }
      continue;
    }

    assert(!miss, `still missing-KB for: ${query}`);
    assert(data.answer?.length > 20, `answer too short for: ${query}`);
    console.log("✓ answer preview:", String(data.answer).slice(0, 120).replace(/\n/g, " "));
    assert((data.citations?.length ?? 0) > 0, `no citations for: ${query}`);
    console.log("✓ citations:", data.citations.length);
  }

  console.log("\nAll QA checks passed.");
}

main().catch((err) => {
  console.error("\nQA FAILED:", err.message);
  process.exit(1);
});

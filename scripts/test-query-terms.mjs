/** Unit checks for query term extraction and hybrid threshold (no API keys). */
import { extractSearchTerms, hasStrongKeywordMatch, normalizeKeywordScore, scoreChunkKeywordMatch } from "../server/knowledge/queryTermsService.js";
import { passesHybridThreshold } from "../server/knowledge/hybridSearchService.js";

const query = "מה זה 3DS?";
const terms = extractSearchTerms(query);

if (!terms.includes("3ds")) {
  console.error("FAIL: expected 3ds in terms, got", terms);
  process.exit(1);
}
if (terms.includes("מה") || terms.includes("זה")) {
  console.error("FAIL: stop words should be stripped, got", terms);
  process.exit(1);
}

const chunk = {
  documentName: "3DS-guide",
  text: "3D Secure (3DS) הוא פרוטוקול אימות נוסף לכרטיסי אשראי בעסקאות מקוונות.",
};
const raw = scoreChunkKeywordMatch(chunk, terms);
const norm = normalizeKeywordScore(raw, terms);
if (raw < 2) {
  console.error("FAIL: acronym chunk should score >= 2, got", raw);
  process.exit(1);
}
if (!hasStrongKeywordMatch(query, chunk)) {
  console.error("FAIL: should be strong keyword match");
  process.exit(1);
}

const hits = [
  {
    chunk,
    score: norm * 0.25,
    vectorScore: 0.12,
    keywordScore: norm,
    imageScore: 0,
  },
];
if (!passesHybridThreshold(hits, query)) {
  console.error("FAIL: hybrid threshold should pass for 3DS keyword hit, scores", hits[0]);
  process.exit(1);
}

console.log("OK query-terms + threshold", { terms, raw, norm });

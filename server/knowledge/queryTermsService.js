/** Query term extraction for hybrid keyword search — mirrors client RAG tokenize. */

const STOP_WORDS = new Set([
  "מה",
  "זה",
  "זאת",
  "איך",
  "למה",
  "האם",
  "מי",
  "איפה",
  "היכן",
  "מתי",
  "כמה",
  "את",
  "של",
  "על",
  "עם",
  "אל",
  "גם",
  "או",
  "כי",
  "אם",
  "לא",
  "כן",
  "יש",
  "אין",
  "הוא",
  "היא",
  "הם",
  "אני",
  "אנחנו",
  "the",
  "is",
  "are",
  "what",
  "how",
  "why",
  "when",
  "where",
  "who",
]);

/**
 * Meaningful search terms — strips Hebrew question words, keeps acronyms like 3DS.
 * @param {string} query
 * @returns {string[]}
 */
export function extractSearchTerms(query) {
  const raw = String(query || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!raw) return [];

  const expanded = raw
    .replace(/([\u0590-\u05ff])([a-z0-9])/gi, "$1 $2")
    .replace(/([a-z0-9])([\u0590-\u05ff])/gi, "$1 $2");

  const words =
    expanded.match(/[\u0590-\u05ff][\u0590-\u05ff'"-]*|[a-z0-9][a-z0-9_.-]*/gi) || [];

  const meaningful = [...new Set(words.filter((w) => w.length > 1 && !STOP_WORDS.has(w)))];

  // Acronyms / product codes (3DS, PCI, API) — often dropped when mixed with Hebrew glue.
  const acronyms = (raw.match(/[a-z0-9][a-z0-9._-]{1,11}/gi) || []).filter(
    (w) => /\d/.test(w) || w.length >= 3,
  );
  for (const acr of acronyms) {
    const t = acr.toLowerCase();
    if (!meaningful.includes(t)) meaningful.push(t);
  }

  if (meaningful.length) return meaningful;
  return [...new Set(words.filter((w) => w.length > 1))];
}

/**
 * @param {object} chunk
 * @param {string[]} terms
 * @returns {number} raw score (not normalized)
 */
export function scoreChunkKeywordMatch(chunk, terms) {
  if (!terms?.length || !chunk) return 0;

  const hay = `${chunk.documentName || chunk.documentTitle || ""} ${chunk.sectionTitle || ""} ${chunk.text || ""} ${chunk.category || ""}`
    .toLowerCase()
    .replace(/([\u0590-\u05ff])([a-z0-9])/gi, "$1 $2")
    .replace(/([a-z0-9])([\u0590-\u05ff])/gi, "$1 $2");

  let score = 0;
  let matched = 0;

  for (const term of terms) {
    if (!term || !hay.includes(term)) continue;
    matched += 1;
    const isAcronym = /\d/.test(term) || /^[a-z0-9]{2,8}$/i.test(term);
    score += term.length >= 4 || isAcronym ? 3 : 2;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = hay.match(new RegExp(escaped, "g"));
    if (matches) score += matches.length * 0.35;
  }

  if (matched >= 2) score += 1.2;
  if (matched === terms.length && terms.length > 0) score += 1.5;

  return score;
}

/** Normalize raw keyword scores to 0–1 for hybrid merge. */
export function normalizeKeywordScore(rawScore, terms) {
  if (!terms?.length || rawScore <= 0) return 0;
  const maxPossible = terms.length * 3.5 + 2.7;
  return Math.min(1, rawScore / Math.max(maxPossible * 0.45, 2));
}

/** True when top chunk has a strong literal term overlap (e.g. acronym hit). */
export function hasStrongKeywordMatch(query, chunk) {
  const terms = extractSearchTerms(query);
  if (!terms.length || !chunk) return false;
  const raw = scoreChunkKeywordMatch(chunk, terms);
  const acronyms = terms.filter((t) => /\d/.test(t) || /^[a-z0-9]{2,8}$/i.test(t));
  if (acronyms.some((t) => String(chunk.text || "").toLowerCase().includes(t))) {
    return raw >= 2;
  }
  return raw >= 3 || (terms.length === 1 && raw >= 2);
}

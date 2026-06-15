/** Fallback answer from retrieved chunks when Gemini is unavailable. */

import { sanitizeAssistantAnswer } from "./assistantBidi.js";
import { truncateSnippet } from "./chatAnswerService.js";
import { extractSearchTerms } from "./queryTermsService.js";

const VISUAL_PLACEHOLDER =
  /^עמוד\s+\d+\s*[—–-]\s*תוכן ויזואלי/i;

function formatSourceLine(chunk) {
  if (!chunk) return "";
  const parts = [
    chunk.documentName || chunk.documentTitle,
    chunk.pageNumber != null ? `עמוד ${chunk.pageNumber}` : null,
    chunk.sectionTitle,
  ].filter(Boolean);
  return parts.join(" · ");
}

function isVisualPlaceholder(text) {
  return VISUAL_PLACEHOLDER.test(String(text || "").trim());
}

function scoreSentence(sentence, terms) {
  const hay = sentence.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (hay.includes(term)) score += term.length >= 4 ? 3 : 2;
  }
  return score;
}

function pickSentences(text, terms, max = 3) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned || isVisualPlaceholder(cleaned)) return [];

  const sentences = cleaned
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(
      (s) =>
        s.length >= 12 &&
        /[\u0590-\u05FFa-zA-Z0-9]/.test(s) &&
        !isVisualPlaceholder(s),
    );

  if (!sentences.length) return [];

  return sentences
    .map((sentence) => ({ sentence, score: scoreSentence(sentence, terms) }))
    .sort((a, b) => b.score - a.score)
    .filter((row) => row.score > 0)
    .slice(0, max)
    .map((row) => row.sentence);
}

function buildVisualIntro(chunks, { rateLimited = false, imageCount = 0 } = {}) {
  const docName = chunks[0]?.documentName || chunks[0]?.documentTitle || "המסמך";
  const pages = [
    ...new Set(
      (chunks || [])
        .map((c) => c.pageNumber)
        .filter((n) => n != null),
    ),
  ].sort((a, b) => a - b);

  const pageHint =
    pages.length > 1
      ? ` (עמודים ${pages.slice(0, 4).join(", ")}${pages.length > 4 ? "…" : ""})`
      : pages.length === 1
        ? ` (עמוד ${pages[0]})`
        : "";

  if (rateLimited) {
    return `**שירות ה-AI זמנית עמוס.** להלן ${imageCount > 1 ? "צילומי העמודים" : "צילום העמוד"} הרלוונטיים ממסמך **${docName}**${pageHint}:`;
  }
  return `להלן ${imageCount > 1 ? "צילומי העמודים" : "צילום העמוד"} הרלוונטיים ממסמך **${docName}**${pageHint}:`;
}

/**
 * @param {string} query
 * @param {Array} chunks
 * @param {{ rateLimited?: boolean, imageCount?: number }} [options]
 */
export function buildChunkFallbackAnswer(query, chunks, options = {}) {
  const terms = extractSearchTerms(query);
  const picked = [];
  const seen = new Set();

  for (const chunk of (chunks || []).slice(0, 4)) {
    const haystack = [chunk.text, chunk.ocrText].filter(Boolean).join("\n");
    for (const sentence of pickSentences(haystack, terms, 3)) {
      const key = sentence.slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(sentence);
      if (picked.length >= 4) break;
    }
    if (picked.length >= 4) break;
  }

  if (!picked.length && chunks?.[0]) {
    const fallbackText = [chunks[0].ocrText, chunks[0].text]
      .filter((t) => t && !isVisualPlaceholder(t))
      .join("\n");
    if (fallbackText) {
      picked.push(truncateSnippet(fallbackText, 360));
    }
  }

  const imageCount = options.imageCount ?? 0;
  if (!picked.length && imageCount > 0) {
    return {
      answer: sanitizeAssistantAnswer(buildVisualIntro(chunks, options)),
      grounded: true,
    };
  }

  if (!picked.length) {
    return {
      answer: "נמצאו קטעים רלוונטיים במאגר, אך לא ניתן לנסח תשובה כרגע. נסו שוב בעוד דקה.",
      grounded: false,
    };
  }

  const lead = sanitizeAssistantAnswer(picked[0]);
  const bullets =
    picked.length > 1
      ? picked
          .slice(1)
          .map((s) => `- ${sanitizeAssistantAnswer(s)}`)
          .join("\n")
      : "";
  const source = formatSourceLine(chunks[0]);
  const parts = [];

  if (options.rateLimited) {
    parts.push("**שירות ה-AI זמנית עמוס** — להלן קטעים מהמסמכים:");
  }

  parts.push(lead);
  if (bullets) parts.push(`**פירוט:**\n${bullets}`);
  if (imageCount > 0) {
    parts.push(sanitizeAssistantAnswer(buildVisualIntro(chunks, { ...options, rateLimited: false })));
  } else if (source) {
    parts.push(`*מקור: ${source}*`);
  }

  return {
    answer: parts.join("\n\n"),
    grounded: true,
  };
}

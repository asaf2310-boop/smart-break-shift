/** Fallback answer from retrieved chunks when Gemini is unavailable. */

import { sanitizeAssistantAnswer } from "./assistantBidi.js";
import { KNOWLEDGE_MISSING_ANSWER } from "./geminiKnowledgePrompt.js";
import { extractSearchTerms } from "./queryTermsService.js";

const VISUAL_PLACEHOLDER =
  /^עמוד\s+\d+\s*[—–-]\s*תוכן ויזואלי/i;

const MIN_SENTENCE_SCORE = 2;

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
    .filter((row) => row.score >= MIN_SENTENCE_SCORE)
    .slice(0, max)
    .map((row) => row.sentence);
}

function collectPageNumbers(chunks) {
  return [
    ...new Set(
      (chunks || [])
        .map((c) => c.pageNumber)
        .filter((n) => n != null),
    ),
  ].sort((a, b) => a - b);
}

function buildVisualIntro(chunks, { imageCount = 0 } = {}) {
  const docName = chunks[0]?.documentName || chunks[0]?.documentTitle || "המסמך";
  const pages = collectPageNumbers(chunks);

  const pageHint =
    pages.length > 1
      ? ` (עמודים ${pages.slice(0, 6).join(", ")}${pages.length > 6 ? "…" : ""})`
      : pages.length === 1
        ? ` (עמוד ${pages[0]})`
        : "";

  return `להלן ${imageCount > 1 ? "צילומי העמודים" : imageCount === 1 ? "צילום העמוד" : "העמודים"} הרלוונטיים ממסמך **${docName}**${pageHint}:`;
}

/**
 * Minimal answer: page numbers + optional screenshot intro — no procedural text.
 * @param {Array} chunks
 * @param {{ imageCount?: number }} [options]
 */
export function buildPageReferenceAnswer(chunks, options = {}) {
  const docName = chunks[0]?.documentName || chunks[0]?.documentTitle || "המסמך";
  const pages = collectPageNumbers(chunks);
  const imageCount = options.imageCount ?? 0;

  if (!pages.length && imageCount === 0) {
    return {
      answer: KNOWLEDGE_MISSING_ANSWER,
      grounded: false,
    };
  }

  const pageList =
    pages.length > 0
      ? pages.map((n) => `- עמוד ${n}`).join("\n")
      : "- (לא זוהו מספרי עמוד — ראו צילומי המסך למטה)";

  const summaryLine1 =
    pages.length > 0
      ? `העמודים הרלוונטיים במסמך **${docName}** הם: ${pages.join(", ")}.`
      : `נמצאו צילומי מסך רלוונטיים במסמך **${docName}**.`;
  const summaryLine2 = "להלן תצוגת העמודים — ללא טקסט הוראות.";

  const parts = [`${summaryLine1}\n${summaryLine2}`, `### עמודים רלוונטיים\n${pageList}`];

  if (imageCount > 0) {
    parts.push(sanitizeAssistantAnswer(buildVisualIntro(chunks, { imageCount })));
  }

  return {
    answer: sanitizeAssistantAnswer(parts.join("\n\n")),
    grounded: true,
  };
}

/**
 * @param {string} query
 * @param {Array} chunks
 * @param {{ imageCount?: number }} [options]
 */
export function buildChunkFallbackAnswer(query, chunks, options = {}) {
  const imageCount = options.imageCount ?? 0;

  if (options.pageReferenceOnly) {
    return buildPageReferenceAnswer(chunks, { imageCount });
  }

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
      if (picked.length >= 3) break;
    }
    if (picked.length >= 3) break;
  }

  if (!picked.length) {
    if (imageCount > 0) {
      return {
        answer: sanitizeAssistantAnswer(buildVisualIntro(chunks, { imageCount })),
        grounded: true,
      };
    }
    return {
      answer: KNOWLEDGE_MISSING_ANSWER,
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
  const parts = [lead];

  if (bullets) parts.push(`**פירוט:**\n${bullets}`);
  if (imageCount > 0) {
    parts.push(sanitizeAssistantAnswer(buildVisualIntro(chunks, { imageCount })));
  } else if (source) {
    parts.push(`*מקור: ${source}*`);
  }

  return {
    answer: sanitizeAssistantAnswer(parts.join("\n\n")),
    grounded: true,
  };
}

/** Fallback answer from retrieved chunks when Gemini is unavailable. */

import { sanitizeAssistantAnswer } from "./assistantBidi.js";
import { truncateSnippet } from "./chatAnswerService.js";
import { extractSearchTerms } from "./queryTermsService.js";

function formatSourceLine(chunk) {
  if (!chunk) return "";
  const parts = [
    chunk.documentName || chunk.documentTitle,
    chunk.pageNumber != null ? `עמוד ${chunk.pageNumber}` : null,
    chunk.sectionTitle,
  ].filter(Boolean);
  return parts.join(" · ");
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
  if (!cleaned) return [];

  const sentences = cleaned
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 12 && /[\u0590-\u05FFa-zA-Z0-9]/.test(s));

  if (!sentences.length) return [truncateSnippet(cleaned, 280)];

  return sentences
    .map((sentence) => ({ sentence, score: scoreSentence(sentence, terms) }))
    .sort((a, b) => b.score - a.score)
    .filter((row) => row.score > 0)
    .slice(0, max)
    .map((row) => row.sentence);
}

/**
 * @param {string} query
 * @param {Array} chunks
 * @param {{ rateLimited?: boolean }} [options]
 */
export function buildChunkFallbackAnswer(query, chunks, options = {}) {
  const terms = extractSearchTerms(query);
  const picked = [];
  const seen = new Set();

  for (const chunk of (chunks || []).slice(0, 4)) {
    for (const sentence of pickSentences(chunk.text, terms, 3)) {
      const key = sentence.slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(sentence);
      if (picked.length >= 4) break;
    }
    if (picked.length >= 4) break;
  }

  if (!picked.length && chunks?.[0]?.text) {
    picked.push(truncateSnippet(chunks[0].text, 360));
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
  if (source) parts.push(`*מקור: ${source}*`);

  return {
    answer: parts.join("\n\n"),
    grounded: true,
  };
}

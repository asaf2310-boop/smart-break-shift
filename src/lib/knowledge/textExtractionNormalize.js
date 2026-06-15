/**
 * Normalize raw document text after PDF/DOCX/TXT extraction.
 * Preserves Hebrew word spaces and paragraph structure for RAG ingest.
 * Keep in sync with server/knowledge/textExtractionNormalize.js
 */

import { ultimateHebrewSanitizer } from "@/lib/knowledge/sanitizeHebrewText";

const UNICODE_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF]/g;
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
/** Hidden line breaks that glue words if stripped — normalize to space first. */
const HIDDEN_LINE_BREAKS = /[\r\u000b\u000c\u2028\u2029\u0085]/g;

function collapseHiddenLineBreaks(s) {
  return String(s || "")
    .replace(/\r\n/g, "\n")
    .replace(HIDDEN_LINE_BREAKS, " ");
}

function separateHebrewLatinGlue(s) {
  return String(s || "")
    .replace(/([\u0590-\u05FF])([A-Za-z0-9])/g, "$1 $2")
    .replace(/([A-Za-z0-9])([\u0590-\u05FF])/g, "$1 $2");
}

function normalizeLineSpaces(line) {
  return String(line || "")
    .replace(UNICODE_SPACES, " ")
    .replace(/\t/g, " ")
    .replace(/[ ]+/g, " ")
    .replace(/[ ]+([,.;:!?…])/g, "$1")
    .replace(/([,.;:!?…])(?=[\u0590-\u05FF])/g, "$1 ")
    .trimEnd();
}

/**
 * Space-safe normalization pass — run immediately after parser output.
 * @param {string} rawText
 * @returns {string}
 */
export function normalizeExtractedDocumentText(rawText) {
  let s = String(rawText || "");
  if (!s) return "";

  s = collapseHiddenLineBreaks(s);
  s = s.replace(/\u0000/g, "");
  s = s.replace(CONTROL_CHARS, "");
  s = s.replace(/\r/g, " ");
  s = s.replace(UNICODE_SPACES, " ");
  s = s.replace(/\t/g, " ");

  s = s
    .split("\n")
    .map((line) => normalizeLineSpaces(line))
    .join("\n");

  s = s.replace(/\n{3,}/g, "\n\n");
  s = separateHebrewLatinGlue(s);
  s = ultimateHebrewSanitizer(s);

  return s.trim();
}

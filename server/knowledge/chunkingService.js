/** Server-side document chunking for RAG ingest. Mirrors src/lib/knowledge/chunkingService.js */

import { cleanPdfPageText } from "./pdfTextQuality.js";

const CHUNK_TARGET_CHARS = 2600;
const CHUNK_MIN_CHARS = 2000;
const CHUNK_MAX_CHARS = 3200;
const CHUNK_OVERLAP_CHARS = 500;

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function separateHebrewLatinGlue(s) {
  return String(s || "")
    .replace(/([\u0590-\u05FF])([A-Za-z0-9])/g, "$1 $2")
    .replace(/([A-Za-z0-9])([\u0590-\u05FF])/g, "$1 $2");
}

function stripBrokenMarkdownLinks(s) {
  let out = String(s || "");
  out = out.replace(/\[([^\]\n]{1,160})\]\([^)\n]{0,240}\)/g, "$1");
  out = out.replace(/\[[^\]\n]{1,160}\]\([^)\n]*$/g, "$1");
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  return out;
}

function stripAggressiveMarkdownFormatting(s) {
  let out = String(s || "");
  out = out.replace(/#{1,6}(?=\s|[\u0590-\u05FF])/g, " ");
  out = out.replace(/^#{1,6}\s*/gm, "");
  out = out.replace(/^\s*[-*+]\s+/gm, "");
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  out = out.replace(/__([^_\n]+)__/g, "$1");
  out = out.replace(/`([^`\n]+)`/g, "$1");
  out = out.replace(/<\/?[a-z][^>]*>/gi, " ");
  return out;
}

function normalizeHebrewTextSingleLine(text) {
  let s = String(text || "")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!s) return "";
  s = s.replace(/[ \t]+([,.;:!?…])/g, "$1");
  s = s.replace(/([,.;:!?…])(?=[\u0590-\u05FF])/g, "$1 ");
  return s.replace(/[ \t]+/g, " ").trim();
}

function normalizeHebrewText(text, options = {}) {
  if (options.preserveLines === true) {
    return String(text || "")
      .split("\n")
      .map((line) => normalizeHebrewTextSingleLine(line))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return normalizeHebrewTextSingleLine(normalizeText(text));
}

function sanitizeChunkText(text, options = {}) {
  const preserveLines = options.preserveLines === true;
  const keepMarkdown = options.keepMarkdown === true;
  let s = String(text || "");
  s = stripBrokenMarkdownLinks(s);
  if (!keepMarkdown) s = stripAggressiveMarkdownFormatting(s);
  s = separateHebrewLatinGlue(s);
  return normalizeHebrewText(s, { preserveLines });
}

function contentLooksLikeMarkdown(content) {
  const s = String(content || "");
  return /^#{1,6}\s/m.test(s) || /\[[^\]\n]{1,160}\]\([^)\n]+\)/.test(s);
}

function detectSectionTitle(line) {
  const t = String(line || "").trim();
  if (!t) return null;
  if (/^#{1,4}\s+/.test(t)) return t.replace(/^#{1,4}\s+/, "").trim();
  if (t.length >= 4 && t.length <= 72 && /^[\u0590-\u05FF]/.test(t) && !/[.!?…]$/.test(t)) {
    return t;
  }
  return null;
}

function splitTextIntoSections(text) {
  const lines = String(text || "").split(/\n+/);
  const sections = [];
  let currentTitle = null;
  let buffer = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (body) sections.push({ sectionTitle: currentTitle, text: body });
    buffer = [];
  };

  for (const line of lines) {
    const title = detectSectionTitle(line);
    if (title && buffer.length === 0) {
      currentTitle = title;
      continue;
    }
    if (title && buffer.length > 0) {
      flush();
      currentTitle = title;
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (!sections.length && text.trim()) {
    return [{ sectionTitle: null, text: text.trim() }];
  }
  return sections;
}

function findChunkBreak(slice, maxLen) {
  if (slice.length <= maxLen) return slice.length;
  const window = slice.slice(0, maxLen);
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph > CHUNK_MIN_CHARS * 0.5) return paragraph;
  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
    window.lastIndexOf("… "),
  );
  if (sentence > CHUNK_MIN_CHARS * 0.45) return sentence + 1;
  const space = window.lastIndexOf(" ");
  if (space > CHUNK_MIN_CHARS * 0.4) return space;
  return maxLen;
}

function pageSectionText(page, docTitle) {
  const sanitized = sanitizeChunkText(cleanPdfPageText(page.text), { preserveLines: true });
  if (sanitized) return sanitized;
  if (page.thumbnail || page.hasThumbnail || page.pageNumber != null) {
    const n = page.pageNumber ?? "?";
    const name = docTitle || "מסמך";
    return normalizeHebrewText(`עמוד ${n} — תוכן ויזואלי מהמסמך "${name}"`);
  }
  return "";
}

/** @param {{ id: string, title: string, category?: string, content: string, pages?: Array }} document */
export function chunkDocument(document) {
  const keepMarkdown = contentLooksLikeMarkdown(document.content);
  const text = sanitizeChunkText(document.content, { preserveLines: true, keepMarkdown });
  const hasVisualPages =
    Array.isArray(document.pages) && document.pages.some((p) => p?.thumbnail || p?.hasThumbnail);
  if (!text && !hasVisualPages) return [];

  const pageSections = Array.isArray(document.pages)
    ? document.pages
        .map((p) => ({
          sectionTitle: p.sectionTitle || (p.pageNumber != null ? `עמוד ${p.pageNumber}` : null),
          pageNumber: p.pageNumber ?? null,
          thumbnail: p.thumbnail || null,
          text: pageSectionText(p, document.title),
        }))
        .filter((p) => p.text || p.thumbnail || p.hasThumbnail)
    : null;

  const sections = pageSections?.length
    ? pageSections.map((p) => ({
        sectionTitle: p.sectionTitle,
        pageNumber: p.pageNumber,
        text: p.text,
      }))
    : splitTextIntoSections(text).map((s) => ({ ...s, pageNumber: null }));

  const chunks = [];
  let globalIndex = 0;

  for (const section of sections) {
    const sectionText = section.text;
    let start = 0;

    while (start < sectionText.length) {
      const maxEnd = Math.min(start + CHUNK_MAX_CHARS, sectionText.length);
      let end = findChunkBreak(sectionText.slice(start, maxEnd), CHUNK_MAX_CHARS);
      if (end < CHUNK_MIN_CHARS && maxEnd < sectionText.length) {
        end = Math.min(CHUNK_TARGET_CHARS, maxEnd - start);
      }
      if (end <= 0) end = Math.min(CHUNK_TARGET_CHARS, sectionText.length - start);

      const slice = sectionText.slice(start, start + end);
      const chunkText = normalizeHebrewText(slice);
      if (chunkText) {
        chunks.push({
          id: `${document.id}_c${globalIndex}`,
          documentId: document.id,
          documentName: document.title,
          documentTitle: document.title,
          category: document.category || "כללי",
          chunkIndex: globalIndex,
          pageNumber: section.pageNumber ?? null,
          sectionTitle: section.sectionTitle || null,
          text: chunkText,
        });
        globalIndex += 1;
      }

      if (start + end >= sectionText.length) break;
      start += Math.max(end - CHUNK_OVERLAP_CHARS, 1);
    }
  }

  return chunks;
}

export { sanitizeChunkText, normalizeHebrewText };

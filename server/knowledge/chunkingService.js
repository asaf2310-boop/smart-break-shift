/** Server-side semantic chunking for RAG ingest. Mirrors src/lib/knowledgeAi.js chunking. */

import { cleanPdfPageText } from "./pdfTextQuality.js";
import { normalizeExtractedDocumentText } from "./textExtractionNormalize.js";

const MARKDOWN_HEADING = /^#{1,6}\s+\S/;
const NUMBERED_SECTION_HEADING = /^\d+\.\s+\S/;

function stripBrokenMarkdownLinks(s) {
  let out = String(s || "");
  out = out.replace(/\[([^\]\n]{1,160})\]\([^)\n]{0,240}\)/g, "$1");
  out = out.replace(/\[[^\]\n]{1,160}\]\([^)\n]*$/g, "$1");
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  return out;
}

function contentLooksLikeMarkdown(content) {
  const s = String(content || "");
  return MARKDOWN_HEADING.test(s) || /\[[^\]\n]{1,160}\]\([^)\n]+\)/.test(s);
}

function prepareIngestText(text, options = {}) {
  const keepMarkdown = options.keepMarkdown === true;
  let s = normalizeExtractedDocumentText(text);
  s = stripBrokenMarkdownLinks(s);
  if (!keepMarkdown) {
    s = s
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/\*\*([^*\n]+)\*\*/g, "$1")
      .replace(/__([^_\n]+)__/g, "$1")
      .replace(/`([^`\n]+)`/g, "$1");
  }
  return s.trim();
}

function isStructuralHeadingLine(line) {
  const t = String(line || "").trim();
  if (!t) return false;
  return MARKDOWN_HEADING.test(t) || NUMBERED_SECTION_HEADING.test(t);
}

function headingTitle(line) {
  const t = String(line || "").trim();
  if (MARKDOWN_HEADING.test(t)) return t.replace(/^#{1,6}\s+/, "").trim();
  if (NUMBERED_SECTION_HEADING.test(t)) return t;
  return null;
}

/**
 * Split text into semantic blocks — markdown/numbered headings or double newlines only.
 * Each block stays intact (no character-based sub-splitting).
 */
export function splitIntoSemanticBlocks(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return [];

  const hasStructuralHeadings = normalized
    .split("\n")
    .some((line) => isStructuralHeadingLine(line));

  if (hasStructuralHeadings) {
    const lines = normalized.split("\n");
    const blocks = [];
    let current = [];

    const flush = () => {
      const body = current.join("\n").trim();
      if (!body) return;
      const first = current.find((l) => l.trim())?.trim() || "";
      blocks.push({
        sectionTitle: headingTitle(first),
        text: body,
      });
      current = [];
    };

    for (const line of lines) {
      if (isStructuralHeadingLine(line) && current.length > 0) {
        flush();
      }
      current.push(line);
    }
    flush();
    return blocks;
  }

  return normalized
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({
      sectionTitle: headingTitle(block.split("\n")[0]?.trim() || "") || null,
      text: block,
    }));
}

function pageSectionText(page, docTitle) {
  const raw = cleanPdfPageText(page.text);
  const sanitized = raw ? prepareIngestText(raw, { keepMarkdown: true }) : "";
  if (sanitized) return sanitized;
  if (page.thumbnail || page.hasThumbnail || page.pageNumber != null) {
    const n = page.pageNumber ?? "?";
    const name = docTitle || "מסמך";
    return `עמוד ${n} — תוכן ויזואלי מהמסמך "${name}"`;
  }
  return "";
}

function pushChunk(chunks, document, section, globalIndex) {
  const chunkText = String(section.text || "").trim();
  if (!chunkText) return globalIndex;

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
  return globalIndex + 1;
}

/** @param {{ id: string, title: string, category?: string, content: string, pages?: Array }} document */
export function chunkDocument(document) {
  const keepMarkdown = contentLooksLikeMarkdown(document.content);
  const text = prepareIngestText(document.content, { preserveLines: true, keepMarkdown });
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

  const chunks = [];
  let globalIndex = 0;

  if (pageSections?.length) {
    for (const page of pageSections) {
      const pageBlocks = splitIntoSemanticBlocks(page.text);
      const blocks =
        pageBlocks.length > 0
          ? pageBlocks
          : page.text
            ? [{ sectionTitle: page.sectionTitle, text: page.text }]
            : [];

      for (const block of blocks) {
        globalIndex = pushChunk(chunks, document, {
          ...block,
          pageNumber: page.pageNumber,
          sectionTitle: block.sectionTitle || page.sectionTitle,
        }, globalIndex);
      }
    }
    return chunks;
  }

  for (const block of splitIntoSemanticBlocks(text)) {
    globalIndex = pushChunk(chunks, document, { ...block, pageNumber: null }, globalIndex);
  }

  return chunks;
}

/** @deprecated Use prepareIngestText — kept for callers that import sanitizeChunkText */
export function sanitizeChunkText(text, options = {}) {
  return prepareIngestText(text, options);
}

/** Light per-line space normalization for display paths */
export function normalizeHebrewText(text, options = {}) {
  const normalized = normalizeExtractedDocumentText(text);
  if (options.preserveLines !== true) {
    return normalized.replace(/\n+/g, " ").replace(/[ ]+/g, " ").trim();
  }
  return normalized;
}

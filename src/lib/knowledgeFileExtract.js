import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import {
  sanitizeChunkText,
  sanitizeMarkdownIngestText,
} from "@/lib/knowledgeAi";
import { cleanPdfPageText, isPdfExtractedTextReadable } from "@/lib/knowledge/pdfTextQuality";
import { normalizeExtractedDocumentText } from "@/lib/knowledge/textExtractionNormalize";
import { appendTextSegment, joinTextParagraphs } from "@/lib/knowledge/documentTextAssembly";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const PDF_CMAP_URL = new URL("pdfjs-dist/cmaps/", import.meta.url).toString();
const PDF_STANDARD_FONT_URL = new URL("pdfjs-dist/standard_fonts/", import.meta.url).toString();

function openPdfDocument(data) {
  return pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    cMapUrl: PDF_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDF_STANDARD_FONT_URL,
  }).promise;
}

export const MAX_KNOWLEDGE_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_PAGES = 30;
const PAGE_RENDER_MAX_WIDTH = 960;
const UPLOAD_THUMB_MAX_WIDTH = 480;

/** Metadata only — thumbnails live on server in knowledge_images. */
export function stripPageThumbnailsForStorage(pages) {
  if (!Array.isArray(pages) || !pages.length) return null;
  return pages.map((p) => ({
    pageNumber: p.pageNumber ?? null,
    sectionTitle: p.sectionTitle || (p.pageNumber != null ? `עמוד ${p.pageNumber}` : null),
    text: p.text || "",
    ...(p.thumbnail || p.hasThumbnail ? { hasThumbnail: true } : {}),
  }));
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Smaller JPEGs for server ingest — avoids request size / timeout failures. */
export async function slimPageThumbnailsForUpload(pages) {
  if (!Array.isArray(pages) || !pages.length) return pages;
  const out = [];
  for (const page of pages) {
    const thumb = page?.thumbnail;
    if (!thumb?.startsWith("data:image")) {
      out.push(page);
      continue;
    }
    try {
      const img = await loadImageFromDataUrl(thumb);
      const scale = Math.min(UPLOAD_THUMB_MAX_WIDTH / img.width, 1);
      const w = Math.max(1, Math.floor(img.width * scale));
      const h = Math.max(1, Math.floor(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      out.push({ ...page, thumbnail: canvas.toDataURL("image/jpeg", 0.55) });
    } catch {
      out.push(page);
    }
  }
  return out;
}

/** Structured per-page text for storage and RAG (not one glued wall of text). */
export function buildPdfDocumentContent(pages, title = "מסמך") {
  if (!Array.isArray(pages) || !pages.length) return "";
  return pages
    .map((p) => {
      const header = `## עמוד ${p.pageNumber}`;
      const body = String(p.text || "").trim();
      if (body) return `${header}\n\n${body}`;
      return `${header}\n\n[עמוד ויזואלי — התוכן מוצג כתמונת עמוד מ"${title}"]`;
    })
    .join("\n\n");
}

const SUPPORTED_EXTENSIONS = new Set(["txt", "md", "pdf", "docx", "html", "htm", "png", "jpg", "jpeg", "webp"]);

function getExtension(fileName) {
  const match = String(fileName || "").match(/\.([^.]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

export function sanitizeKnowledgeText(raw) {
  return normalizeExtractedDocumentText(raw);
}

async function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractImageFile(file) {
  const dataUrl = await readImageAsDataUrl(file);
  return {
    text: "",
    pages: [
      {
        pageNumber: 1,
        text: "",
        thumbnail: dataUrl,
      },
    ],
    images: [{ pageNumber: 1, imageData: dataUrl, fileName: file.name }],
  };
}

function titleFromFileName(fileName) {
  return String(fileName || "")
    .replace(/\.[^.]+$/i, "")
    .trim() || "מסמך מועלה";
}

/** Group PDF text items in reading order — always separate runs/lines with space or \\n. */
function pdfItemsToText(items) {
  if (!items?.length) return "";

  let text = "";
  let lastY = null;

  for (const item of items) {
    if (!("str" in item) || !item.str) continue;

    const str = String(item.str);
    const transform = item.transform || [1, 0, 0, 1, 0, 0];
    const y = transform[5];
    const fontSize = Math.max(Math.hypot(transform[0], transform[1]), Math.abs(transform[3]), 8);
    const lineTolerance = Math.max(fontSize * 0.55, 4);
    const sameLine = lastY !== null && Math.abs(y - lastY) <= lineTolerance;
    const separator = !text.length ? null : sameLine ? " " : "\n";

    if (separator) {
      text = appendTextSegment(text, str, separator);
    } else {
      text = str;
    }

    if (item.hasEOL && !text.endsWith("\n")) {
      text += "\n";
    }

    lastY = y;
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

async function renderPageThumbnail(page) {
  const baseViewport = page.getViewport({ scale: 1 });
  if (!baseViewport.width) return null;

  const scales = [
    Math.min(PAGE_RENDER_MAX_WIDTH / baseViewport.width, 2),
    1.25,
    1,
  ];

  for (const scale of scales) {
    try {
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) continue;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, intent: "display" }).promise;
      return canvas.toDataURL("image/jpeg", 0.78);
    } catch {
      // try lower scale / simpler render path
    }
  }

  return null;
}

async function extractPdfText(file, docTitle) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await openPdfDocument(data);
  const pages = [];
  const pageLimit = Math.min(pdf.numPages, MAX_PDF_PAGES);

  for (let pageNum = 1; pageNum <= pageLimit; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent({ disableCombineTextItems: true });
    const pageText = cleanPdfPageText(
      normalizeExtractedDocumentText(pdfItemsToText(content.items)),
    );
    let thumbnail = null;

    try {
      thumbnail = await renderPageThumbnail(page);
    } catch {
      thumbnail = null;
    }

    pages.push({
      pageNumber: pageNum,
      sectionTitle: `עמוד ${pageNum}`,
      text: pageText,
      ...(thumbnail ? { thumbnail } : {}),
    });
  }

  const title = docTitle || "מסמך";
  const visualOnly = pages.length > 0 && pages.every((p) => !p.text);
  return {
    text: buildPdfDocumentContent(pages, title),
    pages,
    sourceFormat: "pdf",
    visualFirst: visualOnly || pages.some((p) => p?.thumbnail),
    needsServerOcr: visualOnly || pages.some((p) => !p.text && p.thumbnail),
  };
}

const DOCX_BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "TD", "TH"]);

function collectDocxBlocks(root) {
  const blocks = [];

  const walk = (node) => {
    if (!node) return;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName;
      if (DOCX_BLOCK_TAGS.has(tag)) {
        const text = node.textContent?.replace(/\s+/g, " ").trim();
        if (text) blocks.push(text);
        return;
      }
      for (const child of node.children) walk(child);
    }
  };

  walk(root);
  return blocks;
}

function docxHtmlToText(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ""), "text/html");
  const blocks = collectDocxBlocks(doc.body);
  if (blocks.length) return joinTextParagraphs(blocks);
  const fallback = doc.body?.textContent?.replace(/\s+/g, " ").trim();
  return fallback || "";
}

async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  const fromHtml = docxHtmlToText(htmlResult.value);
  if (fromHtml) return fromHtml;

  const result = await mammoth.extractRawText({ arrayBuffer });
  if (result.messages?.length) {
    const hasErrors = result.messages.some((m) => m.type === "error");
    if (hasErrors && !result.value?.trim()) {
      throw new Error("docx_parse_failed");
    }
  }

  return joinTextParagraphs(String(result.value || "").split(/\n+/));
}

function extractHtmlText(rawHtml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(rawHtml || ""), "text/html");
  doc.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
  const title = doc.querySelector("title")?.textContent?.trim() || null;
  const bodyText = doc.body?.innerText || doc.documentElement?.textContent || "";
  return { text: bodyText, title };
}

/**
 * @param {File} file
 * @returns {Promise<{ text: string, title: string, error: string | null, pages?: Array<{ pageNumber: number, text: string, thumbnail?: string }> }>}
 */
export async function extractTextFromFile(file) {
  const title = titleFromFileName(file.name);
  const ext = getExtension(file.name);

  if (!file || !(file instanceof File)) {
    return { text: "", title, error: "לא נבחר קובץ" };
  }

  if (file.size > MAX_KNOWLEDGE_FILE_BYTES) {
    return {
      text: "",
      title,
      error: "הקובץ גדול מדי (מקסימום 5 מגה-בייט)",
    };
  }

  if (ext === "doc") {
    return {
      text: "",
      title,
      error: "קבצי Word ישנים (.doc) אינם נתמכים. שמור את הקובץ כ-.docx והעלה שוב.",
    };
  }

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return {
      text: "",
      title,
      error: "סוג קובץ לא נתמך. ניתן להעלות: txt, md, html, pdf, docx, png, jpg, webp",
    };
  }

  try {
    let rawText = "";
    let pages = null;
    let images = null;
    let needsServerOcr = false;

    let htmlTitle = null;

    if (ext === "txt" || ext === "md") {
      rawText = await file.text();
    } else if (ext === "html" || ext === "htm") {
      const htmlRaw = await file.text();
      const parsed = extractHtmlText(htmlRaw);
      rawText = parsed.text;
      htmlTitle = parsed.title;
    } else if (ext === "docx") {
      rawText = normalizeExtractedDocumentText(await extractDocxText(file));
    } else if (ext === "pdf") {
      const pdfResult = await extractPdfText(file, title);
      rawText = pdfResult.text;
      pages = pdfResult.pages;
      needsServerOcr = pdfResult.needsServerOcr === true;
    } else if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") {
      const imgResult = await extractImageFile(file);
      rawText = imgResult.text;
      pages = imgResult.pages;
      images = imgResult.images;
    }

    const cleaned =
      ext === "docx" || ext === "pdf"
        ? rawText
        : normalizeExtractedDocumentText(sanitizeKnowledgeText(rawText));
    const text =
      ext === "md"
        ? sanitizeMarkdownIngestText(cleaned)
        : ext === "pdf"
          ? sanitizeChunkText(cleaned, { preserveLines: true, keepMarkdown: true })
          : ext === "txt" || ext === "docx"
            ? sanitizeChunkText(cleaned, { preserveLines: true })
            : sanitizeChunkText(cleaned);

    const hasImages = pages?.some((p) => p?.thumbnail) || images?.length > 0;
    const hasPdfPages = Array.isArray(pages) && pages.length > 0;
    const readableText =
      isPdfExtractedTextReadable(cleaned) ||
      pages?.some((p) => isPdfExtractedTextReadable(p.text));

    if (!readableText && !hasImages && !hasPdfPages) {
      return {
        text: "",
        title,
        error: "לא נמצא טקסט קריא בקובץ (ייתכן שמדובר במסמך סרוק או ריק)",
      };
    }

    if (!readableText && !hasImages && hasPdfPages) {
      return {
        text: "",
        title,
        error:
          "לא ניתן לרנדר את עמודי ה-PDF בדפדפן. נסו Chrome/Edge עדכני, או ייצאו את הקובץ מחדש כ-PDF עם שכבת טקסט.",
      };
    }

    return {
      text: text || (hasPdfPages ? buildPdfDocumentContent(pages, title) : `[תמונה: ${title}]`),
      title: htmlTitle || title,
      error: null,
      pages: pages || undefined,
      images: images || undefined,
      sourceFormat: ext === "pdf" ? "pdf" : undefined,
      visualFirst: ext === "pdf" && (hasImages || needsServerOcr),
      needsServerOcr: needsServerOcr && hasImages,
    };
  } catch {
    if (ext === "pdf") {
      return { text: "", title, error: "שגיאה בקריאת קובץ PDF" };
    }
    if (ext === "docx") {
      return { text: "", title, error: "שגיאה בקריאת קובץ Word" };
    }
    if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") {
      return { text: "", title, error: "שגיאה בקריאת קובץ תמונה" };
    }
    return { text: "", title, error: "שגיאה בקריאת הקובץ" };
  }
}

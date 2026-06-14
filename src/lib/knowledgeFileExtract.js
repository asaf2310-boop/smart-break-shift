import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import {
  normalizeHebrewText,
  sanitizeChunkText,
  sanitizeMarkdownIngestText,
} from "@/lib/knowledgeAi";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export const MAX_KNOWLEDGE_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PAGE_THUMBNAILS = 24;
const THUMBNAIL_MAX_WIDTH = 520;

const SUPPORTED_EXTENSIONS = new Set(["txt", "md", "pdf", "docx", "html", "htm", "png", "jpg", "jpeg", "webp"]);

function getExtension(fileName) {
  const match = String(fileName || "").match(/\.([^.]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

export function sanitizeKnowledgeText(raw) {
  return String(raw || "")
    .replace(/\u0000/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

/** Group PDF text items into lines, sort RTL, and insert word spaces from glyph gaps. */
function pdfItemsToText(items) {
  if (!items?.length) return "";

  const lineMap = new Map();

  for (const item of items) {
    if (!("str" in item) || !item.str) continue;
    const transform = item.transform || [1, 0, 0, 1, 0, 0];
    const x = transform[4];
    const y = transform[5];
    const yKey = Math.round(y / 4) * 4;
    const width = item.width ?? item.str.length * 5;

    if (!lineMap.has(yKey)) lineMap.set(yKey, []);
    lineMap.get(yKey).push({ x, str: item.str, width, endX: x + width });
  }

  const lines = [...lineMap.keys()].sort((a, b) => b - a);
  const parts = [];

  for (const yKey of lines) {
    const row = lineMap.get(yKey).sort((a, b) => b.x - a.x);
    let lineText = "";
    let prevStartX = null;

    for (const { x, str, endX } of row) {
      if (prevStartX !== null) {
        const gap = prevStartX - endX;
        if (gap > 1.2) {
          lineText += gap > 2.5 || /[\u0590-\u05FF]$/.test(lineText) ? " " : "";
        }
      }
      lineText += str;
      prevStartX = x;
    }

    const trimmed = lineText.trim();
    if (trimmed) parts.push(trimmed);
  }

  return parts.join("\n");
}

async function renderPageThumbnail(page) {
  const baseViewport = page.getViewport({ scale: 1 });
  if (!baseViewport.width) return null;

  const scale = Math.min(THUMBNAIL_MAX_WIDTH / baseViewport.width, 1.25);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.62);
}

async function extractPdfText(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
  const parts = [];
  const pages = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = normalizeHebrewText(pdfItemsToText(content.items));
    let thumbnail = null;

    if (pageText && pageNum <= MAX_PAGE_THUMBNAILS) {
      try {
        thumbnail = await renderPageThumbnail(page);
      } catch {
        thumbnail = null;
      }
    }

    if (pageText || thumbnail) {
      if (pageText) parts.push(pageText);
      pages.push({
        pageNumber: pageNum,
        text: pageText || "",
        ...(thumbnail ? { thumbnail } : {}),
      });
    }
  }

  return {
    text: normalizeHebrewText(parts.join("\n\n")),
    pages,
  };
}

async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  if (result.messages?.length) {
    const hasErrors = result.messages.some((m) => m.type === "error");
    if (hasErrors && !result.value?.trim()) {
      throw new Error("docx_parse_failed");
    }
  }
  return result.value || "";
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

    let htmlTitle = null;

    if (ext === "txt" || ext === "md") {
      rawText = await file.text();
    } else if (ext === "html" || ext === "htm") {
      const htmlRaw = await file.text();
      const parsed = extractHtmlText(htmlRaw);
      rawText = parsed.text;
      htmlTitle = parsed.title;
    } else if (ext === "docx") {
      rawText = await extractDocxText(file);
    } else if (ext === "pdf") {
      const pdfResult = await extractPdfText(file);
      rawText = pdfResult.text;
      pages = pdfResult.pages;
    } else if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") {
      const imgResult = await extractImageFile(file);
      rawText = imgResult.text;
      pages = imgResult.pages;
      images = imgResult.images;
    }

    const cleaned = sanitizeKnowledgeText(rawText);
    const text =
      ext === "md"
        ? sanitizeMarkdownIngestText(cleaned)
        : ext === "txt" || ext === "docx"
          ? sanitizeChunkText(cleaned, { preserveLines: true })
          : sanitizeChunkText(cleaned);

    const hasImages = pages?.some((p) => p?.thumbnail) || images?.length > 0;

    if (!text && !hasImages) {
      return {
        text: "",
        title,
        error: "לא נמצא טקסט קריא בקובץ (ייתכן שמדובר במסמך סרוק או ריק)",
      };
    }

    return {
      text: text || `[תמונה: ${title}]`,
      title: htmlTitle || title,
      error: null,
      pages: pages || undefined,
      images: images || undefined,
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

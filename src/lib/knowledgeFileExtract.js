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

const SUPPORTED_EXTENSIONS = new Set(["txt", "md", "pdf", "docx"]);

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

function titleFromFileName(fileName) {
  return String(fileName || "")
    .replace(/\.[^.]+$/i, "")
    .trim() || "מסמך מועלה";
}

function pdfItemsToText(items) {
  let text = "";
  let lastEndX = null;
  let lastY = null;

  for (const item of items) {
    if (!("str" in item) || !item.str) continue;
    const str = item.str;
    const transform = item.transform || [1, 0, 0, 1, 0, 0];
    const x = transform[4];
    const y = transform[5];
    const width = item.width ?? str.length * 4;

    if (lastEndX !== null) {
      const gap = x - lastEndX;
      const newLine = Math.abs(y - lastY) > 4;
      if (newLine) {
        text += "\n";
      } else if (gap > 1.5) {
        text += gap > 6 ? " " : "";
      }
    }

    text += str;
    lastEndX = x + width;
    lastY = y;
  }

  return text.trim();
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
    if (pageText) {
      parts.push(pageText);
      pages.push({ pageNumber: pageNum, text: pageText });
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

/**
 * @param {File} file
 * @returns {Promise<{ text: string, title: string, error: string | null, pages?: Array<{ pageNumber: number, text: string }> }>}
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
      error: "סוג קובץ לא נתמך. ניתן להעלות: txt, md, pdf, docx",
    };
  }

  try {
    let rawText = "";
    let pages = null;

    if (ext === "txt" || ext === "md") {
      rawText = await file.text();
    } else if (ext === "docx") {
      rawText = await extractDocxText(file);
    } else if (ext === "pdf") {
      const pdfResult = await extractPdfText(file);
      rawText = pdfResult.text;
      pages = pdfResult.pages;
    }

    const cleaned = sanitizeKnowledgeText(rawText);
    const text =
      ext === "md"
        ? sanitizeMarkdownIngestText(cleaned)
        : ext === "txt" || ext === "docx"
          ? sanitizeChunkText(cleaned, { preserveLines: true })
          : sanitizeChunkText(cleaned);
    if (!text) {
      return {
        text: "",
        title,
        error: "לא נמצא טקסט קריא בקובץ (ייתכן שמדובר במסמך סרוק או ריק)",
      };
    }

    return { text, title, error: null, pages: pages || undefined };
  } catch {
    if (ext === "pdf") {
      return { text: "", title, error: "שגיאה בקריאת קובץ PDF" };
    }
    if (ext === "docx") {
      return { text: "", title, error: "שגיאה בקריאת קובץ Word" };
    }
    return { text: "", title, error: "שגיאה בקריאת הקובץ" };
  }
}

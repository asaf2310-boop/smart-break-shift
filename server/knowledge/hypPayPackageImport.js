/** Import pre-chunked HYP Pay RAG package into knowledge_documents + knowledge_chunks. */

import { readFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { ingestPreChunkedDocument } from "./documentIngestService.js";
import { normalizeExtractedDocumentText } from "./textExtractionNormalize.js";
import { joinTextParagraphs } from "./documentTextAssembly.js";

export const HYP_PAY_DOC_ID = "hyp-pay-api-documentation";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_JSON_PATH = join(__dirname, "../../data/hyp-pay/HYP_Pay_RAG_Clean_RTL_Fixed.json");

/**
 * @param {unknown} data — JSON array from HYP Pay package
 */
export function parseHypPayPackageJson(data) {
  const arr = Array.isArray(data) ? data : [];
  return arr
    .map((item, i) => {
      const pages = Array.isArray(item?.pages)
        ? item.pages.map((p) => Number(p)).filter((p) => Number.isFinite(p))
        : [];
      const text = String(item?.content || "").trim();
      if (!text) return null;
      return {
        chunkIndex: Number.isFinite(Number(item?.id)) ? Number(item.id) - 1 : i,
        text,
        pageNumber: pages.length ? pages[0] : null,
        pages,
        sectionTitle: String(item?.section || item?.topic || "").trim() || null,
        category: String(item?.topic || "").trim() || null,
        keywords: Array.isArray(item?.keywords) ? item.keywords.map(String) : [],
        source: String(item?.source || "").trim() || null,
      };
    })
    .filter(Boolean);
}

/**
 * @param {ReturnType<typeof parseHypPayPackageJson>} chunks
 */
export function buildHypPayDocument(chunks) {
  const title = "HYP Pay — מדריך API";
  const category = "תשלומים";

  const content = joinTextParagraphs(
    chunks.map((c) => normalizeExtractedDocumentText(c.text)).filter(Boolean),
  );

  const pageMap = new Map();
  for (const chunk of chunks) {
    const pageNums = chunk.pages?.length ? chunk.pages : chunk.pageNumber != null ? [chunk.pageNumber] : [];
    const normalized = normalizeExtractedDocumentText(chunk.text);
    if (!normalized) continue;

    for (const pageNumber of pageNums) {
      if (!pageMap.has(pageNumber)) {
        pageMap.set(pageNumber, {
          pageNumber,
          sectionTitle: chunk.sectionTitle,
          text: "",
          hasThumbnail: false,
        });
      }
      const page = pageMap.get(pageNumber);
      page.text = page.text ? `${page.text}\n\n${normalized}` : normalized;
      if (chunk.sectionTitle && !page.sectionTitle) {
        page.sectionTitle = chunk.sectionTitle;
      }
    }
  }

  const pages = [...pageMap.values()].sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0));

  return {
    id: HYP_PAY_DOC_ID,
    title,
    category,
    content: content || " ",
    sourceType: "package",
    fileName: "HYP_Pay_RAG_Clean_RTL_Fixed.json",
    pages: pages.length ? pages : null,
  };
}

/**
 * @param {{ jsonPath?: string, jsonData?: unknown, tenantId?: string | null, skipImages?: boolean }} [options]
 */
export async function importHypPayPackage({ jsonPath, jsonData, tenantId = null, skipImages = true } = {}) {
  let raw = jsonData;
  if (!raw) {
    const path = resolve(jsonPath || DEFAULT_JSON_PATH);
    const text = await readFile(path, "utf8");
    raw = JSON.parse(text);
  }

  const parsed = parseHypPayPackageJson(raw);
  if (!parsed.length) {
    return { ok: false, error: "no_chunks_in_package", chunkCount: 0 };
  }

  const document = buildHypPayDocument(parsed);
  if (tenantId != null) document.tenantId = tenantId;

  const preChunks = parsed.map((c, i) => ({
    documentName: document.title,
    text: normalizeExtractedDocumentText(c.text),
    chunkIndex: c.chunkIndex ?? i,
    pageNumber: c.pageNumber,
    sectionTitle: c.sectionTitle,
    category: c.category || document.category,
  }));

  return ingestPreChunkedDocument(document, preChunks, { skipImages });
}

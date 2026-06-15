/** Production Gemini chat service — structured SDK + fetch fallback. */

import { getAiProvider } from "../ai/aiProvider.js";
import {
  geminiGenerateText,
  geminiGenerateMultimodal,
  geminiGenerateStructuredAgentResponse,
  isGeminiSdkAvailable,
} from "../ai/geminiClient.js";
import {
  buildContextBlocks,
  uniqueCitations,
  truncateSnippet,
} from "./chatAnswerService.js";
import {
  GEMINI_KNOWLEDGE_SYSTEM_PROMPT,
  GEMINI_AGENT_STRUCTURED_SYSTEM_PROMPT,
  KNOWLEDGE_MISSING_ANSWER,
  buildGeminiUserPrompt,
  isVisualFlowQuestion,
  isMissingKnowledgeAnswer,
  parseRelevantImageLabels,
  stripRelevantImagesMarker,
} from "./geminiKnowledgePrompt.js";

import { sanitizeAssistantAnswer } from "./assistantBidi.js";

/** Assign stable [IMG-N] labels for prompt + response parsing. */
export function assignImageLabels(images = []) {
  return images.map((img, i) => ({
    ...img,
    label: img.label || `IMG-${i + 1}`,
  }));
}

/** Normalize image records for API + multimodal. */
export function normalizeKnowledgeImages(images = [], limit = 3) {
  const seen = new Set();
  const out = [];

  for (const img of images) {
    if (out.length >= limit) break;
    const src = img.src || img.url || img.image_data || img.imageData;
    if (!src) continue;
    const key = `${img.documentId || img.document_id}:${img.pageNumber ?? img.page_number ?? ""}:${src.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id: img.id || null,
      url: src,
      src,
      documentId: img.documentId || img.document_id,
      documentName: img.documentName || img.documentTitle || img.document_name,
      documentTitle: img.documentName || img.documentTitle || img.document_name,
      pageNumber: img.pageNumber ?? img.page_number ?? null,
      caption: img.description || img.caption || null,
      fileName: img.fileName || img.file_name || null,
    });
  }

  return assignImageLabels(out);
}

/** Build sources array for agent UI. */
export function buildKnowledgeSources(citations = [], images = []) {
  const sources = [];

  for (const c of citations) {
    sources.push({
      type: "document",
      documentId: c.documentId,
      title: c.title,
      pageNumber: c.pageNumber ?? null,
      sectionTitle: c.sectionTitle ?? null,
      category: c.category ?? null,
    });
  }

  for (const img of images) {
    sources.push({
      type: "image",
      documentId: img.documentId,
      title: img.documentName || img.documentTitle,
      pageNumber: img.pageNumber ?? null,
      url: img.url || img.src,
      caption: img.caption || null,
      label: img.label || null,
    });
  }

  return sources;
}

/**
 * Merge chunk-based images + image search hits.
 * @param {Array} fetchedImages — from fetchImagesForChunks
 * @param {Array} imageHits — from hybridSearch imageHits
 */
export function mergeRelevantImages(fetchedImages = [], imageHits = [], limit = 3) {
  const combined = [
    ...fetchedImages,
    ...imageHits.map((h) => h.image).filter(Boolean),
  ];
  return normalizeKnowledgeImages(combined, limit);
}

function parseInlineImage(src) {
  const url = String(src || "").trim();
  if (!url.startsWith("data:")) return null;
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function buildLabeledImageDescriptions(labeledImages = []) {
  return labeledImages.map((img) => {
    const doc = img.documentName || img.documentTitle || "מסמך";
    const page = img.pageNumber != null ? ` · עמוד ${img.pageNumber}` : "";
    const caption = img.caption ? ` — ${img.caption}` : "";
    return `${doc}${page}${caption}`;
  });
}

function buildStructuredImageMetadataLine(img) {
  const doc = img.documentName || img.documentTitle || "מסמך";
  const page = img.pageNumber != null ? ` · עמוד ${img.pageNumber}` : "";
  const caption = img.caption ? ` — ${img.caption}` : "";
  const url = img.url || img.src || "";
  const idPart = img.id ? `id=${img.id}` : `label=${img.label}`;
  const urlPreview = url.length > 120 ? `${url.slice(0, 120)}…` : url;
  return `[${img.label}] ${idPart} · url=${urlPreview} · ${doc}${page}${caption}`;
}

/** Build SDK contents array — text context + inline base64 images. */
export function buildStructuredAgentContents(query, context, labeledImages = []) {
  const contents = [
    { text: `שאלת הנציג: ${query}` },
    {
      text: `הנה הקונטקסט שנשלף ממאגר הידע הארגוני:\n${context || "(ריק — אין מידע)"}`,
    },
  ];

  if (labeledImages.length) {
    contents.push({
      text: `צילומי מסך מצורפים (מזהים וקישורים — החזר ב-relevantImageUrlsToDisplay את ה-URL המלא או המזהה):\n${labeledImages.map(buildStructuredImageMetadataLine).join("\n")}`,
    });
  }

  for (const img of labeledImages) {
    const inline = parseInlineImage(img.src || img.url);
    if (!inline) continue;
    contents.push({ text: `[${img.label}]` });
    contents.push({ inlineData: { mimeType: inline.mimeType, data: inline.data } });
  }

  return contents;
}

/** Match model-selected URLs/IDs/labels back to image records. */
export function filterImagesByRelevantUrls(labeledImages = [], urls = []) {
  if (!urls?.length) return [];

  const tokens = urls.map((u) => String(u || "").trim()).filter(Boolean);
  if (!tokens.length) return [];

  const tokenSet = new Set(tokens);
  const tokenLower = new Set(tokens.map((t) => t.toLowerCase()));

  return labeledImages.filter((img) => {
    const src = img.url || img.src || "";
    if (tokenSet.has(src) || tokenLower.has(src.toLowerCase())) return true;
    if (img.id != null && (tokenSet.has(String(img.id)) || tokenLower.has(String(img.id).toLowerCase()))) {
      return true;
    }
    if (img.label && (tokenSet.has(img.label) || tokenLower.has(img.label.toLowerCase()))) {
      return true;
    }
    for (const token of tokens) {
      if (!token || !src) continue;
      if (src.startsWith(token) || token.startsWith(src.slice(0, 80))) return true;
    }
    return false;
  });
}

function selectResponseImages(labeledImages, rawAnswer, grounded) {
  if (!grounded || !labeledImages.length) return [];

  const selectedLabels = parseRelevantImageLabels(rawAnswer);
  if (selectedLabels === null || !selectedLabels.length) return [];

  const labelSet = new Set(selectedLabels.map((l) => l.toUpperCase()));
  return labeledImages.filter((img) => labelSet.has(String(img.label || "").toUpperCase()));
}

async function generateGeminiStructuredKnowledgeAnswer(query, chunks, options = {}) {
  const labeledImages = normalizeKnowledgeImages(options.images || [], 3);
  const contextBlocks = buildContextBlocks(chunks);
  const context = contextBlocks.join("\n\n");
  const citations = uniqueCitations(chunks);
  const contents = buildStructuredAgentContents(query, context, labeledImages);

  const result = await geminiGenerateStructuredAgentResponse({
    systemInstruction: GEMINI_AGENT_STRUCTURED_SYSTEM_PROMPT,
    contents,
    maxOutputTokens: isVisualFlowQuestion(query) ? 720 : 640,
    temperature: 0.15,
  });

  if (result.error && result.error !== "json_parse_failed") {
    return {
      answer: null,
      citations,
      sources: buildKnowledgeSources(citations, []),
      images: [],
      context,
      error: result.error,
      retryAfterSec: result.retryAfterSec,
      rateLimited: result.rateLimited,
      grounded: false,
      structured: true,
    };
  }

  const parsed = result.parsed;
  if (!parsed || result.error === "json_parse_failed") {
    return {
      answer: KNOWLEDGE_MISSING_ANSWER,
      citations,
      sources: buildKnowledgeSources(citations, []),
      images: [],
      context,
      error: null,
      retryAfterSec: null,
      rateLimited: false,
      grounded: false,
      mode: "gemini_structured_fallback",
      structured: true,
    };
  }

  let answer = sanitizeAssistantAnswer(parsed.hebrewAnswerMarkdown || "");
  const grounded = !isMissingKnowledgeAnswer(answer);
  if (!answer) {
    answer = KNOWLEDGE_MISSING_ANSWER;
  }

  const responseImages = grounded
    ? filterImagesByRelevantUrls(labeledImages, parsed.relevantImageUrlsToDisplay || [])
    : [];

  return {
    answer,
    citations,
    sources: buildKnowledgeSources(citations, responseImages),
    images: responseImages.map(({ label, ...img }) => ({
      ...img,
      label: label || null,
    })),
    context,
    error: null,
    retryAfterSec: null,
    rateLimited: false,
    grounded,
    mode: "gemini_structured",
    structured: true,
    relevantImageUrls: parsed.relevantImageUrlsToDisplay || [],
  };
}

async function generateGeminiFetchKnowledgeAnswer(query, chunks, options = {}) {
  const labeledImages = normalizeKnowledgeImages(options.images || [], 3);
  const contextBlocks = buildContextBlocks(chunks);
  const context = contextBlocks.join("\n\n");
  const citations = uniqueCitations(chunks);

  const labeledDescriptions = labeledImages.map((img, i) => ({
    label: img.label || `IMG-${i + 1}`,
    description: buildLabeledImageDescriptions([img])[0],
  }));

  const userPrompt = buildGeminiUserPrompt(query, context, {
    hasImages: labeledImages.length > 0,
    labeledImages: labeledDescriptions,
  });

  const inlineImages = labeledImages
    .map((img) => ({ img, inline: parseInlineImage(img.src) }))
    .filter((row) => row.inline);

  const useMultimodal = inlineImages.length > 0;
  let result;

  if (useMultimodal) {
    const parts = [{ text: userPrompt }];
    for (const { img, inline } of inlineImages.slice(0, 3)) {
      parts.push({ text: `[${img.label}]` });
      parts.push({ inline_data: { mime_type: inline.mimeType, data: inline.data } });
    }
    result = await geminiGenerateMultimodal({
      system: GEMINI_KNOWLEDGE_SYSTEM_PROMPT,
      userParts: parts,
      maxTokens: isVisualFlowQuestion(query) ? 720 : 640,
      temperature: 0.15,
    });
  } else {
    result = await geminiGenerateText({
      system: GEMINI_KNOWLEDGE_SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 560,
      temperature: 0.15,
    });
  }

  if (result.error) {
    return {
      answer: null,
      citations,
      sources: buildKnowledgeSources(citations, []),
      images: [],
      context,
      error: result.error,
      retryAfterSec: result.retryAfterSec,
      rateLimited: result.rateLimited,
      grounded: false,
      mode: "gemini",
    };
  }

  const rawAnswer = result.text || "";
  const selectedLabels = parseRelevantImageLabels(rawAnswer);
  let answer = sanitizeAssistantAnswer(stripRelevantImagesMarker(rawAnswer));
  const grounded = !isMissingKnowledgeAnswer(answer);

  if (!answer) {
    answer = KNOWLEDGE_MISSING_ANSWER;
  }

  const responseImages = selectResponseImages(labeledImages, rawAnswer, grounded);

  return {
    answer,
    citations,
    sources: buildKnowledgeSources(citations, responseImages),
    images: responseImages.map(({ label, ...img }) => ({
      ...img,
      label: label || null,
    })),
    context,
    error: null,
    retryAfterSec: null,
    rateLimited: false,
    grounded,
    mode: "gemini",
    selectedImageLabels: selectedLabels,
  };
}

/**
 * Generate grounded Gemini answer with optional multimodal images.
 * Prefers @google/genai structured JSON when SDK is available.
 */
export async function generateGeminiKnowledgeAnswer(query, chunks, options = {}) {
  if (isGeminiSdkAvailable()) {
    const structured = await generateGeminiStructuredKnowledgeAnswer(query, chunks, options);
    if (!structured.error) {
      return structured;
    }
    if (structured.rateLimited) {
      return structured;
    }
  }

  return generateGeminiFetchKnowledgeAnswer(query, chunks, options);
}

/** Route to Gemini or fallback — used by chatAnswerService. */
export async function generateKnowledgeAnswer(query, chunks, options = {}) {
  if (getAiProvider() === "gemini") {
    return generateGeminiKnowledgeAnswer(query, chunks, options);
  }
  return null;
}

export { KNOWLEDGE_MISSING_ANSWER, truncateSnippet, parseRelevantImageLabels, stripRelevantImagesMarker };

/** AI Vision OCR — extract Hebrew text + short caption from images. */

import { ocrImage as providerOcrImage, isAiConfigured } from "../ai/aiProvider.js";

export function isOcrConfigured() {
  return isAiConfigured();
}

/**
 * @param {string} imageDataUrl — data:image/jpeg;base64,... or https URL
 * @param {{ fileName?: string, pageNumber?: number }} [meta]
 */
export async function ocrImage(imageDataUrl, meta = {}) {
  if (!isAiConfigured()) {
    return { ocrText: "", description: "", error: "ai_not_configured" };
  }
  return providerOcrImage(imageDataUrl, meta);
}

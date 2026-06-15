/** POST /api/ask-web — Gemini + Google Search grounding (no local RAG). */

import { json, readJsonBody, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { isGeminiConfigured } from "../server/ai/geminiClient.js";
import { generateWebSearchAnswer } from "../server/knowledge/webSearchService.js";

function buildWebSearchResponse(result) {
  const webSources = result.webSources || [];
  return {
    answer: result.hebrewAnswerMarkdown,
    hebrewAnswerMarkdown: result.hebrewAnswerMarkdown,
    webSources,
    sources: webSources.map((s) => ({ type: "web", title: s.title, url: s.url })),
    grounded: false,
    mode: "web_search",
    citations: [],
    images: [],
    chunks: [],
    confidence: null,
    debug: result.webSearchQueries?.length ? { webSearchQueries: result.webSearchQueries } : null,
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden", message: "CORS: same origin only" }, req);
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: "invalid_json" }, req);
  }

  const query = String(body.query || "").trim();
  if (!query) {
    return json(res, 400, { error: "query_required" }, req);
  }

  if (!isGeminiConfigured()) {
    return json(
      res,
      503,
      {
        error: "gemini_required_for_web_search",
        message: "חיפוש ברשת דורש GEMINI_API_KEY ומודל Gemini שתומך ב-Google Search.",
      },
      req,
    );
  }

  const result = await generateWebSearchAnswer(query);

  if (result.error === "query_required") {
    return json(res, 400, { error: "query_required" }, req);
  }

  if (result.error === "ai_not_configured") {
    return json(res, 503, { error: "ai_not_configured" }, req);
  }

  if (result.error) {
    const is429 = result.rateLimited || String(result.error).includes("429");
    return json(
      res,
      is429 ? 429 : 503,
      {
        error: result.error,
        retryAfterSec: result.retryAfterSec,
        rateLimited: result.rateLimited,
      },
      req,
    );
  }

  return json(res, 200, buildWebSearchResponse(result), req);
}

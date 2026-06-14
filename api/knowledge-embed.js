/** Vercel serverless — AI embeddings for knowledge RAG (Gemini / OpenAI) */

import { embedTexts, getEmbedModelName, isEmbeddingConfigured } from "../server/knowledge/embeddingService.js";
import { getAiProvider, getEmbeddingDimensions } from "../server/ai/aiProvider.js";

const MAX_BATCH = 64;

function getSiteOrigin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host || Array.isArray(host)) return null;
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto =
    (typeof protoHeader === "string" ? protoHeader.split(",")[0] : null) ||
    (String(host).includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function isSameOrigin(req) {
  const siteOrigin = getSiteOrigin(req);
  if (!siteOrigin) return false;
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin === siteOrigin) return true;
  const referer = req.headers.referer;
  if (typeof referer === "string" && referer.startsWith(siteOrigin)) return true;
  return false;
}

function corsHeaders(req) {
  const siteOrigin = getSiteOrigin(req);
  const origin = req.headers.origin;
  if (siteOrigin && typeof origin === "string" && origin === siteOrigin) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
  }
  return { Vary: "Origin" };
}

function json(res, status, body, req) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    if (!isSameOrigin(req)) {
      return json(res, 403, { error: "forbidden" }, req);
    }
    res.statusCode = 204;
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));
    res.end();
    return;
  }

  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.searchParams.get("health") === "1") {
      return json(
        res,
        200,
        {
          ok: isEmbeddingConfigured(),
          provider: getAiProvider(),
          model: isEmbeddingConfigured() ? getEmbedModelName() : null,
          dimensions: getEmbeddingDimensions(),
        },
        req,
      );
    }
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden" }, req);
  }

  if (!isEmbeddingConfigured()) {
    return json(
      res,
      503,
      {
        code: "ai_not_configured",
        error: "ai_not_configured",
        message: "הגדר GEMINI_API_KEY (או OPENAI_API_KEY) ב-Vercel ופרוס מחדש.",
      },
      req,
    );
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: "invalid_json" }, req);
  }

  const inputs = Array.isArray(body.inputs)
    ? body.inputs.map((t) => String(t || "").trim()).filter(Boolean)
    : [];
  if (!inputs.length) {
    return json(res, 400, { error: "inputs_required" }, req);
  }
  if (inputs.length > MAX_BATCH) {
    return json(res, 400, { error: "batch_too_large", max: MAX_BATCH }, req);
  }

  const { embeddings, error, retryAfterSec } = await embedTexts(inputs);

  if (error || !embeddings) {
    const rateLimited = String(error || "").includes("429");
    return json(
      res,
      rateLimited ? 429 : 503,
      {
        error: error || "embedding_failed",
        retryAfterSec,
        rateLimited,
      },
      req,
    );
  }

  return json(
    res,
    200,
    { embeddings, model: getEmbedModelName(), mode: getAiProvider(), dimensions: getEmbeddingDimensions() },
    req,
  );
}

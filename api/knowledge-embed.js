/** Vercel serverless — OpenAI embeddings for knowledge RAG (OPENAI_API_KEY only) */

import { fetchOpenAiWithRetry, getRetryAfterSec } from "../server/openaiRetry.js";

const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_MODEL = "text-embedding-3-small";
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

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  const model = String(process.env.OPENAI_EMBED_MODEL || DEFAULT_MODEL).trim();

  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.searchParams.get("health") === "1") {
      return json(res, 200, { ok: Boolean(apiKey), model: apiKey ? model : null }, req);
    }
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden" }, req);
  }

  if (!apiKey) {
    return json(
      res,
      503,
      {
        code: "openai_not_configured",
        error: "openai_not_configured",
        message: "הגדר OPENAI_API_KEY ב-Vercel (Environment Variables) ופרוס מחדש.",
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

  const openaiRes = await fetchOpenAiWithRetry(OPENAI_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: inputs }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => "");
    const retryAfterSec = openaiRes.status === 429 ? getRetryAfterSec(openaiRes) : null;
    return json(
      res,
      openaiRes.status,
      {
        error: `openai_error:${openaiRes.status}`,
        detail: errText.slice(0, 200),
        retryAfterSec,
        rateLimited: openaiRes.status === 429,
      },
      req,
    );
  }

  const data = await openaiRes.json();
  const embeddings = (data.data || [])
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((row) => row.embedding);

  return json(res, 200, { embeddings, model, mode: "openai" }, req);
}

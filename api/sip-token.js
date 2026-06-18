/**
 * @deprecated Phase 15 — SIP moved to POST /api/agent-auth (sip_token_mint / sip_token_redeem).
 * Thin backward-compat shim; remove after clients migrate.
 */
import { isSameOrigin } from "../server/knowledge/httpUtils.js";
import {
  mintSipTokenForAgent,
  redeemSipTokenForAgent,
  requireAuthenticatedAgentForSip,
  resolveSipAgentKey,
} from "../server/sip/sipTokenService.js";
import {
  checkRateLimit,
  getRateLimitKey,
  rateLimitHebrewMessage,
  recordRateLimit,
  setRateLimitHeaders,
} from "../server/http/rateLimit.js";

const sipTokenRateByIp = new Map();
const SIP_TOKEN_RATE_MAX = 30;
const SIP_TOKEN_RATE_WINDOW_MS = 60 * 60 * 1000;

function corsHeaders(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host || Array.isArray(host)) return {};
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto =
    (typeof protoHeader === "string" ? protoHeader.split(",")[0] : null) ||
    (String(host).includes("localhost") ? "http" : "https");
  const siteOrigin = `${proto}://${host}`;
  const origin = req.headers.origin;
  if (siteOrigin && typeof origin === "string" && origin === siteOrigin) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-agent-name",
      Vary: "Origin",
    };
  }
  return {};
}

async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try {
        return req.body ? JSON.parse(req.body) : {};
      } catch {
        return {};
      }
    }
    if (typeof req.body === "object") return req.body;
  }
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

function enforceSipRateLimit(res, req, userId) {
  const key = getRateLimitKey(req, userId);
  const check = checkRateLimit(
    sipTokenRateByIp,
    key,
    SIP_TOKEN_RATE_MAX,
    SIP_TOKEN_RATE_WINDOW_MS
  );
  if (!check.allowed) {
    const sec = setRateLimitHeaders(res, check.retryAfterSec);
    res.status(429).json({
      ok: false,
      reason: "rate_limited",
      retryAfterSec: sec,
      message: rateLimitHebrewMessage(sec),
    });
    return false;
  }
  recordRateLimit(check.entry);
  return true;
}

export default async function handler(req, res) {
  Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") {
    if (!isSameOrigin(req)) {
      return res.status(403).json({ ok: false, reason: "Forbidden" });
    }
    return res.status(204).end();
  }

  if (!isSameOrigin(req)) {
    return res.status(403).json({ ok: false, reason: "Forbidden" });
  }

  const auth = await requireAuthenticatedAgentForSip(req);
  if (!auth) {
    return res.status(401).json({ ok: false, reason: "נדרשת התחברות נציג" });
  }
  if (!enforceSipRateLimit(res, req, auth.agent.id)) return;

  if (req.method === "POST") {
    let body = {};
    try {
      body = await readJsonBody(req);
    } catch {
      return res.status(400).json({ ok: false, reason: "invalid_json" });
    }

    if (body.action !== "redeem") {
      return res.status(400).json({ ok: false, reason: "unknown_action" });
    }

    const result = await redeemSipTokenForAgent({
      req,
      auth,
      credentialToken: body.credentialToken,
    });
    if (!result.ok) {
      return res.status(result.status || 403).json({ ok: false, reason: result.reason });
    }
    const { status: _s, ...payload } = result;
    return res.status(200).json(payload);
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, reason: "Method not allowed" });
  }

  const agentKey = resolveSipAgentKey({
    queryAgent: req.query?.agent,
    headerAgent: req.headers["x-agent-name"],
  });
  const result = await mintSipTokenForAgent({ req, auth, agentKey });
  if (!result.ok) {
    return res.status(result.status || 400).json({ ok: false, reason: result.reason });
  }
  const { status: _s, ...payload } = result;
  return res.status(200).json(payload);
}

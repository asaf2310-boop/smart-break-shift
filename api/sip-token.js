/**
 * Vercel serverless — SIP credentials for in-browser WebRTC softphone.
 * Secrets live in server env only — not embedded in Vite build.
 *
 * Multi-agent:
 *   GET /api/sip-token?agent=101
 *   GET /api/sip-token?agent=רחלה%20מנשה
 *   Header: Authorization: Bearer <supabase-jwt>
 *
 * Env patterns:
 *   SIP_USER_101 / SIP_PASSWORD_101  — per extension
 *   SIP_AGENT_MAP={"שם נציג":"101",...}  — name → extension
 *   SIP_USER / SIP_PASSWORD — fallback when no agent resolved
 *   SIP_TOKEN_SECRET (or GUEST_LINK_SECRET) — encrypts short-lived credential tokens
 */

import { verifyBearerAgent } from "../server/agent/agentAuthService.js";
import { isSameOrigin } from "../server/knowledge/httpUtils.js";
import {
  DEFAULT_SIP_CREDENTIAL_TTL_SEC,
  redeemSipCredentialToken,
  signSipCredentialToken,
  sipCredentialTokenConfigured,
} from "../server/sip/sipCredentialToken.js";

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

function parseAgentMap() {
  const raw = process.env.SIP_AGENT_MAP?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function resolveAgentKey(req) {
  const queryAgent = req.query?.agent;
  if (typeof queryAgent === "string" && queryAgent.trim()) {
    return queryAgent.trim();
  }
  const header = req.headers["x-agent-name"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  return null;
}

function resolveExtension(agentKey) {
  if (!agentKey) return null;
  if (/^\d{3,5}$/.test(agentKey)) return agentKey;
  const map = parseAgentMap();
  const mapped = map[agentKey];
  if (mapped != null && String(mapped).trim()) {
    return String(mapped).replace(/\D/g, "") || String(mapped).trim();
  }
  return null;
}

function resolveSipCredentials(extension) {
  const domain = process.env.SIP_DOMAIN?.trim();
  const wsUrl =
    process.env.SIP_WS_URL?.trim() || process.env.VITE_SIP_WS_URL?.trim() || "";

  if (extension) {
    const ext = String(extension).replace(/\D/g, "") || extension;
    const user = process.env[`SIP_USER_${ext}`]?.trim();
    const password = process.env[`SIP_PASSWORD_${ext}`]?.trim();
    if (user && password && domain && wsUrl) {
      return { wsUrl, user, password, domain, extension: ext };
    }
  }

  const user = process.env.SIP_USER?.trim();
  const password = process.env.SIP_PASSWORD?.trim();
  if (user && password && domain && wsUrl) {
    return { wsUrl, user, password, domain, extension: null };
  }

  return null;
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

async function requireAuthenticatedAgent(req, res) {
  const auth = await verifyBearerAgent(req);
  if (!auth?.agent) {
    res.status(401).json({ ok: false, reason: "נדרשת התחברות נציג" });
    return null;
  }
  return auth;
}

function agentMatchesRequested(auth, agentKey) {
  if (!agentKey) return true;
  const requested = normalizeName(agentKey);
  const displayName = normalizeName(auth.agent.displayName);
  if (displayName && (displayName === requested || displayName.includes(requested))) {
    return true;
  }
  const extension = resolveExtension(agentKey);
  if (extension) {
    const creds = resolveSipCredentials(extension);
    if (creds?.user) return true;
  }
  return !agentKey;
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

  if (req.method === "POST") {
    const auth = await requireAuthenticatedAgent(req, res);
    if (!auth) return;

    let body = {};
    try {
      body = await readJsonBody(req);
    } catch {
      return res.status(400).json({ ok: false, reason: "invalid_json" });
    }

    if (body.action !== "redeem") {
      return res.status(400).json({ ok: false, reason: "unknown_action" });
    }

    const token = String(body.credentialToken || "").trim();
    if (!token) {
      return res.status(400).json({ ok: false, reason: "credential_token_required" });
    }

    const redeemed = redeemSipCredentialToken(token);
    if (!redeemed.ok) {
      const status = redeemed.error === "expired" ? 410 : 403;
      return res.status(status).json({ ok: false, reason: redeemed.error });
    }

    const clientUser = process.env.VITE_SIP_USER?.trim() || redeemed.user;
    return res.status(200).json({
      ok: true,
      wsUrl: redeemed.wsUrl,
      user: clientUser,
      password: redeemed.password,
      domain: redeemed.domain,
      extension: redeemed.extension,
      aor: `sip:${clientUser}@${redeemed.domain}`,
    });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, reason: "Method not allowed" });
  }

  const auth = await requireAuthenticatedAgent(req, res);
  if (!auth) return;

  const agentKey = resolveAgentKey(req);
  if (!agentMatchesRequested(auth, agentKey)) {
    return res.status(403).json({ ok: false, reason: "אין הרשאה לנציג המבוקש" });
  }

  const extension = resolveExtension(agentKey);
  const creds = resolveSipCredentials(extension);

  if (!creds) {
    const hint = agentKey
      ? `לא נמצאו אישורי SIP לנציג «${agentKey}» (SIP_USER_${extension || "XXX"} / SIP_AGENT_MAP)`
      : "SIP לא מוגדר בשרת (SIP_WS_URL, SIP_USER, SIP_PASSWORD, SIP_DOMAIN)";
    return res.status(503).json({ ok: false, reason: hint });
  }

  if (!sipCredentialTokenConfigured()) {
    return res.status(503).json({
      ok: false,
      reason: "הגדר SIP_TOKEN_SECRET (או GUEST_LINK_SECRET) ב-Vercel",
    });
  }

  const clientUser = process.env.VITE_SIP_USER?.trim() || creds.user;
  const credentialToken = signSipCredentialToken({
    user: creds.user,
    password: creds.password,
    wsUrl: creds.wsUrl,
    domain: creds.domain,
    extension: creds.extension,
    ttlSec: DEFAULT_SIP_CREDENTIAL_TTL_SEC,
  });

  return res.status(200).json({
    ok: true,
    wsUrl: creds.wsUrl,
    user: clientUser,
    domain: creds.domain,
    extension: creds.extension,
    aor: `sip:${clientUser}@${creds.domain}`,
    credentialToken,
    expiresInSec: DEFAULT_SIP_CREDENTIAL_TTL_SEC,
  });
}

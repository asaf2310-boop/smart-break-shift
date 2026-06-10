/**
 * Vercel serverless — SIP credentials for in-browser WebRTC softphone.
 * Secrets live in server env only — not embedded in Vite build.
 *
 * Multi-agent:
 *   GET /api/sip-token?agent=101
 *   GET /api/sip-token?agent=רחלה%20מנשה
 *   Header: x-agent-name (optional fallback)
 *
 * Env patterns:
 *   SIP_USER_101 / SIP_PASSWORD_101  — per extension
 *   SIP_AGENT_MAP={"שם נציג":"101",...}  — name → extension
 *   SIP_USER / SIP_PASSWORD — fallback when no agent resolved
 */

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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
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

export default async function handler(req, res) {
  Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, reason: "Method not allowed" });
  }

  if (!isSameOrigin(req)) {
    return res.status(403).json({ ok: false, reason: "Forbidden" });
  }

  const agentKey = resolveAgentKey(req);
  const extension = resolveExtension(agentKey);
  const creds = resolveSipCredentials(extension);

  if (!creds) {
    const hint = agentKey
      ? `לא נמצאו אישורי SIP לנציג «${agentKey}» (SIP_USER_${extension || "XXX"} / SIP_AGENT_MAP)`
      : "SIP לא מוגדר בשרת (SIP_WS_URL, SIP_USER, SIP_PASSWORD, SIP_DOMAIN)";
    return res.status(503).json({ ok: false, reason: hint });
  }

  const clientUser = process.env.VITE_SIP_USER?.trim() || creds.user;

  return res.status(200).json({
    ok: true,
    wsUrl: creds.wsUrl,
    user: clientUser,
    password: creds.password,
    domain: creds.domain,
    extension: creds.extension,
    aor: `sip:${clientUser}@${creds.domain}`,
  });
}

/**
 * Vercel serverless — SIP credentials for in-browser WebRTC softphone.
 * Secrets live in server env only (SIP_USER, SIP_PASSWORD, SIP_DOMAIN).
 * Client fetches at connect time — not embedded in Vite build.
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

  const user = process.env.SIP_USER?.trim();
  const password = process.env.SIP_PASSWORD?.trim();
  const domain = process.env.SIP_DOMAIN?.trim();
  const wsUrl =
    process.env.SIP_WS_URL?.trim() || process.env.VITE_SIP_WS_URL?.trim() || "";

  if (!wsUrl || !user || !password || !domain) {
    return res.status(503).json({
      ok: false,
      reason: "SIP לא מוגדר בשרת (SIP_WS_URL, SIP_USER, SIP_PASSWORD, SIP_DOMAIN)",
    });
  }

  const clientUser = process.env.VITE_SIP_USER?.trim() || user;

  return res.status(200).json({
    ok: true,
    wsUrl,
    user: clientUser,
    password,
    domain,
    aor: `sip:${clientUser}@${domain}`,
  });
}

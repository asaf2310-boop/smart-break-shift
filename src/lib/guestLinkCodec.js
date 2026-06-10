export const GUEST_BOOTSTRAP_QUERY_KEY = "b";

const SHORT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateShortCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += SHORT_CODE_CHARS[Math.floor(Math.random() * SHORT_CODE_CHARS.length)];
  }
  return code;
}

function toBase64Url(str) {
  if (typeof btoa === "undefined") return "";
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded) {
  if (!encoded || typeof atob === "undefined") return null;
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    const binary = atob(padded + "=".repeat(padLen));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeGuestBootstrapPayload(session, kind = "screen") {
  if (!session?.id || !session.createdAt) return "";
  const payload = {
    i: session.id,
    c: session.createdAt,
    a: String(session.agentName || "").slice(0, 120),
    e: String(session.customerEmail || "").slice(0, 200),
    r: session.crmCustomerId || null,
    k: kind === "consent" ? "c" : "s",
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeGuestBootstrapPayload(encoded) {
  const json = fromBase64Url(encoded);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed?.c || Number.isNaN(new Date(parsed.c).getTime())) return null;
    return {
      sessionId: parsed.i ? String(parsed.i) : null,
      kind: parsed.k === "c" ? "consent" : "screen",
      createdAt: parsed.c,
      agentName: String(parsed.a || "").slice(0, 120),
      customerEmail: String(parsed.e || "").slice(0, 200),
      crmCustomerId: parsed.r || null,
    };
  } catch {
    return null;
  }
}

export function encodeCompactGuestToken(session, kind = "screen") {
  if (!session?.id || !session.createdAt) return "";
  const payload = {
    k: kind === "consent" ? "c" : "s",
    i: session.id,
    c: session.createdAt,
  };
  const agent = String(session.agentName || "").trim();
  const email = String(session.customerEmail || "").trim();
  if (agent) payload.a = agent.slice(0, 80);
  if (email) payload.e = email.slice(0, 120);
  if (session.crmCustomerId) payload.r = session.crmCustomerId;
  return toBase64Url(JSON.stringify(payload));
}

export function decodeCompactGuestToken(token) {
  const json = fromBase64Url(token);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed?.i || !parsed?.c) return null;
    const kind = parsed.k === "c" ? "consent" : "screen";
    return {
      kind,
      sessionId: String(parsed.i),
      createdAt: parsed.c,
      agentName: String(parsed.a || "").slice(0, 120),
      customerEmail: String(parsed.e || "").slice(0, 200),
      crmCustomerId: parsed.r || null,
    };
  } catch {
    return null;
  }
}

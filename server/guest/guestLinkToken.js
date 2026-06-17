import { createHmac, timingSafeEqual } from "node:crypto";

export const GUEST_LINK_TOKEN_PREFIX = "g1.";
export const DEFAULT_GUEST_LINK_TTL_SEC = 24 * 60 * 60;

export function getGuestLinkTtlSec() {
  const env = parseInt(process.env.GUEST_LINK_TTL_SEC || "", 10);
  if (Number.isFinite(env) && env >= 300) return env;
  return DEFAULT_GUEST_LINK_TTL_SEC;
}

function getGuestLinkSecret() {
  return String(process.env.GUEST_LINK_SECRET || "").trim();
}

export function guestLinkSecretConfigured() {
  return Boolean(getGuestLinkSecret());
}

function canonicalString(payload) {
  return `${payload.sid}|${payload.sc || ""}|${payload.k}|${payload.exp}|${payload.iat}`;
}

function parsePayloadJson(payloadB64) {
  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed?.sid || !parsed?.exp || !parsed?.iat || !parsed?.k) return null;
    return {
      sid: String(parsed.sid),
      sc: parsed.sc ? String(parsed.sc) : "",
      k: parsed.k === "c" ? "c" : "s",
      exp: Number(parsed.exp),
      iat: Number(parsed.iat),
    };
  } catch {
    return null;
  }
}

export function isSignedGuestLinkToken(token) {
  return String(token || "").startsWith(GUEST_LINK_TOKEN_PREFIX);
}

export function signGuestLinkToken({ sessionId, shortCode, kind, ttlSec = getGuestLinkTtlSec() }) {
  const secret = getGuestLinkSecret();
  if (!secret) {
    throw new Error("guest_link_secret_missing");
  }

  const sid = String(sessionId || "").trim();
  if (!sid) {
    throw new Error("invalid_session");
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + Math.max(60, Number(ttlSec) || getGuestLinkTtlSec());
  const k = kind === "consent" ? "c" : "s";
  const payload = { sid, sc: shortCode ? String(shortCode) : "", k, exp, iat };
  const sig = createHmac("sha256", secret).update(canonicalString(payload)).digest("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${GUEST_LINK_TOKEN_PREFIX}${payloadB64}.${sig}`;
}

export function verifyGuestLinkToken(token) {
  const trimmed = String(token || "").trim();
  if (!isSignedGuestLinkToken(trimmed)) {
    return { ok: false, error: "invalid_token" };
  }

  const secret = getGuestLinkSecret();
  if (!secret) {
    return { ok: false, error: "guest_link_secret_missing" };
  }

  const body = trimmed.slice(GUEST_LINK_TOKEN_PREFIX.length);
  const dot = body.lastIndexOf(".");
  if (dot <= 0) {
    return { ok: false, error: "invalid_token" };
  }

  const payloadB64 = body.slice(0, dot);
  const sig = body.slice(dot + 1);
  const payload = parsePayloadJson(payloadB64);
  if (!payload || !sig) {
    return { ok: false, error: "invalid_token" };
  }

  const expected = createHmac("sha256", secret).update(canonicalString(payload)).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, error: "invalid_token" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp < now) {
    return { ok: false, error: "expired" };
  }

  return {
    ok: true,
    sessionId: payload.sid,
    shortCode: payload.sc || null,
    kind: payload.k === "c" ? "consent" : "screen",
    exp: payload.exp,
  };
}

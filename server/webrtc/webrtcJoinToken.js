import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBRTC_JOIN_TOKEN_PREFIX = "wj1.";
export const DEFAULT_WEBRTC_JOIN_TTL_SEC = 15 * 60;

export function getWebrtcJoinTtlSec() {
  const env = parseInt(process.env.WEBRTC_JOIN_TTL_SEC || "", 10);
  if (Number.isFinite(env) && env >= 60 && env <= 3600) return env;
  return DEFAULT_WEBRTC_JOIN_TTL_SEC;
}

export function webrtcJoinRequireEnabled() {
  const raw = String(process.env.WEBRTC_JOIN_REQUIRE ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0";
}

function getJoinSecret() {
  return String(process.env.GUEST_LINK_SECRET || "").trim();
}

function canonicalString(payload) {
  return `${payload.sid}|${payload.r}|${payload.fp || ""}|${payload.aid || ""}|${payload.exp}|${payload.iat}`;
}

function parsePayloadJson(payloadB64) {
  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed?.sid || !parsed?.exp || !parsed?.iat || !parsed?.r) return null;
    return {
      sid: String(parsed.sid),
      r: parsed.r === "a" ? "a" : "g",
      fp: parsed.fp ? String(parsed.fp) : "",
      aid: parsed.aid ? String(parsed.aid) : "",
      exp: Number(parsed.exp),
      iat: Number(parsed.iat),
    };
  } catch {
    return null;
  }
}

export function signWebrtcJoinToken({
  sessionId,
  role,
  fingerprint = null,
  agentId = null,
  ttlSec = getWebrtcJoinTtlSec(),
}) {
  const secret = getJoinSecret();
  if (!secret) throw new Error("guest_link_secret_missing");

  const sid = String(sessionId || "").trim();
  if (!sid) throw new Error("invalid_session");

  const r = role === "agent" || role === "a" ? "a" : "g";
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + Math.max(60, Number(ttlSec) || getWebrtcJoinTtlSec());
  const payload = {
    sid,
    r,
    fp: fingerprint ? String(fingerprint) : "",
    aid: agentId ? String(agentId) : "",
    exp,
    iat,
  };
  const sig = createHmac("sha256", secret).update(canonicalString(payload)).digest("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${WEBRTC_JOIN_TOKEN_PREFIX}${payloadB64}.${sig}`;
}

export function verifyWebrtcJoinToken(token) {
  const trimmed = String(token || "").trim();
  if (!trimmed.startsWith(WEBRTC_JOIN_TOKEN_PREFIX)) {
    return { ok: false, error: "invalid_token" };
  }

  const secret = getJoinSecret();
  if (!secret) return { ok: false, error: "guest_link_secret_missing" };

  const body = trimmed.slice(WEBRTC_JOIN_TOKEN_PREFIX.length);
  const dot = body.lastIndexOf(".");
  if (dot <= 0) return { ok: false, error: "invalid_token" };

  const payloadB64 = body.slice(0, dot);
  const sig = body.slice(dot + 1);
  const payload = parsePayloadJson(payloadB64);
  if (!payload || !sig) return { ok: false, error: "invalid_token" };

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
    role: payload.r === "a" ? "agent" : "guest",
    fingerprint: payload.fp || null,
    agentId: payload.aid || null,
    exp: payload.exp,
  };
}

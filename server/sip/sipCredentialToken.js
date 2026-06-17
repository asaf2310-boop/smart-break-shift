import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SIP_CREDENTIAL_TOKEN_PREFIX = "s1.";
export const DEFAULT_SIP_CREDENTIAL_TTL_SEC = 5 * 60;

function getSipTokenSecret() {
  return String(
    process.env.SIP_TOKEN_SECRET || process.env.GUEST_LINK_SECRET || ""
  ).trim();
}

function deriveKey(secret) {
  return createHash("sha256").update(`sip-cred:${secret}`).digest();
}

export function sipCredentialTokenConfigured() {
  return Boolean(getSipTokenSecret());
}

export function signSipCredentialToken({
  user,
  password,
  wsUrl,
  domain,
  extension = null,
  ttlSec = DEFAULT_SIP_CREDENTIAL_TTL_SEC,
}) {
  const secret = getSipTokenSecret();
  if (!secret) throw new Error("sip_token_secret_missing");

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + Math.max(60, Number(ttlSec) || DEFAULT_SIP_CREDENTIAL_TTL_SEC);
  const payload = {
    u: String(user || ""),
    p: String(password || ""),
    w: String(wsUrl || ""),
    d: String(domain || ""),
    e: extension != null ? String(extension) : "",
    exp,
    iat,
    n: randomBytes(8).toString("base64url"),
  };

  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, tag, encrypted]).toString("base64url");
  return `${SIP_CREDENTIAL_TOKEN_PREFIX}${blob}`;
}

export function redeemSipCredentialToken(token) {
  const trimmed = String(token || "").trim();
  if (!trimmed.startsWith(SIP_CREDENTIAL_TOKEN_PREFIX)) {
    return { ok: false, error: "invalid_token" };
  }

  const secret = getSipTokenSecret();
  if (!secret) return { ok: false, error: "sip_token_secret_missing" };

  try {
    const blob = Buffer.from(trimmed.slice(SIP_CREDENTIAL_TOKEN_PREFIX.length), "base64url");
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const encrypted = blob.subarray(28);
    const key = deriveKey(secret);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const payload = JSON.parse(json);

    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(payload.exp) || payload.exp < now) {
      return { ok: false, error: "expired" };
    }

    return {
      ok: true,
      user: payload.u,
      password: payload.p,
      wsUrl: payload.w,
      domain: payload.d,
      extension: payload.e || null,
      exp: payload.exp,
    };
  } catch {
    return { ok: false, error: "invalid_token" };
  }
}

/** Constant-time prefix check for token format validation. */
export function isSipCredentialToken(token) {
  const trimmed = String(token || "");
  const prefix = SIP_CREDENTIAL_TOKEN_PREFIX;
  if (trimmed.length < prefix.length) return false;
  const a = Buffer.from(trimmed.slice(0, prefix.length));
  const b = Buffer.from(prefix);
  return a.length === b.length && timingSafeEqual(a, b);
}

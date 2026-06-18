import { createHmac } from "node:crypto";
import { getClientIp } from "../http/rateLimit.js";

function getFingerprintSecret() {
  return String(process.env.GUEST_LINK_SECRET || "").trim();
}

export function fingerprintBindEnabled() {
  const raw = String(process.env.GUEST_SESSION_FINGERPRINT_BIND ?? "true")
    .trim()
    .toLowerCase();
  return raw !== "false" && raw !== "0";
}

/**
 * Stable client binding from IP + User-Agent (hashed — not stored raw).
 */
export function computeClientFingerprint(req) {
  const secret = getFingerprintSecret();
  if (!secret) return "anonymous";
  const ip = getClientIp(req);
  const ua = String(req?.headers?.["user-agent"] || "")
    .trim()
    .slice(0, 256);
  return createHmac("sha256", secret)
    .update(`fp:${ip}|${ua}`)
    .digest("base64url")
    .slice(0, 32);
}

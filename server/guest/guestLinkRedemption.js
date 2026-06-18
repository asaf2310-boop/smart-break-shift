import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";
import { computeClientFingerprint, fingerprintBindEnabled } from "./guestSessionFingerprint.js";
import { guestLinkOneTimeEnabled } from "./guestLinkOneTime.js";
import { getGuestLinkTtlSec } from "./guestLinkToken.js";

/** @type {Map<string, { fp: string, expiresAt: number }>} */
const memoryBindings = new Map();

function hashToken(token) {
  return createHash("sha256").update(String(token).trim()).digest("hex");
}

function pruneMemory(now = Date.now()) {
  for (const [key, entry] of memoryBindings.entries()) {
    if (entry.expiresAt <= now) memoryBindings.delete(key);
  }
}

function memoryGet(tokenHash) {
  pruneMemory();
  return memoryBindings.get(tokenHash) || null;
}

function memorySet(tokenHash, fp, expiresAtMs) {
  pruneMemory();
  memoryBindings.set(tokenHash, { fp, expiresAt: expiresAtMs });
}

async function loadBinding(tokenHash) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return memoryGet(tokenHash);

  const { data, error } = await supabase
    .from("guest_link_redemptions")
    .select("client_fingerprint, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.warn("[guestLinkRedemption] load failed", error.message);
    return memoryGet(tokenHash);
  }

  if (!data) return memoryGet(tokenHash);

  const expiresAt = new Date(data.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return { fp: data.client_fingerprint, expiresAt };
}

async function insertBinding(tokenHash, sessionId, fp, expiresAtIso) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("guest_link_redemptions").insert({
      token_hash: tokenHash,
      session_id: String(sessionId),
      client_fingerprint: fp,
      expires_at: expiresAtIso,
    });

    if (!error) return { ok: true };

    if (String(error.message || "").includes("duplicate")) {
      return { ok: false, duplicate: true };
    }
    console.warn("[guestLinkRedemption] insert failed", error.message);
  }

  memorySet(tokenHash, fp, new Date(expiresAtIso).getTime());
  return { ok: true };
}

/**
 * First resolve (or lazy bind) — records fingerprint; enforces one-time when enabled.
 */
export async function redeemGuestLinkOnResolve(token, sessionId, req) {
  if (!fingerprintBindEnabled() && !guestLinkOneTimeEnabled()) {
    return { ok: true };
  }

  const fp = computeClientFingerprint(req);
  const tokenHash = hashToken(token);
  const ttlSec = getGuestLinkTtlSec();
  const expiresAtIso = new Date(Date.now() + ttlSec * 1000).toISOString();

  const existing = await loadBinding(tokenHash);
  if (existing) {
    if (guestLinkOneTimeEnabled()) {
      return {
        ok: false,
        error: "already_used",
        message: "קישור זה כבר נוצל (שימוש חד-פעמי)",
      };
    }
    if (fingerprintBindEnabled() && existing.fp !== fp) {
      return {
        ok: false,
        error: "fingerprint_mismatch",
        message: "קישור זה נפתח ממכשיר אחר",
      };
    }
    return { ok: true, fingerprint: fp };
  }

  const inserted = await insertBinding(tokenHash, sessionId, fp, expiresAtIso);
  if (inserted.duplicate) {
    if (guestLinkOneTimeEnabled()) {
      return {
        ok: false,
        error: "already_used",
        message: "קישור זה כבר נוצל (שימוש חד-פעמי)",
      };
    }
    const raced = await loadBinding(tokenHash);
    if (raced && fingerprintBindEnabled() && raced.fp !== fp) {
      return {
        ok: false,
        error: "fingerprint_mismatch",
        message: "קישור זה נפתח ממכשיר אחר",
      };
    }
  }

  return { ok: true, fingerprint: fp };
}

/**
 * Verify guest API calls match the client that redeemed the link.
 */
export async function verifyOrBindGuestTokenFingerprint(token, sessionId, req) {
  if (!fingerprintBindEnabled()) return { ok: true };

  const fp = computeClientFingerprint(req);
  const tokenHash = hashToken(token);
  const existing = await loadBinding(tokenHash);

  if (!existing) {
    return redeemGuestLinkOnResolve(token, sessionId, req);
  }

  if (existing.expiresAt <= Date.now()) {
    return { ok: false, error: "expired" };
  }

  if (existing.fp !== fp) {
    return {
      ok: false,
      error: "fingerprint_mismatch",
      message: "גישה נדחתה — הקישור נפתח ממכשיר אחר",
    };
  }

  return { ok: true, fingerprint: fp };
}

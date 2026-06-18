import { logSecurityEvent } from "../security/auditLog.js";
import { verifyBearerAgent } from "../agent/agentAuthService.js";
import {
  getSipCredentialTtlSec,
  redeemSipCredentialToken,
  signSipCredentialToken,
  sipCredentialTokenConfigured,
} from "./sipCredentialToken.js";
import { consumeSipCredentialNonce } from "./sipRedeemStore.js";

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

export function resolveSipAgentKey({ queryAgent, headerAgent, bodyAgent } = {}) {
  if (typeof queryAgent === "string" && queryAgent.trim()) return queryAgent.trim();
  if (typeof headerAgent === "string" && headerAgent.trim()) return headerAgent.trim();
  if (typeof bodyAgent === "string" && bodyAgent.trim()) return bodyAgent.trim();
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

export function resolveSipCredentials(extension) {
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

export async function mintSipTokenForAgent({ req, auth, agentKey }) {
  if (!auth?.agent) {
    return { ok: false, status: 401, reason: "נדרשת התחברות נציג" };
  }

  if (!agentMatchesRequested(auth, agentKey)) {
    return { ok: false, status: 403, reason: "אין הרשאה לנציג המבוקש" };
  }

  const extension = resolveExtension(agentKey);
  const creds = resolveSipCredentials(extension);

  if (!creds) {
    const hint = agentKey
      ? `לא נמצאו אישורי SIP לנציג «${agentKey}» (SIP_USER_${extension || "XXX"} / SIP_AGENT_MAP)`
      : "SIP לא מוגדר בשרת (SIP_WS_URL, SIP_USER, SIP_PASSWORD, SIP_DOMAIN)";
    return { ok: false, status: 503, reason: hint };
  }

  if (!sipCredentialTokenConfigured()) {
    return {
      ok: false,
      status: 503,
      reason: "הגדר SIP_TOKEN_SECRET (או GUEST_LINK_SECRET) ב-Vercel",
    };
  }

  const ttlSec = getSipCredentialTtlSec();
  const clientUser = process.env.VITE_SIP_USER?.trim() || creds.user;
  const credentialToken = signSipCredentialToken({
    user: creds.user,
    password: creds.password,
    wsUrl: creds.wsUrl,
    domain: creds.domain,
    extension: creds.extension,
    ttlSec,
  });

  void logSecurityEvent({
    action: "sip_token_mint",
    actorAgentId: auth.agent.id,
    resourceType: "sip_extension",
    resourceId: creds.extension || creds.user,
    metadata: { agentKey: agentKey || null, ttlSec },
    req,
  });

  return {
    ok: true,
    status: 200,
    wsUrl: creds.wsUrl,
    user: clientUser,
    domain: creds.domain,
    extension: creds.extension,
    aor: `sip:${clientUser}@${creds.domain}`,
    credentialToken,
    expiresInSec: ttlSec,
  };
}

export async function redeemSipTokenForAgent({ req, auth, credentialToken }) {
  if (!auth?.agent) {
    return { ok: false, status: 401, reason: "נדרשת התחברות נציג" };
  }

  const token = String(credentialToken || "").trim();
  if (!token) {
    return { ok: false, status: 400, reason: "credential_token_required" };
  }

  const redeemed = redeemSipCredentialToken(token);
  if (!redeemed.ok) {
    const status = redeemed.error === "expired" ? 410 : 403;
    return { ok: false, status, reason: redeemed.error };
  }

  if (!redeemed.nonce || !consumeSipCredentialNonce(redeemed.nonce, redeemed.exp)) {
    return { ok: false, status: 410, reason: "already_redeemed" };
  }

  void logSecurityEvent({
    action: "sip_token_redeem",
    actorAgentId: auth.agent.id,
    resourceType: "sip_extension",
    resourceId: redeemed.extension || redeemed.user,
    metadata: { extension: redeemed.extension },
    req,
  });

  const clientUser = process.env.VITE_SIP_USER?.trim() || redeemed.user;
  return {
    ok: true,
    status: 200,
    wsUrl: redeemed.wsUrl,
    user: clientUser,
    password: redeemed.password,
    domain: redeemed.domain,
    extension: redeemed.extension,
    aor: `sip:${clientUser}@${redeemed.domain}`,
  };
}

export async function requireAuthenticatedAgentForSip(req) {
  const auth = await verifyBearerAgent(req);
  if (!auth?.agent) return null;
  return auth;
}

/**
 * Production telephony integration (stub).
 * Real WebRTC/SIP or Twilio Voice requires server-side secrets and HTTPS.
 */

export function getSipConfig() {
  const wsUrl = import.meta.env.VITE_SIP_WS_URL?.trim();
  const user = import.meta.env.VITE_SIP_USER?.trim();
  const password = import.meta.env.VITE_SIP_PASSWORD?.trim();
  if (!wsUrl || !user) return null;
  return { wsUrl, user, hasPassword: Boolean(password) };
}

export function getTwilioConfig() {
  const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID?.trim();
  const apiKey = import.meta.env.VITE_TWILIO_API_KEY?.trim();
  const appSid = import.meta.env.VITE_TWILIO_TWIML_APP_SID?.trim();
  if (!accountSid && !apiKey && !appSid) return null;
  return { accountSid: Boolean(accountSid), apiKey: Boolean(apiKey), appSid: Boolean(appSid) };
}

/** @returns {'sip' | 'twilio' | null} */
export function getConfiguredProvider() {
  if (getSipConfig()) return "sip";
  if (getTwilioConfig()) return "twilio";
  return null;
}

export function isTelephonyConfigured() {
  return getConfiguredProvider() != null;
}

export function isHttpsRequired() {
  return typeof window !== "undefined" && window.location?.protocol === "http:";
}

/**
 * Placeholder for production dial — not implemented in this repo.
 * @returns {Promise<{ ok: false, reason: string }>}
 */
export async function connectProductionCall() {
  const provider = getConfiguredProvider();
  if (!provider) {
    return { ok: false, reason: "לא הוגדר ספק טלפוניה (SIP או Twilio)" };
  }
  if (isHttpsRequired()) {
    return { ok: false, reason: "WebRTC דורש HTTPS — פרסמו ב-Vercel או דומה" };
  }
  return {
    ok: false,
    reason:
      provider === "sip"
        ? "אינטגרציית SIP/WebRTC טרם מומשה — ראו docs/TELEPHONY_SETUP.md"
        : "אינטגרציית Twilio Voice טרם מומשה — ראו docs/TELEPHONY_SETUP.md",
  };
}

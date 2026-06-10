/**
<<<<<<< HEAD
 * In-browser WebRTC softphone via sip.js (WSS + WebRTC).
 * Demo simulation stays in telephonyStore when SIP is not configured.
 *
 * Library choice: sip.js — actively maintained, SimpleUser API for WSS/WebRTC,
 * TypeScript-friendly, no jQuery dependency (unlike legacy JsSIP bundles).
 */

import { Web } from "sip.js";
import { parseIceServers } from "@/lib/webrtcConfig";

/** @typedef {'idle' | 'connecting' | 'registered' | 'unregistered' | 'error'} SipRegistrationState */

/** @type {Web.SimpleUser | null} */
let simpleUser = null;
/** @type {SipRegistrationState} */
let registrationState = "idle";
let registrationError = null;
let sipConfig = null;
/** @type {HTMLAudioElement | null} */
let remoteAudioEl = null;
/** @type {null | ((event: Record<string, unknown>) => void)} */
let eventHandler = null;
let connectInFlight = null;

export const SIP_REGISTRATION = {
  idle: "idle",
  connecting: "connecting",
  registered: "registered",
  unregistered: "unregistered",
  error: "error",
};

=======
 * Production telephony integration (stub).
 * Real WebRTC/SIP or Twilio Voice requires server-side secrets and HTTPS.
 */

>>>>>>> 842dd9e (Initial commit)
export function getSipConfig() {
  const wsUrl = import.meta.env.VITE_SIP_WS_URL?.trim();
  const user = import.meta.env.VITE_SIP_USER?.trim();
  const password = import.meta.env.VITE_SIP_PASSWORD?.trim();
<<<<<<< HEAD
  if (!wsUrl) return null;
  return {
    wsUrl,
    user: user || null,
    hasClientPassword: Boolean(password),
    usesServerCredentials: !password,
  };
=======
  if (!wsUrl || !user) return null;
  return { wsUrl, user, hasPassword: Boolean(password) };
>>>>>>> 842dd9e (Initial commit)
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

<<<<<<< HEAD
export function isSipTelephonyActive() {
  return Boolean(simpleUser && sipConfig);
}

export function getSipRegistrationState() {
  return registrationState;
}

export function getSipRegistrationError() {
  return registrationError;
}

/**
 * @param {{ remoteAudioEl?: HTMLAudioElement | null, onEvent?: (event: Record<string, unknown>) => void }} options
 */
export function initSipTelephony({ remoteAudioEl: audioEl = null, onEvent } = {}) {
  if (audioEl) remoteAudioEl = audioEl;
  if (typeof onEvent === "function") eventHandler = onEvent;
}

function emit(event) {
  eventHandler?.(event);
}

function setRegistrationState(state, error = null) {
  registrationState = state;
  registrationError = error;
  emit({ type: "registration", state, error });
}

function normalizePhone(raw) {
  return String(raw || "").replace(/\s/g, "").trim();
}

function extractCallerPhone(session) {
  try {
    const uri = session?.remoteIdentity?.uri;
    if (uri?.user) return decodeURIComponent(uri.user);
    if (typeof uri?.toString === "function") {
      const match = uri.toString().match(/sip:([^@;>]+)/i);
      if (match?.[1]) return decodeURIComponent(match[1]);
    }
  } catch {
    /* ignore parse errors */
  }
  return "unknown";
}

function getCurrentAgentNameForSip() {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("agent_name")?.trim() || "";
  } catch {
    return "";
  }
}

export { parseIceServers };

function buildOutboundDestination(phone, domain) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error("הזינו מספר טלפון");
  if (normalized.includes("@")) return normalized.startsWith("sip:") ? normalized : `sip:${normalized}`;
  const digits = normalized.replace(/[^\d+]/g, "");
  return `sip:${digits}@${domain}`;
}

async function fetchSipCredentials() {
  const local = getSipConfig();
  if (!local?.wsUrl) return null;

  if (local.hasClientPassword && local.user) {
    const domain =
      import.meta.env.VITE_SIP_DOMAIN?.trim() ||
      (() => {
        try {
          const host = new URL(local.wsUrl).hostname;
          return host.replace(/^ws\./i, "");
        } catch {
          return "localhost";
        }
      })();
    return {
      wsUrl: local.wsUrl,
      user: local.user,
      password: import.meta.env.VITE_SIP_PASSWORD?.trim() || "",
      domain,
      aor: `sip:${local.user}@${domain}`,
      source: "client-env",
    };
  }

  try {
    const agentName = getCurrentAgentNameForSip();
    const params = agentName ? `?agent=${encodeURIComponent(agentName)}` : "";
    const headers = agentName ? { "x-agent-name": agentName } : {};
    const res = await fetch(`/api/sip-token${params}`, {
      credentials: "same-origin",
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      return {
        error: data?.reason || `שגיאת שרת SIP (${res.status})`,
      };
    }
    return { ...data, source: "server" };
  } catch (err) {
    return { error: err?.message || "לא ניתן להתחבר לשרת SIP" };
  }
}

function ensureRemoteAudio() {
  if (remoteAudioEl) return remoteAudioEl;
  if (typeof document === "undefined") return null;
  const el = document.createElement("audio");
  el.id = "sip-remote-audio";
  el.autoplay = true;
  el.playsInline = true;
  el.hidden = true;
  document.body.appendChild(el);
  remoteAudioEl = el;
  return el;
}

function attachSimpleUserDelegates(user) {
  user.delegate = {
    onCallReceived: async () => {
      const phone = extractCallerPhone(user.session);
      emit({
        type: "inbound-ringing",
        phone,
        sessionId: user.session?.id || `sip_${Date.now()}`,
      });
    },
    onCallAnswered: () => {
      emit({
        type: "connected",
        connectedAt: new Date().toISOString(),
        direction: user.session?.direction || "unknown",
      });
    },
    onCallCreated: () => {
      const phone = extractCallerPhone(user.session);
      const direction = user.session?.direction;
      if (direction === "outgoing") {
        emit({
          type: "outbound-progress",
          phone,
          status: "dialing",
          sessionId: user.session?.id || `sip_${Date.now()}`,
        });
      }
    },
    onCallHangup: () => {
      emit({ type: "ended" });
    },
    onCallHold: (held) => {
      emit({ type: "hold", held });
    },
    onRegistered: () => {
      setRegistrationState(SIP_REGISTRATION.registered);
    },
    onUnregistered: () => {
      setRegistrationState(SIP_REGISTRATION.unregistered);
    },
    onServerConnect: () => {
      /* connected to WSS */
    },
    onServerDisconnect: (error) => {
      if (error) {
        setRegistrationState(SIP_REGISTRATION.error, error?.message || "ניתוק משרת SIP");
      } else {
        setRegistrationState(SIP_REGISTRATION.unregistered);
      }
    },
  };
}

async function createSimpleUser(credentials) {
  const audio = ensureRemoteAudio();
  const aor = credentials.aor || `sip:${credentials.user}@${credentials.domain}`;

  const user = new Web.SimpleUser(credentials.wsUrl, {
    aor,
    userAgentOptions: {
      authorizationUsername: credentials.user,
      authorizationPassword: credentials.password,
      displayName: credentials.user,
      sessionDescriptionHandlerFactoryOptions: {
        peerConnectionConfiguration: {
          iceServers: parseIceServers(),
        },
      },
    },
    media: {
      constraints: { audio: true, video: false },
      remote: audio ? { audio } : undefined,
    },
  });

  attachSimpleUserDelegates(user);
  return user;
}

/**
 * Register SIP extension (WSS + WebRTC). Idempotent while in flight.
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function connectSip() {
  if (registrationState === SIP_REGISTRATION.registered) {
    return { ok: true };
  }
  if (connectInFlight) return connectInFlight;

  connectInFlight = (async () => {
    if (isHttpsRequired()) {
      const reason = "WebRTC דורש HTTPS — פרסמו ב-Vercel או דומה";
      setRegistrationState(SIP_REGISTRATION.error, reason);
      return { ok: false, reason };
    }

    const credentials = await fetchSipCredentials();
    if (!credentials || credentials.error) {
      const reason = credentials?.error || "לא הוגדרו פרטי SIP";
      setRegistrationState(SIP_REGISTRATION.error, reason);
      return { ok: false, reason };
    }

    setRegistrationState(SIP_REGISTRATION.connecting);

    try {
      if (simpleUser) {
        try {
          await simpleUser.unregister();
        } catch {
          /* ignore */
        }
        try {
          await simpleUser.disconnect();
        } catch {
          /* ignore */
        }
        simpleUser = null;
      }

      simpleUser = await createSimpleUser(credentials);
      sipConfig = credentials;

      await simpleUser.connect();
      await simpleUser.register();

      setRegistrationState(SIP_REGISTRATION.registered);
      return { ok: true };
    } catch (err) {
      const reason = err?.message || "כשל בהרשמה ל-SIP";
      setRegistrationState(SIP_REGISTRATION.error, reason);
      simpleUser = null;
      sipConfig = null;
      return { ok: false, reason };
    } finally {
      connectInFlight = null;
    }
  })();

  return connectInFlight;
}

/** @returns {Promise<{ ok: boolean, reason?: string }>} */
export async function disconnectSip() {
  if (!simpleUser) {
    setRegistrationState(SIP_REGISTRATION.unregistered);
    return { ok: true };
  }

  try {
    if (simpleUser.isConnected?.()) {
      try {
        await simpleUser.hangup();
      } catch {
        /* no active call */
      }
      try {
        await simpleUser.unregister();
      } catch {
        /* ignore */
      }
      await simpleUser.disconnect();
    }
  } catch (err) {
    const reason = err?.message || "שגיאה בניתוק SIP";
    setRegistrationState(SIP_REGISTRATION.error, reason);
    return { ok: false, reason };
  } finally {
    simpleUser = null;
    sipConfig = null;
    setRegistrationState(SIP_REGISTRATION.unregistered);
  }

  return { ok: true };
}

/**
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function dialSipOutbound(phone) {
  if (!simpleUser || registrationState !== SIP_REGISTRATION.registered) {
    return { ok: false, reason: "לא רשום ל-SIP — לחצו «התחבר» קודם" };
  }
  if (!sipConfig?.domain) {
    return { ok: false, reason: "חסר SIP_DOMAIN" };
  }

  try {
    const destination = buildOutboundDestination(phone, sipConfig.domain);
    const normalized = normalizePhone(phone);
    emit({
      type: "outbound-progress",
      phone: normalized,
      status: "dialing",
      sessionId: `sip_out_${Date.now()}`,
    });
    await simpleUser.call(destination);
    emit({
      type: "outbound-progress",
      phone: normalized,
      status: "ringing",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message || "כשל בחיוג" };
  }
}

/** @returns {Promise<{ ok: boolean, reason?: string }>} */
export async function answerSipCall() {
  if (!simpleUser) return { ok: false, reason: "אין חיבור SIP" };
  try {
    await simpleUser.answer();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message || "כשל במענה" };
  }
}

/** @returns {Promise<{ ok: boolean, reason?: string }>} */
export async function hangupSipCall() {
  if (!simpleUser) return { ok: true };
  try {
    await simpleUser.hangup();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message || "כשל בניתוק" };
  }
}

/** @returns {Promise<{ ok: boolean, muted?: boolean, reason?: string }>} */
export async function toggleSipMute() {
  if (!simpleUser) return { ok: false, reason: "אין חיבור SIP" };
  try {
    const currentlyMuted = simpleUser.isMuted?.() ?? false;
    if (currentlyMuted) {
      await simpleUser.unmute();
    } else {
      await simpleUser.mute();
    }
    const muted = simpleUser.isMuted?.() ?? !currentlyMuted;
    emit({ type: "mute", muted });
    return { ok: true, muted };
  } catch (err) {
    return { ok: false, reason: err?.message || "כשל בהשתקה" };
  }
}

/**
 * Health check for configured telephony (no network dial).
 * @returns {Promise<{ ok: boolean, reason?: string, provider?: string }>}
=======
/**
 * Placeholder for production dial — not implemented in this repo.
 * @returns {Promise<{ ok: false, reason: string }>}
>>>>>>> 842dd9e (Initial commit)
 */
export async function connectProductionCall() {
  const provider = getConfiguredProvider();
  if (!provider) {
    return { ok: false, reason: "לא הוגדר ספק טלפוניה (SIP או Twilio)" };
  }
<<<<<<< HEAD
  if (provider === "twilio") {
    return {
      ok: false,
      reason: "אינטגרציית Twilio Voice טרם מומשה — ראו docs/TELEPHONY_SETUP.md",
    };
  }
  if (isHttpsRequired()) {
    return { ok: false, reason: "WebRTC דורש HTTPS — פרסמו ב-Vercel או דומה" };
  }

  const credentials = await fetchSipCredentials();
  if (!credentials || credentials.error) {
    return { ok: false, reason: credentials?.error || "לא ניתן לטעון פרטי SIP מהשרת" };
  }

  return {
    ok: true,
    reason: `SIP מוכן (${credentials.source === "server" ? "אישורים מהשרת" : "אישורים מקומיים"})`,
    provider: "sip",
=======
  if (isHttpsRequired()) {
    return { ok: false, reason: "WebRTC דורש HTTPS — פרסמו ב-Vercel או דומה" };
  }
  return {
    ok: false,
    reason:
      provider === "sip"
        ? "אינטגרציית SIP/WebRTC טרם מומשה — ראו docs/TELEPHONY_SETUP.md"
        : "אינטגרציית Twilio Voice טרם מומשה — ראו docs/TELEPHONY_SETUP.md",
>>>>>>> 842dd9e (Initial commit)
  };
}

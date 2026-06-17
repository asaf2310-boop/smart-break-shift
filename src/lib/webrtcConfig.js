/** @typedef {import('peerjs').PeerJSOption} PeerJSOption */

import {
  fetchIceServers,
  getCachedIceServers,
  getStunOnlyFallback,
} from "@/lib/iceServersClient";

export const STUN_ONLY_SERVERS = getStunOnlyFallback().iceServers;

/** @returns {RTCIceServer[]} */
export function getDefaultIceServers() {
  const cached = getCachedIceServers();
  if (cached?.iceServers?.length) return cached.iceServers;
  return [...STUN_ONLY_SERVERS];
}

function getClientIceTransportPolicyOverride() {
  const explicit = import.meta.env.VITE_ICE_TRANSPORT_POLICY?.trim().toLowerCase();
  if (explicit === "relay" || explicit === "all") return explicit;
  return null;
}

function resolveTransportPolicy(serverPolicy) {
  const override = getClientIceTransportPolicyOverride();
  if (override) return override;
  return serverPolicy === "relay" ? "relay" : "all";
}

/**
 * Fetch ICE servers from the server API and update the in-memory cache.
 * @returns {Promise<{ iceServers: RTCIceServer[], iceTransportPolicy: 'all'|'relay', turnConfigured: boolean }>}
 */
export async function resolveIceServers(options = {}) {
  return fetchIceServers(options);
}

/** @returns {Promise<RTCIceServer[]>} */
export async function parseIceServersAsync() {
  const { iceServers } = await resolveIceServers();
  return iceServers;
}

/** @returns {RTCIceServer[]} */
export function parseIceServers() {
  return getDefaultIceServers();
}

export function isTurnConfigured() {
  const cached = getCachedIceServers();
  return Boolean(cached?.turnConfigured);
}

export async function isTurnConfiguredAsync() {
  const { turnConfigured } = await resolveIceServers();
  return turnConfigured;
}

/**
 * PeerJS options with ICE/TURN from server API (sync — uses cache or STUN-only fallback).
 * @param {string} [peerId]
 * @returns {PeerJSOption}
 */
export function getPeerJsOptions(peerId) {
  const cached = getCachedIceServers();
  const iceServers = cached?.iceServers?.length ? cached.iceServers : STUN_ONLY_SERVERS;
  const iceTransportPolicy = resolveTransportPolicy(cached?.iceTransportPolicy || "all");

  /** @type {PeerJSOption} */
  const options = {
    debug: 0,
    config: {
      iceServers,
      iceTransportPolicy,
      iceCandidatePoolSize: 10,
    },
  };

  applyPeerServerEnv(options);
  if (peerId) options.id = peerId;
  return options;
}

/**
 * PeerJS options with ICE/TURN fetched from server API.
 * @param {string} [peerId]
 * @returns {Promise<PeerJSOption>}
 */
export async function getPeerJsOptionsAsync(peerId, fetchOptions = {}) {
  const { iceServers, iceTransportPolicy } = await resolveIceServers(fetchOptions);

  /** @type {PeerJSOption} */
  const options = {
    debug: 0,
    config: {
      iceServers,
      iceTransportPolicy: resolveTransportPolicy(iceTransportPolicy),
      iceCandidatePoolSize: 10,
    },
  };

  applyPeerServerEnv(options);
  if (peerId) options.id = peerId;
  return options;
}

/** @param {PeerJSOption} options */
function applyPeerServerEnv(options) {
  const host = import.meta.env.VITE_PEERJS_HOST?.trim();
  const path = import.meta.env.VITE_PEERJS_PATH?.trim();
  const key = import.meta.env.VITE_PEERJS_KEY?.trim();
  const portRaw = import.meta.env.VITE_PEERJS_PORT?.trim();
  const secureRaw = import.meta.env.VITE_PEERJS_SECURE?.trim();

  if (host) options.host = host;
  if (path) options.path = path;
  if (key) options.key = key;
  if (portRaw) {
    const port = Number(portRaw);
    if (!Number.isNaN(port)) options.port = port;
  }
  if (secureRaw === "true" || secureRaw === "1") options.secure = true;
  if (secureRaw === "false" || secureRaw === "0") options.secure = false;
}

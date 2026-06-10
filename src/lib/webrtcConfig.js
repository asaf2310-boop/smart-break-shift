/** @typedef {import('peerjs').PeerJSOption} PeerJSOption */

const DEFAULT_STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

const METERED_STUN = { urls: "stun:stun.relay.metered.ca:80" };

/** PeerJS Cloud TURN — fallback when custom TURN fails or is not configured */
const PEERJS_CLOUD_TURN = {
  urls: ["turn:eu-0.turn.peerjs.com:3478", "turn:us-0.turn.peerjs.com:3478"],
  username: "peerjs",
  credential: "peerjsp",
};

function meteredTurnUrls() {
  return [
    "turn:global.relay.metered.ca:80",
    "turn:global.relay.metered.ca:80?transport=tcp",
    "turn:global.relay.metered.ca:443",
    "turns:global.relay.metered.ca:443?transport=tcp",
  ];
}

function isMeteredTurnHost(url) {
  return /metered\.ca/i.test(String(url || ""));
}

function expandTurnUrls(turnUrl) {
  const raw = String(turnUrl || "").trim();
  if (!raw) return [];
  if (raw.includes(",")) {
    return raw.split(",").map((u) => u.trim()).filter(Boolean);
  }
  if (isMeteredTurnHost(raw)) {
    const hostMatch = raw.match(/(?:turn|turns):([^:?]+)/i);
    const host = hostMatch?.[1] || "global.relay.metered.ca";
    if (host.includes("global.relay") || host.includes("standard.relay")) {
      return meteredTurnUrls();
    }
    return [
      `turn:${host}:80`,
      `turn:${host}:80?transport=tcp`,
      `turn:${host}:443`,
      `turns:${host}:443?transport=tcp`,
    ];
  }
  return [raw];
}

function buildTurnIceServers(turnUrl, username, credential) {
  const urls = expandTurnUrls(turnUrl);
  if (!urls.length) return [];
  const servers = urls.map((urlsEntry) => ({
    urls: urlsEntry,
    username,
    credential,
  }));
  if (isMeteredTurnHost(turnUrl)) {
    return [METERED_STUN, ...servers];
  }
  return servers;
}

function hasTurnInServers(servers) {
  return servers.some((s) => {
    const u = s.urls;
    const list = Array.isArray(u) ? u : [u];
    return list.some((entry) => String(entry || "").startsWith("turn"));
  });
}

/** @returns {RTCIceServer[]} */
export function getDefaultIceServers() {
  const raw = import.meta.env.VITE_ICE_SERVERS?.trim();
  let servers;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        servers = [...parsed];
      }
    } catch {
      /* invalid JSON — use defaults */
    }
  }

  const turnUrl = import.meta.env.VITE_TURN_URL?.trim();
  const turnUsername = import.meta.env.VITE_TURN_USERNAME?.trim();
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL?.trim();
  const hasCustomTurn = Boolean(turnUrl && turnUsername && turnCredential);

  if (!servers) {
    servers = hasCustomTurn && isMeteredTurnHost(turnUrl)
      ? [METERED_STUN, ...DEFAULT_STUN_SERVERS]
      : [...DEFAULT_STUN_SERVERS];
  }

  if (hasCustomTurn) {
    servers.push(...buildTurnIceServers(turnUrl, turnUsername, turnCredential));
  }

  if (!hasTurnInServers(servers)) {
    servers.push(PEERJS_CLOUD_TURN);
  }

  return servers;
}

function getIceTransportPolicy() {
  const explicit = import.meta.env.VITE_ICE_TRANSPORT_POLICY?.trim().toLowerCase();
  if (explicit === "relay" || explicit === "all") return explicit;
  const forceRelay = import.meta.env.VITE_ICE_FORCE_RELAY?.trim();
  if (forceRelay === "true" || forceRelay === "1") return "relay";
  return "all";
}

/** @returns {RTCIceServer[]} */
export function parseIceServers() {
  return getDefaultIceServers();
}

export function isTurnConfigured() {
  const turnUrl = import.meta.env.VITE_TURN_URL?.trim();
  const turnUsername = import.meta.env.VITE_TURN_USERNAME?.trim();
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL?.trim();
  if (turnUrl && turnUsername && turnCredential) return true;
  const raw = import.meta.env.VITE_ICE_SERVERS?.trim();
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return (
      Array.isArray(parsed) &&
      parsed.some((s) => String(s.urls || "").startsWith("turn"))
    );
  } catch {
    return false;
  }
}

/**
 * PeerJS options with ICE/TURN and optional custom PeerServer.
 * @param {string} [peerId]
 * @returns {PeerJSOption}
 */
export function getPeerJsOptions(peerId) {
  /** @type {PeerJSOption} */
  const options = {
    debug: 0,
    config: {
      iceServers: getDefaultIceServers(),
      iceTransportPolicy: getIceTransportPolicy(),
      iceCandidatePoolSize: 10,
    },
  };

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

  if (peerId) options.id = peerId;

  return options;
}

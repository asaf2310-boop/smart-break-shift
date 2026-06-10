/** @typedef {import('peerjs').PeerJSOption} PeerJSOption */

const DEFAULT_STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

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
  if (!servers) {
    servers = [...DEFAULT_STUN_SERVERS];
  }

  const turnUrl = import.meta.env.VITE_TURN_URL?.trim();
  const turnUsername = import.meta.env.VITE_TURN_USERNAME?.trim();
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL?.trim();
  if (turnUrl && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return servers;
}

/** @returns {RTCIceServer[]} */
export function parseIceServers() {
  return getDefaultIceServers();
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

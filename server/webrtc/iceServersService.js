import { json } from "../knowledge/httpUtils.js";

const DEFAULT_STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

const METERED_STUN = { urls: "stun:stun.relay.metered.ca:80" };

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

function getIceTransportPolicy() {
  const explicit = process.env.ICE_TRANSPORT_POLICY?.trim().toLowerCase();
  if (explicit === "relay" || explicit === "all") return explicit;
  const forceRelay = process.env.ICE_FORCE_RELAY?.trim();
  if (forceRelay === "true" || forceRelay === "1") return "relay";
  return "all";
}

function peerJsCloudTurnFallbackEnabled() {
  const raw = process.env.PEERJS_CLOUD_TURN_FALLBACK?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

/**
 * Build ICE servers from server-only environment variables.
 * @returns {{ iceServers: RTCIceServer[], iceTransportPolicy: 'all'|'relay', turnConfigured: boolean }}
 */
export function buildIceServersFromEnv() {
  const raw = process.env.ICE_SERVERS?.trim();
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

  const turnUrl = process.env.TURN_URL?.trim();
  const turnUsername = process.env.TURN_USERNAME?.trim();
  const turnCredential = process.env.TURN_CREDENTIAL?.trim();
  const hasCustomTurn = Boolean(turnUrl && turnUsername && turnCredential);

  if (!servers) {
    servers = hasCustomTurn && isMeteredTurnHost(turnUrl)
      ? [METERED_STUN, ...DEFAULT_STUN_SERVERS]
      : [...DEFAULT_STUN_SERVERS];
  }

  if (hasCustomTurn) {
    servers.push(...buildTurnIceServers(turnUrl, turnUsername, turnCredential));
  }

  const turnConfigured = hasTurnInServers(servers);

  if (!turnConfigured && peerJsCloudTurnFallbackEnabled()) {
    servers.push(PEERJS_CLOUD_TURN);
  }

  let iceTransportPolicy = getIceTransportPolicy();
  if (!turnConfigured && iceTransportPolicy === "relay") {
    iceTransportPolicy = "all";
  }

  return {
    iceServers: servers,
    iceTransportPolicy,
    turnConfigured: turnConfigured || peerJsCloudTurnFallbackEnabled(),
  };
}

/**
 * @param {import('http').ServerResponse} res
 * @param {import('http').IncomingMessage} req
 */
export function handleIceServersRequest(res, req) {
  const { iceServers, iceTransportPolicy, turnConfigured } = buildIceServersFromEnv();
  return json(
    res,
    200,
    { ok: true, iceServers, iceTransportPolicy, turnConfigured },
    req
  );
}

export { DEFAULT_STUN_SERVERS, METERED_STUN };

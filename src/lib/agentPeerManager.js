/**
 * Singleton agent Peer per sessionId — random PeerJS id, survives React remount.
 * Guest calls peer.call(agentPeerId) where agentPeerId is published via session store + Supabase.
 */
import Peer from "peerjs";
import { getPeerJsOptions } from "@/lib/webrtcConfig";

/** @typedef {{ peer: import('peerjs').Peer | null, creating: boolean, listenersAttached: boolean, activeCall: import('peerjs').MediaConnection | null, remoteStream: MediaStream | null, refCount: number }} AgentPeerEntry */

/** @type {Map<string, AgentPeerEntry>} */
const entries = new Map();
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const destroyTimers = new Map();

export function cancelDeferredPeerDestroy(sessionId) {
  const timer = destroyTimers.get(sessionId);
  if (timer != null) {
    window.clearTimeout(timer);
    destroyTimers.delete(sessionId);
  }
}

export function scheduleDeferredPeerDestroy(sessionId, peer, delayMs = 2000) {
  cancelDeferredPeerDestroy(sessionId);
  destroyTimers.set(
    sessionId,
    window.setTimeout(() => {
      destroyTimers.delete(sessionId);
      destroyAgentPeer(sessionId, peer);
    }, delayMs)
  );
}

/**
 * @param {string} sessionId
 * @param {import('peerjs').Peer} [expectedPeer]
 */
export function destroyAgentPeer(sessionId, expectedPeer) {
  cancelDeferredPeerDestroy(sessionId);
  const entry = entries.get(sessionId);
  if (!entry) return;
  if (expectedPeer && entry.peer && entry.peer !== expectedPeer) return;
  entries.delete(sessionId);
  try {
    entry.activeCall?.close();
  } catch {
    /* ignore */
  }
  if (!entry.peer || entry.peer.destroyed) return;
  try {
    entry.peer.destroy();
  } catch {
    /* ignore */
  }
}

/** @param {string} sessionId */
export function getAgentPeerEntry(sessionId) {
  return entries.get(sessionId) || null;
}

/**
 * Open or reuse the agent Peer for a session (random id — no sessionId collision).
 * @param {string} sessionId
 * @returns {{ peer: import('peerjs').Peer | null, entry: AgentPeerEntry, reusing: boolean, created: boolean, inFlight?: boolean }}
 */
export function openAgentPeer(sessionId) {
  cancelDeferredPeerDestroy(sessionId);
  let entry = entries.get(sessionId);

  if (entry?.peer && !entry.peer.destroyed) {
    entry.refCount += 1;
    return { peer: entry.peer, entry, reusing: true, created: false };
  }

  if (entry?.creating) {
    entry.refCount += 1;
    return { peer: entry.peer, entry, reusing: true, created: false, inFlight: true };
  }

  entry = {
    peer: null,
    creating: true,
    listenersAttached: false,
    activeCall: null,
    remoteStream: null,
    refCount: 1,
  };
  entries.set(sessionId, entry);

  const peer = new Peer(getPeerJsOptions());
  entry.peer = peer;
  entry.creating = false;

  return { peer, entry, reusing: false, created: true };
}

/**
 * @param {string} sessionId
 * @param {import('peerjs').Peer} peer
 */
export function releaseAgentPeer(sessionId, peer) {
  const entry = entries.get(sessionId);
  if (!entry) return;
  if (entry.peer && peer && entry.peer !== peer) return;
  entry.refCount = Math.max(0, entry.refCount - 1);
  if (entry.refCount === 0) {
    if (entry.peer && !entry.peer.destroyed) {
      scheduleDeferredPeerDestroy(sessionId, entry.peer);
    } else if (entry.creating && !entry.peer) {
      entries.delete(sessionId);
    }
  }
}

/** @param {string} sessionId @param {import('peerjs').MediaConnection | null} call */
export function setAgentPeerActiveCall(sessionId, call) {
  const entry = entries.get(sessionId);
  if (entry) entry.activeCall = call;
}

/** @param {string} sessionId @param {MediaStream | null} stream */
export function setAgentPeerRemoteStream(sessionId, stream) {
  const entry = entries.get(sessionId);
  if (entry) entry.remoteStream = stream;
}

/**
 * Wait until peer exists on the slot (another mount is still constructing).
 * @param {string} sessionId
 * @param {number} [timeoutMs]
 */
export function waitForAgentPeer(sessionId, timeoutMs = 15000) {
  const entry = entries.get(sessionId);
  if (!entry) return Promise.resolve(null);
  if (entry.peer && !entry.peer.destroyed) return Promise.resolve(entry.peer);
  if (!entry.creating) return Promise.resolve(entry.peer);

  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const current = entries.get(sessionId);
      if (!current) {
        resolve(null);
        return;
      }
      if (current.peer && !current.peer.destroyed) {
        resolve(current.peer);
        return;
      }
      if (!current.creating) {
        resolve(current.peer);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

/**
 * Singleton agent Peer per sessionId — survives React remount / in-flight registration.
 * One Peer registers on PeerServer; remount reuses the same instance instead of recreating.
 */

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
      forceDestroyAgentPeer(sessionId, peer);
    }, delayMs)
  );
}

/**
 * @param {string} sessionId
 * @param {import('peerjs').Peer} [expectedPeer]
 */
export function forceDestroyAgentPeer(sessionId, expectedPeer) {
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
 * Reserve or reuse a peer slot. Sets `creating=true` synchronously so a second
 * React mount cannot call `new Peer(sessionId)` before the first registers.
 * @param {string} sessionId
 * @returns {{ entry: AgentPeerEntry, created: boolean, reusing: boolean }}
 */
export function beginAgentPeerSession(sessionId) {
  cancelDeferredPeerDestroy(sessionId);
  let entry = entries.get(sessionId);

  if (entry?.peer && !entry.peer.destroyed) {
    entry.refCount += 1;
    return { entry, created: false, reusing: true };
  }

  if (entry?.creating) {
    entry.refCount += 1;
    return { entry, created: false, reusing: true };
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
  return { entry, created: true, reusing: false };
}

/**
 * @param {string} sessionId
 * @param {import('peerjs').Peer} peer
 * @returns {AgentPeerEntry}
 */
export function commitAgentPeer(sessionId, peer) {
  let entry = entries.get(sessionId);
  if (!entry) {
    entry = {
      peer,
      creating: false,
      listenersAttached: false,
      activeCall: null,
      remoteStream: null,
      refCount: 1,
    };
    entries.set(sessionId, entry);
    return entry;
  }
  entry.peer = peer;
  entry.creating = false;
  return entry;
}

/** @deprecated use beginAgentPeerSession */
export function acquireAgentPeer(sessionId) {
  const { entry, created, reusing } = beginAgentPeerSession(sessionId);
  return {
    peer: entry.peer,
    entry,
    created: created && !reusing,
  };
}

/** @deprecated use commitAgentPeer */
export function registerAgentPeer(sessionId, peer) {
  return commitAgentPeer(sessionId, peer);
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

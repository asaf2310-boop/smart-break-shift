/**
 * Helpers for PeerJS / WebRTC screen share (agent receives guest display).
 */

/** @param {RTCPeerConnection | null | undefined} pc */
export function collectRemoteVideoStream(pc) {
  if (!pc) return null;
  const tracks = pc
    .getReceivers()
    .map((receiver) => receiver.track)
    .filter((track) => track?.kind === "video" && track.readyState !== "ended");
  if (!tracks.length) return null;
  for (const track of tracks) {
    track.enabled = true;
  }
  return new MediaStream(tracks);
}

/**
 * Poll peer connection for inbound video (Unified Plan — stream event may not fire).
 * @param {RTCPeerConnection} pc
 * @param {(stream: MediaStream) => void} onStream
 * @param {{ attempts?: number, intervalMs?: number }} [options]
 * @returns {() => void} cleanup
 */
export function watchRemoteVideoFromPeerConnection(pc, onStream, options = {}) {
  const { attempts = 40, intervalMs = 500 } = options;
  let tries = 0;
  let stopped = false;
  let attached = false;

  const tryAttach = () => {
    if (stopped || attached) return;
    const stream = collectRemoteVideoStream(pc);
    if (stream?.getVideoTracks().length) {
      attached = true;
      onStream(stream);
      return;
    }
    tries += 1;
    if (tries >= attempts) return;
    timer = window.setTimeout(tryAttach, intervalMs);
  };

  let timer = window.setTimeout(tryAttach, 100);

  const onTrack = (event) => {
    if (stopped || attached) return;
    if (event.track?.kind !== "video") return;
    event.track.enabled = true;
    const stream = event.streams?.[0] || new MediaStream([event.track]);
    attached = true;
    onStream(stream);
  };

  pc.addEventListener("track", onTrack);

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    pc.removeEventListener("track", onTrack);
  };
}

/**
 * @param {MediaStream} stream
 * @param {() => void} onActive
 * @returns {() => void} cleanup
 */
export function watchVideoTrackActivation(stream, onActive) {
  const tracks = stream?.getVideoTracks?.() || [];
  if (!tracks.length) return () => {};

  const handlers = [];
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    onActive();
  };

  for (const track of tracks) {
    if (!track.muted && track.readyState === "live") {
      fire();
      return () => {};
    }
    const onUnmute = () => fire();
    track.addEventListener("unmute", onUnmute);
    handlers.push(() => track.removeEventListener("unmute", onUnmute));
  }

  return () => handlers.forEach((off) => off());
}

/** @param {RTCPeerConnection | null | undefined} pc */
export async function describeIcePath(pc) {
  if (!pc?.getStats) return null;
  try {
    const stats = await pc.getStats();
    let usingRelay = false;
    let bytesReceived = 0;
    stats.forEach((report) => {
      if (report.type === "local-candidate" && report.candidateType === "relay") {
        usingRelay = true;
      }
      if (report.type === "inbound-rtp" && report.kind === "video") {
        bytesReceived += report.bytesReceived || 0;
      }
    });
    return { usingRelay, bytesReceived };
  } catch {
    return null;
  }
}

/**
 * Send a one-shot data message to a remote peer id (agent → guest or guest → agent).
 * @param {import('peerjs').default | null | undefined} peer
 * @param {string} remotePeerId
 * @param {object} payload
 */
export function sendPeerDataMessage(peer, remotePeerId, payload) {
  if (!peer || peer.destroyed || !remotePeerId) return;
  try {
    const conn = peer.connect(remotePeerId, { reliable: true });
    const sendAndClose = () => {
      try {
        conn.send(payload);
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        try {
          conn.close();
        } catch {
          /* ignore */
        }
      }, 80);
    };
    if (conn.open) {
      sendAndClose();
    } else {
      conn.on("open", sendAndClose);
      window.setTimeout(() => {
        try {
          conn.close();
        } catch {
          /* ignore */
        }
      }, 400);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Ask guest to re-send the display stream (agent side, no video after connect).
 * @param {import('peerjs').default | null | undefined} agentPeer
 * @param {string} guestPeerId
 */
export function requestGuestVideoRetry(agentPeer, guestPeerId) {
  sendPeerDataMessage(agentPeer, guestPeerId, {
    type: "request_video_retry",
    at: Date.now(),
  });
}

/**
 * @param {RTCPeerConnection | null | undefined} pc
 * @param {number} [timeoutMs]
 */
export function waitForIceConnected(pc, timeoutMs = 20000) {
  return new Promise((resolve) => {
    if (!pc) {
      resolve(false);
      return;
    }
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      pc.removeEventListener("iceconnectionstatechange", onIce);
      pc.removeEventListener("connectionstatechange", onConn);
      window.clearTimeout(timer);
      resolve(ok);
    };
    const onIce = () => {
      const ice = pc.iceConnectionState;
      if (ice === "connected" || ice === "completed") finish(true);
      if (ice === "failed") finish(false);
    };
    const onConn = () => {
      if (pc.connectionState === "connected") finish(true);
      if (pc.connectionState === "failed") finish(false);
    };
    onIce();
    pc.addEventListener("iceconnectionstatechange", onIce);
    pc.addEventListener("connectionstatechange", onConn);
    const timer = window.setTimeout(() => finish(false), timeoutMs);
  });
}

/**
 * Answer an incoming screen-share call as receive-only (agent side).
 * @param {import('peerjs').MediaConnection} call
 */
export function answerIncomingCallRecvOnly(call) {
  try {
    call.answer();
  } catch {
    try {
      call.answer(new MediaStream());
    } catch {
      /* ignore */
    }
  }
  const pc = call.peerConnection;
  if (!pc) return;
  try {
    for (const transceiver of pc.getTransceivers()) {
      if (transceiver.sender?.track) continue;
      if (transceiver.direction === "sendrecv") {
        transceiver.direction = "recvonly";
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * @param {RTCPeerConnection | null | undefined} pc
 */
export function tryRestartIce(pc) {
  if (!pc?.restartIce) return false;
  try {
    pc.restartIce();
    return true;
  } catch {
    return false;
  }
}

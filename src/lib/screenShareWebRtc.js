/**
 * Helpers for PeerJS / WebRTC screen share (agent receives guest display).
 */

const WEBRTC_DEBUG_STORAGE_KEY = "hyp_webrtc_debug_logs";
const WEBRTC_DEBUG_MAX_ENTRIES = 200;

/** @type {Record<string, string>} */
const INBOUND_VIDEO_DIAGNOSIS = {
  ok: "ווידאו מתקבל ומתפענח — bytesReceived ו-framesDecoded עולים",
  codec: "bytesReceived עולה אך framesDecoded=0 — בעיית Codec או דקודר",
  not_sent: "bytesReceived=0 — בעיית Track/SDP (הווידאו לא נשלח או לא הגיע)",
  element: "framesDecoded עולה אך אין תמונה — בדקו אלמנט וידאו / CSS (opacity, z-index, גודל)",
};

/**
 * @param {number} bytesReceived
 * @param {number} framesDecoded
 * @param {{ videoHasDimensions?: boolean }} [options]
 * @returns {"ok"|"codec"|"not_sent"|"element"}
 */
export function diagnoseInboundVideoKey(bytesReceived, framesDecoded, options = {}) {
  const { videoHasDimensions = true } = options;
  if (bytesReceived > 0 && framesDecoded > 0) {
    if (!videoHasDimensions) return "element";
    return "ok";
  }
  if (bytesReceived > 0 && framesDecoded === 0) return "codec";
  return "not_sent";
}

/**
 * @param {RTCStatsReport} stats
 * @param {{ videoHasDimensions?: boolean }} [options]
 */
export function summarizeInboundVideoStatsFromReport(stats, options = {}) {
  let bytesReceived = 0;
  let framesDecoded = 0;
  let framesReceived = 0;
  let packetsReceived = 0;
  let packetsLost = 0;
  stats.forEach((report) => {
    if (report.type === "inbound-rtp" && report.kind === "video") {
      bytesReceived += report.bytesReceived || 0;
      framesDecoded += report.framesDecoded || 0;
      framesReceived += report.framesReceived || 0;
      packetsReceived += report.packetsReceived || 0;
      packetsLost += report.packetsLost || 0;
    }
  });
  const diagnosisKey = diagnoseInboundVideoKey(
    bytesReceived,
    framesDecoded,
    options
  );
  return {
    bytesReceived,
    framesDecoded,
    framesReceived,
    packetsReceived,
    packetsLost,
    diagnosisKey,
    diagnosis: INBOUND_VIDEO_DIAGNOSIS[diagnosisKey],
  };
}

/**
 * @param {RTCPeerConnection | null | undefined} pc
 * @param {{ videoHasDimensions?: boolean }} [options]
 */
export async function summarizeInboundVideoStats(pc, options = {}) {
  if (!pc?.getStats) return null;
  try {
    const stats = await pc.getStats();
    return summarizeInboundVideoStatsFromReport(stats, options);
  } catch {
    return null;
  }
}

/**
 * אבחון מהיר מהקונסולה: diagnoseInboundVideo(pc)
 * @param {RTCPeerConnection | null | undefined} pc
 */
export async function diagnoseInboundVideo(pc) {
  const summary = await summarizeInboundVideoStats(pc);
  if (!summary) {
    console.warn("[WebRTC:diagnose] pc.getStats unavailable");
    return null;
  }
  console.log("[WebRTC:diagnose] Frames Decoded:", summary.framesDecoded);
  console.log("[WebRTC:diagnose] Bytes Received:", summary.bytesReceived);
  console.log("[WebRTC:diagnose]", summary.diagnosis);
  return summary;
}

/**
 * getDisplayMedia constraints — avoid displaySurface:"monitor" (rejects window/tab → OverconstrainedError).
 * @param {{ includeAudio?: boolean }} [options]
 */
export function buildDisplayMediaConstraints(options = {}) {
  const { includeAudio = false } = options;
  return {
    video: {
      cursor: "always",
      frameRate: { ideal: 15, max: 30 },
    },
    audio: includeAudio ? true : false,
  };
}

/**
 * Acquire display stream; retries with { video: true } if strict prefs fail.
 * @param {{ includeAudio?: boolean }} [options]
 */
export async function acquireDisplayMediaStream(options = {}) {
  const { includeAudio = false } = options;
  const attempts = [
    { label: "preferred", constraints: buildDisplayMediaConstraints({ includeAudio }) },
    { label: "fallback", constraints: { video: true, audio: includeAudio ? true : false } },
  ];

  let lastError = null;
  for (const { label, constraints } of attempts) {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      console.log(`[WebRTC:guest:getDisplayMedia] ok (${label})`);
      return { stream, constraintLabel: label };
    } catch (err) {
      lastError = err;
      console.warn(`[WebRTC:guest:getDisplayMedia] failed (${label})`, err?.name, err?.message);
      if (err?.name !== "OverconstrainedError") throw err;
    }
  }
  throw lastError || new Error("getDisplayMedia failed");
}

/**
 * @param {RTCPeerConnection | null | undefined} pc
 * @param {MediaStream | null | undefined} stream
 */
export function hasOutboundVideoSender(pc, stream) {
  const videoTrack = stream?.getVideoTracks?.()?.[0];
  if (!pc || !videoTrack) return false;
  return pc
    .getSenders()
    .some(
      (sender) =>
        sender.track?.kind === "video" &&
        sender.track.id === videoTrack.id &&
        sender.track.readyState === "live"
    );
}

/**
 * @param {MediaStream | null | undefined} stream
 * @param {{ reason?: string, sessionId?: string }} [context]
 */
export function logOutboundVideoTrack(stream, context = {}) {
  const prefix = `[WebRTC:guest${context.reason ? `:${context.reason}` : ""}]`;
  const track = stream?.getVideoTracks?.()?.[0];
  if (!track) {
    console.warn(prefix, "no video track in stream");
    appendWebRtcDebugLog({
      at: new Date().toISOString(),
      type: "outbound_track",
      error: "no_video_track",
      context,
    });
    return null;
  }

  /** @type {Record<string, unknown>} */
  let settings = {};
  try {
    settings = track.getSettings?.() || {};
  } catch {
    /* ignore */
  }

  console.log(prefix, "SCREEN TRACK");
  console.log(prefix, "readyState:", track.readyState);
  console.log(prefix, "enabled:", track.enabled);
  console.log(prefix, "muted:", track.muted);
  console.log(prefix, "getSettings():", settings);

  const payload = {
    at: new Date().toISOString(),
    type: "outbound_track",
    readyState: track.readyState,
    enabled: track.enabled,
    muted: track.muted,
    id: track.id,
    label: track.label,
    settings,
    context,
  };
  appendWebRtcDebugLog(payload);
  return payload;
}

/**
 * @param {HTMLVideoElement | null | undefined} video
 * @param {MediaStream | null | undefined} stream
 * @param {string} [label]
 */
export async function playRemoteVideoElement(video, stream, label = "agent") {
  if (!video || !stream) return false;
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }
  try {
    await video.play();
    return true;
  } catch (err) {
    console.error(`[WebRTC:${label}] video.play() failed:`, err);
    return false;
  }
}

/**
 * PeerJS peer.call() should attach tracks; ensure all stream tracks are on the PC senders.
 * @param {RTCPeerConnection | null | undefined} pc
 * @param {MediaStream | null | undefined} stream
 */
export function ensureOutboundTracksOnPeerConnection(pc, stream) {
  if (!pc || !stream) return;
  stream.getTracks().forEach((track) => {
    if (!pc.getSenders().some((sender) => sender.track?.id === track.id)) {
      pc.addTrack(track, stream);
    }
  });
}

/**
 * סקריפט צופה — polling כל intervalMs עד שמתקבלות פריימים.
 * @param {RTCPeerConnection} pc
 * @param {{ role?: string, sessionId?: string, shouldStop?: () => boolean, getVideoElement?: () => HTMLVideoElement | null | undefined, onSummary?: (summary: ReturnType<typeof summarizeInboundVideoStatsFromReport> & { bytesRising?: boolean }) => void }} [context]
 * @param {number} [intervalMs]
 * @returns {() => void}
 */
export function startInboundVideoStatsPolling(pc, context = {}, intervalMs = 2000) {
  const {
    role = "agent",
    sessionId,
    shouldStop = () => false,
    getVideoElement,
    onSummary,
  } = context;
  let prevBytes = 0;
  let stopped = false;
  const prefix = `[WebRTC:${role}:poll${sessionId ? `:${sessionId.slice(0, 8)}` : ""}]`;

  const tick = async () => {
    if (stopped || shouldStop()) return;
    const video = getVideoElement?.();
    const videoHasDimensions =
      !video || (video.videoWidth > 0 && video.videoHeight > 0);
    const summary = await summarizeInboundVideoStats(pc, { videoHasDimensions });
    if (!summary || stopped || shouldStop()) return;

    const bytesRising = summary.bytesReceived > prevBytes;
    prevBytes = summary.bytesReceived;
    console.log(prefix, "inbound-rtp stats:");
    console.log(prefix, "bytesReceived:", summary.bytesReceived, bytesRising ? "(עולה)" : "");
    console.log(prefix, "framesReceived:", summary.framesReceived);
    console.log(prefix, "framesDecoded:", summary.framesDecoded);
    console.log(prefix, "packetsLost:", summary.packetsLost);
    console.log(prefix, "אבחון:", summary.diagnosis);

    const enriched = { ...summary, bytesRising, videoHasDimensions };
    onSummary?.(enriched);
    appendWebRtcDebugLog({
      at: new Date().toISOString(),
      type: "inbound_poll",
      context: { role, sessionId },
      ...enriched,
    });
  };

  void tick();
  const timerId = window.setInterval(() => {
    if (stopped || shouldStop()) {
      window.clearInterval(timerId);
      return;
    }
    void tick();
  }, intervalMs);

  return () => {
    stopped = true;
    window.clearInterval(timerId);
  };
}

/** @param {RTCStatsReport} stats */
export function rtcStatsReportToJson(stats) {
  const rows = [];
  stats.forEach((report) => {
    /** @type {Record<string, unknown>} */
    const row = {
      id: report.id,
      type: report.type,
      timestamp: report.timestamp,
    };
    Object.keys(report).forEach((key) => {
      if (key === "id" || key === "type" || key === "timestamp") return;
      row[key] = report[key];
    });
    rows.push(row);
  });
  return rows;
}

/** @param {object} entry */
export function appendWebRtcDebugLog(entry) {
  if (typeof window === "undefined") return;
  window.__webrtcDebugLogs = window.__webrtcDebugLogs || [];
  window.__webrtcDebugLogs.push(entry);
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(WEBRTC_DEBUG_STORAGE_KEY) || "[]"
    );
    if (!Array.isArray(stored)) return;
    stored.push(entry);
    while (stored.length > WEBRTC_DEBUG_MAX_ENTRIES) stored.shift();
    window.localStorage.setItem(WEBRTC_DEBUG_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getWebRtcDebugLogs() {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(WEBRTC_DEBUG_STORAGE_KEY) || "[]"
    );
    return Array.isArray(stored) ? stored : window.__webrtcDebugLogs || [];
  } catch {
    return window.__webrtcDebugLogs || [];
  }
}

export function clearWebRtcDebugLogs() {
  if (typeof window === "undefined") return;
  window.__webrtcDebugLogs = [];
  try {
    window.localStorage.removeItem(WEBRTC_DEBUG_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** הורדת כל לוגי WebRTC כקובץ JSON (מהקונסולה: exportWebRtcDebugLogs()) */
export function exportWebRtcDebugLogs(filename) {
  const logs = getWebRtcDebugLogs();
  const blob = new Blob([JSON.stringify(logs, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    filename ||
    `webrtc-debug-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  return logs.length;
}

/**
 * לוגים מלאים: iceconnectionstatechange, connectionstatechange, track, getStats → JSON.
 * @param {RTCPeerConnection | null | undefined} pc
 * @param {{ role?: string, sessionId?: string, guestPeerId?: string, attempt?: number }} [context]
 * @returns {() => void} cleanup
 */
export function attachPeerConnectionDebugLogging(pc, context = {}) {
  if (!pc) return () => {};

  const label = [context.role, context.sessionId?.slice(0, 8)]
    .filter(Boolean)
    .join(":");
  const prefix = `[WebRTC${label ? `:${label}` : ""}]`;

  const captureStats = async (reason) => {
    if (!pc.getStats) return;
    try {
      const stats = await pc.getStats();
      const inboundVideo = summarizeInboundVideoStatsFromReport(stats);
      console.log(prefix, reason, "pc.getStats() →", stats);
      console.log(prefix, "Frames Decoded:", inboundVideo.framesDecoded);
      console.log(prefix, "Bytes Received:", inboundVideo.bytesReceived);
      console.log(prefix, inboundVideo.diagnosis);

      const payload = {
        at: new Date().toISOString(),
        reason,
        context,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState,
        connectionState: pc.connectionState,
        signalingState: pc.signalingState,
        inboundVideo,
        stats: rtcStatsReportToJson(stats),
      };

      console.log(prefix, reason, "stats JSON:", JSON.stringify(payload, null, 2));
      appendWebRtcDebugLog(payload);
    } catch (err) {
      console.warn(prefix, "getStats failed", err);
    }
  };

  const onIceConnectionStateChange = () => {
    console.log(prefix, "iceconnectionstatechange →", pc.iceConnectionState);
    void captureStats(`iceconnectionstatechange:${pc.iceConnectionState}`);
  };

  const onConnectionStateChange = () => {
    console.log(prefix, "connectionstatechange →", pc.connectionState);
    void captureStats(`connectionstatechange:${pc.connectionState}`);
  };

  const onTrack = (event) => {
    console.log(prefix, "TRACK RECEIVED");
    console.log(prefix, "kind:", event.track?.kind);
    console.log(prefix, "readyState:", event.track?.readyState);
    console.log(prefix, "muted:", event.track?.muted);
    console.log(prefix, "streams:", event.streams);
    console.log(prefix, "track.id:", event.track?.id);
    appendWebRtcDebugLog({
      at: new Date().toISOString(),
      type: "track_received",
      kind: event.track?.kind,
      readyState: event.track?.readyState,
      muted: event.track?.muted,
      streamIds: (event.streams || []).map((s) => s.id),
      context,
    });
    void captureStats(`track:${event.track?.kind || "unknown"}`);
  };

  pc.addEventListener("iceconnectionstatechange", onIceConnectionStateChange);
  pc.addEventListener("connectionstatechange", onConnectionStateChange);
  pc.addEventListener("track", onTrack);

  console.log(prefix, "debug logging attached", context);
  void captureStats("attach");

  return () => {
    pc.removeEventListener("iceconnectionstatechange", onIceConnectionStateChange);
    pc.removeEventListener("connectionstatechange", onConnectionStateChange);
    pc.removeEventListener("track", onTrack);
    void captureStats("detach");
  };
}

if (typeof window !== "undefined") {
  window.exportWebRtcDebugLogs = exportWebRtcDebugLogs;
  window.getWebRtcDebugLogs = getWebRtcDebugLogs;
  window.clearWebRtcDebugLogs = clearWebRtcDebugLogs;
  window.diagnoseInboundVideo = diagnoseInboundVideo;
  window.summarizeInboundVideoStats = summarizeInboundVideoStats;
}

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

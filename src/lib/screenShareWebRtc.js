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
  const { attempts = 12, intervalMs = 500 } = options;
  let tries = 0;
  let stopped = false;

  const tryAttach = () => {
    if (stopped) return;
    const stream = collectRemoteVideoStream(pc);
    if (stream?.getVideoTracks().length) {
      onStream(stream);
      return;
    }
    tries += 1;
    if (tries >= attempts) return;
    timer = window.setTimeout(tryAttach, intervalMs);
  };

  let timer = window.setTimeout(tryAttach, 150);

  const onTrack = (event) => {
    if (event.track?.kind !== "video") return;
    const stream = event.streams?.[0] || new MediaStream([event.track]);
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
    let candidateType = "";
    stats.forEach((report) => {
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        candidateType = report.localCandidateId || "";
      }
      if (report.type === "local-candidate" && report.candidateType === "relay") {
        usingRelay = true;
      }
    });
    return { usingRelay, candidateType };
  } catch {
    return null;
  }
}

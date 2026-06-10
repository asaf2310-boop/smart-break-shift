/**
 * Unit checks for screen-share WebRTC helpers (run: node scripts/qa-screen-share-unit.mjs)
 */
import assert from "node:assert/strict";
import {
  collectRemoteVideoStream,
  sendPeerDataMessage,
} from "../src/lib/screenShareWebRtc.js";

function mockPcWithVideoTrack(trackState = "live") {
  const track = {
    kind: "video",
    readyState: trackState,
    enabled: false,
  };
  return {
    getReceivers: () => [{ track }],
  };
}

assert.equal(collectRemoteVideoStream(null), null);
assert.equal(collectRemoteVideoStream(mockPcWithVideoTrack("ended")), null);

if (typeof MediaStream !== "undefined") {
  const stream = collectRemoteVideoStream(mockPcWithVideoTrack());
  assert.ok(stream instanceof MediaStream);
  assert.equal(stream.getVideoTracks().length, 1);
  assert.equal(stream.getVideoTracks()[0].enabled, true);
} else {
  console.log("(skip MediaStream checks — run in browser)");
}

let sendPeerDataMessageThrows = false;
try {
  sendPeerDataMessage(null, "x", {});
  sendPeerDataMessage({ destroyed: true }, "x", {});
} catch {
  sendPeerDataMessageThrows = true;
}
assert.equal(sendPeerDataMessageThrows, false);

console.log("qa-screen-share-unit: OK");

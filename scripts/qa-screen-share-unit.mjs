/**
 * Unit checks for screen-share WebRTC helpers (run: node scripts/qa-screen-share-unit.mjs)
 */
import assert from "node:assert/strict";
import {
  collectRemoteVideoStream,
  diagnoseInboundVideoKey,
  sendPeerDataMessage,
  summarizeInboundVideoStatsFromReport,
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

const mockStats = {
  forEach(fn) {
    fn({
      type: "inbound-rtp",
      kind: "video",
      bytesReceived: 1200,
      framesDecoded: 0,
      framesReceived: 5,
      packetsReceived: 3,
    });
    fn({
      type: "inbound-rtp",
      kind: "video",
      bytesReceived: 800,
      framesDecoded: 10,
      framesReceived: 2,
      packetsReceived: 1,
    });
  },
};

const inbound = summarizeInboundVideoStatsFromReport(mockStats);
assert.equal(inbound.bytesReceived, 2000);
assert.equal(inbound.framesDecoded, 10);
assert.equal(inbound.framesReceived, 7);
assert.equal(diagnoseInboundVideoKey(2000, 10), "ok");
assert.equal(diagnoseInboundVideoKey(500, 0), "codec");
assert.equal(diagnoseInboundVideoKey(0, 0), "not_sent");

console.log("qa-screen-share-unit: OK");

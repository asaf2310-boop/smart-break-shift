export const SESSION_END_REASON = {
  AGENT: "agent_ended",
  CLIENT_STOP: "client_stop",
  CLIENT_CLOSED: "client_closed",
};

export const GUEST_INITIATED_END_REASONS = new Set([
  SESSION_END_REASON.CLIENT_STOP,
  SESSION_END_REASON.CLIENT_CLOSED,
]);

export function isGuestInitiatedEnd(reason) {
  return GUEST_INITIATED_END_REASONS.has(reason);
}

export function isRemotePartyEnded(reason) {
  return !isGuestInitiatedEnd(reason);
}

/** נציג מסיים — ScreenShareAgentView שולח הודעת Peer ללקוח לפני endSession */
export const SCREEN_SHARE_AGENT_END_EVENT = "screen-share-agent-end-request";

export function requestAgentEndGuestNotify(sessionId, { endedReason = SESSION_END_REASON.AGENT } = {}) {
  if (typeof window === "undefined" || !sessionId) return;
  window.dispatchEvent(
    new CustomEvent(SCREEN_SHARE_AGENT_END_EVENT, {
      detail: { sessionId, endedReason },
    })
  );
}

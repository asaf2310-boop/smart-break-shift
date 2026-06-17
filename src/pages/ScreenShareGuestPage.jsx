import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Peer from "peerjs";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Monitor,
  ShieldAlert,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  logRecordingConsent,
  logScreenConsent,
  GUEST_BOOTSTRAP_QUERY_KEY,
  endSession,
  resolveGuestSession,
  resolveGuestSessionAsync,
  screenShareFeaturesAvailable,
  startSessionCloudPoll,
  subscribeScreenShare,
  waitForAgentPeerId,
} from "@/lib/screenShareStore";
import { cloudSessionSyncEnabled } from "@/lib/supportSessionsSync";
import {
  isAgentEndedSession,
  isGuestInitiatedEnd,
  SESSION_END_REASON,
} from "@/lib/screenShareSessionEnd";
import { GUEST_LINK_ERROR, messageForGuestLinkError } from "@/lib/shortGuestLink";
import { demoModeEnabled } from "@/api/demoClient";
import { CLOUD_RECORDING_RETENTION_DAYS } from "@/lib/screenRecordingsSync";
import { m3PageClass } from "@/lib/hypPage";
import SessionFileShare from "@/components/remote/SessionFileShare";
import SessionSupportChat from "@/components/remote/SessionSupportChat";
import { getPeerJsOptionsAsync, resolveIceServers } from "@/lib/webrtcConfig";
import {
  acquireDisplayMediaStream,
  attachPeerConnectionDebugLogging,
  ensureOutboundTracksOnPeerConnection,
  hasOutboundVideoSender,
  logOutboundVideoTrack,
  waitForIceConnected,
} from "@/lib/screenShareWebRtc";

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const GUEST_INFO_BANNER = demoModeEnabled
  ? "דמו — שיתוף מסך בדפדפן (צפייה בלבד). מומלץ Chrome או Edge. לפרודקשן: PeerServer עצמי."
  : "שיתוף מסך בדפדפן (צפייה בלבד). מומלץ Chrome או Edge.";

const AGENT_ENDED_MESSAGE = "הנציג סיים את הסשן";
const AGENT_ENDED_REASON = SESSION_END_REASON.AGENT;

function parsePeerData(raw) {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw && typeof raw === "object" ? raw : null;
}

/** אודיו מערכת ב-getDisplayMedia — בדרך כלל Chrome/Edge בדסקטופ */
function displayMediaSystemAudioSupported() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    return false;
  }
  const ua = navigator.userAgent;
  return /Chrome|Edg/.test(ua) && !/Firefox/i.test(ua);
}

export default function ScreenShareGuestPage() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const bootstrapKey = searchParams.get(GUEST_BOOTSTRAP_QUERY_KEY);
  const [session, setSession] = useState(() =>
    resolveGuestSession(sessionId, bootstrapKey)
  );
  const [sessionLoading, setSessionLoading] = useState(() => !resolveGuestSession(sessionId, bootstrapKey));
  const [consentChecked, setConsentChecked] = useState(false);
  const [recordingConsentChecked, setRecordingConsentChecked] = useState(false);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(false);
  const systemAudioSupported = displayMediaSystemAudioSupported();
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState("");
  const peerRef = useRef(null);
  const callRef = useRef(null);
  const streamRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const sharingRef = useRef(false);
  const endNotifiedRef = useRef(false);
  const agentEndedHandledRef = useRef(false);

  useEffect(() => {
    sharingRef.current = sharing;
  }, [sharing]);

  const isStreamAlive = useCallback(() => {
    const track = streamRef.current?.getVideoTracks?.()?.[0];
    return Boolean(track && track.readyState === "live");
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const endInStore = useCallback(
    (reason) => {
      if (!sessionId || endNotifiedRef.current) return;
      endNotifiedRef.current = true;
      try {
        endSession(sessionId, { endedReason: reason });
      } catch {
        /* ignore */
      }
    },
    [sessionId]
  );

  const stopPeerAndStream = useCallback(() => {
    // Prevent placeCall's reconnection/err handlers from firing.
    sharingRef.current = false;
    clearReconnectTimer();
    try {
      callRef.current?.close();
    } catch {
      /* ignore */
    }
    try {
      peerRef.current?.destroy();
    } catch {
      /* ignore */
    }
    callRef.current = null;
    peerRef.current = null;
    try {
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    streamRef.current = null;
  }, [clearReconnectTimer]);

  const endGuestSession = useCallback(
    (reason, { updateUi = false } = {}) => {
      endInStore(reason);
      stopPeerAndStream();
      if (!updateUi) return;
      setError("");
      setSharing(false);
      setShared(false);
      setSession(resolveGuestSession(sessionId, bootstrapKey));
    },
    [
      endInStore,
      stopPeerAndStream,
      resolveGuestSession,
      sessionId,
      bootstrapKey,
    ]
  );

  const sendPeerDataMessage = useCallback((payload) => {
    const peer = peerRef.current;
    if (!peer || peer.destroyed || !sessionId) return;
    const agentPeerId = resolveGuestSession(sessionId, bootstrapKey)?.agentPeerId;
    if (!agentPeerId) return;
    try {
      const conn = peer.connect(agentPeerId, { reliable: true });
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
        }, 50);
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
        }, 300);
      }
    } catch {
      /* ignore */
    }
  }, [sessionId, bootstrapKey]);

  const notifyAgentSessionEnded = useCallback(
    (reason) => {
      sendPeerDataMessage({ type: "guest_end", reason, at: Date.now() });
    },
    [sendPeerDataMessage]
  );

  const notifyAgentGuestReady = useCallback(
    (sessionSnapshot) => {
      if (!sessionSnapshot) return;
      const sendReady = () => {
        const latest = resolveGuestSession(sessionId, bootstrapKey) || sessionSnapshot;
        sendPeerDataMessage({
          type: "guest_ready",
          consentAt: latest.consentAt || null,
          recordingConsentAt: latest.recordingConsentAt || null,
          at: Date.now(),
        });
        if (latest.recordingConsentAt) {
          sendPeerDataMessage({
            type: "recording_consent",
            recordingConsentAt: latest.recordingConsentAt,
            at: Date.now(),
          });
        }
      };
      sendReady();
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        window.setTimeout(sendReady, attempt * 1200);
      }
    },
    [sendPeerDataMessage, sessionId, bootstrapKey]
  );

  const endGuestSessionWithNotify = useCallback(
    (reason, options = {}) => {
      notifyAgentSessionEnded(reason);
      endGuestSession(reason, options);
    },
    [notifyAgentSessionEnded, endGuestSession]
  );

  const handleEndedByAgent = useCallback(() => {
    if (agentEndedHandledRef.current) return;
    agentEndedHandledRef.current = true;
    endGuestSession(AGENT_ENDED_REASON, { updateUi: true });
  }, [endGuestSession]);

  const isRemoteEndedSession = useCallback((sessionSnapshot) => {
    if (sessionSnapshot?.status !== "ended") return false;
    return !isGuestInitiatedEnd(sessionSnapshot?.endedReason);
  }, []);

  const placeCall = useCallback(
    (peer, stream, agentPeerId) => {
      if (!sessionId || !stream) return false;
      const targetPeerId = String(agentPeerId || "").trim();
      if (!targetPeerId) {
        setError("ממתין לחיבור הנציג — ודאו שהנציג פתח את מסך הצפייה");
        return false;
      }
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== "live") {
        setError("שיתוף המסך לא פעיל — בחרו מסך לשיתוף שוב");
        return false;
      }
      videoTrack.enabled = true;
      logOutboundVideoTrack(stream, { reason: "before_place_call", sessionId });
      console.log("[WebRTC:guest] placeCall", {
        sessionId,
        agentPeerId: targetPeerId,
        guestPeerId: peer.id || "(pending)",
      });
      const call = peer.call(targetPeerId, stream);
      if (!call) {
        setError("לא ניתן לפתוח שיחה לנציג — ודאו שהנציג פתח את מסך הצפייה");
        return false;
      }
      callRef.current = call;

      let stopPcDebug = () => {};
      const pc = call.peerConnection;
      if (pc) {
        ensureOutboundTracksOnPeerConnection(pc, stream);
        stopPcDebug = attachPeerConnectionDebugLogging(pc, {
          role: "guest",
          sessionId,
        });
        pc.addEventListener("iceconnectionstatechange", () => {
          if (!sharingRef.current) return;
          if (pc.iceConnectionState === "failed") {
            setError(
              "חיבור הרשת נכשל — ודאו שהנציג פתח סשן צפייה וש-TURN מוגדר בשרת"
            );
          }
        });
      }

      call.on("close", () => {
        stopPcDebug();
        if (!sharingRef.current) return;
        const latest = resolveGuestSession(sessionId, bootstrapKey);
        if (isAgentEndedSession(latest)) {
          handleEndedByAgent();
          return;
        }
        if (!isStreamAlive()) {
          setShared(false);
          setError("שיתוף המסך הופסק מהדפדפן");
          return;
        }
        setError("החיבור לנציג נותק — מנסה להתחבר מחדש…");
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(async () => {
          reconnectTimerRef.current = null;
          if (!sharingRef.current || !isStreamAlive()) return;
          const latestAgentPeerId = await waitForAgentPeerId(sessionId, {
            timeoutMs: 15000,
            intervalMs: 500,
          });
          if (latestAgentPeerId) {
            placeCall(peer, stream, latestAgentPeerId);
          }
        }, 2000);
      });

      call.on("error", () => {
        stopPcDebug();
        if (!sharingRef.current) return;
        const latest = resolveGuestSession(sessionId, bootstrapKey);
        if (isAgentEndedSession(latest)) {
          handleEndedByAgent();
          return;
        }
        if (!isStreamAlive()) {
          setShared(false);
          setError("שיתוף המסך הופסק");
          return;
        }
        setError("החיבור לנציג נותק — מנסה להתחבר מחדש…");
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(async () => {
          reconnectTimerRef.current = null;
          if (!sharingRef.current || !isStreamAlive()) return;
          const latestAgentPeerId = await waitForAgentPeerId(sessionId, {
            timeoutMs: 15000,
            intervalMs: 500,
          });
          if (latestAgentPeerId) {
            placeCall(peer, stream, latestAgentPeerId);
          }
        }, 2000);
      });

      setError("");
      return true;
    },
    [
      sessionId,
      bootstrapKey,
      isStreamAlive,
      clearReconnectTimer,
      handleEndedByAgent,
    ]
  );

  const connectMediaToAgent = useCallback(
    async (peer, stream) => {
      const maxAttempts = 8;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          callRef.current?.close();
        } catch {
          /* ignore */
        }
        callRef.current = null;

        const agentPeerId = await waitForAgentPeerId(sessionId, {
          timeoutMs: attempt === 1 ? 45000 : 10000,
          intervalMs: 500,
        });
        if (!agentPeerId) {
          setError("הנציג עדיין לא מוכן — ודאו שהנציג פתח את מסך הצפייה");
          return false;
        }

        if (!placeCall(peer, stream, agentPeerId)) return false;

        const pc = callRef.current?.peerConnection;
        if (!pc) {
          if (attempt < maxAttempts) await sleep(1500 * attempt);
          continue;
        }

        if (!hasOutboundVideoSender(pc, stream)) {
          ensureOutboundTracksOnPeerConnection(pc, stream);
        }

        if (hasOutboundVideoSender(pc, stream)) {
          // Call placed with outbound video — succeed immediately; ICE may take >12s (TURN).
          // Do not close/retry on ICE timeout — that drops the agent's incoming call.
          void waitForIceConnected(pc, 25000).then((iceOk) => {
            if (!sharingRef.current || iceOk) return;
            setError(
              "שיתוף המסך נשלח — ממתין לחיבור רשת. אם הנציג לא רואה תמונה, ודאו ש-TURN מוגדר"
            );
          });
          return true;
        }

        const iceOk = await waitForIceConnected(pc, 12000);
        if (iceOk && hasOutboundVideoSender(pc, stream)) return true;

        if (attempt < maxAttempts) {
          setError(`מנסה להתחבר לנציג (ניסיון ${attempt + 1}/${maxAttempts})…`);
          await sleep(2000 * attempt);
        }
      }
      return false;
    },
    [sessionId, placeCall]
  );

  const bindPeerAgentEndListener = useCallback(
    (peer) => {
      if (!peer) return;
      peer.on("connection", (conn) => {
        conn.on("data", (raw) => {
          const data = parsePeerData(raw);
          if (data?.type === "session_ended_by_agent") {
            handleEndedByAgent();
            return;
          }
          if (data?.type === "request_video_retry") {
            if (!sharingRef.current || !isStreamAlive()) return;
            void connectMediaToAgent(peer, streamRef.current);
          }
        });
      });
    },
    [handleEndedByAgent, isStreamAlive, connectMediaToAgent]
  );

  const reconnectToAgent = useCallback(async () => {
    if (!sharingRef.current || !sessionId || !isStreamAlive()) return;
    setError("מתחבר מחדש לנציג…");
    try {
      callRef.current?.close();
    } catch {
      /* ignore */
    }
    callRef.current = null;

    let peer = peerRef.current;
    if (!peer || peer.destroyed) {
      peer = new Peer(await getPeerJsOptionsAsync(undefined, { sessionId }));
      peerRef.current = peer;
      bindPeerAgentEndListener(peer);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("תם הזמן להתחברות — ודאו שהנציג פתח את מסך הצפייה")),
          45000
        );
        peer.on("open", () => {
          clearTimeout(timeout);
          resolve();
        });
        peer.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }

    const connected = await connectMediaToAgent(peer, streamRef.current);
    if (!connected) {
      setError(
        "לא הצלחנו לחבר את שיתוף המסך לנציג — ודאו שהנציג פתח את סשן הצפייה ולחצו «שתף מסך» שוב"
      );
      return;
    }
    notifyAgentGuestReady(resolveGuestSession(sessionId, bootstrapKey));
    setError("");
  }, [
    sessionId,
    bootstrapKey,
    isStreamAlive,
    connectMediaToAgent,
    notifyAgentGuestReady,
    bindPeerAgentEndListener,
  ]);

  useEffect(() => {
    if (!sessionId || agentEndedHandledRef.current) return;
    if (!isRemoteEndedSession(session)) return;
    handleEndedByAgent();
  }, [
    sessionId,
    session?.status,
    session?.endedReason,
    isRemoteEndedSession,
    handleEndedByAgent,
  ]);

  useEffect(() => {
    if (!sessionId) return;
    void resolveIceServers({ sessionId });
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !cloudSessionSyncEnabled()) return undefined;
    return startSessionCloudPoll(sessionId);
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const local = resolveGuestSession(sessionId, bootstrapKey);
      if (local) {
        if (!cancelled) {
          setSession(local);
          setSessionLoading(false);
        }
        return;
      }
      if (!cancelled) setSessionLoading(true);
      const fromCloud = await resolveGuestSessionAsync(sessionId, bootstrapKey);
      if (!cancelled) {
        setSession(fromCloud || resolveGuestSession(sessionId, bootstrapKey));
        setSessionLoading(false);
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [sessionId, bootstrapKey]);

  useEffect(() => {
    const refresh = () => {
      const latest = resolveGuestSession(sessionId, bootstrapKey);
      if (latest) setSession(latest);
    };
    return subscribeScreenShare(refresh);
  }, [sessionId, bootstrapKey]);

  useEffect(() => {
    if (!shared || !sessionId) return undefined;
    let intervalMs = 1500;
    let timer;
    const tick = () => {
      const latest = resolveGuestSession(sessionId, bootstrapKey);
      setSession(latest);
      const nextMs =
        latest?.recordingConsentAt && latest?.recordingActiveAt ? 500 : 1500;
      if (nextMs !== intervalMs) {
        intervalMs = nextMs;
        clearInterval(timer);
        timer = setInterval(tick, intervalMs);
      }
    };
    tick();
    timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [shared, sessionId, bootstrapKey]);

  // ניקוי רק ביציאה מהדף — לא כש-shared משתנה (אחרת סיום אוטומטי מיד אחרי setShared(true))
  useEffect(() => {
    return () => {
      if (!sharingRef.current && !streamRef.current) return;
      if (sessionId && !endNotifiedRef.current) {
        endInStore("client_closed");
      }
      stopPeerAndStream();
    };
  }, [sessionId, endInStore, stopPeerAndStream]);

  useEffect(() => {
    if (!shared) return undefined;
    const onVisibility = () => {
      if (document.hidden) return;
      if (sharingRef.current && isStreamAlive() && !callRef.current) {
        reconnectToAgent();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [shared, isStreamAlive, reconnectToAgent]);

  useEffect(() => {
    if (!sessionId || !shared) return undefined;

    const tryEndOnUnload = () => {
      notifyAgentSessionEnded("client_closed");
      endInStore("client_closed");
    };

    window.addEventListener("beforeunload", tryEndOnUnload);
    window.addEventListener("pagehide", tryEndOnUnload);

    return () => {
      window.removeEventListener("beforeunload", tryEndOnUnload);
      window.removeEventListener("pagehide", tryEndOnUnload);
    };
  }, [sessionId, shared, endInStore, notifyAgentSessionEnded]);

  const handleShareScreen = async () => {
    if (!session || session.status === "ended") return;
    if (!consentChecked) {
      setError("יש לאשר את תנאי שיתוף המסך לפני המשך");
      return;
    }

    setError("");
    setSharing(true);

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error(
          "הדפדפן אינו תומך בשיתוף מסך. נסו Chrome או Edge בגרסה עדכנית."
        );
      }

      console.log("[WebRTC:guest] starting getDisplayMedia", { sessionId });
      const { stream } = await acquireDisplayMediaStream({
        includeAudio: includeSystemAudio && systemAudioSupported,
      });
      const displayVideoTrack = stream.getVideoTracks()[0];
      if (!displayVideoTrack) {
        throw new Error(
          "לא התקבל מסלול וידאו משיתוף המסך — בחרו מסך או חלון ונסו שוב"
        );
      }
      stream.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });
      streamRef.current = stream;
      logOutboundVideoTrack(stream, { reason: "after_getDisplayMedia", sessionId });

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        endGuestSessionWithNotify("client_stop", { updateUi: true });
        setError("שיתוף המסך הופסק מהדפדפן");
      });

      logScreenConsent(session.id);
      if (recordingConsentChecked) {
        logRecordingConsent(session.id);
      }
      setSession(resolveGuestSession(sessionId, bootstrapKey));

      const peer = new Peer(await getPeerJsOptionsAsync(undefined, { sessionId }));
      peerRef.current = peer;
      bindPeerAgentEndListener(peer);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("תם הזמן להתחברות לנציג — ודאו שהנציג פתח את מסך הצפייה")),
          45000
        );
        peer.on("open", () => {
          clearTimeout(timeout);
          resolve();
        });
        peer.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      sharingRef.current = true;
      const connected = await connectMediaToAgent(peer, stream);
      if (!connected) {
        throw new Error(
          "לא הצלחנו לחבר את שיתוף המסך לנציג — ודאו שהנציג פתח את סשן הצפייה לפני השיתוף"
        );
      }
      notifyAgentGuestReady(resolveGuestSession(sessionId, bootstrapKey));
      setShared(true);
      setError("");
    } catch (err) {
      const name = err?.name || "";
      let message = err?.message || "לא ניתן לשתף מסך";
      if (name === "NotAllowedError") {
        message = "הרשאת שיתוף מסך נדחתה — אשרו בחלון הדפדפן ונסו שוב";
      } else if (name === "NotFoundError") {
        message = "לא נבחר מסך לשיתוף";
      } else if (name === "OverconstrainedError") {
        message =
          "הדפדפן לא הצליח לשתף את הבחירה — נסו שוב ובחרו מסך שלם, חלון או לשונית";
      }
      setError(message);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        peerRef.current?.destroy();
      } catch {
        /* ignore */
      }
    } finally {
      setSharing(false);
    }
  };

  if (!screenShareFeaturesAvailable()) {
    return (
      <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
        <p className="text-slate-600 text-center">שיתוף מסך אינו פעיל בסביבה זו.</p>
      </div>
    );
  }

  if (sessionLoading) {
    return (
      <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
        <div className="flex items-center gap-2 text-slate-600 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
          <span>טוען קישור שיתוף…</span>
        </div>
      </div>
    );
  }

  const showRecordingWatermark =
    shared && Boolean(session?.recordingConsentAt && session?.recordingActiveAt);

  return (
    <div className={m3PageClass("flex items-center justify-center p-4 relative")} dir="rtl">
      {showRecordingWatermark && (
        <div
          className="fixed bottom-4 left-4 z-50 pointer-events-none select-none text-sm font-semibold text-slate-800/45 tracking-wide"
          role="status"
          aria-live="polite"
        >
          מוקלט
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden"
      >
        {session?.status !== "ended" ? (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-start gap-2 text-amber-950 text-xs leading-relaxed">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{GUEST_INFO_BANNER}</span>
          </div>
        ) : null}

        <div className="p-6 space-y-5">
          {session?.status !== "ended" ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 mb-3">
                <Monitor className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-extrabold text-slate-800">שיתוף מסך לתמיכה</h1>
              <p className="text-sm text-slate-500 mt-1">צפייה בלבד — ללא שליטה בעכבר</p>
            </div>
          ) : null}

          {!session ? (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-3 border border-red-100">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>
                {bootstrapKey
                  ? messageForGuestLinkError(GUEST_LINK_ERROR.EXPIRED)
                  : messageForGuestLinkError(GUEST_LINK_ERROR.NOT_FOUND)}
              </p>
            </div>
          ) : session.status === "ended" ? (
            <div className="text-center space-y-4 py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 mx-auto">
                <Monitor className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">הסשן הסתיים</h2>
              {isRemoteEndedSession(session) ? (
                <p className="text-sm text-slate-600 leading-relaxed">{AGENT_ENDED_MESSAGE}</p>
              ) : isGuestInitiatedEnd(session.endedReason) ? (
                <p className="text-sm text-slate-600 leading-relaxed">
                  סיימתם את שיתוף המסך. אין צורך בפעולה נוספת.
                </p>
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed">
                  סשן שיתוף המסך הסתיים. אין צורך בפעולה נוספת.
                </p>
              )}
              <p className="text-xs text-slate-400">ניתן לסגור את הדפדפן.</p>
            </div>
          ) : shared ? (
            <div className="text-center space-y-3">
              <SessionFileShare
                sessionId={sessionId}
                uploadedBy="guest"
                uploaderLabel="לקוח"
              />
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <p className="font-semibold text-emerald-800">המסך משותף לנציג</p>
              {session.recordingConsentAt && session.recordingActiveAt && (
                <div
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-800"
                  role="status"
                  aria-live="polite"
                >
                  <Circle className="w-2.5 h-2.5 fill-red-600 text-red-600 animate-pulse" />
                  המסך מוקלט
                </div>
              )}
              {error && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                  {error}
                </p>
              )}
              <p className="text-xs text-slate-500 leading-relaxed">
                השאירו דף זה פתוח. אם עברתם לחלון אחר — החיבור יתחדש אוטומטית כשתחזרו.
                לעצירה — השתמשו בכפתור «הפסק סשן צפייה» למטה.
              </p>
              {error && isStreamAlive() && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={reconnectToAgent}
                  className="w-full border-teal-300 text-teal-900 hover:bg-teal-50"
                >
                  חזור לשיתוף עם הנציג
                </Button>
              )}

              <Button
                type="button"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  endGuestSessionWithNotify("client_stop", { updateUi: true });
                }}
                className="w-full"
              >
                הפסק סשן צפייה
              </Button>
            </div>
          ) : (
            <>
              <SessionFileShare
                sessionId={sessionId}
                uploadedBy="guest"
                uploaderLabel="לקוח"
              />
              <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside bg-slate-50 rounded-xl p-3 border border-slate-100 leading-relaxed">
                <li>השתמשו ב-Chrome או Edge (מומלץ)</li>
                <li>סמנו «אני מאשר שיתוף מסך»</li>
                <li>
                  אם הנציג עשוי להקליט — סמנו גם «אישור הקלטה»; ההקלטה נשמרת בשרת{" "}
                  {CLOUD_RECORDING_RETENTION_DAYS} ימים (אופציונלי לצפייה בלבד)
                </li>
                <li>לחצו «התחל שיתוף מסך»</li>
                <li>בחרו מסך, חלון או לשונית לשיתוף</li>
              </ol>

              {session.agentName && (
                <p className="text-xs text-slate-500 text-center">
                  נציג: {session.agentName}
                </p>
              )}

              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-teal-200 bg-teal-50/40 p-3">
                <Checkbox
                  checked={consentChecked}
                  onCheckedChange={(v) => setConsentChecked(Boolean(v))}
                  className="mt-0.5"
                />
                <span className="text-sm font-medium text-slate-800 leading-relaxed">
                  אני מאשר שיתוף מסך — נציג התמיכה יצפה במסך שלי בדפדפן לצורך טיפול בתקלה
                  בלבד, ללא שליטה בעכבר או במקלדת
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                <Checkbox
                  checked={recordingConsentChecked}
                  onCheckedChange={(v) => setRecordingConsentChecked(Boolean(v))}
                  className="mt-0.5"
                />
                <span className="text-sm font-medium text-slate-800 leading-relaxed">
                  אני מאשר שהנציג יוכל להקליט את שיתוף המסך לצורך תיעוד הטיפול.
                  {demoModeEnabled ? " (דמו)" : ""} ההקלטה נשמרת בשרת למשך{" "}
                  {CLOUD_RECORDING_RETENTION_DAYS} ימים ונמחקת אוטומטית לאחר מכן.
                </span>
              </label>

              {systemAudioSupported && (
                <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <Checkbox
                    checked={includeSystemAudio}
                    onCheckedChange={(v) => setIncludeSystemAudio(Boolean(v))}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-slate-700 leading-relaxed">
                    כלול אודיו מערכת (אופציונלי) — יש לסמן גם «שתף אודיו» בחלון הדפדפן. ברירת מחדל:
                    ללא אודיו.
                  </span>
                </label>
              )}

              {error && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
                בחלון הדפדפן בחרו <strong>מסך שלם</strong> או <strong>חלון גלוי</strong> — לא
                חלון ממוזער או ריק (גורם למסך שחור).
              </p>

              <Button
                type="button"
                onClick={handleShareScreen}
                disabled={!consentChecked || sharing}
                className="w-full h-12 text-base bg-gradient-to-l from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
              >
                {sharing ? "מתחבר לנציג…" : "התחל שיתוף מסך"}
              </Button>
            </>
          )}
        </div>
      </motion.div>

      {session?.consentAt && session.status !== "ended" ? (
        <SessionSupportChat
          sessionId={sessionId}
          senderType="guest"
          agentDisplayName={session.agentName}
          autoOpen
          className="fixed bottom-4 right-4 z-40 w-[min(300px,calc(100vw-2rem))]"
        />
      ) : null}
    </div>
  );
}

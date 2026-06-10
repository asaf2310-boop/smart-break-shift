import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Peer from "peerjs";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Monitor,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  logRecordingConsent,
  logScreenConsent,
  GUEST_BOOTSTRAP_QUERY_KEY,
  endSession,
  resolveGuestSession,
  screenShareFeaturesAvailable,
  subscribeScreenShare,
} from "@/lib/screenShareStore";
import { GUEST_LINK_ERROR, messageForGuestLinkError } from "@/lib/shortGuestLink";
import { demoModeEnabled } from "@/api/demoClient";
import { m3PageClass } from "@/lib/hypPage";
import SessionFileShare from "@/components/remote/SessionFileShare";
import { getPeerJsOptions } from "@/lib/webrtcConfig";

const GUEST_INFO_BANNER = demoModeEnabled
  ? "דמו — שיתוף מסך בדפדפן (צפייה בלבד). מומלץ Chrome או Edge. לפרודקשן: PeerServer עצמי."
  : "שיתוף מסך בדפדפן (צפייה בלבד). מומלץ Chrome או Edge.";

const AGENT_ENDED_MESSAGE = "הנציג סיים את הסשן";
const AGENT_ENDED_REASON = "agent_ended";

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
  const [showAgentEndedDialog, setShowAgentEndedDialog] = useState(false);
  const [agentEndedMessage, setAgentEndedMessage] = useState(AGENT_ENDED_MESSAGE);

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
    try {
      const conn = peer.connect(sessionId, { reliable: true });
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
  }, [sessionId]);

  const notifyAgentSessionEnded = useCallback(
    (reason) => {
      sendPeerDataMessage({ type: "guest_end", reason, at: Date.now() });
    },
    [sendPeerDataMessage]
  );

  const notifyAgentGuestReady = useCallback(
    (sessionSnapshot) => {
      if (!sessionSnapshot) return;
      sendPeerDataMessage({
        type: "guest_ready",
        consentAt: sessionSnapshot.consentAt || null,
        recordingConsentAt: sessionSnapshot.recordingConsentAt || null,
        at: Date.now(),
      });
    },
    [sendPeerDataMessage]
  );

  const endGuestSessionWithNotify = useCallback(
    (reason, options = {}) => {
      notifyAgentSessionEnded(reason);
      endGuestSession(reason, options);
    },
    [notifyAgentSessionEnded, endGuestSession]
  );

  const handleEndedByAgent = useCallback(
    (message = AGENT_ENDED_MESSAGE) => {
      if (agentEndedHandledRef.current) return;
      agentEndedHandledRef.current = true;
      endGuestSession(AGENT_ENDED_REASON, { updateUi: true });
      setAgentEndedMessage(message || AGENT_ENDED_MESSAGE);
      setShowAgentEndedDialog(true);
    },
    [endGuestSession]
  );

  const bindPeerAgentEndListener = useCallback(
    (peer) => {
      if (!peer) return;
      peer.on("connection", (conn) => {
        conn.on("data", (raw) => {
          const data = parsePeerData(raw);
          if (data?.type === "session_ended_by_agent") {
            handleEndedByAgent(data.message);
          }
        });
      });
    },
    [handleEndedByAgent]
  );

  const isAgentEndedSession = useCallback(
    (sessionSnapshot) =>
      sessionSnapshot?.status === "ended" &&
      sessionSnapshot?.endedReason === AGENT_ENDED_REASON,
    []
  );

  const placeCall = useCallback(
    (peer, stream) => {
      if (!sessionId || !stream) return false;
      const call = peer.call(sessionId, stream);
      callRef.current = call;

      call.on("close", () => {
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
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (sharingRef.current && isStreamAlive()) {
            placeCall(peer, stream);
          }
        }, 2000);
      });

      call.on("error", () => {
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
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (sharingRef.current && isStreamAlive()) {
            placeCall(peer, stream);
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
      isAgentEndedSession,
      handleEndedByAgent,
    ]
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
      peer = new Peer(getPeerJsOptions());
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

    await placeCall(peer, streamRef.current);
    notifyAgentGuestReady(resolveGuestSession(sessionId, bootstrapKey));
    setError("");
  }, [
    sessionId,
    bootstrapKey,
    isStreamAlive,
    placeCall,
    notifyAgentGuestReady,
    bindPeerAgentEndListener,
  ]);

  useEffect(() => {
    if (!sessionId || agentEndedHandledRef.current) return;
    if (!isAgentEndedSession(session)) return;
    if (!(shared || sharingRef.current)) return;
    handleEndedByAgent();
  }, [
    sessionId,
    session?.status,
    session?.endedReason,
    shared,
    isAgentEndedSession,
    handleEndedByAgent,
  ]);

  useEffect(() => {
    const refresh = () => setSession(resolveGuestSession(sessionId, bootstrapKey));
    refresh();
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

  useEffect(() => {
    return () => {
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

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: includeSystemAudio && systemAudioSupported,
      });
      streamRef.current = stream;

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        endGuestSessionWithNotify("client_stop", { updateUi: true });
        setError("שיתוף המסך הופסק מהדפדפן");
      });

      logScreenConsent(session.id);
      if (recordingConsentChecked) {
        logRecordingConsent(session.id);
      }
      setSession(resolveGuestSession(sessionId, bootstrapKey));

      const peer = new Peer(getPeerJsOptions());
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
      await placeCall(peer, stream);
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
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-start gap-2 text-amber-950 text-xs leading-relaxed">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{GUEST_INFO_BANNER}</span>
        </div>

        <div className="p-6 space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 mb-3">
              <Monitor className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-800">שיתוף מסך לתמיכה</h1>
            <p className="text-sm text-slate-500 mt-1">צפייה בלבד — ללא שליטה בעכבר</p>
          </div>

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
            <div className="text-center space-y-2">
              {session.endedReason === AGENT_ENDED_REASON && (
                <p className="text-sm font-semibold text-slate-800">{AGENT_ENDED_MESSAGE}</p>
              )}
              <p className="text-sm text-slate-600">סשן שיתוף המסך הסתיים.</p>
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
                <li>אם הנציג עשוי להקליט — סמנו גם «אישור הקלטה» (אופציונלי לצפייה בלבד)</li>
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
                  אני מאשר שהנציג יוכל להקליט את שיתוף המסך לצורך תיעוד הטיפול (דמו) — הקובץ
                  נשמר אצל הנציג בלבד ולא נשלח אוטומטית לשרת
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

          <p className="text-center">
            <Link to="/" className="text-xs text-teal-600 hover:underline">
              חזרה לדף הבית
            </Link>
          </p>
        </div>
      </motion.div>

      <AlertDialog open={showAgentEndedDialog} onOpenChange={setShowAgentEndedDialog}>
        <AlertDialogContent dir="rtl" className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>סשן הצפייה הסתיים</AlertDialogTitle>
            <AlertDialogDescription>{agentEndedMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-start">
            <AlertDialogAction onClick={() => setShowAgentEndedDialog(false)}>
              הבנתי
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

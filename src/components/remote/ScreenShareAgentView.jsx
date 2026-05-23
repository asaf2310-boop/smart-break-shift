import React, { useEffect, useRef, useState } from "react";
import Peer from "peerjs";
import { Loader2, Monitor, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  endSession,
  getSession,
  subscribeScreenShare,
} from "@/lib/screenShareStore";

const PEER_STATUS_LABELS = {
  idle: "ממתין לפתיחת חיבור",
  waiting: "ממתין לשיתוף מסך",
  connected: "מחובר — צפייה במסך",
  ended: "הסתיים",
  error: "שגיאת חיבור",
};

/**
 * PeerJS flow (documented):
 * - Agent opens first: `new Peer(sessionId)` and waits for incoming call
 * - Customer: `new Peer()` then `peer.call(sessionId, displayStream)`
 */
export default function ScreenShareAgentView({
  sessionId,
  onEnded,
  className = "",
}) {
  const videoRef = useRef(null);
  const peerRef = useRef(null);
  const callRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [errorDetail, setErrorDetail] = useState("");
  const [sessionRecord, setSessionRecord] = useState(() =>
    sessionId ? getSession(sessionId) : null
  );

  useEffect(() => {
    if (!sessionId) return undefined;
    const refresh = () => setSessionRecord(getSession(sessionId));
    refresh();
    return subscribeScreenShare(refresh);
  }, [sessionId]);

  const displayStatusLabel = (() => {
    if (status === "connected") return PEER_STATUS_LABELS.connected;
    if (status === "ended") return PEER_STATUS_LABELS.ended;
    if (status === "error") return PEER_STATUS_LABELS.error;
    if (!sessionRecord?.consentAt) return "ממתין לאישור הלקוח בקישור";
    return PEER_STATUS_LABELS[status] || status;
  })();

  useEffect(() => {
    if (!sessionId) return undefined;

    setStatus("waiting");
    setErrorDetail("");

    const peer = new Peer(sessionId, {
      debug: 0,
    });
    peerRef.current = peer;

    peer.on("open", () => {
      setStatus("waiting");
    });

    peer.on("call", (call) => {
      callRef.current = call;
      call.answer();
      setStatus("connected");

      call.on("stream", (remoteStream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
        }
      });

      call.on("close", () => {
        setStatus("ended");
        if (videoRef.current) videoRef.current.srcObject = null;
      });

      call.on("error", () => {
        setStatus("error");
        setErrorDetail("השיחה נותקה");
      });
    });

    peer.on("error", (err) => {
      setStatus("error");
      const msg =
        err?.type === "unavailable-id"
          ? "מזהה הסשן תפוס — סגרו חלונות אחרים או צרו סשן חדש"
          : err?.message || "שגיאת PeerJS";
      setErrorDetail(msg);
    });

    return () => {
      try {
        callRef.current?.close();
      } catch {
        /* ignore */
      }
      try {
        peer.destroy();
      } catch {
        /* ignore */
      }
      peerRef.current = null;
      callRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [sessionId]);

  const handleEnd = () => {
    try {
      callRef.current?.close();
      peerRef.current?.destroy();
    } catch {
      /* ignore */
    }
    if (sessionId) endSession(sessionId);
    setStatus("ended");
    if (videoRef.current) videoRef.current.srcObject = null;
    onEnded?.();
  };

  const statusIcon =
    status === "connected" ? (
      <Wifi className="w-4 h-4 text-emerald-600" />
    ) : status === "error" ? (
      <WifiOff className="w-4 h-4 text-red-600" />
    ) : (
      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
    );

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="font-medium text-slate-800">{displayStatusLabel}</span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono" dir="ltr">
          {sessionId?.slice(0, 12)}…
        </span>
      </div>

      {errorDetail && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {errorDetail}
        </p>
      )}

      <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video border border-slate-700">
        {status !== "connected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 z-10">
            <Monitor className="w-10 h-10 opacity-50" />
            <p className="text-xs text-center px-4">
              {!sessionRecord?.consentAt
                ? "ממתין שהלקוח יאשר בקישור וישתף מסך"
                : "השאירו דף זה פתוח — הווידאו יופיע כשהלקוח ישתף מסך"}
            </p>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        צפייה בלבד — אין שליטה בעכבר. דמו: PeerServer ציבורי; לפרודקשן יש לארח PeerServer
        עצמי או Supabase Realtime.
      </p>

      <Button
        type="button"
        variant="secondary"
        onClick={handleEnd}
        disabled={status === "ended"}
        className="w-full"
      >
        סיים סשן צפייה
      </Button>
    </div>
  );
}

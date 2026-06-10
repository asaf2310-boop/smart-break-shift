import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Peer from "peerjs";
import {
  Check,
  Circle,
  CloudUpload,
  Download,
  FolderOpen,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  RefreshCw,
  Square,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { demoModeEnabled, remoteSupportEnabled } from "@/api/demoClient";

const recordingFeaturesEnabled = remoteSupportEnabled;
import { createCallLog } from "@/lib/crmStore";
import {
  downloadRecordingBlob,
  getRecordingBlob,
  hasRecordingBlob,
  saveRecordingBlob,
} from "@/lib/demoRecordingStorage";
import {
  cloudRecordingUploadEnabled,
  recordingUploadStatusLabel,
  uploadRecordingToCloud,
} from "@/lib/recordingUpload";
import {
  appendSessionRecording,
  applyGuestPeerSync,
  endSession,
  getSession,
  markGuestStreamConnected,
  markAgentPeerReady,
  listRecordingsForSession,
  markRecordingDownloaded,
  setRecordingActive,
  setRecordingStopped,
  subscribeScreenShare,
  updateRecordingMetadata,
} from "@/lib/screenShareStore";
import SessionFileShare from "@/components/remote/SessionFileShare";
import { getPeerJsOptions, isTurnConfigured } from "@/lib/webrtcConfig";
import {
  describeIcePath,
  watchRemoteVideoFromPeerConnection,
  watchVideoTrackActivation,
} from "@/lib/screenShareWebRtc";

const MAX_RECORDING_SECONDS = 30 * 60;

const PEER_STATUS_LABELS = {
  idle: "ממתין לפתיחת חיבור",
  waiting: "ממתין לשיתוף מסך",
  connecting: "מתחבר — ממתין לווידאו",
  connected: "מחובר — צפייה במסך",
  disconnected: "החיבור נותק — ניתן לחזור לצפייה",
  paused: "מושהה — חזרו ללשונית",
  ended: "הסתיים",
  error: "שגיאת חיבור",
};

const GUEST_ENDED_LABEL = "לקוח סגר את הסשן";
const AGENT_ENDED_PEER_MESSAGE = "הנציג סיים את הסשן";
const CLIENT_ENDED_REASONS = new Set(["client_stop", "client_closed"]);

function isGuestInitiatedEnd(reason) {
  return CLIENT_ENDED_REASONS.has(reason);
}

function formatRecordingElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDurationLabel(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} שניות`;
  if (s === 0) return `${m} דקות`;
  return `${m} דקות ו-${s} שניות`;
}

function formatFileSizeMb(bytes) {
  if (!bytes || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function formatRecordingTimestamp(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function pickWebmMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

/**
 * PeerJS flow (documented):
 * - Agent opens first: `new Peer(sessionId)` and waits for incoming call
 * - Customer: `new Peer()` then `peer.call(sessionId, displayStream)`
 */
export default function ScreenShareAgentView({
  sessionId,
  agentName = "",
  viewOpen = true,
  onEnded,
  className = "",
}) {
  const { toast } = useToast();
  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const peerRef = useRef(null);
  const callRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const maxDurationWarnedRef = useRef(false);
  const metadataPersistedRef = useRef(false);
  const recordingElapsedRef = useRef(0);
  const autoStartAttemptedRef = useRef(false);
  const startRecordingRef = useRef(() => {});
  const sessionEndedRef = useRef(false);

  const DEMO_AUTO_START_KEY = "demo-auto-start-recording";
  const [autoStartRecording, setAutoStartRecording] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(DEMO_AUTO_START_KEY);
    if (stored === null) return true;
    return stored === "true";
  });

  const [status, setStatus] = useState("idle");
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [errorDetail, setErrorDetail] = useState("");
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [sessionRecord, setSessionRecord] = useState(() =>
    sessionId ? getSession(sessionId) : null
  );
  const [sessionRecordings, setSessionRecordings] = useState(() =>
    sessionId ? listRecordingsForSession(sessionId) : []
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [lastRecordingMeta, setLastRecordingMeta] = useState(null);
  const [showMaxDurationBanner, setShowMaxDurationBanner] = useState(false);
  const [showPreflightDialog, setShowPreflightDialog] = useState(false);
  const [blobAvailableIds, setBlobAvailableIds] = useState(() => new Set());
  const [savingBlob, setSavingBlob] = useState(false);
  const [recordingSummary, setRecordingSummary] = useState(null);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudUploadStatus, setCloudUploadStatus] = useState(null);

  const stopRecordingInternal = useCallback((discardBlob = false) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    } else if (discardBlob) {
      chunksRef.current = [];
      setIsRecording(false);
      setRecordingElapsed(0);
    }
    if (discardBlob) {
      setRecordedBlob(null);
      mediaRecorderRef.current = null;
    }
  }, []);

  const persistRecordingMetadata = useCallback(
    (durationSec) => {
      if (!sessionId || !recordingStartedAtRef.current) return null;
      const stoppedAt = new Date().toISOString();
      const startedAt = recordingStartedAtRef.current;
      const timestamp = stoppedAt.replace(/[:.]/g, "-");
      const fileName = `screen-${sessionId}-${timestamp}.webm`;
      const hasAudio = (remoteStreamRef.current?.getAudioTracks?.() || []).length > 0;
      const latestSession = getSession(sessionId);
      const entry = appendSessionRecording(sessionId, {
        startedAt,
        stoppedAt,
        durationSec,
        fileName,
        consentAt: latestSession?.recordingConsentAt || sessionRecord?.recordingConsentAt,
        hasAudio,
      });
      setSessionRecordings(listRecordingsForSession(sessionId));
      setLastRecordingMeta(entry);
      recordingStartedAtRef.current = null;

      const customerId = sessionRecord?.crmCustomerId;
      if (customerId && entry) {
        const minutes =
          entry.durationSec >= 60
            ? Math.max(1, Math.round(entry.durationSec / 60))
            : null;
        createCallLog({
          customer_id: customerId,
          call_type: "chat",
          summary: `הקלטת מסך — ${formatDurationLabel(entry.durationSec)}`,
          agent_name: agentName || sessionRecord?.agentName || "",
          duration_minutes: minutes,
          referral_topic: null,
        });
      }
      return entry;
    },
    [sessionId, sessionRecord, agentName]
  );

  const resolveRecordingDurationSec = useCallback(() => {
    if (recordingStartedAtRef.current) {
      const started = new Date(recordingStartedAtRef.current).getTime();
      if (!Number.isNaN(started)) {
        return Math.max(1, Math.round((Date.now() - started) / 1000));
      }
    }
    return Math.max(1, recordingElapsedRef.current || 0);
  }, []);

  const refreshSessionData = useCallback(async () => {
    if (!sessionId) return;
    setSessionRecord(getSession(sessionId));
    const recs = listRecordingsForSession(sessionId);
    setSessionRecordings(recs);
    if (!recordingFeaturesEnabled) return;
    const available = new Set();
    await Promise.all(
      recs.map(async (rec) => {
        if (await hasRecordingBlob(sessionId, rec.id)) {
          available.add(rec.id);
        }
      })
    );
    setBlobAvailableIds(available);
  }, [sessionId]);

  const uploadRecordingBlobToCloud = useCallback(
    async (blob, entry, { showToast = true } = {}) => {
      if (!entry?.id || !sessionId || !blob?.size) return null;
      setCloudSaving(true);
      setCloudUploadStatus("uploading");
      try {
        const result = await uploadRecordingToCloud(
          blob,
          {
            sessionId,
            recordingId: entry.id,
            fileName: entry.fileName,
            startedAt: entry.startedAt,
            stoppedAt: entry.stoppedAt,
            durationSec: entry.durationSec,
            hasAudio: entry.hasAudio,
            agentName: sessionRecord?.agentName || agentName,
            customerEmail: sessionRecord?.customerEmail || entry.customerEmail,
            crmCustomerId: sessionRecord?.crmCustomerId || entry.crmCustomerId,
          },
          { onStatus: setCloudUploadStatus }
        );
        if (result.ok) {
          if (showToast) {
            toast({
              title: demoModeEnabled ? "נשמר בדמו (ענן מדומה)" : "הקלטה הועלתה לשרת",
              description: result.message,
            });
          }
          refreshSessionData();
        } else if (showToast && cloudRecordingUploadEnabled()) {
          toast({
            title: "העלאה לשרת",
            description: result.message,
            variant: "destructive",
          });
        }
        return result;
      } catch (err) {
        setCloudUploadStatus("failed");
        if (showToast) {
          toast({
            title: "שגיאה",
            description: err?.message || "נסו שוב",
            variant: "destructive",
          });
        }
        return null;
      } finally {
        setCloudSaving(false);
      }
    },
    [sessionId, sessionRecord, agentName, toast, refreshSessionData]
  );

  const flushRecordingSave = useCallback(
    async (blob) => {
      if (!blob?.size || metadataPersistedRef.current || !sessionId) return;
      if (!recordingFeaturesEnabled) return;
      metadataPersistedRef.current = true;
      const durationSec = resolveRecordingDurationSec();
      setRecordingElapsed(durationSec);
      recordingElapsedRef.current = durationSec;
      const entry = persistRecordingMetadata(durationSec);
      if (!entry?.id) {
        metadataPersistedRef.current = false;
        return;
      }

      setSavingBlob(true);
      try {
        if (demoModeEnabled) {
          await saveRecordingBlob({
            sessionId,
            recordingId: entry.id,
            blob,
            meta: { fileName: entry.fileName, fileSizeBytes: blob.size },
          });
          updateRecordingMetadata(sessionId, entry.id, {
            fileSizeBytes: blob.size,
          });
          setBlobAvailableIds((prev) => new Set(prev).add(entry.id));
        } else if (!cloudRecordingUploadEnabled()) {
          await saveRecordingBlob({
            sessionId,
            recordingId: entry.id,
            blob,
            meta: { fileName: entry.fileName, fileSizeBytes: blob.size },
          });
          updateRecordingMetadata(sessionId, entry.id, {
            fileSizeBytes: blob.size,
          });
          setBlobAvailableIds((prev) => new Set(prev).add(entry.id));
        }

        const summary = {
          recordingId: entry.id,
          durationSec,
          fileSizeBytes: blob.size,
          crmCustomerId: sessionRecord?.crmCustomerId || entry.crmCustomerId,
        };
        setRecordingSummary(summary);

        if (cloudRecordingUploadEnabled()) {
          setCloudUploadStatus("uploading");
          void uploadRecordingBlobToCloud(blob, entry, { showToast: true });
        } else if (demoModeEnabled) {
          toast({
            title: `הקלטה נשמרה — ${formatDurationLabel(durationSec)}, ${formatFileSizeMb(blob.size)}`,
            description: "ניתן להוריד, לשמור לענן (דמו) או לפתוח את תיק הלקוח",
          });
        } else {
          toast({
            title: `הקלטה נשמרה — ${formatDurationLabel(durationSec)}, ${formatFileSizeMb(blob.size)}`,
            description: "נשמרה מקומית — העלאה לשרת אינה מוגדרת",
          });
        }
      } catch {
        metadataPersistedRef.current = false;
        toast({
          title: "שמירה מקומית",
          description: "לא ניתן לשמור ב-IndexedDB — ההורדה המיידית עדיין זמינה",
          variant: "destructive",
        });
      } finally {
        setSavingBlob(false);
      }
    },
    [
      sessionId,
      sessionRecord,
      persistRecordingMetadata,
      resolveRecordingDurationSec,
      toast,
      uploadRecordingBlobToCloud,
    ]
  );

  const finalizeRecordingBlob = useCallback(() => {
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (blob.size > 0) {
      setRecordedBlob(blob);
      void flushRecordingSave(blob);
    }
  }, [flushRecordingSave]);

  useEffect(() => {
    if (!sessionId) return undefined;
    refreshSessionData();
    return subscribeScreenShare(() => {
      refreshSessionData();
    });
  }, [sessionId, refreshSessionData]);

  const displayStatusLabel = (() => {
    if (hasRemoteStream) {
      if (tabHidden && status === "connected") return PEER_STATUS_LABELS.paused;
      return PEER_STATUS_LABELS.connected;
    }
    if (status === "connecting") return PEER_STATUS_LABELS.connecting;
    if (sessionRecord?.guestStreamConnectedAt) {
      return "לקוח מחובר — ממתין לווידאו";
    }
    if (tabHidden && status === "connected") return PEER_STATUS_LABELS.paused;
    if (status === "connected") return PEER_STATUS_LABELS.connected;
    if (status === "disconnected") return PEER_STATUS_LABELS.disconnected;
    if (status === "ended") {
      return isGuestInitiatedEnd(sessionRecord?.endedReason)
        ? GUEST_ENDED_LABEL
        : PEER_STATUS_LABELS.ended;
    }
    if (status === "error") return PEER_STATUS_LABELS.error;
    if (!sessionRecord?.agentPeerReadyAt) return "מפעיל חיבור לקבלת שיתוף מסך…";
    if (!sessionRecord?.consentAt) return "ממתין שהלקוח יפתח את הקישור וישתף מסך";
    return PEER_STATUS_LABELS[status] || status;
  })();

  const resumeVideoPlayback = useCallback(() => {
    const video = videoRef.current;
    const stream = remoteStreamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    video.play().catch(() => {});
  }, []);

  const bindRemoteStreamToVideo = useCallback(
    (remoteStream) => {
      remoteStreamRef.current = remoteStream;
      setHasRemoteStream(true);
      setStatus("connected");
      setTabHidden(false);
      setErrorDetail("");
      setReconnecting(false);
      if (sessionId) {
        markGuestStreamConnected(sessionId);
        const latest = getSession(sessionId);
        if (latest && !latest.consentAt) {
          applyGuestPeerSync(sessionId, { consentAt: new Date().toISOString() });
          setSessionRecord(getSession(sessionId));
        }
      }
      const video = videoRef.current;
      if (video) {
        video.srcObject = remoteStream;
        video.play().catch(() => {});
      }
      void describeIcePath(callRef.current?.peerConnection).then((info) => {
        if (!info || sessionEndedRef.current) return;
        if (!info.usingRelay && isTurnConfigured()) {
          setErrorDetail(
            "החיבור עלה בלי TURN — אם המסך שחור, בדקו VITE_TURN_* ב-Vercel ו-Redeploy"
          );
        }
      });
    },
    [sessionId]
  );

  const attachRemoteStream = useCallback(
    (remoteStream) => {
      const videoTracks = remoteStream?.getVideoTracks?.() || [];
      if (!videoTracks.length) {
        setHasRemoteStream(false);
        setErrorDetail("לא התקבל זרם וידאו מהלקוח — בדקו שיתוף מסך בדפדפן הלקוח");
        return;
      }
      for (const track of videoTracks) {
        track.enabled = true;
      }
      bindRemoteStreamToVideo(remoteStream);
      watchVideoTrackActivation(remoteStream, () => {
        resumeVideoPlayback();
      });
    },
    [sessionId, bindRemoteStreamToVideo, resumeVideoPlayback]
  );

  const clearRemoteVideo = useCallback(() => {
    setHasRemoteStream(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const handleSessionEndedByGuest = useCallback(() => {
    sessionEndedRef.current = true;
    if (sessionId && mediaRecorderRef.current) setRecordingStopped(sessionId);
    stopRecordingInternal();
    setReconnecting(false);
    setErrorDetail("");
    setTabHidden(false);
    try {
      callRef.current?.close();
      peerRef.current?.destroy();
    } catch {
      /* ignore */
    }
    callRef.current = null;
    peerRef.current = null;
    setStatus("ended");
    remoteStreamRef.current = null;
    clearRemoteVideo();
  }, [sessionId, stopRecordingInternal, clearRemoteVideo]);

  const handleStreamDisconnect = useCallback(() => {
    if (sessionEndedRef.current) return;
    const latest = sessionId ? getSession(sessionId) : null;
    if (latest?.status === "ended" && isGuestInitiatedEnd(latest?.endedReason)) {
      handleSessionEndedByGuest();
      return;
    }
    if (sessionId && mediaRecorderRef.current) setRecordingStopped(sessionId);
    stopRecordingInternal();
    setStatus("disconnected");
    clearRemoteVideo();
  }, [
    sessionId,
    stopRecordingInternal,
    clearRemoteVideo,
    handleSessionEndedByGuest,
  ]);

  useEffect(() => {
    if (!sessionId || sessionRecord?.status !== "ended") return;
    if (sessionEndedRef.current) return;
    if (!isGuestInitiatedEnd(sessionRecord?.endedReason)) return;
    handleSessionEndedByGuest();
  }, [
    sessionId,
    sessionRecord?.status,
    sessionRecord?.endedReason,
    handleSessionEndedByGuest,
  ]);

  const canRecord =
    recordingFeaturesEnabled &&
    status === "connected" &&
    hasRemoteStream &&
    Boolean(sessionRecord?.recordingConsentAt);

  const recordDisabledReason = (() => {
    if (!recordingFeaturesEnabled) return null;
    if (status !== "connected") {
      return "הקלטה זמינה רק לאחר חיבור ושיתוף מסך מהלקוח";
    }
    if (!hasRemoteStream) {
      return "אין זרם וידאו — המתינו להופעת התמונה לפני הקלטה";
    }
    if (!sessionRecord?.recordingConsentAt) {
      return "הלקוח טרם אישר הקלטה בקישור שיתוף המסך";
    }
    return null;
  })();

  useEffect(() => {
    if (!sessionId) return undefined;
    sessionEndedRef.current = false;

    setStatus("waiting");
    setHasRemoteStream(false);
    setErrorDetail("");
    setRecordedBlob(null);
    setTabHidden(false);
    chunksRef.current = [];
    metadataPersistedRef.current = false;

    const peer = new Peer(getPeerJsOptions(sessionId));
    peerRef.current = peer;

    peer.on("open", () => {
      setReconnecting(false);
      if (sessionId) {
        markAgentPeerReady(sessionId);
        setSessionRecord(getSession(sessionId));
      }
      setStatus((prev) => (prev === "ended" ? prev : "waiting"));
    });

    peer.on("connection", (conn) => {
      conn.on("data", (raw) => {
        if (sessionEndedRef.current) return;
        let data = raw;
        if (typeof raw === "string") {
          try {
            data = JSON.parse(raw);
          } catch {
            return;
          }
        }
        if (data?.type === "guest_ready") {
          applyGuestPeerSync(sessionId, {
            consentAt: data.consentAt,
            recordingConsentAt: data.recordingConsentAt,
          });
          setSessionRecord(getSession(sessionId));
          return;
        }
        if (data?.type !== "guest_end") return;
        const reason = data.reason || "client_stop";
        endSession(sessionId, { endedReason: reason });
        handleSessionEndedByGuest();
      });
    });

    peer.on("call", (call) => {
      callRef.current = call;
      let stopWatchReceivers = () => {};

      call.on("stream", (remoteStream) => {
        attachRemoteStream(remoteStream);
      });

      const pc = call.peerConnection;
      if (pc) {
        stopWatchReceivers = watchRemoteVideoFromPeerConnection(pc, (stream) => {
          attachRemoteStream(stream);
        });

        const onIceStateChange = () => {
          if (sessionEndedRef.current) return;
          const ice = pc.iceConnectionState;
          if (ice === "connected" || ice === "completed") {
            setStatus((prev) => (prev === "ended" ? prev : "connecting"));
            return;
          }
          if (ice === "disconnected") {
            setErrorDetail("חיבור הרשת נותק זמנית — ממתין לשחזור…");
            return;
          }
          if (ice === "failed") {
            setStatus("error");
            setErrorDetail(
              isTurnConfigured()
                ? "חיבור WebRTC נכשל — ודאו ש-VITE_TURN_* נכונים ושבוצע Redeploy ב-Vercel"
                : "חיבור WebRTC נכשל — הגדירו TURN (VITE_TURN_URL) לרשתות שונות"
            );
          }
        };
        pc.addEventListener("iceconnectionstatechange", onIceStateChange);
        pc.addEventListener("connectionstatechange", () => {
          if (sessionEndedRef.current) return;
          if (pc.connectionState === "failed") {
            setStatus("error");
            setErrorDetail("חיבור המדיה נכשל — לחצו «חזור לצפייה» או בקשו מהלקוח לשתף שוב");
          }
        });
      }

      call.on("close", () => {
        stopWatchReceivers();
        handleStreamDisconnect();
      });

      call.on("error", () => {
        if (sessionEndedRef.current) return;
        stopWatchReceivers();
        handleStreamDisconnect();
        if (sessionEndedRef.current) return;
        setErrorDetail("השיחה נותקה — לחצו «חזור לצפייה»");
      });

      call.answer();
      setStatus("connecting");
      setReconnecting(false);
    });

    peer.on("error", (err) => {
      if (sessionEndedRef.current) return;
      const latest = getSession(sessionId);
      if (latest?.status === "ended" && isGuestInitiatedEnd(latest?.endedReason)) {
        handleSessionEndedByGuest();
        return;
      }
      stopRecordingInternal();
      setStatus("error");
      setReconnecting(false);
      const msg =
        err?.type === "unavailable-id"
          ? "מזהה הסשן תפוס — לחצו «חזור לצפייה» או סגרו חלונות אחרים"
          : err?.message || "שגיאת PeerJS";
      setErrorDetail(msg);
    });

    return () => {
      stopRecordingInternal(false);
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
      remoteStreamRef.current = null;
      setHasRemoteStream(false);
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [
    sessionId,
    connectionEpoch,
    attachRemoteStream,
    handleStreamDisconnect,
    handleSessionEndedByGuest,
    stopRecordingInternal,
  ]);

  useEffect(() => {
    const stream = remoteStreamRef.current;
    const video = videoRef.current;
    if (!hasRemoteStream || !stream || !video) return undefined;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    const startPlayback = () => {
      video.play().catch(() => {});
    };

    video.addEventListener("loadedmetadata", startPlayback);
    if (video.readyState >= 1) startPlayback();

    return () => video.removeEventListener("loadedmetadata", startPlayback);
  }, [hasRemoteStream, status]);

  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.hidden;
      setTabHidden(hidden);
      if (!hidden) {
        if (status === "connected" && remoteStreamRef.current) {
          resumeVideoPlayback();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [status, resumeVideoPlayback]);

  useEffect(() => {
    if (!viewOpen || !hasRemoteStream) return;
    resumeVideoPlayback();
  }, [viewOpen, hasRemoteStream, resumeVideoPlayback]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleToggleFullscreen = async () => {
    const container = videoContainerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch {
      toast({
        title: "מסך מלא",
        description: "לא ניתן להיכנס למסך מלא בדפדפן זה",
        variant: "destructive",
      });
    }
  };

  const handleReconnect = () => {
    if (reconnecting || status === "ended") return;
    setReconnecting(true);
    setErrorDetail("");
    clearRemoteVideo();
    remoteStreamRef.current = null;
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
    setStatus("waiting");
    setConnectionEpoch((n) => n + 1);
    toast({
      title: "מתחבר מחדש",
      description: "ממתין לזרם מהלקוח — ודאו שהלקוח עדיין משתף מסך",
    });
  };

  const handleStartRecording = () => {
    if (!recordingFeaturesEnabled || isRecording) return;
    if (status !== "connected" || !remoteStreamRef.current) {
      toast({
        title: "לא ניתן להקליט",
        description: "יש לחכות לחיבור ושיתוף מסך מהלקוח לפני התחלת הקלטה",
        variant: "destructive",
      });
      return;
    }
    if (!canRecord) return;
    if (typeof MediaRecorder === "undefined") {
      setErrorDetail("הדפדפן אינו תומך בהקלטה (MediaRecorder)");
      return;
    }

    setRecordedBlob(null);
    setLastRecordingMeta(null);
    setRecordingSummary(null);
    chunksRef.current = [];
    maxDurationWarnedRef.current = false;
    setShowMaxDurationBanner(false);
    recordingStartedAtRef.current = new Date().toISOString();
    metadataPersistedRef.current = false;
    if (sessionId) setRecordingActive(sessionId);

    const mimeType = pickWebmMimeType();
    let recorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(remoteStreamRef.current, { mimeType })
        : new MediaRecorder(remoteStreamRef.current);
    } catch {
      setErrorDetail("לא ניתן להתחיל הקלטה — נסו Chrome או Edge");
      return;
    }

    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = finalizeRecordingBlob;
    recorder.onerror = () => {
      setErrorDetail("שגיאה במהלך ההקלטה");
      stopRecordingInternal(true);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setIsRecording(true);
    setRecordingElapsed(0);
    recordingElapsedRef.current = 0;
    recordingTimerRef.current = setInterval(() => {
      setRecordingElapsed((s) => {
        const next = s + 1;
        recordingElapsedRef.current = next;
        if (next >= MAX_RECORDING_SECONDS && !maxDurationWarnedRef.current) {
          maxDurationWarnedRef.current = true;
          setShowMaxDurationBanner(true);
          toast({
            title: "הגעתם ל-30 דקות הקלטה",
            description: "מומלץ לעצור את ההקלטה. ניתן להמשיך עד שתעצרו ידנית.",
          });
        }
        return next;
      });
    }, 1000);
  };

  startRecordingRef.current = handleStartRecording;

  useEffect(() => {
    autoStartAttemptedRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (status !== "connected") {
      autoStartAttemptedRef.current = false;
    }
  }, [status]);

  useEffect(() => {
    if (!recordingFeaturesEnabled || !autoStartRecording) return undefined;
    if (!canRecord || isRecording) return undefined;
    if (autoStartAttemptedRef.current) return undefined;
    autoStartAttemptedRef.current = true;
    startRecordingRef.current();
    return undefined;
  }, [recordingFeaturesEnabled, autoStartRecording, canRecord, isRecording]);

  const handleAutoStartToggle = (event) => {
    const checked = event.target.checked;
    setAutoStartRecording(checked);
    if (typeof window !== "undefined") {
      if (checked) {
        window.localStorage.setItem(DEMO_AUTO_START_KEY, "true");
      } else {
        window.localStorage.removeItem(DEMO_AUTO_START_KEY);
      }
    }
  };

  const handleStopRecording = () => {
    if (!isRecording) return;
    if (sessionId) setRecordingStopped(sessionId);
    setShowMaxDurationBanner(false);
    stopRecordingInternal();
  };

  const handleCloudSaveSummary = async () => {
    if (!sessionId || !recordingSummary?.recordingId) return;
    const blob = await resolveBlobForDownload(recordingSummary.recordingId);
    if (!blob?.size) {
      toast({
        title: "אין קובץ",
        description: demoModeEnabled
          ? "ההקלטה לא נשמרה ב-IndexedDB"
          : "אין קובץ זמין להעלאה — הקליטו שוב",
        variant: "destructive",
      });
      return;
    }
    const meta =
      sessionRecordings.find((r) => r.id === recordingSummary.recordingId) || lastRecordingMeta;
    await uploadRecordingBlobToCloud(blob, meta, { showToast: true });
  };

  const resolveBlobForDownload = async (recordingId) => {
    if (recordedBlob && (!recordingId || lastRecordingMeta?.id === recordingId)) {
      return recordedBlob;
    }
    if (!sessionId || !recordingId) return null;
    return getRecordingBlob(sessionId, recordingId);
  };

  const handleDownloadRecording = async (recordingId = null) => {
    if (!sessionId) return;
    let meta = lastRecordingMeta;
    if (recordingId) {
      meta = sessionRecordings.find((r) => r.id === recordingId) || meta;
    }
    if (!meta && recordedBlob && !metadataPersistedRef.current) {
      await flushRecordingSave(recordedBlob);
      meta =
        listRecordingsForSession(sessionId).find((r) => r.id === lastRecordingMeta?.id) ||
        listRecordingsForSession(sessionId).at(-1) ||
        lastRecordingMeta;
    }
    const blob = await resolveBlobForDownload(recordingId || meta?.id);
    if (!blob?.size) {
      toast({
        title: "אין קובץ",
        description: "ההקלטה לא נשמרה בדפדפן — הקליטו שוב או בדקו שהדפדפן לא ניקה נתונים",
        variant: "destructive",
      });
      return;
    }
    const fileName =
      meta?.fileName ||
      `screen-${sessionId}-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
    await downloadRecordingBlob(blob, fileName);
    const id = recordingId || meta?.id;
    if (id) markRecordingDownloaded(sessionId, id);
    refreshSessionData();
  };

  const preflightItems = [
    {
      label: "חיבור פעיל",
      ok: status === "connected",
    },
    {
      label: "אישור הקלטה מהלקוח",
      ok: Boolean(sessionRecord?.recordingConsentAt),
    },
    {
      label: "זרם וידאו זמין",
      ok: hasRemoteStream,
    },
  ];

  const preflightReady = preflightItems.every((item) => item.ok);

  const handlePreflightConfirm = () => {
    setShowPreflightDialog(false);
    handleStartRecording();
  };

  const notifyGuestSessionEnded = useCallback(() => {
    const peer = peerRef.current;
    const guestPeerId = callRef.current?.peer;
    if (!peer || peer.destroyed || !guestPeerId) return;
    const payload = {
      type: "session_ended_by_agent",
      reason: "agent_ended",
      message: AGENT_ENDED_PEER_MESSAGE,
      at: Date.now(),
    };
    try {
      const conn = peer.connect(guestPeerId, { reliable: true });
      const send = () => {
        try {
          conn.send(payload);
        } catch {
          /* ignore */
        }
      };
      if (conn.open) {
        send();
      } else {
        conn.on("open", send);
      }
      window.setTimeout(() => {
        try {
          conn.close();
        } catch {
          /* ignore */
        }
      }, 300);
    } catch {
      /* ignore */
    }
  }, []);

  const handleEnd = () => {
    sessionEndedRef.current = true;
    if (isRecording && sessionId) setRecordingStopped(sessionId);
    stopRecordingInternal();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    notifyGuestSessionEnded();
    const teardown = () => {
      try {
        callRef.current?.close();
        peerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      if (sessionId) endSession(sessionId, { endedReason: "agent_ended" });
      setStatus("ended");
      remoteStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      onEnded?.();
    };
    window.setTimeout(teardown, 200);
  };

  const showReconnectOverlay =
    (status === "disconnected" || status === "error") && status !== "ended";
  const canReconnect = status !== "ended";

  const statusIcon =
    status === "connected" && !tabHidden ? (
      <Wifi className="w-4 h-4 text-emerald-600" />
    ) : status === "disconnected" || status === "error" ? (
      <WifiOff className="w-4 h-4 text-amber-600" />
    ) : status === "ended" ? (
      <WifiOff className="w-4 h-4 text-slate-500" />
    ) : (
      <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
    );

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="font-medium text-slate-800">{displayStatusLabel}</span>
          {recordingFeaturesEnabled && isRecording && (
            <span
              className="inline-flex items-center gap-1.5 text-red-700 font-semibold text-xs"
              dir="ltr"
            >
              <Circle className="w-2.5 h-2.5 fill-red-600 text-red-600 animate-pulse" />
              REC {formatRecordingElapsed(recordingElapsed)}
            </span>
          )}
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

      <div
        ref={videoContainerRef}
        className={`relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 ${
          isFullscreen ? "w-screen h-screen" : "aspect-video min-h-[220px] sm:min-h-[320px]"
        }`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {!hasRemoteStream && status !== "ended" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3 z-10 px-4">
            <Monitor className="w-10 h-10 opacity-50 pointer-events-none" />
            <p className="text-xs text-center leading-relaxed pointer-events-none">
              {!sessionRecord?.agentPeerReadyAt
                ? "מפעיל חיבור — המתינו רגע לפני שליחת הקישור ללקוח"
                : status === "connecting" || sessionRecord?.guestStreamConnectedAt
                  ? "הלקוח מחובר — ממתין להופעת התמונה. אם נשאר שחור: בקשו מהלקוח לשתף שוב או לחצו «חזור לצפייה»"
                  : !sessionRecord?.consentAt
                    ? "שלחו ללקוח את הקישור — הוא יאשר וישתף מסך"
                    : reconnecting
                      ? "מתחבר מחדש ללקוח…"
                      : "השאירו חלון זה פתוח — הווידאו יופיע כשהלקוח ישתף מסך"}
            </p>
            {(status === "connecting" || sessionRecord?.guestStreamConnectedAt) &&
              canReconnect && (
                <Button
                  type="button"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReconnect();
                  }}
                  disabled={reconnecting}
                  className="gap-2 bg-teal-600 hover:bg-teal-700 pointer-events-auto"
                >
                  {reconnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  חזור לצפייה
                </Button>
              )}
          </div>
        )}
        {showReconnectOverlay && hasRemoteStream === false && status !== "waiting" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/85 px-4">
            <p className="text-sm text-slate-200 text-center leading-relaxed">
              החיבור נותק — הסשן עדיין פעיל
            </p>
            {canReconnect && (
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReconnect();
                }}
                disabled={reconnecting}
                className="gap-2 bg-teal-600 hover:bg-teal-700 pointer-events-auto"
              >
                {reconnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                חזור לצפייה
              </Button>
            )}
          </div>
        )}
        {tabHidden && status === "connected" && hasRemoteStream && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/75 px-4">
            <p className="text-sm text-slate-200 text-center">חזרו ללשונית — לחצו לחידוש הצפייה</p>
            <Button
              type="button"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                resumeVideoPlayback();
                setTabHidden(false);
              }}
              className="gap-2 bg-teal-600 hover:bg-teal-700 pointer-events-auto"
            >
              <RefreshCw className="w-4 h-4" />
              חזור לצפייה
            </Button>
          </div>
        )}
        {recordingFeaturesEnabled && isRecording && (
          <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-1 text-xs text-white font-semibold pointer-events-none">
            <Circle className="w-2 h-2 fill-red-500 text-red-500 animate-pulse" />
            <span dir="ltr">{formatRecordingElapsed(recordingElapsed)}</span>
          </div>
        )}
        <div className="absolute top-2 right-2 z-30 flex gap-1.5">
          {(status === "connected" || hasRemoteStream) && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFullscreen();
              }}
              className="h-8 gap-1.5 bg-black/60 text-white border-0 hover:bg-black/80 pointer-events-auto"
              aria-label={isFullscreen ? "יציאה ממסך מלא" : "מסך מלא"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
              {isFullscreen ? "יציאה" : "מסך מלא"}
            </Button>
          )}
        </div>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="relative z-0 w-full h-full min-h-[180px] object-contain bg-black pointer-events-none select-none"
        />
      </div>

      {recordingFeaturesEnabled && showMaxDurationBanner && isRecording && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
          עברתם 30 דקות הקלטה — מומלץ לעצור. ההקלטה תמשיך עד לחיצה על «עצור הקלטה».
        </p>
      )}

      {recordingFeaturesEnabled && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-700">
            הקלטת מסך{demoModeEnabled ? " (דמו)" : ""}
          </p>
          {isRecording && (
            <p className="text-[11px] text-red-800 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5 leading-relaxed">
              מקליט כעת — הקובץ יישמר אוטומטית בסיום ההקלטה או הסשן
            </p>
          )}
          {recordDisabledReason && !isRecording && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 leading-relaxed">
              {recordDisabledReason}
            </p>
          )}
          {autoStartRecording && canRecord && !isRecording && !recordedBlob && (
            <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5 leading-relaxed">
              הקלטה אוטומטית פעילה — תתחיל עם חיבור הזרם
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {!isRecording ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setShowPreflightDialog(true)}
                disabled={!canRecord}
                className="gap-1.5"
              >
                <Circle className="w-3 h-3 fill-current" />
                התחל הקלטה
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleStopRecording}
                className="gap-1.5"
              >
                <Square className="w-3 h-3" />
                עצור הקלטה
              </Button>
            )}
            {recordedBlob && !isRecording && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleDownloadRecording()}
                disabled={savingBlob}
                className="gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                הורד
              </Button>
            )}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoStartRecording}
              onChange={handleAutoStartToggle}
              className="rounded border-slate-300"
            />
            התחל הקלטה אוטומטית לאחר חיבור (כשהלקוח אישר הקלטה)
          </label>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {cloudRecordingUploadEnabled()
              ? "בפרודקשן: הקובץ מועלה אוטומטית לשרת (Supabase Storage) בסיום ההקלטה."
              : demoModeEnabled
                ? "הקובץ נשמר ב-IndexedDB בדפדפן הנציג (WebM). «הורד שוב» זמין גם אחרי רענון."
                : "הקובץ נשמר מקומית ב-IndexedDB (WebM)."}
            {savingBlob ? " שומר…" : null}
            {cloudSaving ? ` ${recordingUploadStatusLabel("uploading")}` : null}
          </p>

          {recordingSummary && !isRecording && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 space-y-2">
              <p className="text-xs font-semibold text-emerald-900">
                הקלטה נשמרה — {formatDurationLabel(recordingSummary.durationSec)},{" "}
                {formatFileSizeMb(recordingSummary.fileSizeBytes)}
              </p>
              {cloudUploadStatus ? (
                <p
                  className={`text-[11px] rounded px-2 py-1 border ${
                    cloudUploadStatus === "ready"
                      ? "text-emerald-800 bg-emerald-100/80 border-emerald-200"
                      : cloudUploadStatus === "failed"
                        ? "text-red-800 bg-red-50 border-red-100"
                        : "text-amber-800 bg-amber-50 border-amber-100"
                  }`}
                >
                  {recordingUploadStatusLabel(cloudUploadStatus)}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs h-8"
                  onClick={() => handleDownloadRecording(recordingSummary.recordingId)}
                >
                  <Download className="w-3.5 h-3.5" />
                  הורד
                </Button>
                {(demoModeEnabled ||
                  cloudUploadStatus === "failed" ||
                  !cloudRecordingUploadEnabled()) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-1 text-xs h-8"
                    disabled={cloudSaving || savingBlob}
                    onClick={handleCloudSaveSummary}
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    {cloudUploadStatus === "failed" ? "נסה שוב להעלות" : "שמור לענן"}
                  </Button>
                )}
                {recordingSummary.crmCustomerId && (
                  <Link
                    to={`/crm/${recordingSummary.crmCustomerId}`}
                    className="inline-flex items-center gap-1 text-xs h-8 px-3 rounded-md border border-teal-200 bg-white text-teal-800 hover:bg-teal-50 font-medium"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    פתח תיק
                  </Link>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs h-8 text-slate-600"
                  onClick={() => setRecordingSummary(null)}
                >
                  סגור
                </Button>
              </div>
            </div>
          )}

          {sessionRecordings.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
              <p className="text-xs font-semibold text-slate-700">הקלטות בסשן</p>
              <ul className="space-y-1.5 max-h-36 overflow-y-auto">
                {sessionRecordings.map((rec) => (
                  <li
                    key={rec.id}
                    className="text-[11px] text-slate-600 bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100"
                  >
                    <span className="font-medium text-slate-800">
                      {formatDurationLabel(rec.durationSec)}
                    </span>
                    <span className="text-slate-400 mx-1">·</span>
                    <span>{formatRecordingTimestamp(rec.stoppedAt || rec.startedAt)}</span>
                    {rec.cloudUploadStatus ? (
                      <p
                        className={`text-[10px] mt-0.5 ${
                          rec.cloudUploadStatus === "ready"
                            ? "text-emerald-700"
                            : rec.cloudUploadStatus === "failed"
                              ? "text-red-700"
                              : "text-amber-700"
                        }`}
                      >
                        {recordingUploadStatusLabel(rec.cloudUploadStatus)}
                      </p>
                    ) : null}
                    {rec.downloadedAt ? (
                      <p className="text-[10px] text-emerald-700 mt-0.5">
                        הורדת הקובץ בוצעה ({formatRecordingTimestamp(rec.downloadedAt)})
                      </p>
                    ) : null}
                    {(blobAvailableIds.has(rec.id) ||
                      (recordedBlob && lastRecordingMeta?.id === rec.id)) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="link"
                        className="h-auto p-0 text-[11px] text-teal-700"
                        onClick={() => handleDownloadRecording(rec.id)}
                      >
                        הורד שוב
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {recordingFeaturesEnabled && (
        <Dialog open={showPreflightDialog} onOpenChange={setShowPreflightDialog}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>בדיקה לפני הקלטה</DialogTitle>
              <DialogDescription>
                ודאו שכל התנאים מתקיימים לפני תחילת הקלטת המסך.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2 py-2">
              {preflightItems.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-2 text-sm rounded-lg border border-slate-100 px-3 py-2"
                >
                  {item.ok ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <span className={item.ok ? "text-slate-800" : "text-slate-500"}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreflightDialog(false)}
              >
                ביטול
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!preflightReady}
                onClick={handlePreflightConfirm}
                className="gap-1.5"
              >
                <Circle className="w-3 h-3 fill-current" />
                התחל הקלטה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <SessionFileShare
        sessionId={sessionId}
        uploadedBy="agent"
        uploaderLabel={agentName || sessionRecord?.agentName || ""}
        disabled={status === "ended"}
      />

      <p className="text-[11px] text-slate-500 leading-relaxed">
        צפייה בלבד — לחיצה על הווידאו לא מסיימת את הסשן. השתמשו ב«מסך מלא» להגדלה; אם עברתם
        לחלון אחר — «חזור לצפייה» מחדש את הזרם.
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

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
  Monitor,
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
import { demoModeEnabled } from "@/api/demoClient";
import { createCallLog } from "@/lib/crmStore";
import {
  downloadRecordingBlob,
  getRecordingBlob,
  hasRecordingBlob,
  saveRecordingBlob,
} from "@/lib/demoRecordingStorage";
import { uploadRecordingToCloud } from "@/lib/recordingUpload";
import {
  appendSessionRecording,
  endSession,
  getSession,
  listRecordingsForSession,
  markRecordingDownloaded,
  setRecordingActive,
  setRecordingStopped,
  subscribeScreenShare,
  updateRecordingMetadata,
} from "@/lib/screenShareStore";

const MAX_RECORDING_SECONDS = 30 * 60;

const PEER_STATUS_LABELS = {
  idle: "ממתין לפתיחת חיבור",
  waiting: "ממתין לשיתוף מסך",
  connected: "מחובר — צפייה במסך",
  ended: "הסתיים",
  error: "שגיאת חיבור",
};

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
  onEnded,
  className = "",
}) {
  const { toast } = useToast();
  const videoRef = useRef(null);
  const peerRef = useRef(null);
  const callRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const maxDurationWarnedRef = useRef(false);
  const metadataPersistedRef = useRef(false);
  const autoStartAttemptedRef = useRef(false);
  const startRecordingRef = useRef(() => {});

  const DEMO_AUTO_START_KEY = "demo-auto-start-recording";
  const [autoStartRecording, setAutoStartRecording] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DEMO_AUTO_START_KEY) === "true";
  });

  const [status, setStatus] = useState("idle");
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [errorDetail, setErrorDetail] = useState("");
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

  const finalizeRecordingBlob = useCallback(() => {
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (blob.size > 0) {
      setRecordedBlob(blob);
    }
  }, []);

  const refreshSessionData = useCallback(async () => {
    if (!sessionId) return;
    setSessionRecord(getSession(sessionId));
    const recs = listRecordingsForSession(sessionId);
    setSessionRecordings(recs);
    if (!demoModeEnabled) return;
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

  useEffect(() => {
    if (!sessionId) return undefined;
    refreshSessionData();
    return subscribeScreenShare(() => {
      refreshSessionData();
    });
  }, [sessionId, refreshSessionData]);

  const persistRecordingMetadata = useCallback(
    (durationSec) => {
      if (!sessionId || !recordingStartedAtRef.current) return null;
      const stoppedAt = new Date().toISOString();
      const startedAt = recordingStartedAtRef.current;
      const timestamp = stoppedAt.replace(/[:.]/g, "-");
      const fileName = `screen-${sessionId}-${timestamp}.webm`;
      const hasAudio = (remoteStreamRef.current?.getAudioTracks?.() || []).length > 0;
      const entry = appendSessionRecording(sessionId, {
        startedAt,
        stoppedAt,
        durationSec,
        fileName,
        consentAt: sessionRecord?.recordingConsentAt,
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

  const displayStatusLabel = (() => {
    if (status === "connected") return PEER_STATUS_LABELS.connected;
    if (status === "ended") return PEER_STATUS_LABELS.ended;
    if (status === "error") return PEER_STATUS_LABELS.error;
    if (!sessionRecord?.consentAt) return "ממתין לאישור הלקוח בקישור";
    return PEER_STATUS_LABELS[status] || status;
  })();

  const canRecord =
    demoModeEnabled &&
    status === "connected" &&
    hasRemoteStream &&
    Boolean(sessionRecord?.recordingConsentAt);

  const recordDisabledReason = (() => {
    if (!demoModeEnabled) return null;
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

    setStatus("waiting");
    setHasRemoteStream(false);
    setErrorDetail("");
    setRecordedBlob(null);
    chunksRef.current = [];
    metadataPersistedRef.current = false;

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
        remoteStreamRef.current = remoteStream;
        setHasRemoteStream(true);
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
        }
      });

      call.on("close", () => {
        if (sessionId && mediaRecorderRef.current) setRecordingStopped(sessionId);
        stopRecordingInternal();
        setStatus("ended");
        setHasRemoteStream(false);
        remoteStreamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
      });

      call.on("error", () => {
        if (sessionId && mediaRecorderRef.current) setRecordingStopped(sessionId);
        stopRecordingInternal();
        setStatus("error");
        setErrorDetail("השיחה נותקה");
        setHasRemoteStream(false);
        remoteStreamRef.current = null;
      });
    });

    peer.on("error", (err) => {
      stopRecordingInternal();
      setStatus("error");
      const msg =
        err?.type === "unavailable-id"
          ? "מזהה הסשן תפוס — סגרו חלונות אחרים או צרו סשן חדש"
          : err?.message || "שגיאת PeerJS";
      setErrorDetail(msg);
    });

    return () => {
      stopRecordingInternal(true);
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
  }, [sessionId, stopRecordingInternal]);

  const handleStartRecording = () => {
    if (!demoModeEnabled || isRecording) return;
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
    recordingTimerRef.current = setInterval(() => {
      setRecordingElapsed((s) => {
        const next = s + 1;
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
    if (!demoModeEnabled || !autoStartRecording) return undefined;
    if (!canRecord || isRecording) return undefined;
    if (autoStartAttemptedRef.current) return undefined;
    autoStartAttemptedRef.current = true;
    startRecordingRef.current();
    return undefined;
  }, [demoModeEnabled, autoStartRecording, canRecord, isRecording]);

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

  useEffect(() => {
    if (isRecording || !recordedBlob || recordingElapsed <= 0) return;
    if (metadataPersistedRef.current) return;
    metadataPersistedRef.current = true;
    const entry = persistRecordingMetadata(recordingElapsed);
    if (!demoModeEnabled || !sessionId || !entry?.id) return;

    let cancelled = false;
    setSavingBlob(true);
    saveRecordingBlob({
      sessionId,
      recordingId: entry.id,
      blob: recordedBlob,
      meta: { fileName: entry.fileName, fileSizeBytes: recordedBlob.size },
    })
      .then(() => {
        if (cancelled) return;
        updateRecordingMetadata(sessionId, entry.id, {
          fileSizeBytes: recordedBlob.size,
        });
        setBlobAvailableIds((prev) => new Set(prev).add(entry.id));
        const summary = {
          recordingId: entry.id,
          durationSec: recordingElapsed,
          fileSizeBytes: recordedBlob.size,
          crmCustomerId: sessionRecord?.crmCustomerId || entry.crmCustomerId,
        };
        setRecordingSummary(summary);
        toast({
          title: `הקלטה נשמרה — ${formatDurationLabel(recordingElapsed)}, ${formatFileSizeMb(recordedBlob.size)}`,
          description: "ניתן להוריד, לשמור לענן (דמו) או לפתוח את תיק הלקוח",
        });
      })
      .catch(() => {
        if (!cancelled) {
          toast({
            title: "שמירה מקומית",
            description: "לא ניתן לשמור ב-IndexedDB — ההורדה המיידית עדיין זמינה",
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setSavingBlob(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    recordedBlob,
    isRecording,
    recordingElapsed,
    persistRecordingMetadata,
    sessionId,
    sessionRecord,
    toast,
  ]);

  const handleCloudSaveSummary = async () => {
    if (!sessionId || !recordingSummary?.recordingId) return;
    setCloudSaving(true);
    try {
      const blob = await resolveBlobForDownload(recordingSummary.recordingId);
      if (!blob?.size) {
        toast({
          title: "אין קובץ",
          description: "ההקלטה לא נשמרה ב-IndexedDB",
          variant: "destructive",
        });
        return;
      }
      const meta = sessionRecordings.find((r) => r.id === recordingSummary.recordingId);
      const result = await uploadRecordingToCloud(blob, {
        sessionId,
        recordingId: recordingSummary.recordingId,
        fileName: meta?.fileName,
      });
      if (result.ok) {
        toast({ title: "נשמר בדמו (ענן מדומה)", description: result.message });
        refreshSessionData();
      } else {
        toast({
          title: "העלאה לענן",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "שגיאה",
        description: err?.message || "נסו שוב",
        variant: "destructive",
      });
    } finally {
      setCloudSaving(false);
    }
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
    if (!meta && recordedBlob && recordingElapsed > 0 && !metadataPersistedRef.current) {
      metadataPersistedRef.current = true;
      meta = persistRecordingMetadata(recordingElapsed);
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

  const handleEnd = () => {
    if (isRecording && sessionId) setRecordingStopped(sessionId);
    stopRecordingInternal();
    try {
      callRef.current?.close();
      peerRef.current?.destroy();
    } catch {
      /* ignore */
    }
    if (sessionId) endSession(sessionId);
    setStatus("ended");
    remoteStreamRef.current = null;
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
          {demoModeEnabled && isRecording && (
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
        {demoModeEnabled && isRecording && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-1 text-xs text-white font-semibold">
            <Circle className="w-2 h-2 fill-red-500 text-red-500 animate-pulse" />
            <span dir="ltr">{formatRecordingElapsed(recordingElapsed)}</span>
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

      {demoModeEnabled && showMaxDurationBanner && isRecording && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
          עברתם 30 דקות הקלטה — מומלץ לעצור. ההקלטה תמשיך עד לחיצה על «עצור הקלטה».
        </p>
      )}

      {demoModeEnabled && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-700">הקלטת מסך (דמו)</p>
          {recordDisabledReason && !isRecording && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 leading-relaxed">
              {recordDisabledReason}
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
            הקובץ נשמר ב-IndexedDB בדפדפן הנציג (WebM, דמו). «הורד שוב» זמין גם אחרי רענון.
            {savingBlob ? " שומר…" : null}
          </p>

          {recordingSummary && !isRecording && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 space-y-2">
              <p className="text-xs font-semibold text-emerald-900">
                הקלטה נשמרה — {formatDurationLabel(recordingSummary.durationSec)},{" "}
                {formatFileSizeMb(recordingSummary.fileSizeBytes)}
              </p>
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
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1 text-xs h-8"
                  disabled={cloudSaving || savingBlob}
                  onClick={handleCloudSaveSummary}
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  שמור לענן
                </Button>
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

      {demoModeEnabled && (
        <Dialog open={showPreflightDialog} onOpenChange={setShowPreflightDialog}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>בדיקה לפני הקלטה</DialogTitle>
              <DialogDescription>
                ודאו שכל התנאים מתקיימים לפני תחילת הקלטת המסך (דמו).
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

<<<<<<< HEAD
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { demoModeEnabled, remoteSupportEnabled } from "@/api/demoClient";
import { getRecordingBlob } from "@/lib/demoRecordingStorage";
import { recordingUploadStatusLabel } from "@/lib/recordingUpload";
import { m3PageClass } from "@/lib/hypPage";
import {
  cloudRecordingUploadEnabled,
  fetchCloudRecordingById,
  getSignedRecordingUrl,
} from "@/lib/screenRecordingsSync";
import { findRecordingByPlayId, parseRecordingPlayId } from "@/lib/screenShareStore";

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} שניות`;
  if (s === 0) return `${m} דקות`;
  return `${m} דקות ו-${s} שניות`;
}

/** נגן הקלטה מ-IndexedDB — אותו דפדפן שבו נשמר הקובץ */
export default function DemoRecordingPlayPage({ backTo = "/remote-support", titleSuffix = "" }) {
  const [searchParams] = useSearchParams();
  const playId = searchParams.get("id") || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [playUrl, setPlayUrl] = useState(null);
  const playUrlRef = useRef(null);
  const playUrlIsBlobRef = useRef(false);

  const revokePlayUrl = useCallback(() => {
    if (playUrlRef.current && playUrlIsBlobRef.current) {
      URL.revokeObjectURL(playUrlRef.current);
    }
    playUrlRef.current = null;
    playUrlIsBlobRef.current = false;
    setPlayUrl(null);
  }, []);

  useEffect(() => {
    if (!remoteSupportEnabled) {
      setLoading(false);
      setError("תמיכה מרחוק אינה פעילה ב-build זה");
      return undefined;
    }
    if (!playId) {
      setLoading(false);
      setError("חסר מזהה הקלטה בקישור");
      return undefined;
    }

    let cancelled = false;
    revokePlayUrl();
    setError("");
    setLoading(true);

    (async () => {
      let rec = findRecordingByPlayId(playId);
      const parsed = parseRecordingPlayId(playId);

      if (!rec && cloudRecordingUploadEnabled() && parsed?.recordingId) {
        const cloudRec = await fetchCloudRecordingById(parsed.recordingId);
        if (cloudRec) {
          rec = {
            ...cloudRec,
            sessionId: cloudRec.sessionId || parsed.sessionId,
          };
        }
      }

      if (!rec) {
        if (!cancelled) {
          setError("ההקלטה לא נמצאה — ייתכן שנמחקה או שהקישור שגוי");
          setLoading(false);
        }
        return;
      }

      setTitle(
        `${formatDuration(rec.durationSec)} · ${formatWhen(rec.stoppedAt || rec.startedAt)}`
      );

      try {
        if (rec.cloudReady && rec.storagePath) {
          const signedUrl = await getSignedRecordingUrl(rec.storagePath);
          if (signedUrl) {
            if (!cancelled) {
              playUrlRef.current = signedUrl;
              playUrlIsBlobRef.current = false;
              setPlayUrl(signedUrl);
            }
            return;
          }
        }

        const blob = await getRecordingBlob(rec.sessionId, rec.id);
        if (!blob?.size) {
          if (!cancelled) {
            setError(
              cloudRecordingUploadEnabled()
                ? recordingUploadStatusLabel(rec.cloudUploadStatus || "pending")
                : "אין קובץ וידאו ב-IndexedDB — ההקלטה לא נשמרה בדפדפן זה"
            );
            setLoading(false);
          }
          return;
        }
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        playUrlRef.current = url;
        playUrlIsBlobRef.current = true;
        setPlayUrl(url);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "לא ניתן לטעון את ההקלטה");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      revokePlayUrl();
    };
  }, [playId, revokePlayUrl]);

  if (!remoteSupportEnabled) return null;

  return (
    <div className={m3PageClass("min-h-screen p-4 sm:p-6")} dir="rtl">
      <div className="max-w-3xl mx-auto space-y-4">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה
        </Link>

        <div className="m3-card p-4 sm:p-6 space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              נגן הקלטה{titleSuffix || (demoModeEnabled ? " (דמו)" : "")}
            </h1>
            {title && (
              <p className="text-sm text-slate-600 mt-1">{title}</p>
            )}
          </div>

          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
            {cloudRecordingUploadEnabled()
              ? "בפרודקשן: הקלטות זמינות בשרת נטענות בקישור חתום. בדמו — מ-IndexedDB באותו דפדפן."
              : "עובד באותו דפדפן בלבד — הקובץ נטען מ-IndexedDB במכשיר זה."}
          </p>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">טוען וידאו…</span>
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-4 text-center">
              {error}
            </p>
          )}

          {!loading && !error && playUrl && (
            <video
              src={playUrl}
              controls
              playsInline
              className="w-full rounded-lg bg-black aspect-video"
            />
          )}
        </div>
      </div>
    </div>
  );
}
=======
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { demoModeEnabled } from "@/api/demoClient";
import { getRecordingBlob } from "@/lib/demoRecordingStorage";
import { m3PageClass } from "@/lib/hypPage";
import { findRecordingByPlayId } from "@/lib/screenShareStore";

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} שניות`;
  if (s === 0) return `${m} דקות`;
  return `${m} דקות ו-${s} שניות`;
}

/** נגן הקלטה מ-IndexedDB — דמו בלבד, אותו דפדפן */
export default function DemoRecordingPlayPage() {
  const [searchParams] = useSearchParams();
  const playId = searchParams.get("id") || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [playUrl, setPlayUrl] = useState(null);
  const playUrlRef = useRef(null);

  const revokePlayUrl = useCallback(() => {
    if (playUrlRef.current) {
      URL.revokeObjectURL(playUrlRef.current);
      playUrlRef.current = null;
    }
    setPlayUrl(null);
  }, []);

  useEffect(() => {
    if (!demoModeEnabled) {
      setLoading(false);
      setError("נגן הקלטות זמין רק במצב דמו");
      return undefined;
    }
    if (!playId) {
      setLoading(false);
      setError("חסר מזהה הקלטה בקישור");
      return undefined;
    }

    let cancelled = false;
    revokePlayUrl();
    setError("");
    setLoading(true);

    (async () => {
      const rec = findRecordingByPlayId(playId);
      if (!rec) {
        if (!cancelled) {
          setError("ההקלטה לא נמצאה — ייתכן שנמחקה או שהקישור שגוי");
          setLoading(false);
        }
        return;
      }
      setTitle(
        `${formatDuration(rec.durationSec)} · ${formatWhen(rec.stoppedAt || rec.startedAt)}`
      );
      try {
        const blob = await getRecordingBlob(rec.sessionId, rec.id);
        if (!blob?.size) {
          if (!cancelled) {
            setError("אין קובץ וידאו ב-IndexedDB — ההקלטה לא נשמרה בדפדפן זה");
            setLoading(false);
          }
          return;
        }
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        playUrlRef.current = url;
        setPlayUrl(url);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "לא ניתן לטעון את ההקלטה");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      revokePlayUrl();
    };
  }, [playId, revokePlayUrl]);

  if (!demoModeEnabled) return null;

  return (
    <div className={m3PageClass("min-h-screen p-4 sm:p-6")} dir="rtl">
      <div className="max-w-3xl mx-auto space-y-4">
        <Link
          to="/remote-support"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה לתמיכה מרחוק
        </Link>

        <div className="m3-card p-4 sm:p-6 space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">נגן הקלטה (דמו)</h1>
            {title && (
              <p className="text-sm text-slate-600 mt-1">{title}</p>
            )}
          </div>

          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
            עובד באותו דפדפן בלבד — הקובץ נטען מ-IndexedDB במכשיר זה. אין שיתוף בין מחשבים או
            דפדפנים.
          </p>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">טוען וידאו…</span>
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-4 text-center">
              {error}
            </p>
          )}

          {!loading && !error && playUrl && (
            <video
              src={playUrl}
              controls
              playsInline
              className="w-full rounded-lg bg-black aspect-video"
            />
          )}
        </div>
      </div>
    </div>
  );
}
>>>>>>> 842dd9e (Initial commit)

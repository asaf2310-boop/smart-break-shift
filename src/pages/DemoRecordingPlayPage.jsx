import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { demoModeEnabled } from "@/api/demoClient";
import { getRecordingBlob } from "@/lib/demoRecordingStorage";
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
    <div className="m3-page min-h-screen p-4 sm:p-6" dir="rtl">
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

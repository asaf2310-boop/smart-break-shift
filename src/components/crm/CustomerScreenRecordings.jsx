import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, ExternalLink, Film, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { demoModeEnabled } from "@/api/demoClient";
import {
  downloadRecordingBlob,
  getRecordingBlob,
  listStoredRecordingRefs,
} from "@/lib/demoRecordingStorage";
import {
  listRecordingsForCustomer,
  markRecordingDownloaded,
  subscribeScreenShare,
} from "@/lib/screenShareStore";

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

function formatFileSizeMb(bytes) {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

export default function CustomerScreenRecordings({ crmCustomerId }) {
  const { toast } = useToast();
  const [recordings, setRecordings] = useState([]);
  const [blobKeys, setBlobKeys] = useState(() => new Set());
  const [playOpen, setPlayOpen] = useState(false);
  const [playLoading, setPlayLoading] = useState(false);
  const [playError, setPlayError] = useState("");
  const [playTitle, setPlayTitle] = useState("");
  const [playUrl, setPlayUrl] = useState(null);
  const playUrlRef = useRef(null);

  const revokePlayUrl = useCallback(() => {
    if (playUrlRef.current) {
      URL.revokeObjectURL(playUrlRef.current);
      playUrlRef.current = null;
    }
    setPlayUrl(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!crmCustomerId) {
      setRecordings([]);
      setBlobKeys(new Set());
      return;
    }
    const list = listRecordingsForCustomer(crmCustomerId);
    setRecordings(list);
    try {
      const refs = await listStoredRecordingRefs();
      const keys = new Set(
        refs
          .filter((r) => list.some((rec) => rec.sessionId === r.sessionId && rec.id === r.recordingId))
          .map((r) => `${r.sessionId}::${r.recordingId}`)
      );
      setBlobKeys(keys);
    } catch {
      setBlobKeys(new Set());
    }
  }, [crmCustomerId]);

  useEffect(() => {
    if (!demoModeEnabled || !crmCustomerId) return undefined;
    refresh();
    return subscribeScreenShare(refresh);
  }, [crmCustomerId, refresh]);

  useEffect(() => () => revokePlayUrl(), [revokePlayUrl]);

  if (!demoModeEnabled || !crmCustomerId) return null;

  const hasBlob = (rec) => blobKeys.has(`${rec.sessionId}::${rec.id}`);

  const handleDownload = async (rec) => {
    try {
      const blob = await getRecordingBlob(rec.sessionId, rec.id);
      if (!blob?.size) {
        toast({
          title: "אין קובץ שמור",
          description: "ההקלטה נמחקה מהדפדפן או לא נשמרה ב-IndexedDB",
          variant: "destructive",
        });
        return;
      }
      await downloadRecordingBlob(blob, rec.fileName || `screen-${rec.sessionId}.webm`);
      markRecordingDownloaded(rec.sessionId, rec.id);
      refresh();
      toast({ title: "הורדה", description: "קובץ ההקלטה הורד למחשב" });
    } catch (err) {
      toast({
        title: "שגיאה בהורדה",
        description: err?.message || "נסו שוב",
        variant: "destructive",
      });
    }
  };

  const handlePlay = async (rec) => {
    revokePlayUrl();
    setPlayError("");
    setPlayTitle(
      `${formatDuration(rec.durationSec)} · ${formatWhen(rec.stoppedAt || rec.startedAt)}`
    );
    setPlayOpen(true);
    setPlayLoading(true);
    try {
      const blob = await getRecordingBlob(rec.sessionId, rec.id);
      if (!blob?.size) {
        setPlayError("אין קובץ וידאו שמור — ההקלטה נמחקה או לא נשמרה ב-IndexedDB");
        return;
      }
      const url = URL.createObjectURL(blob);
      playUrlRef.current = url;
      setPlayUrl(url);
    } catch (err) {
      setPlayError(err?.message || "לא ניתן לטעון את ההקלטה");
    } finally {
      setPlayLoading(false);
    }
  };

  const handlePlayClose = (open) => {
    if (!open) {
      revokePlayUrl();
      setPlayError("");
      setPlayLoading(false);
    }
    setPlayOpen(open);
  };

  return (
    <section className="mt-4 pt-4 border-t border-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Film className="w-4 h-4 text-rose-700" />
          הקלטות מסך
        </h2>
        <Link
          to="/remote-support"
          className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline font-medium"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          קישור לתמיכה מרחוק
        </Link>
      </div>

      {recordings.length === 0 ? (
        <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 py-3 px-3 text-center">
          אין הקלטות מסך משויכות ללקוח זה. הקליטו בסשן צפייה מקושר ל-CRM.
        </p>
      ) : (
        <ul className="space-y-2">
          {recordings.map((rec) => {
            const blobSaved = hasBlob(rec);
            const sizeLabel = formatFileSizeMb(rec.fileSizeBytes);
            return (
              <li
                key={rec.id}
                className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {formatDuration(rec.durationSec)}
                    <span className="text-slate-400 font-normal mx-1">·</span>
                    {formatWhen(rec.stoppedAt || rec.startedAt)}
                  </p>
                  {sizeLabel && (
                    <p className="text-[10px] text-slate-600 mt-0.5">{sizeLabel}</p>
                  )}
                  {rec.demoCloudSaved && (
                    <span className="inline-block mt-1 text-[10px] font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5">
                      בענן (דמו)
                    </span>
                  )}
                  {!blobSaved && (
                    <p className="text-[10px] text-amber-800 mt-0.5">מטא-דאטה בלבד (ללא קובץ)</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs h-8"
                    disabled={!blobSaved}
                    onClick={() => handlePlay(rec)}
                  >
                    <Play className="w-3.5 h-3.5" />
                    נגן
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs h-8"
                    disabled={!blobSaved}
                    onClick={() => handleDownload(rec)}
                  >
                    <Download className="w-3.5 h-3.5" />
                    הורד
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={playOpen} onOpenChange={handlePlayClose}>
        <DialogContent className="sm:max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>נגן הקלטה (דמו)</DialogTitle>
            <DialogDescription>{playTitle || "הקלטת מסך"}</DialogDescription>
          </DialogHeader>
          {playLoading && (
            <p className="text-sm text-slate-600 text-center py-8">טוען וידאו…</p>
          )}
          {!playLoading && playError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-4 text-center">
              {playError}
            </p>
          )}
          {!playLoading && !playError && playUrl && (
            <video
              src={playUrl}
              controls
              playsInline
              className="w-full rounded-lg bg-black aspect-video"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

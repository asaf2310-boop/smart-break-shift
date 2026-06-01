import React, { useCallback, useEffect, useRef, useState } from "react";

import { Link } from "react-router-dom";

import {

  CloudUpload,

  Download,

  FileJson,

  FolderOpen,

  Link2,

  Play,

  Trash2,

} from "lucide-react";

import { Button } from "@/components/ui/button";

import {

  Tooltip,

  TooltipContent,

  TooltipProvider,

  TooltipTrigger,

} from "@/components/ui/tooltip";

import {

  Dialog,

  DialogContent,

  DialogDescription,

  DialogHeader,

  DialogTitle,

} from "@/components/ui/dialog";

import { useToast } from "@/components/ui/use-toast";

import { demoModeEnabled } from "@/api/demoClient";

import { getCustomerById } from "@/lib/crmStore";

import {

  deleteRecordingBlob,

  downloadRecordingBlob,

  getRecordingBlob,

  listStoredRecordingRefs,

} from "@/lib/demoRecordingStorage";

import { uploadRecordingToCloud } from "@/lib/recordingUpload";

import {

  findExpiredRecordings,

  getRecordingRetentionDays,

  purgeExpiredRecordings,

  RETENTION_DAY_OPTIONS,

  setRecordingRetentionDays,

} from "@/lib/demoRecordingRetention";

import {

  buildDemoRecordingAuditExport,

  buildRecordingPlayId,

  deleteRecordingMetadata,

  listAllRecordings,

  markRecordingDownloaded,

  subscribeScreenShare,

  updateRecordingMetadata,

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



function downloadAuditJson(data) {

  const blob = new Blob([JSON.stringify(data, null, 2)], {

    type: "application/json;charset=utf-8",

  });

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;

  anchor.download = `demo-recording-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

  anchor.click();

  URL.revokeObjectURL(url);

}



export default function DemoRecordingsLibrary() {

  const { toast } = useToast();

  const [recordings, setRecordings] = useState(() => listAllRecordings());

  const [blobKeys, setBlobKeys] = useState(() => new Set());

  const [sizeByKey, setSizeByKey] = useState(() => new Map());

  const [playOpen, setPlayOpen] = useState(false);

  const [playLoading, setPlayLoading] = useState(false);

  const [playError, setPlayError] = useState("");

  const [playTitle, setPlayTitle] = useState("");

  const [playUrl, setPlayUrl] = useState(null);

  const playUrlRef = useRef(null);

  const [retentionDays, setRetentionDays] = useState(() => getRecordingRetentionDays());

  const retentionCheckedRef = useRef(false);

  const [batchDownloading, setBatchDownloading] = useState(false);



  const revokePlayUrl = useCallback(() => {

    if (playUrlRef.current) {

      URL.revokeObjectURL(playUrlRef.current);

      playUrlRef.current = null;

    }

    setPlayUrl(null);

  }, []);



  const applyRetentionPurge = useCallback(async () => {

    const all = listAllRecordings();

    const expired = findExpiredRecordings(all, retentionDays);

    if (expired.length === 0) return;

    const ok = window.confirm(

      `נמצאו ${expired.length} הקלטות ישנות מ-${retentionDays} ימים.\n\nלמחוק אותן מהדפדפן (מטא-דאטה + קובץ)? פעולה זו אינה הפיכה.`

    );

    if (!ok) return;

    const removed = await purgeExpiredRecordings(all, retentionDays);

    if (removed > 0) {

      toast({

        title: "ניקוי לפי שמירה",

        description: `${removed} הקלטות הוסרו (מדיניות ${retentionDays} ימים)`,

      });

    }

  }, [retentionDays, toast]);



  const refresh = useCallback(async () => {

    if (!retentionCheckedRef.current) {

      retentionCheckedRef.current = true;

      await applyRetentionPurge();

    }

    setRecordings(listAllRecordings());

    try {

      const refs = await listStoredRecordingRefs();

      const keys = new Set(refs.map((r) => `${r.sessionId}::${r.recordingId}`));

      setBlobKeys(keys);

      const sizes = new Map();

      await Promise.all(

        refs.map(async (r) => {

          const key = `${r.sessionId}::${r.recordingId}`;

          const rec = listAllRecordings().find(

            (x) => x.sessionId === r.sessionId && x.id === r.recordingId

          );

          if (rec?.fileSizeBytes) {

            sizes.set(key, rec.fileSizeBytes);

            return;

          }

          try {

            const blob = await getRecordingBlob(r.sessionId, r.recordingId);

            if (blob?.size) {

              sizes.set(key, blob.size);

              if (rec && !rec.fileSizeBytes) {

                updateRecordingMetadata(r.sessionId, r.recordingId, {

                  fileSizeBytes: blob.size,

                });

              }

            }

          } catch {

            /* ignore */

          }

        })

      );

      setSizeByKey(sizes);

      setRecordings(listAllRecordings());

    } catch {

      setBlobKeys(new Set());

      setSizeByKey(new Map());

    }

  }, [applyRetentionPurge]);



  const handleRetentionChange = (event) => {

    const days = Number(event.target.value);

    if (!RETENTION_DAY_OPTIONS.includes(days)) return;

    setRecordingRetentionDays(days);

    setRetentionDays(days);

    retentionCheckedRef.current = false;

    toast({

      title: "מדיניות שמירה",

      description: `הקלטות ישנות מ-${days} ימים יוצעו למחיקה בטעינה הבאה של הספרייה`,

    });

  };



  useEffect(() => {

    if (!demoModeEnabled) return undefined;

    refresh();

    return subscribeScreenShare(() => {

      refresh();

    });

  }, [refresh]);



  useEffect(() => {

    return () => revokePlayUrl();

  }, [revokePlayUrl]);



  const hasBlob = (rec) => blobKeys.has(`${rec.sessionId}::${rec.id}`);



  const fileSizeLabel = (rec) => {

    const key = `${rec.sessionId}::${rec.id}`;

    const bytes = rec.fileSizeBytes || sizeByKey.get(key);

    return formatFileSizeMb(bytes);

  };



  const downloadRecordingFile = async (rec, { silent = false } = {}) => {

    const blob = await getRecordingBlob(rec.sessionId, rec.id);

    if (!blob?.size) {

      if (!silent) {

        toast({

          title: "אין קובץ שמור",

          description: "ההקלטה נמחקה מהדפדפן או לא נשמרה ב-IndexedDB",

          variant: "destructive",

        });

      }

      return false;

    }

    await downloadRecordingBlob(blob, rec.fileName || `screen-${rec.sessionId}.webm`);

    markRecordingDownloaded(rec.sessionId, rec.id);

    if (!rec.fileSizeBytes) {

      updateRecordingMetadata(rec.sessionId, rec.id, { fileSizeBytes: blob.size });

    }

    return true;

  };



  const handleDownload = async (rec) => {

    try {

      const ok = await downloadRecordingFile(rec);

      if (!ok) return;

      await refresh();

      toast({ title: "הורדה", description: "קובץ ההקלטה הורד למחשב" });

    } catch (err) {

      toast({

        title: "שגיאה בהורדה",

        description: err?.message || "נסו שוב",

        variant: "destructive",

      });

    }

  };



  const handleDownloadAll = async () => {

    const withBlob = recordings.filter((rec) => hasBlob(rec));

    if (withBlob.length === 0) {

      toast({

        title: "אין קבצים להורדה",

        description: "אין הקלטות עם קובץ ב-IndexedDB",

        variant: "destructive",

      });

      return;

    }

    setBatchDownloading(true);

    let succeeded = 0;

    try {

      for (const rec of withBlob) {

        try {

          const ok = await downloadRecordingFile(rec, { silent: true });

          if (ok) succeeded += 1;

        } catch {

          /* continue */

        }

        await new Promise((resolve) => {

          setTimeout(resolve, 400);

        });

      }

      await refresh();

      toast({

        title: "הורד הכל",

        description:

          succeeded === withBlob.length

            ? `הורדו ${succeeded} קבצים`

            : `הורדו ${succeeded} מתוך ${withBlob.length} (חלק נכשלו)`,

      });

    } finally {

      setBatchDownloading(false);

    }

  };



  const buildPlayPageUrl = (rec) => {

    const id = buildRecordingPlayId(rec.sessionId, rec.id);

    return `${window.location.origin}/remote-support/recordings/play?id=${id}`;

  };



  const handleCopyPlayLink = async (rec) => {

    if (!hasBlob(rec)) {

      toast({

        title: "אין קובץ שמור",

        description: "לא ניתן לשתף קישור ללא וידאו ב-IndexedDB",

        variant: "destructive",

      });

      return;

    }

    const url = buildPlayPageUrl(rec);

    try {

      await navigator.clipboard.writeText(url);

      toast({

        title: "קישור הועתק",

        description: "עובד באותו דפדפן בלבד — פתחו את הקישור באותו מחשב ודפדפן",

      });

    } catch {

      window.prompt("העתיקו את הקישור (אותו דפדפן בלבד):", url);

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

      if (!rec.fileSizeBytes) {

        updateRecordingMetadata(rec.sessionId, rec.id, { fileSizeBytes: blob.size });

      }

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



  const handleDelete = async (rec) => {

    if (

      !window.confirm(

        "למחוק את ההקלטה מהדפדפן (דמו)? פעולה זו אינה הפיכה."

      )

    ) {

      return;

    }

    try {

      await deleteRecordingBlob(rec.sessionId, rec.id);

      deleteRecordingMetadata(rec.sessionId, rec.id);

      await refresh();

      toast({ title: "נמחק", description: "ההקלטה הוסרה מהמאגר המקומי" });

    } catch (err) {

      toast({

        title: "שגיאה במחיקה",

        description: err?.message || "נסו שוב",

        variant: "destructive",

      });

    }

  };



  const handleUpload = async (rec) => {

    try {

      const blob = await getRecordingBlob(rec.sessionId, rec.id);

      if (!blob?.size) {

        toast({

          title: "אין קובץ שמור",

          description: "לא ניתן להעלות ללא קובץ ב-IndexedDB",

          variant: "destructive",

        });

        return;

      }

      const result = await uploadRecordingToCloud(blob, {

        sessionId: rec.sessionId,

        recordingId: rec.id,

        fileName: rec.fileName,

        durationSec: rec.durationSec,

      });

      if (result.ok) {

        await refresh();

        toast({ title: "נשמר בדמו (ענן מדומה)", description: result.message });

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

    }

  };



  const handleExportAudit = () => {

    const data = buildDemoRecordingAuditExport();

    downloadAuditJson(data);

    toast({

      title: "יומן יוצא",

      description: "קובץ JSON עם הסכמות ומטא-דאטה (ללא וידאו) הורד למחשב",

    });

  };



  if (!demoModeEnabled) return null;



  const stats = recordings.reduce(

    (acc, rec) => {

      const key = `${rec.sessionId}::${rec.id}`;

      const bytes = rec.fileSizeBytes || sizeByKey.get(key) || 0;

      acc.totalBytes += bytes;

      if (rec.demoCloudSaved) acc.cloudCount += 1;

      return acc;

    },

    { totalBytes: 0, cloudCount: 0 }

  );

  const totalMbLabel =

    stats.totalBytes > 0

      ? `${(stats.totalBytes / (1024 * 1024)).toFixed(stats.totalBytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`

      : "0 MB";

  const downloadableCount = recordings.filter((rec) => hasBlob(rec)).length;



  return (

    <TooltipProvider delayDuration={200}>

    <div className="space-y-3" dir="rtl">

      <p className="m3-label-medium text-on-surface-variant text-xs leading-relaxed">

        הקלטות נשמרות ב-IndexedDB בדפדפן הנציג (דמו). «נגן» / «הורד» זמינים גם אחרי רענון הדף.

      </p>



      {recordings.length > 0 && (

        <div className="flex flex-wrap gap-3 text-xs rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">

          <span>

            <span className="font-semibold text-slate-800">{recordings.length}</span> הקלטות

          </span>

          <span className="text-slate-400">·</span>

          <span>

            סה״כ <span className="font-semibold text-slate-800">{totalMbLabel}</span>

          </span>

          <span className="text-slate-400">·</span>

          <span>

            <span className="font-semibold text-sky-800">{stats.cloudCount}</span> בענן (דמו)

          </span>

          <span className="text-slate-400">·</span>

          <span className="text-slate-600">{downloadableCount} עם קובץ מקומי</span>

        </div>

      )}



      <div className="flex flex-wrap items-center gap-3">

        <label className="flex items-center gap-2 text-xs text-slate-700">

          <span className="font-medium">שמירה (דמו):</span>

          <select

            value={retentionDays}

            onChange={handleRetentionChange}

            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"

          >

            {RETENTION_DAY_OPTIONS.map((d) => (

              <option key={d} value={d}>

                {d} ימים

              </option>

            ))}

          </select>

        </label>

        <Button

          type="button"

          size="sm"

          variant="outline"

          className="gap-1.5 text-xs h-8"

          onClick={handleExportAudit}

        >

          <FileJson className="w-3.5 h-3.5" />

          ייצוא יומן הקלטות (דמו)

        </Button>

        {recordings.length > 0 && (

          <Button

            type="button"

            size="sm"

            variant="outline"

            className="gap-1.5 text-xs h-8"

            disabled={batchDownloading || downloadableCount === 0}

            onClick={handleDownloadAll}

          >

            <Download className="w-3.5 h-3.5" />

            {batchDownloading ? "מוריד…" : "הורד הכל"}

          </Button>

        )}

      </div>



      {recordings.length === 0 ? (

        <p className="m3-label-medium text-on-surface-variant text-sm">

          אין הקלטות שמורות עדיין. התחילו סשן צפייה והקליטו לאחר אישור הלקוח.

        </p>

      ) : (

        <ul className="divide-y divide-outline-variant/40">

          {recordings.map((rec) => {

            const customer = rec.crmCustomerId

              ? getCustomerById(rec.crmCustomerId)

              : null;

            const blobSaved = hasBlob(rec);

            const sizeLabel = fileSizeLabel(rec);

            return (

              <li

                key={rec.id}

                className="py-3 flex flex-wrap items-start justify-between gap-3"

              >

                <div className="min-w-0 space-y-1">

                  <div className="flex items-center gap-2">

                    <div

                      className="w-14 h-9 rounded-md bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0"

                      aria-hidden

                    >

                      <Play className="w-4 h-4 text-slate-500 opacity-60" />

                    </div>

                    <div>

                      <p className="m3-label-medium font-semibold flex flex-wrap items-center gap-1.5">

                        <span>

                          {formatDuration(rec.durationSec)}

                          <span className="text-on-surface-variant font-normal mx-1">·</span>

                          {formatWhen(rec.stoppedAt || rec.startedAt)}

                        </span>

                        {rec.demoCloudSaved && (

                          <Tooltip>

                            <TooltipTrigger asChild>

                              <span className="text-[10px] font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5 cursor-help">

                                בענן (דמו)

                              </span>

                            </TooltipTrigger>

                            <TooltipContent

                              side="top"

                              className="max-w-xs text-right leading-relaxed"

                            >

                              ענן מדומה בלבד — סימון ב-localStorage. אין העלאה אמיתית ל-Supabase

                              או שרת חיצוני.

                            </TooltipContent>

                          </Tooltip>

                        )}

                      </p>

                      {sizeLabel && (

                        <p className="text-[10px] text-slate-600">{sizeLabel}</p>

                      )}

                    </div>

                  </div>

                  <p className="m3-label-medium text-on-surface-variant text-xs font-mono" dir="ltr">

                    {rec.sessionId?.slice(0, 20)}…

                  </p>

                  {customer ? (

                    <p className="m3-label-medium text-xs text-teal-800">

                      {customer.name}

                      {customer.company ? ` · ${customer.company}` : ""}

                    </p>

                  ) : rec.customerEmail ? (

                    <p className="m3-label-medium text-xs text-slate-600">{rec.customerEmail}</p>

                  ) : null}

                  {rec.hasAudio && (

                    <p className="text-[10px] text-indigo-700">כולל אודיו בזרם</p>

                  )}

                  {rec.downloadedAt && (

                    <p className="text-[10px] text-emerald-700">

                      הורד לאחרונה: {formatWhen(rec.downloadedAt)}

                    </p>

                  )}

                  {!blobSaved && (

                    <p className="text-[10px] text-amber-800">אין קובץ ב-IndexedDB (מטא-דאטה בלבד)</p>

                  )}

                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">

                  {rec.crmCustomerId && (

                    <Link

                      to={`/crm/${rec.crmCustomerId}`}

                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"

                    >

                      <FolderOpen className="w-3.5 h-3.5" />

                      שמור לתיק לקוח

                    </Link>

                  )}

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

                  <Button

                    type="button"

                    size="sm"

                    variant="outline"

                    className="gap-1 text-xs h-8"

                    disabled={!blobSaved}

                    onClick={() => handleCopyPlayLink(rec)}

                    title="קישור נגן — אותו דפדפן בלבד"

                  >

                    <Link2 className="w-3.5 h-3.5" />

                    קישור

                  </Button>

                  <Link

                    to={`/remote-support/recordings/play?id=${buildRecordingPlayId(rec.sessionId, rec.id)}`}

                    className={`inline-flex items-center gap-1 text-xs h-8 px-3 rounded-md border font-medium ${

                      blobSaved

                        ? "border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-50"

                        : "border-slate-200 text-slate-400 pointer-events-none opacity-60"

                    }`}

                    aria-disabled={!blobSaved}

                    tabIndex={blobSaved ? 0 : -1}

                  >

                    <Play className="w-3.5 h-3.5" />

                    נגן בדף

                  </Link>

                  <Button

                    type="button"

                    size="sm"

                    variant="ghost"

                    className="gap-1 text-xs h-8 text-red-700 hover:text-red-800"

                    onClick={() => handleDelete(rec)}

                  >

                    <Trash2 className="w-3.5 h-3.5" />

                    מחק

                  </Button>

                  <Tooltip>

                    <TooltipTrigger asChild>

                      <span className="inline-flex">

                        <Button

                          type="button"

                          size="sm"

                          variant="secondary"

                          className="gap-1 text-xs h-8"

                          disabled={!blobSaved || rec.demoCloudSaved}

                          onClick={() => handleUpload(rec)}

                        >

                          <CloudUpload className="w-3.5 h-3.5" />

                          {rec.demoCloudSaved ? "בענן (דמו)" : "העלאה לענן"}

                        </Button>

                      </span>

                    </TooltipTrigger>

                    <TooltipContent side="top" className="max-w-xs text-right leading-relaxed">

                      {rec.demoCloudSaved

                        ? "כבר סומן כענן מדומה — אין שרת אמיתי"

                        : "סימולציה בלבד: מעדכן מטא-דאטה מקומית, ללא Supabase Storage"}

                    </TooltipContent>

                  </Tooltip>

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

            <DialogDescription>{playTitle || "הקלטת מסך שמורה מקומית"}</DialogDescription>

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

    </div>

    </TooltipProvider>

  );

}


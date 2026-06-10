import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileUp, Loader2, Paperclip, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { demoModeEnabled } from "@/api/demoClient";
import { listLocalSessionFiles, subscribeSupportFiles } from "@/lib/supportFilesStore";
import {
  cloudSupportFilesEnabled,
  downloadSupportSessionFile,
  fetchCloudSessionFiles,
  formatSupportFileSize,
  mergeSessionFiles,
  supportFileUploadStatusLabel,
  uploadSupportSessionFile,
  MAX_SUPPORT_FILE_BYTES,
} from "@/lib/supportFileUpload";

function formatFileTime(iso) {
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

function uploaderBadge(file) {
  if (file.uploadedBy === "guest") return "לקוח";
  return file.uploaderLabel || "נציג";
}

/**
 * שיתוף קבצים בסשן תמיכה — נציג ולקוח.
 * @param {{ sessionId: string, uploadedBy: 'agent'|'guest', uploaderLabel?: string, disabled?: boolean }} props
 */
export default function SessionFileShare({
  sessionId,
  uploadedBy = "agent",
  uploaderLabel = "",
  disabled = false,
  className = "",
}) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshFiles = useCallback(async () => {
    if (!sessionId) {
      setFiles([]);
      return;
    }
    const local = listLocalSessionFiles(sessionId);
    if (cloudSupportFilesEnabled()) {
      setLoading(true);
      try {
        const cloud = await fetchCloudSessionFiles(sessionId);
        setFiles(mergeSessionFiles(local, cloud));
      } finally {
        setLoading(false);
      }
    } else {
      setFiles(local);
    }
  }, [sessionId]);

  useEffect(() => {
    refreshFiles();
    const unsubLocal = subscribeSupportFiles(refreshFiles);
    return unsubLocal;
  }, [refreshFiles]);

  useEffect(() => {
    if (!sessionId || disabled || !cloudSupportFilesEnabled()) return undefined;
    const interval = window.setInterval(refreshFiles, 4000);
    return () => window.clearInterval(interval);
  }, [sessionId, disabled, refreshFiles]);

  const handlePickFile = () => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked || !sessionId) return;

    setUploading(true);
    try {
      const result = await uploadSupportSessionFile(picked, {
        sessionId,
        uploadedBy,
        uploaderLabel,
      });
      if (result.ok) {
        toast({
          title: "קובץ הועלה",
          description: `${picked.name} — ${formatSupportFileSize(picked.size)}`,
        });
        await refreshFiles();
      } else {
        toast({
          title: "העלאה נכשלה",
          description: result.message || "נסו שוב",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "שגיאה",
        description: err?.message || "לא ניתן להעלות את הקובץ",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file) => {
    if (!file?.id) return;
    setDownloadingId(file.id);
    try {
      const result = await downloadSupportSessionFile(file);
      if (!result.ok) {
        toast({
          title: "הורדה נכשלה",
          description: result.message || "נסו שוב",
          variant: "destructive",
        });
      }
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div
      className={`space-y-2 rounded-xl border border-slate-200 bg-white p-3 ${className}`}
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-teal-700" />
          קבצים משותפים{demoModeEnabled ? " (דמו)" : ""}
        </p>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
      </div>

      <p className="text-[10px] text-slate-500 leading-relaxed">
        העלו קבצים לשיתוף עם הצד השני. מקסימום {formatSupportFileSize(MAX_SUPPORT_FILE_BYTES)} לקובץ.
        {cloudSupportFilesEnabled()
          ? " הקבצים נשמרים בשרת וזמינים להורדה מכל מכשיר."
          : " בדמו: הקבצים נשמרים בדפדפן המעלה בלבד."}
      </p>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handlePickFile}
        disabled={disabled || uploading}
        className="w-full gap-2 border-teal-200 text-teal-900 hover:bg-teal-50"
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileUp className="w-4 h-4" />
        )}
        {uploading ? "מעלה קובץ…" : "צרף קובץ"}
      </Button>

      {files.length > 0 ? (
        <ul className="space-y-1.5 max-h-40 overflow-y-auto pt-1 border-t border-slate-100">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-start justify-between gap-2 text-[11px] bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800 truncate" title={file.originalName}>
                  {file.originalName}
                </p>
                <p className="text-slate-500 flex flex-wrap items-center gap-1 mt-0.5">
                  <span className="inline-flex items-center gap-0.5">
                    <User className="w-3 h-3" />
                    {uploaderBadge(file)}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>{formatSupportFileSize(file.fileSizeBytes)}</span>
                  <span className="text-slate-300">·</span>
                  <span>{formatFileTime(file.uploadedAt || file.createdAt)}</span>
                </p>
                {file.uploadStatus && file.uploadStatus !== "ready" ? (
                  <p
                    className={`text-[10px] mt-0.5 ${
                      file.uploadStatus === "failed" ? "text-red-700" : "text-amber-700"
                    }`}
                  >
                    {supportFileUploadStatusLabel(file.uploadStatus)}
                    {file.uploadError ? ` — ${file.uploadError}` : ""}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="shrink-0 h-7 px-2 text-teal-700 hover:text-teal-900"
                disabled={file.uploadStatus === "uploading" || downloadingId === file.id}
                onClick={() => handleDownload(file)}
                title="הורדה"
              >
                {downloadingId === file.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-slate-400 text-center py-2 border-t border-slate-100">
          עדיין לא שותפו קבצים בסשן זה
        </p>
      )}
    </div>
  );
}

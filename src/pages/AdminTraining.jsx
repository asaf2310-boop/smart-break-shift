import React, { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileUp, GraduationCap, Trash2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { resolveTrainingSchedule } from "@/lib/trainingSchedule";
import {
  listPresentationAvailability,
  removeTrainingPresentation,
  uploadTrainingPresentation,
} from "@/lib/trainingPresentations";
import { supabaseConfigured } from "@/api/supabase";

export default function AdminTraining() {
  const schedule = useMemo(() => resolveTrainingSchedule(), []);
  const teachableSessions = useMemo(
    () => schedule.sessions.filter((s) => !s.isBreak),
    [schedule.sessions]
  );
  const sessionIds = useMemo(() => teachableSessions.map((s) => s.id), [teachableSessions]);

  const [availability, setAvailability] = useState({});
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputRefs = useRef({});
  const { toast } = useToast();

  const refreshAvailability = useCallback(async () => {
    const map = await listPresentationAvailability(sessionIds);
    setAvailability(map);
  }, [sessionIds]);

  React.useEffect(() => {
    refreshAvailability();
  }, [refreshAvailability]);

  const handleFile = async (sessionId, file) => {
    if (!file) return;
    setUploadingId(sessionId);
    try {
      const result = await uploadTrainingPresentation(sessionId, file);
      if (result.ok) {
        toast({ title: "הועלה בהצלחה", description: result.message });
        await refreshAvailability();
      } else {
        toast({
          title: result.message,
          description: result.description,
          variant: result.description ? "default" : "destructive",
        });
      }
    } catch {
      toast({ title: "שגיאה", description: "העלאה נכשלה" });
    } finally {
      setUploadingId(null);
      const input = fileInputRefs.current[sessionId];
      if (input) input.value = "";
    }
  };

  const handleRemove = async (sessionId) => {
    setUploadingId(sessionId);
    try {
      await removeTrainingPresentation(sessionId);
      toast({ title: "הוסר מהאחסון המקומי/ענן" });
      await refreshAvailability();
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="m3-page min-h-screen" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-elevation-2 shrink-0">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="m3-headline-small text-xl font-semibold">ניהול מצגות הדרכה</h1>
              <p className="m3-label-medium">העלאת PDF למפגש — הנציגים רואים מצגת מעוצבת אוטומטית</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Link to="/admin" className="m3-btn-outlined text-xs py-2">
              <ArrowRight className="w-4 h-4" />
              חזרה
            </Link>
            <Link to="/training" className="text-xs text-primary hover:underline">
              תצוגת נציג
            </Link>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="m3-card p-4 mb-6 text-sm text-on-surface-variant space-y-2 border border-primary/15"
        >
          <p className="font-medium text-on-surface">איך זה עובד</p>
          <ul className="list-disc list-inside space-y-1 m-0">
            <li>העלו קובץ PDF אחד לכל מפגש — כל עמוד PDF = שקף במצגת.</li>
            <li>
              {supabaseConfigured
                ? "Supabase מוגדר: הקבצים נשמרים ב-bucket `training-docs`."
                : "ללא Supabase: הקבצים נשמרים בדפדפן (IndexedDB) לבדיקות מקומיות."}
            </li>
            <li>
              לפריסה קבועה בלי Supabase: העתיקו קבצים ל־
              <code className="text-xs bg-surface-container-high px-1 rounded">
                public/training/slides/&#123;sessionId&#125;.pdf
              </code>
            </li>
            <li>PowerPoint (pptx): ייצאו ל-PDF לפני העלאה — אין המרה בדפדפן.</li>
          </ul>
        </motion.div>

        <div className="space-y-3">
          {teachableSessions.map((session, index) => {
            const hasDoc = availability[session.id];
            const busy = uploadingId === session.id;

            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className="m3-surface-container p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-primary font-mono tabular-nums">{session.timeLabel}</p>
                  <p className="font-medium text-sm sm:text-base truncate">{session.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {session.date.split("-").reverse().join(".")} · מזהה:{" "}
                    <code className="text-[11px]">{session.id}</code>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      hasDoc ? "bg-primary/15 text-primary" : "bg-outline-variant/20 text-on-surface-variant"
                    }`}
                  >
                    {hasDoc ? "יש מצגת" : "אין קובץ"}
                  </span>

                  <input
                    ref={(el) => {
                      fileInputRefs.current[session.id] = el;
                    }}
                    type="file"
                    accept=".pdf,application/pdf,.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    className="hidden"
                    onChange={(e) => handleFile(session.id, e.target.files?.[0])}
                  />

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileInputRefs.current[session.id]?.click()}
                    className="m3-btn-primary text-xs py-2 gap-1.5"
                  >
                    {busy ? (
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    העלאת PDF
                  </button>

                  {hasDoc ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRemove(session.id)}
                      className="m3-btn-outlined text-xs py-2 text-destructive border-destructive/30"
                      aria-label="הסרה"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="m3-label-medium text-center mt-8 flex items-center justify-center gap-1">
          <FileUp className="w-4 h-4" />
          אין צורך ליצור שקפים ידנית — המסמך שהועלה הוא המצגת
        </p>
      </div>
    </div>
  );
}

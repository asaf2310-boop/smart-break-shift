import React, { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  FileUp,
  GraduationCap,
  Link2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { format, parseISO, startOfMonth } from "date-fns";
import { he } from "date-fns/locale";

import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { hypHeaderIconClass, m3PageClass } from "@/lib/hypPage";
import { demoModeEnabled } from "@/api/demoClient";
import { supabaseConfigured } from "@/api/supabase";
import { alignTrainingDateSelection, resolveTrainingSchedule } from "@/lib/trainingSchedule";
import {
  deleteTrainingSession,
  hydrateTrainingData,
  resetTrainingScheduleStore,
  subscribeTrainingScheduleStore,
  updateTrainingCourseConfig,
  upsertTrainingSession,
} from "@/lib/trainingScheduleStore";
import {
  getExternalLink,
  listPresentationAvailability,
  removeExternalLink,
  removeTrainingPresentation,
  setExternalLink,
  uploadTrainingPresentation,
} from "@/lib/trainingPresentations";
import TrainingScheduleCalendar from "@/components/training/TrainingScheduleCalendar";
import TrainingSessionDialog from "@/components/training/TrainingSessionDialog";

function dateKey(d) {
  return format(d, "yyyy-MM-dd");
}

function getInitialAdminTrainingState() {
  const schedule = resolveTrainingSchedule();
  const firstDate = schedule.days[0]?.date;
  const anchor = firstDate ? parseISO(`${firstDate}T12:00:00`) : new Date();
  return {
    schedule,
    selectedDate: anchor,
    visibleMonth: startOfMonth(anchor),
    courseStartDraft: schedule.courseStartDate,
  };
}

export default function AdminTraining() {
  const [initial] = useState(getInitialAdminTrainingState);
  const [schedule, setSchedule] = useState(initial.schedule);
  const [selectedDate, setSelectedDate] = useState(initial.selectedDate);
  const [visibleMonth, setVisibleMonth] = useState(initial.visibleMonth);
  const [sessionDialog, setSessionDialog] = useState(null);
  const [filterPresentationsToDay, setFilterPresentationsToDay] = useState(true);
  const [courseStartDraft, setCourseStartDraft] = useState(initial.courseStartDraft);

  const selectedKey = dateKey(selectedDate);
  const previousCourseStartRef = useRef(initial.schedule.courseStartDate);
  const selectedKeyRef = useRef(dateKey(initial.selectedDate));
  const suppressStoreRefreshRef = useRef(0);

  selectedKeyRef.current = selectedKey;

  const applyResolvedSchedule = useCallback((next, overrides = {}) => {
    const previousCourseStartDate = overrides.previousCourseStartDate ?? previousCourseStartRef.current;
    const currentSelectedKey = overrides.selectedDateKey ?? selectedKeyRef.current;
    const courseStartChanged = previousCourseStartDate !== next.courseStartDate;

    const nextSelectedKey = courseStartChanged
      ? alignTrainingDateSelection(
          currentSelectedKey,
          previousCourseStartDate,
          next.courseStartDate,
          next.days,
          { courseStartChanged: true }
        )
      : currentSelectedKey && next.days.some((day) => day.date === currentSelectedKey)
        ? currentSelectedKey
        : alignTrainingDateSelection(
            currentSelectedKey,
            previousCourseStartDate,
            next.courseStartDate,
            next.days
          );

    const fallbackKey = courseStartChanged
      ? (next.days.find((day) => day.date === next.courseStartDate)?.date ??
        next.days[0]?.date ??
        next.courseStartDate)
      : (next.days[0]?.date ?? next.courseStartDate);
    const resolvedKey = nextSelectedKey || fallbackKey;
    if (!resolvedKey) return;

    const resolvedSelectedDate = overrides.selectedDate ?? parseISO(`${resolvedKey}T12:00:00`);
    if (Number.isNaN(resolvedSelectedDate.getTime())) return;

    const nextVisibleMonth =
      overrides.visibleMonth ??
      (courseStartChanged ? startOfMonth(parseISO(`${next.courseStartDate}T12:00:00`)) : null);

    if (courseStartChanged || resolvedKey !== currentSelectedKey) {
      setSelectedDate(resolvedSelectedDate);
      setVisibleMonth(nextVisibleMonth ?? startOfMonth(resolvedSelectedDate));
    } else if (nextVisibleMonth) {
      setVisibleMonth(nextVisibleMonth);
    }

    setSchedule(next);
    setCourseStartDraft(next.courseStartDate);
    previousCourseStartRef.current = next.courseStartDate;
  }, []);

  const refreshSchedule = useCallback((overrides) => {
    applyResolvedSchedule(resolveTrainingSchedule(), overrides);
  }, [applyResolvedSchedule]);

  React.useEffect(() => {
    let mounted = true;
    hydrateTrainingData().then(() => {
      if (mounted) refreshSchedule();
    });
    return subscribeTrainingScheduleStore(() => {
      if (suppressStoreRefreshRef.current > 0) return;
      refreshSchedule();
    });
  }, [refreshSchedule]);

  const sessionsByDate = useMemo(() => {
    const map = {};
    for (const session of schedule.sessions) {
      if (!map[session.date]) map[session.date] = [];
      map[session.date].push(session);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [schedule.sessions]);

  const selectedDaySessions = sessionsByDate[selectedKey] || [];
  const selectedDayMeta = schedule.days.find((d) => d.date === selectedKey);

  const teachableSessions = useMemo(
    () => schedule.sessions.filter((s) => !s.isBreak),
    [schedule.sessions]
  );

  const presentationSessions = useMemo(() => {
    if (!filterPresentationsToDay) return teachableSessions;
    return teachableSessions.filter((s) => s.date === selectedKey);
  }, [filterPresentationsToDay, teachableSessions, selectedKey]);

  const [availability, setAvailability] = useState({});
  const [urlDrafts, setUrlDrafts] = useState({});
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputRefs = useRef({});
  const { toast } = useToast();

  const refreshAvailability = useCallback(async () => {
    const ids = teachableSessions.map((s) => s.id);
    const map = await listPresentationAvailability(ids);
    setAvailability(map);
    setUrlDrafts((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (next[id] === undefined) {
          next[id] = getExternalLink(id) || "";
        }
      });
      return next;
    });
  }, [teachableSessions]);

  React.useEffect(() => {
    refreshAvailability();
  }, [refreshAvailability, schedule.sessions]);

  const openCreateSession = () => {
    setSessionDialog({
      mode: "create",
      initial: {
        date: selectedKey,
        startTime: "09:00",
        endTime: "10:00",
      },
    });
  };

  const openEditSession = (session) => {
    setSessionDialog({
      mode: "edit",
      sessionId: session.id,
      initial: {
        title: session.title,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        description: session.description,
        isBreak: session.isBreak,
        deckUrl: getExternalLink(session.id) || "",
      },
    });
  };

  const handleSaveSession = async (form) => {
    try {
      const sessionId = upsertTrainingSession({
        id: sessionDialog.mode === "edit" ? sessionDialog.sessionId : undefined,
        title: form.title,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        description: form.description,
        isBreak: form.isBreak,
      });

      const deckTrimmed = String(form.deckUrl || "").trim();
      if (deckTrimmed) {
        const linkResult = setExternalLink(sessionId, deckTrimmed);
        if (!linkResult.ok) {
          toast({
            title: linkResult.message,
            description: linkResult.description,
            variant: "destructive",
          });
        }
      }

      refreshSchedule();
      toast({ title: "המפגש נשמר", dedupeKey: "training-session-saved" });
      await refreshAvailability();
    } catch (err) {
      toast({
        title: "שגיאה",
        description: err.message === "session_fields_required" ? "מלאו כותרת, תאריך ושעות" : "לא ניתן לשמור",
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleDeleteSession = (session) => {
    if (!window.confirm(`למחוק את «${session.title}»?`)) return;
    try {
      deleteTrainingSession(session.id);
      refreshSchedule();
      toast({ title: "המפגש הוסר" });
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן למחוק", variant: "destructive" });
    }
  };

  const handleResetSchedule = () => {
    if (!window.confirm("לאפס את לוח הזמנים לערכי ברירת המחדל?")) return;
    resetTrainingScheduleStore();
    refreshSchedule();
    toast({ title: "לוח הזמנים אופס" });
  };

  const handleSaveCourseStart = () => {
    if (!courseStartDraft) return;
    const previousCourseStartDate = schedule.courseStartDate;
    suppressStoreRefreshRef.current += 1;
    try {
      updateTrainingCourseConfig({ courseStartDate: courseStartDraft });
      refreshSchedule({ previousCourseStartDate });
    } finally {
      suppressStoreRefreshRef.current -= 1;
    }
    toast({
      title: "תאריך התחלת הקורס עודכן",
      description: "תאריכי ימי הקורס והמפגשים הותאמו לתאריך החדש",
    });
  };

  const handleFile = async (sessionId, file) => {
    if (!file) return;
    setUploadingId(sessionId);
    try {
      const result = await uploadTrainingPresentation(sessionId, file);
      if (result.ok) {
        toast({
          title: result.storageWarning === "bucket_missing" ? result.message : "הועלה בהצלחה",
          description: result.description || (result.storageWarning ? undefined : result.message),
          variant: result.storageWarning ? "default" : undefined,
          dedupeKey: `training-upload-${sessionId}`,
        });
        await refreshAvailability();
      } else {
        toast({
          title: result.message,
          description: result.description,
          variant: result.description ? "default" : "destructive",
        });
      }
    } catch {
      toast({ title: "שגיאה", description: "העלאה נכשלה", variant: "destructive" });
    } finally {
      setUploadingId(null);
      const input = fileInputRefs.current[sessionId];
      if (input) input.value = "";
    }
  };

  const handleRemovePdf = async (sessionId) => {
    setUploadingId(sessionId);
    try {
      await removeTrainingPresentation(sessionId);
      toast({ title: "המצגת הוסרה" });
      await refreshAvailability();
    } finally {
      setUploadingId(null);
    }
  };

  const handleSaveUrl = (sessionId) => {
    const result = setExternalLink(sessionId, urlDrafts[sessionId]);
    if (result.ok) {
      toast({ title: result.message });
      refreshAvailability();
    } else {
      toast({
        title: result.message,
        description: result.description,
        variant: result.description ? "default" : "destructive",
      });
    }
  };

  const handleRemoveUrl = (sessionId) => {
    removeExternalLink(sessionId);
    setUrlDrafts((prev) => ({ ...prev, [sessionId]: "" }));
    toast({ title: "הקישור הוסר" });
    refreshAvailability();
  };

  return (
    <div className={m3PageClass("min-h-screen")} dir="rtl" lang="he">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={hypHeaderIconClass("w-12 h-12 shadow-elevation-2")}>
              <GraduationCap className={cn("w-6 h-6", demoModeEnabled ? "text-white" : "text-primary")} />
            </div>
            <div className="min-w-0">
              <h1 className="m3-headline-small text-xl font-semibold">ניהול מצגות הדרכה</h1>
              <p className="m3-label-medium">לוח זמנים, מפגשים ומצגות — הנציגים רואים בדף ההדרכה</p>
              {demoModeEnabled ? (
                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                  דמו · localStorage
                </span>
              ) : null}
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
            <li>בלוח השנה: לחצו על יום לצפייה ועריכה במפגשים של אותו יום.</li>
            <li>הוסיפו מפגשים, ערכו תאריכים ושעות — נשמר בדפדפן (ללא שרת בדמו).</li>
            <li>לכל מפגש: העלאת PDF (אייקון ↑ ביום הנבחר או למטה) ו/או קישור — הנציג פותח מצגת או קישור.</li>
            <li>
              {supabaseConfigured
                ? "Supabase מוגדר: קבצי PDF ב-bucket `training-docs`."
                : "ללא Supabase: PDF ב-IndexedDB לבדיקות מקומיות."}
            </li>
          </ul>
        </motion.div>

        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-2xl m3-surface-container">
          <div className="flex-1 min-w-[12rem]">
            <label htmlFor="course-start" className="text-xs font-medium text-on-surface-variant block mb-1">
              תאריך התחלת קורס
            </label>
            <input
              id="course-start"
              type="date"
              value={courseStartDraft}
              onChange={(e) => setCourseStartDraft(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm"
            />
          </div>
          <button type="button" onClick={handleSaveCourseStart} className="m3-btn-outlined text-xs py-2">
            שמירת תאריך קורס
          </button>
          <button
            type="button"
            onClick={handleResetSchedule}
            className="m3-btn-outlined text-xs py-2 gap-1 text-destructive border-destructive/30"
          >
            <RotateCcw className="w-4 h-4" />
            איפוס לוח
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <TrainingScheduleCalendar
            sessionsByDate={sessionsByDate}
            selectedDate={selectedDate}
            onSelectDate={(d) => {
              setSelectedDate(d);
              setVisibleMonth(startOfMonth(d));
            }}
            visibleMonth={visibleMonth}
            onVisibleMonthChange={setVisibleMonth}
          />

          <section className="m3-card p-4 flex flex-col" aria-label="מפגשים ביום הנבחר">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="min-w-0">
                <h2 className="m3-title-large text-base font-semibold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                  {selectedDayMeta
                    ? `יום ${selectedDayMeta.weekdayLabel}`
                    : format(selectedDate, "EEEE", { locale: he })}
                </h2>
                <p className="text-sm text-on-surface-variant">
                  {format(selectedDate, "d בMMMM yyyy", { locale: he })}
                </p>
              </div>
              <button type="button" onClick={openCreateSession} className="m3-btn-primary text-xs py-2 gap-1 shrink-0">
                <Plus className="w-4 h-4" />
                מפגש חדש
              </button>
            </div>

            {selectedDaySessions.length === 0 ? (
              <p className="text-sm text-on-surface-variant m-0 py-4 text-center">אין מפגשים ביום זה</p>
            ) : (
              <ul className="list-none m-0 p-0 space-y-2 flex-1 overflow-y-auto max-h-[22rem]">
                {selectedDaySessions.map((session) => (
                  <li
                    key={session.id}
                    className={`m3-surface-container rounded-xl p-3 flex gap-2 ${
                      session.isBreak ? "opacity-75" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-primary font-mono tabular-nums">{session.timeLabel}</p>
                      <p className="font-medium text-sm truncate">{session.title}</p>
                      {session.isBreak ? (
                        <span className="text-xs text-amber-700">הפסקה</span>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {!session.isBreak ? (
                        <>
                          <input
                            ref={(el) => {
                              fileInputRefs.current[session.id] = el;
                            }}
                            type="file"
                            accept=".pdf,application/pdf"
                            className="hidden"
                            onChange={(e) => handleFile(session.id, e.target.files?.[0])}
                          />
                          <button
                            type="button"
                            disabled={uploadingId === session.id}
                            onClick={() => fileInputRefs.current[session.id]?.click()}
                            className="m3-btn-outlined p-2"
                            aria-label={`העלאת מסמך ל${session.title}`}
                            title="העלאת PDF"
                          >
                            {uploadingId === session.id ? (
                              <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin block" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openEditSession(session)}
                        className="m3-btn-outlined p-2"
                        aria-label={`עריכת ${session.title}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(session)}
                        className="m3-btn-outlined p-2 text-destructive border-destructive/30"
                        aria-label={`מחיקת ${session.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="m3-title-large text-lg font-semibold">מצגות לפי מפגש</h2>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={filterPresentationsToDay}
              onChange={(e) => setFilterPresentationsToDay(e.target.checked)}
              className="rounded border-outline-variant"
            />
            הצג רק מפגשי היום הנבחר
          </label>
        </div>

        {presentationSessions.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-6">אין מפגשים להצגה בטווח הנבחר</p>
        ) : (
          <div className="space-y-3">
            {presentationSessions.map((session, index) => {
              const status = availability[session.id] || { hasPdf: false, hasUrl: false };
              const busy = uploadingId === session.id;
              const urlDraft = urlDrafts[session.id] ?? "";

              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="m3-surface-container p-4 rounded-2xl flex flex-col gap-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-primary font-mono tabular-nums">{session.timeLabel}</p>
                      <p className="font-medium text-sm sm:text-base truncate">{session.title}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {session.date.split("-").reverse().join(".")} ·{" "}
                        <code className="text-[11px]">{session.id}</code>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {status.hasPdf ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">מצגת</span>
                      ) : null}
                      {status.hasUrl ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                          <Link2 className="w-3 h-3" />
                          קישור
                        </span>
                      ) : null}
                      {!status.hasPdf && !status.hasUrl ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-outline-variant/20 text-on-surface-variant">
                          אין תוכן
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-outline-variant/20 pt-3">
                    <label className="text-xs font-medium text-on-surface-variant">קישור חיצוני</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="url"
                        dir="ltr"
                        placeholder="https://..."
                        value={urlDraft}
                        onChange={(e) =>
                          setUrlDrafts((prev) => ({ ...prev, [session.id]: e.target.value }))
                        }
                        className="flex-1 min-w-0 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSaveUrl(session.id)}
                        className="m3-btn-outlined text-xs py-2 shrink-0"
                      >
                        שמירת קישור
                      </button>
                      {status.hasUrl ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRemoveUrl(session.id)}
                          className="m3-btn-outlined text-xs py-2 text-destructive border-destructive/30 shrink-0"
                        >
                          הסרת קישור
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={(el) => {
                        fileInputRefs.current[session.id] = el;
                      }}
                      type="file"
                      accept=".pdf,application/pdf"
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
                      העלאת מסמך (PDF)
                    </button>
                    {status.hasPdf ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemovePdf(session.id)}
                        className="m3-btn-outlined text-xs py-2 text-destructive border-destructive/30"
                        aria-label="הסרת מצגת"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <p className="m3-label-medium text-center mt-8 flex items-center justify-center gap-1">
          <FileUp className="w-4 h-4" />
          PDF = מצגת בשקפים · קישור = מעבר ישיר בלחיצה
        </p>
      </div>

      <TrainingSessionDialog
        open={Boolean(sessionDialog)}
        mode={sessionDialog?.mode}
        initial={sessionDialog?.initial}
        onClose={() => setSessionDialog(null)}
        onSave={handleSaveSession}
      />
    </div>
  );
}

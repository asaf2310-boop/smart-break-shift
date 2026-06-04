import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { parseISO } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  Coffee,
  GraduationCap,
  Link2,
  Presentation,
} from "lucide-react";

import { resolveTrainingSchedule } from "@/lib/trainingSchedule";
import { subscribeTrainingScheduleStore } from "@/lib/trainingScheduleStore";
import {
  getExternalLink,
  listPresentationAvailability,
  resolvePresentationOpenUrl,
} from "@/lib/trainingPresentations";
import { hypHeaderIconClass, m3PageClass } from "@/lib/hypPage";
import { demoModeEnabled } from "@/api/demoClient";
import { cn } from "@/lib/utils";

const WEEKDAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function weekdayShort(dateStr) {
  return WEEKDAY_SHORT[parseISO(`${dateStr}T12:00:00`).getDay()];
}

function summarizeDay(day, availability) {
  let sessionCount = 0;
  let hasPdf = false;
  let hasUrl = false;
  for (const session of day.sessions) {
    if (session.isBreak) continue;
    sessionCount += 1;
    const status = availability[session.id];
    if (status?.hasPdf) hasPdf = true;
    if (status?.hasUrl) hasUrl = true;
  }
  return { sessionCount, hasPdf, hasUrl };
}

function SessionRow({ session, index, displayDate, contentStatus, onOpen }) {
  const isBreak = session.isBreak;
  const canPresent = !isBreak;
  const hasContent = contentStatus?.hasPdf || contentStatus?.hasUrl;

  return (
    <motion.li
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`relative flex gap-3 sm:gap-4 pr-1 ${isBreak ? "opacity-80" : ""}`}
    >
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div
          className={`w-3 h-3 rounded-full ring-4 ${
            isBreak ? "bg-amber-400 ring-amber-100" : "bg-primary ring-primary/15"
          }`}
        />
        <div className="w-px flex-1 min-h-[1rem] bg-outline-variant/40 mt-1" aria-hidden />
      </div>

      {canPresent ? (
        <button
          type="button"
          onClick={() => onOpen({ ...session, displayDate })}
          disabled={!hasContent}
          className={`flex-1 pb-5 min-w-0 text-right m3-surface-container p-3 sm:p-4 rounded-2xl transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
            hasContent
              ? "hover:shadow-elevation-2 ring-1 ring-primary/20 cursor-pointer"
              : "opacity-70 cursor-default"
          }`}
        >
          <SessionContent session={session} isBreak={isBreak} contentStatus={contentStatus} />
        </button>
      ) : (
        <div
          className={`flex-1 pb-5 min-w-0 ${
            isBreak ? "m3-surface-container bg-amber-50/80 border border-amber-100" : "m3-surface-container"
          } p-3 sm:p-4 rounded-2xl`}
        >
          <SessionContent session={session} isBreak={isBreak} contentStatus={null} />
        </div>
      )}
    </motion.li>
  );
}

function SessionContent({ session, isBreak, contentStatus }) {
  const hasUrl = contentStatus?.hasUrl;
  const hasPdf = contentStatus?.hasPdf;
  const hasContent = hasUrl || hasPdf;

  let actionHint = "";
  if (!isBreak && hasContent) {
    if (hasUrl) actionHint = "לחצו למעבר לקישור";
    else if (hasPdf) actionHint = "לחצו לפתיחת המסמך בטאב חדש";
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <span className="m3-label-medium font-mono tabular-nums text-primary">{session.timeLabel}</span>
        {isBreak && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
            <Coffee className="w-3 h-3" />
            הפסקה
          </span>
        )}
        {!isBreak && hasUrl && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
            <Link2 className="w-3 h-3" />
            קישור
          </span>
        )}
        {!isBreak && hasPdf && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            <Presentation className="w-3 h-3" />
            מצגת
          </span>
        )}
      </div>
      <p className={`text-sm sm:text-base leading-relaxed ${isBreak ? "text-on-surface-variant" : "font-medium"}`}>
        {session.title}
      </p>
      {session.description ? <p className="m3-label-medium mt-1.5">{session.description}</p> : null}
      {actionHint ? <p className="text-xs text-primary/80 mt-2">{actionHint}</p> : null}
    </>
  );
}

function DayCard({ day, dayIndex, summary, onSelect }) {
  const shortLabel = weekdayShort(day.date);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: dayIndex * 0.04 }}
      onClick={() => onSelect(day.date)}
      className={cn(
        "m3-card aspect-square w-full p-3 sm:p-4 flex flex-col items-center justify-center gap-1.5",
        "text-center transition-all hover:shadow-elevation-2 hover:ring-2 hover:ring-primary/25",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      )}
      aria-label={`יום ${day.weekdayLabel}, ${day.displayDate}, ${summary.sessionCount} מפגשים`}
    >
      <span className="text-2xl sm:text-3xl font-bold text-primary leading-none">{shortLabel}</span>
      <span className="text-xs sm:text-sm font-medium text-on-surface-variant leading-tight">{day.displayDate}</span>
      <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary mt-0.5">
        {summary.sessionCount} מפגשים
      </span>
      {(summary.hasPdf || summary.hasUrl) && (
        <div className="flex items-center gap-1.5 mt-1" aria-hidden>
          {summary.hasPdf && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
              <Presentation className="w-3.5 h-3.5" />
            </span>
          )}
          {summary.hasUrl && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-100 text-sky-800">
              <Link2 className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      )}
    </motion.button>
  );
}

function DayDetailView({ day, availability, onOpenSession, onBack }) {
  return (
    <motion.div
      key={day.date}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="m3-btn-outlined text-xs py-2 gap-1.5 shrink-0">
          <ArrowRight className="w-4 h-4" />
          חזרה לכל הימים
        </button>
        <p className="m3-label-medium text-center flex-1 min-w-[10rem]">
          לחצו על מפגש לקישור או מצגת
        </p>
      </div>

      <section className="m3-card p-4 sm:p-5">
        <header className="flex flex-wrap items-baseline justify-between gap-2 mb-4 pb-3 border-b border-outline-variant/30">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-5 h-5 text-primary shrink-0" />
            <div>
              <h2 className="m3-title-large text-lg font-semibold">
                יום {day.weekdayLabel}
                <span className="text-primary font-bold ms-1.5">{weekdayShort(day.date)}</span>
              </h2>
              <p className="m3-label-medium">{day.displayDate}</p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary">
            {day.sessions.filter((s) => !s.isBreak).length} מפגשים
          </span>
        </header>

        <ol className="list-none m-0 p-0">
          {day.sessions.map((session, index) => (
            <SessionRow
              key={session.id}
              session={session}
              index={index}
              displayDate={day.displayDate}
              contentStatus={availability[session.id]}
              onOpen={onOpenSession}
            />
          ))}
        </ol>
      </section>
    </motion.div>
  );
}

function DayGridView({ days, daySummaries, onSelectDay }) {
  return (
    <>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="m3-label-medium text-center mb-6 px-2"
      >
        בחרו יום לצפייה בלוח המפגשים
      </motion.p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {days.map((day, index) => (
          <DayCard
            key={day.date}
            day={day}
            dayIndex={index}
            summary={daySummaries[day.date]}
            onSelect={onSelectDay}
          />
        ))}
      </div>
    </>
  );
}

export default function TrainingPage() {
  const [schedule, setSchedule] = useState(() => resolveTrainingSchedule());
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  const sessionIds = useMemo(
    () => schedule.sessions.filter((s) => !s.isBreak).map((s) => s.id),
    [schedule.sessions]
  );

  const [availability, setAvailability] = useState({});

  const refreshSchedule = useCallback(() => {
    setSchedule(resolveTrainingSchedule());
  }, []);

  useEffect(() => {
    refreshSchedule();
    return subscribeTrainingScheduleStore(refreshSchedule);
  }, [refreshSchedule]);

  const refreshAvailability = useCallback(async () => {
    const map = await listPresentationAvailability(sessionIds);
    setAvailability(map);
  }, [sessionIds]);

  useEffect(() => {
    refreshAvailability();
  }, [refreshAvailability]);

  const daySummaries = useMemo(() => {
    const map = {};
    for (const day of schedule.days) {
      map[day.date] = summarizeDay(day, availability);
    }
    return map;
  }, [schedule.days, availability]);

  const selectedDay = useMemo(
    () => (selectedDayKey ? schedule.days.find((d) => d.date === selectedDayKey) : null),
    [schedule.days, selectedDayKey]
  );

  useEffect(() => {
    if (selectedDayKey && !selectedDay) {
      setSelectedDayKey(null);
    }
  }, [selectedDayKey, selectedDay]);

  const handleOpenSession = useCallback(
    async (session) => {
      const status = availability[session.id] || { hasPdf: false, hasUrl: false };
      const externalUrl = getExternalLink(session.id);

      if (status.hasUrl && externalUrl) {
        window.open(externalUrl, "_blank", "noopener,noreferrer");
        return;
      }

      if (status.hasPdf) {
        const pdfUrl = await resolvePresentationOpenUrl(session.id);
        if (pdfUrl) {
          window.open(pdfUrl, "_blank", "noopener,noreferrer");
        }
      }
    },
    [availability]
  );

  return (
    <div className={m3PageClass("pt-app-nav")} dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 gap-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={hypHeaderIconClass("shadow-elevation-2")}>
              <GraduationCap className={cn("w-6 h-6", demoModeEnabled ? "text-white" : "text-primary")} />
            </div>
            <div className="min-w-0">
              <h1 className="m3-headline-small text-xl font-semibold truncate">{schedule.title}</h1>
              <p className="m3-label-medium">{schedule.description}</p>
              <p className="text-sm text-primary font-medium mt-0.5">{schedule.dateRangeLabel}</p>
            </div>
          </div>
          <Link to="/" className="m3-btn-outlined text-xs py-2 shrink-0">
            <ArrowRight className="w-4 h-4" />
            ראשי
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="m3-label-medium text-center mb-4 px-2"
        >
          מתחיל {schedule.courseStartDate.split("-").reverse().join(".")}
        </motion.p>

        <AnimatePresence mode="wait">
          {selectedDay ? (
            <DayDetailView
              key="detail"
              day={selectedDay}
              availability={availability}
              onOpenSession={handleOpenSession}
              onBack={() => setSelectedDayKey(null)}
            />
          ) : (
            <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DayGridView
                days={schedule.days}
                daySummaries={daySummaries}
                onSelectDay={setSelectedDayKey}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

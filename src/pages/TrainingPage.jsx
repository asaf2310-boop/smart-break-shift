import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { parseISO } from "date-fns";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Link2,
  Presentation,
} from "lucide-react";

import TrainingDayTimeline from "@/components/training/TrainingDayTimeline";

import {
  getDefaultTrainingWeekIndex,
  groupTrainingDaysIntoWeeks,
  resolveTrainingSchedule,
} from "@/lib/trainingSchedule";
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

function DayCard({ day, dayIndex, summary, onSelect }) {
  const shortLabel = weekdayShort(day.date);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{
        y: -6,
        scale: 1.02,
        boxShadow: "0 20px 60px rgba(37, 99, 235, 0.15)",
      }}
      transition={{ delay: dayIndex * 0.04, duration: 0.25, ease: "easeOut" }}
      onClick={() => onSelect(day.date)}
      style={{ boxShadow: "0 10px 40px rgba(37, 99, 235, 0.08)" }}
      className={cn(
        "training-day-card aspect-square w-full min-h-0 min-w-0 flex flex-col items-center justify-center",
        "text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
      )}
      aria-label={`יום ${day.weekdayLabel}, ${day.displayDate}, ${summary.sessionCount} מפגשים`}
    >
      <span className="training-day-card__curve training-day-card__curve--tl" aria-hidden />
      <span className="training-day-card__curve training-day-card__curve--br" aria-hidden />
      <span className="training-day-card__dots" aria-hidden />

      <span className="training-day-card__badge" aria-hidden="true">
        <span className="training-day-card__badge-overlay" />
        <span className="training-day-card__badge-letter">{shortLabel}</span>
      </span>

      <span className="training-day-card__divider" aria-hidden="true">
        <span className="training-day-card__divider-dot" />
      </span>

      <span className="training-day-card__date">{day.displayDate}</span>

      <span className="training-day-card__meetings">
        {summary.sessionCount} מפגשים
      </span>

      {(summary.hasPdf || summary.hasUrl) && (
        <span className="training-day-card__icons" aria-hidden>
          {summary.hasPdf && (
            <span className="training-day-card__icon-btn">
              <Presentation className="training-day-card__icon-svg" />
            </span>
          )}
          {summary.hasUrl && (
            <span className="training-day-card__icon-btn training-day-card__icon-btn--link">
              <Link2 className="training-day-card__icon-svg" />
            </span>
          )}
        </span>
      )}
    </motion.button>
  );
}

function WeekNavigator({ weeks, weekIndex, onWeekChange }) {
  if (weeks.length <= 1) return null;

  const week = weeks[weekIndex];
  const canPrev = weekIndex > 0;
  const canNext = weekIndex < weeks.length - 1;

  return (
    <motion.nav
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="ניווט בין שבועות הקורס"
      className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-5"
    >
      <button
        type="button"
        onClick={() => onWeekChange(weekIndex - 1)}
        disabled={!canPrev}
        className="m3-btn-outlined p-2 disabled:opacity-40 disabled:pointer-events-none"
        aria-label="שבוע קודם"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      <div className="text-center min-w-[10rem] px-2">
        <p className="text-sm font-semibold text-primary">
          שבוע {weekIndex + 1} מתוך {weeks.length}
        </p>
        <p className="m3-label-medium mt-0.5">{week.rangeLabel}</p>
      </div>

      <button
        type="button"
        onClick={() => onWeekChange(weekIndex + 1)}
        disabled={!canNext}
        className="m3-btn-outlined p-2 disabled:opacity-40 disabled:pointer-events-none"
        aria-label="שבוע הבא"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
    </motion.nav>
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
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {days.map((day, index) => (
          <div
            key={day.date}
            className="w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-2rem)/3)] min-w-0 shrink-0"
          >
            <DayCard
              day={day}
              dayIndex={index}
              summary={daySummaries[day.date]}
              onSelect={onSelectDay}
            />
          </div>
        ))}
      </div>
    </>
  );
}

export default function TrainingPage() {
  const [schedule, setSchedule] = useState(() => resolveTrainingSchedule());
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [weekIndex, setWeekIndex] = useState(0);
  const weeksSignatureRef = useRef("");

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

  const weeks = useMemo(() => groupTrainingDaysIntoWeeks(schedule.days), [schedule.days]);

  useEffect(() => {
    const signature = weeks.map((w) => w.weekStart).join("|");
    if (signature !== weeksSignatureRef.current) {
      weeksSignatureRef.current = signature;
      setWeekIndex(getDefaultTrainingWeekIndex(weeks));
      return;
    }
    setWeekIndex((prev) => Math.min(prev, Math.max(0, weeks.length - 1)));
  }, [weeks]);

  const currentWeekDays = useMemo(
    () => weeks[weekIndex]?.days ?? [],
    [weeks, weekIndex]
  );

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
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
            >
              <TrainingDayTimeline
                day={selectedDay}
                availability={availability}
                onOpenSession={handleOpenSession}
                onBack={() => setSelectedDayKey(null)}
              />
            </motion.div>
          ) : (
            <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <WeekNavigator
                weeks={weeks}
                weekIndex={weekIndex}
                onWeekChange={setWeekIndex}
              />
              <DayGridView
                days={currentWeekDays}
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
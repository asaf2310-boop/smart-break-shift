import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Coffee, GraduationCap } from "lucide-react";
import { resolveTrainingSchedule } from "@/lib/trainingSchedule";

function SessionRow({ session, index }) {
  const isBreak = session.isBreak;

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
            isBreak
              ? "bg-amber-400 ring-amber-100"
              : "bg-primary ring-primary/15"
          }`}
        />
        <div className="w-px flex-1 min-h-[1rem] bg-outline-variant/40 mt-1" aria-hidden />
      </div>

      <div
        className={`flex-1 pb-5 min-w-0 ${
          isBreak ? "m3-surface-container bg-amber-50/80 border border-amber-100" : "m3-surface-container"
        } p-3 sm:p-4 rounded-2xl`}
      >
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="m3-label-medium font-mono tabular-nums text-primary">
            {session.timeLabel}
          </span>
          {isBreak && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              <Coffee className="w-3 h-3" />
              הפסקה
            </span>
          )}
        </div>
        <p className={`text-sm sm:text-base leading-relaxed ${isBreak ? "text-on-surface-variant" : "font-medium"}`}>
          {session.title}
        </p>
        {session.description ? (
          <p className="m3-label-medium mt-1.5">{session.description}</p>
        ) : null}
      </div>
    </motion.li>
  );
}

function DayBlock({ day, dayIndex }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.06 }}
      className="m3-card p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 mb-4 pb-3 border-b border-outline-variant/30">
        <div>
          <h2 className="m3-title-large text-lg font-semibold">יום {day.weekdayLabel}</h2>
          <p className="m3-label-medium">{day.displayDate}</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary">
          {day.sessions.filter((s) => !s.isBreak).length} מפגשים
        </span>
      </header>

      <ol className="list-none m-0 p-0">
        {day.sessions.map((session, index) => (
          <SessionRow key={session.id} session={session} index={index} />
        ))}
      </ol>
    </motion.section>
  );
}

export default function TrainingPage() {
  const schedule = useMemo(() => resolveTrainingSchedule(), []);

  return (
    <div className="m3-page pt-app-nav" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 gap-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-elevation-2 shrink-0">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
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
          className="m3-label-medium text-center mb-6 px-2"
        >
          לוח זמנים להדרכת נציגים חדשים · מתחיל {schedule.courseStartDate.split("-").reverse().join(".")}
        </motion.p>

        <div className="space-y-5">
          {schedule.days.map((day, index) => (
            <DayBlock key={day.date} day={day} dayIndex={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

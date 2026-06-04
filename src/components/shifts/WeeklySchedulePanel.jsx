import React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { AlertTriangle, CalendarDays, Check, Lock, Moon, Palmtree, Sun } from "lucide-react";
import { HOLIDAY_EVE_DATES, WEEKDAY_LABELS } from "@/constants/scheduling";
import { backendMode } from "@/api/client";
import { formatScheduleLoadError } from "@/lib/shiftScheduleQuery";

export default function WeeklySchedulePanel({
  title,
  weekLabel,
  scheduleDays,
  scheduleRegistrations = [],
  agentName,
  isLoading = false,
  isFetching = false,
  isError = false,
  error = null,
  emptyTitle = "השיבוץ טרם פורסם",
  emptyHint = "המנהל יפרסם בקרוב",
  accent = "amber",
  highlighted = false,
}) {
  const registrations = Array.isArray(scheduleRegistrations) ? scheduleRegistrations : [];
  const published = registrations.length > 0;
  const isInitialLoad = isLoading && registrations.length === 0;
  const headerGradient = accent === "emerald" ? "from-emerald-50" : "from-amber-50";
  const iconGradient = accent === "emerald"
    ? "from-emerald-400 to-teal-500 shadow-emerald-500/30"
    : "from-amber-400 to-orange-500 shadow-amber-500/30";
  const weekLabelClass = accent === "emerald" ? "text-emerald-700" : "text-amber-700";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: accent === "emerald" ? 0.05 : 0.1 }}
      className={`rounded-3xl overflow-hidden border bg-white shadow-lg shadow-slate-200/60 ${
        highlighted ? "border-2 border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"
      }`}
    >
      <motion.div className={`px-6 py-4 bg-gradient-to-l ${headerGradient} to-transparent border-b border-slate-100 flex items-center gap-4`}>
        <motion.div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${iconGradient} flex items-center justify-center shadow`}>
          <CalendarDays className="w-5 h-5 text-white" />
        </motion.div>
        <div className="flex-1">
          <h2 className="font-bold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">טווח תאריכים (א׳–ה׳)</p>
          <p className={`text-base sm:text-lg font-extrabold tracking-tight ${weekLabelClass}`}>
            {weekLabel}
          </p>
        </div>
        {highlighted && (
          <div className="bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-semibold px-3 py-1.5 rounded-xl">
            שיבוץ עדכני
          </div>
        )}
        {published && (
          <div className="bg-green-100 border border-green-200 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-xl">
            ✓ פורסם
          </div>
        )}
      </motion.div>

      {isFetching && published && (
        <div className="mx-4 mt-4 flex justify-center">
          <motion.div className="px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-700">
            מעדכן שיבוץ...
          </motion.div>
        </div>
      )}

      {isError ? (
        <div className="mx-4 my-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-900">
            <p className="font-bold mb-1">לא ניתן לטעון את השיבוץ</p>
            <p className="text-red-800/90">{formatScheduleLoadError(error)}</p>
            {backendMode === "supabase" && (
              <p className="text-red-700/80 mt-2 text-xs">
                ודאו שטבלת shift_registrations קיימת ב-Supabase ושהמנהל פרסם שיבוץ בלוח «משמרות».
              </p>
            )}
          </div>
        </div>
      ) : !published ? (
        <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
          <Lock className="w-8 h-8 opacity-30" />
          <p className="text-sm font-medium">
            {isInitialLoad ? "טוען את השיבוץ..." : emptyTitle}
          </p>
          <p className="text-xs text-center px-6">
            {isInitialLoad
              ? "זה יופיע מיד כשנתוני השיבוץ יגיעו"
              : backendMode === "supabase"
                ? `${emptyHint} · אם כבר פורסם — ודאו שהנתונים נשמרו ב-Supabase (טבלת shift_registrations).`
                : emptyHint}
          </p>
        </div>
      ) : (
        <div className="p-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-3xl overflow-hidden border border-indigo-200 bg-white shadow-lg shadow-indigo-200/40"
          >
            <div className="px-6 py-3 bg-gradient-to-l from-indigo-50 to-transparent border-b border-indigo-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow shadow-indigo-500/30">
                <Check className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-slate-800">השיבוץ שלי</h3>
            </div>
            <motion.div className="p-3 sm:p-4 overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-6 gap-3 mb-2">
                  <div />
                  {scheduleDays.map((date, i) => (
                    <div key={i} className="text-center">
                      <div className="text-xs font-semibold text-slate-500">{WEEKDAY_LABELS[i]}</div>
                      <div className="text-sm font-bold text-slate-700">{format(date, "dd/MM")}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-6 gap-3">
                  <div className="flex flex-col items-center justify-center gap-1 px-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-slate-800">משמרת</div>
                    </div>
                  </div>
                  {scheduleDays.map((date) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const isHolidayEve = HOLIDAY_EVE_DATES.includes(dateStr);
                    const morningReg = registrations.find(
                      (r) => r.agent_name === agentName && r.date === dateStr && r.shift_type === "morning"
                    );
                    const eveningReg = registrations.find(
                      (r) => r.agent_name === agentName && r.date === dateStr && r.shift_type === "evening"
                    );
                    const myReg = morningReg || eveningReg;
                    const time = isHolidayEve && morningReg ? "09:00–14:00" : morningReg ? "08:00–16:00" : eveningReg ? "09:00–17:00" : null;
                    const shiftLabel = isHolidayEve && morningReg ? "ערב חג" : morningReg ? "בוקר" : eveningReg ? "ערב" : null;
                    return (
                      <div key={dateStr} className="py-2 px-1 flex flex-col items-center justify-center">
                        {myReg ? (
                          <div className="w-full px-2 py-2 rounded-lg border-2 bg-indigo-50 border-indigo-300 flex flex-col items-center justify-center gap-1">
                            <div className="text-xs font-bold text-indigo-700">{shiftLabel}</div>
                            <div className="text-xs text-indigo-600 font-semibold">{time}</div>
                          </div>
                        ) : (
                          <div className="w-full px-2 py-2 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center">
                            <span className="text-xs text-slate-300">–</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>

          <h3 className="font-bold text-slate-800 mb-3">כל הנציגים</h3>
          <div className="space-y-3">
            {[
              { type: "morning", label: "משמרת בוקר", time: "08:00–16:00", icon: Sun, gradient: "from-amber-400 to-orange-500" },
              { type: "evening", label: "משמרת ערב", time: "09:00–17:00", icon: Moon, gradient: "from-indigo-400 to-purple-500" },
              { type: "holiday_eve", label: "ערב חג", time: "09:00–14:00", icon: Palmtree, gradient: "from-purple-400 to-violet-500" },
            ].map((shift) => {
              const ShiftIcon = shift.icon;
              return (
                <motion.div
                  key={shift.type}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-lg shadow-slate-200/60"
                >
                  <div className="overflow-x-auto">
                    <motion.div className="min-w-[640px]">
                      <div className="px-3 pt-2 pb-0 grid grid-cols-6 gap-3 border-b border-slate-100">
                        <motion.div />
                        {scheduleDays.map((date, i) => (
                          <div key={i} className="text-center pb-2">
                            <div className="text-xs font-semibold text-slate-500">{WEEKDAY_LABELS[i]}</div>
                            <div className="text-xs font-bold text-slate-700">{format(date, "dd/MM")}</div>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 grid grid-cols-6 gap-3 items-start">
                        <div className="flex items-center gap-2 px-2">
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${shift.gradient} flex items-center justify-center shadow`}>
                            <ShiftIcon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{shift.label}</div>
                            <div className="text-xs text-slate-400">{shift.time}</div>
                          </div>
                        </div>
                        {scheduleDays.map((date) => {
                          const dateStr = format(date, "yyyy-MM-dd");
                          const isHolidayEveDay = HOLIDAY_EVE_DATES.includes(dateStr);
                          const regs = registrations
                            .filter(
                              (r) =>
                                r.date === dateStr &&
                                r.shift_type === shift.type &&
                                r.agent_name !== agentName &&
                                !isHolidayEveDay
                            )
                            .concat(
                              isHolidayEveDay && shift.type === "holiday_eve"
                                ? registrations.filter(
                                    (r) => r.date === dateStr && r.agent_name !== agentName
                                  )
                                : []
                            );
                          const borderColor =
                            shift.type === "morning"
                              ? "border-amber-300"
                              : shift.type === "evening"
                                ? "border-indigo-300"
                                : "border-purple-300";
                          const bgColor =
                            shift.type === "morning"
                              ? "bg-amber-50"
                              : shift.type === "evening"
                                ? "bg-indigo-50"
                                : "bg-purple-50";
                          const textColor =
                            shift.type === "morning"
                              ? "text-amber-700"
                              : shift.type === "evening"
                                ? "text-indigo-700"
                                : "text-purple-700";
                          return (
                            <div key={dateStr} className="flex flex-col gap-1">
                              {regs.length > 0 ? (
                                regs.map((reg) => (
                                  <div
                                    key={reg.id}
                                    className={`px-2 py-1.5 rounded-lg text-xs font-semibold border-2 ${bgColor} ${borderColor} ${textColor}`}
                                  >
                                    {reg.agent_name}
                                  </div>
                                ))
                              ) : (
                                <div className="text-slate-300 text-xs text-center">–</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

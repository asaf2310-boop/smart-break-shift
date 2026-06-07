import React, { useState, useMemo } from "react";
import { format, addDays, subDays } from "date-fns";
import { motion } from "framer-motion";
import { ShieldCheck, ChevronRight, ChevronLeft, Check, Palmtree, X, Sun, Moon, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dataClient } from "@/api/client";
import { Link } from "react-router-dom";
import {
  AGENT_NAMES,
  HOLIDAY_EVE_DATES,
  WEEKDAY_LABELS,
  getWeekDays,
  getWeekStartIsrael,
  getTodayIsraelDate,
  parseDateStrLocal,
  formatDateStr,
} from "@/constants/scheduling";
import AutoScheduleBuilder from "../components/shifts/AutoScheduleBuilder";
import PublishedScheduleEditor from "../components/shifts/PublishedScheduleEditor";
import VacationApprovalPanel from "../components/admin/VacationApprovalPanel";
import BackendConfigBanner from "@/components/BackendConfigBanner";
import { getLiveQueryOptions } from "@/lib/liveQuery";
import ScheduleSmsLog from "@/components/admin/ScheduleSmsLog";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";

const SHIFTS = [
  { type: "morning", label: "משמרת בוקר", time: "08:00 – 16:00", icon: Sun, gradient: "from-amber-400 to-orange-500", bg: "bg-amber-50/50" },
  { type: "evening", label: "משמרת ערב", time: "09:00 – 17:00", icon: Moon, gradient: "from-indigo-400 to-purple-500", bg: "bg-indigo-50/50" },
];

export default function AdminShifts() {
  const [selectedDate, setSelectedDate] = useState(() => getTodayIsraelDate());
  const [activeTab, setActiveTab] = useState("current"); // "current" | "next"
  const weekStart = getWeekStartIsrael(selectedDate);
  const calendarWeekStart = getWeekStartIsrael();
  const adminWeekOffset =
    Math.round((weekStart.getTime() - calendarWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-5xl px-4 py-8">
        <BackendConfigBanner />
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
          <Link to="/admin" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">← הפסקות</Link>
          <div className="text-center">
            <div className="flex items-center gap-3 justify-center mb-1">
              <div
                className={hypHeaderIconClass(
                  "bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30"
                )}
              >
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">ניהול משמרות</h1>
            </div>
          </div>
          <div className="w-24" />
        </motion.div>

        {/* Week Navigator */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button onClick={() => setSelectedDate(d => subDays(d, 7))} className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 flex items-center justify-center transition-all shadow-sm">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <input
            type="date"
            value={format(selectedDate, "yyyy-MM-dd")}
            onChange={(e) => setSelectedDate(parseDateStrLocal(e.target.value))}
            className="text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm outline-none focus:border-indigo-400"
          />
          <button onClick={() => setSelectedDate(d => addDays(d, 7))} className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 flex items-center justify-center transition-all shadow-sm">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-500 mb-2 font-mono" dir="ltr">
          weekStart={formatDateStr(weekStart)} · current {formatDateStr(weekDays[0])}–{formatDateStr(weekDays[4])} · next {formatDateStr(addDays(weekStart, 7))}–{formatDateStr(addDays(weekStart, 11))}
        </p>

        {adminWeekOffset !== 0 && (
          <p className="text-center text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4">
            צופים בשבוע {adminWeekOffset > 0 ? "עתידי" : "קודם"} ({format(weekDays[0], "dd/MM/yyyy")}–{format(weekDays[4], "dd/MM/yyyy")}).
            לפרסום 7–11.6: השאירו תאריך היום ובחרו «שיבוץ שבוע הבא» — לא «שיבוץ נוכחי» (31/05–04/06).
          </p>
        )}

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab("current")}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "current"
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                : "bg-white border border-slate-200 text-slate-600 hover:border-emerald-300"
            }`}
          >
            שיבוץ נוכחי
            <span className="block text-[10px] font-normal opacity-90 mt-0.5">
              {format(weekDays[0], "dd/MM")}–{format(weekDays[4], "dd/MM")}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("next")}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "next"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30"
                : "bg-white border border-slate-200 text-slate-600 hover:border-cyan-300"
            }`}
          >
            שיבוץ שבוע הבא
            <span className="block text-[10px] font-normal opacity-90 mt-0.5">
              {format(addDays(weekStart, 7), "dd/MM")}–{format(addDays(weekStart, 11), "dd/MM")}
            </span>
          </button>
        </div>

        {activeTab === "current" && (
          <>
            <VacationApprovalPanel weekDays={weekDays} />
            <ConstraintsView weekStart={weekStart} />
            <div className="mt-6">
              <PublishedScheduleEditor weekStart={weekStart} />
            </div>
          </>
        )}

        {activeTab === "next" && (
          <>
            <VacationApprovalPanel weekDays={getWeekDays(addDays(weekStart, 7))} />
            <ConstraintsView weekStart={addDays(weekStart, 7)} />

            <div className="mt-6">
              <AutoScheduleBuilder weekStart={addDays(weekStart, 7)} />
            </div>

            <div className="mt-6">
              <PublishedScheduleEditor weekStart={addDays(weekStart, 7)} />
            </div>
          </>
        )}

        <ScheduleSmsLog />
    </HypPageLayout>
  );
}

function ConstraintsView({ weekStart }) {
  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const dateFrom = format(weekDays[0], "yyyy-MM-dd");
  const dateTo = format(weekDays[4], "yyyy-MM-dd");
  const nextWeekStart = dateFrom;

  const { data: allUnavailabilities = [], isLoading: loadingU } = useQuery({
    queryKey: ["all-unavailabilities-week", dateFrom, dateTo],
    queryFn: async () => {
      const results = await Promise.all(
        weekDays.map(d => dataClient.entities.ShiftUnavailability.filter({ date: format(d, "yyyy-MM-dd") }))
      );
      return results.flat();
    },
    ...getLiveQueryOptions(),
  });

  const { data: vacationRequests = [], isLoading: loadingV } = useQuery({
    queryKey: ["all-vac-view", dateFrom, dateTo, "approved"],
    queryFn: async () => {
      const results = await Promise.all(
        weekDays.map(d => dataClient.entities.VacationRequest.filter({ date: format(d, "yyyy-MM-dd") }))
      );
      return results.flat();
    },
    ...getLiveQueryOptions(),
  });

  // Fetch confirmations for next week
  const { data: confirmations = [], isLoading: loadingC } = useQuery({
    queryKey: ["all-confirmations", nextWeekStart],
    queryFn: () => dataClient.entities.ConstraintConfirmation.filter({ week_start: nextWeekStart }),
    ...getLiveQueryOptions(),
  });

  if (loadingU || loadingV || loadingC) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" /></div>;
  }

  // Agent "submitted" if they confirmed OR if they have any unavailability record for next week
  const confirmedByForm = new Set(confirmations.map(c => c.agent_name));
  const submittedByUnavail = new Set(allUnavailabilities.map(u => u.agent_name));
  const submittedByVacation = new Set(vacationRequests.map(v => v.agent_name));
  const confirmedAgents = new Set([...confirmedByForm, ...submittedByUnavail, ...submittedByVacation]);
  // "allAvailable" = confirmed via form but has NO unavailability/vacation records (submitted as fully available)
  const allAvailableAgents = new Set(
    [...confirmedByForm].filter(name => !submittedByUnavail.has(name) && !submittedByVacation.has(name))
  );
  const submittedCount = AGENT_NAMES.filter(a => confirmedAgents.has(a)).length;

  return (
    <>
    {/* Submission status panel */}
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-lg shadow-slate-200/60 mb-4">
      <div className="px-6 py-4 bg-gradient-to-l from-indigo-50 to-transparent border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow">
            <Check className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">סטטוס הגשת אילוצים</h2>
            <p className="text-xs text-slate-400">שבוע הבא · {nextWeekStart}</p>
          </div>
        </div>
        <div className="text-sm font-bold text-slate-700">
          {submittedCount}/{AGENT_NAMES.length} הגישו
        </div>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        {AGENT_NAMES.map(agent => {
          const confirmed = confirmedAgents.has(agent);
          const allAvailable = allAvailableAgents.has(agent);
          return (
            <div key={agent} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              allAvailable
                ? "bg-green-100 border-green-400 text-green-800"
                : confirmed
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-red-50 border-red-200 text-red-600"
            }`}>
              {allAvailable ? <Check className="w-3 h-3" /> : confirmed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              {agent}
              {allAvailable && <span className="opacity-60 font-normal">זמין</span>}
            </div>
          );
        })}
      </div>
    </motion.div>

    {[
      { type: "morning", label: "משמרת בוקר", time: "08:00–16:00", icon: Sun, gradient: "from-amber-400 to-orange-500", bg: "bg-amber-50/50" },
      { type: "evening", label: "משמרת ערב", time: "09:00–17:00", icon: Moon, gradient: "from-indigo-400 to-purple-500", bg: "bg-indigo-50/50" },
    ].map(shift => {
      const ShiftIcon = shift.icon;
      return (
        <motion.div key={shift.type} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-lg shadow-slate-200/60 mb-4">
          <div className={`px-6 py-4 border-b border-slate-100 flex items-center gap-3 ${shift.bg}`}>
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${shift.gradient} flex items-center justify-center shadow`}>
              <ShiftIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">{shift.label}</h2>
              <p className="text-xs text-slate-400">{shift.time} · אי-זמינות לשבוע הבא</p>
            </div>
          </div>
          <div className="p-4 grid grid-cols-5 gap-3">
            {weekDays.map((date, i) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const isHolidayEve = HOLIDAY_EVE_DATES.includes(dateStr);
              const unavailAgents = allUnavailabilities.filter(u =>
                u.date === dateStr && (isHolidayEve || u.shift_type === shift.type)
              );
              const approvedVacAgents = vacationRequests.filter(v => v.date === dateStr && v.status === "approved");
              const vacAgents = vacationRequests.filter(v => v.date === dateStr);

              // Build list: unavailable agents + approved vacation agents, deduped by name
              const seenNames = new Set();
              const items = [
                ...unavailAgents.map(u => ({ name: u.agent_name, type: u.reason, note: u.note })),
                ...approvedVacAgents
                  .filter(v => !unavailAgents.find(u => u.agent_name === v.agent_name))
                  .map(v => ({ name: v.agent_name, type: "vac_approved", note: v.note })),
                ...vacAgents.filter(v => v.status !== "approved")
                  .filter(v => !unavailAgents.find(u => u.agent_name === v.agent_name) && !approvedVacAgents.find(a => a.agent_name === v.agent_name))
                  .map(v => ({ name: v.agent_name, type: "vac_" + v.status, note: v.note })),
              ].filter(item => {
                if (seenNames.has(item.name)) return false;
                seenNames.add(item.name);
                return true;
              });

              // Agents who are available for this specific day+shift (confirmed but not in unavail/vacation for this day)
              const unavailNames = new Set(items.map(i => i.name));
              const availableAgents = AGENT_NAMES.filter(name =>
                confirmedAgents.has(name) && !unavailNames.has(name)
              );

              const allFree = items.length === 0;
              return (
                <div key={dateStr} className={`rounded-2xl border p-2 min-h-[80px] ${allFree ? "border-green-300 bg-green-50/70" : "border-slate-100 bg-slate-50/50"}`}>
                  <div className="text-center mb-2">
                    <div className="text-xs text-slate-400 font-medium">{WEEKDAY_LABELS[i]}</div>
                    <div className="text-sm font-bold text-slate-700">{format(date, "dd/MM")}</div>
                  </div>
                  {allFree ? (
                    <div className="flex items-center justify-center py-1 gap-1">
                      <Check className="w-3 h-3 text-green-500" />
                      <span className="text-xs text-green-600 font-semibold">הכל זמין</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {availableAgents.map(name => (
                        <div key={name} className="flex items-center gap-1 px-1.5 py-1 rounded-lg border text-xs font-medium bg-green-50 border-green-200 text-green-700">
                          <Check className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate">{name}</span>
                        </div>
                      ))}
                      {items.map(item => {
                        let bg, icon, textColor;
                        if (item.type === "unavailable") {
                          bg = "bg-red-50 border-red-200"; textColor = "text-red-600";
                          icon = <X className="w-2.5 h-2.5 flex-shrink-0" />;
                        } else if (item.type === "vacation") {
                          bg = "bg-sky-50 border-sky-200"; textColor = "text-sky-600";
                          icon = <Palmtree className="w-2.5 h-2.5 flex-shrink-0" />;
                        } else if (item.type === "vac_approved") {
                          bg = "bg-emerald-100 border-emerald-300"; textColor = "text-emerald-700";
                          icon = <Palmtree className="w-2.5 h-2.5 flex-shrink-0" />;
                        } else if (item.type === "vac_rejected") {
                          bg = "bg-slate-50 border-slate-200"; textColor = "text-slate-400";
                          icon = <Palmtree className="w-2.5 h-2.5 flex-shrink-0" />;
                        } else {
                          bg = "bg-orange-50 border-orange-200"; textColor = "text-orange-600";
                          icon = <Palmtree className="w-2.5 h-2.5 flex-shrink-0" />;
                        }
                        return (
                          <div
                            key={item.name}
                            title={item.note ? `${item.name}: ${item.note}` : item.name}
                            className={`flex flex-col px-1.5 py-1 rounded-lg border text-xs font-medium ${bg} ${textColor}`}
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              {icon}
                              <span className="truncate flex-1">{item.name}</span>
                              {item.note?.trim() && (
                                <MessageSquare className="w-3 h-3 flex-shrink-0 text-indigo-500 fill-indigo-100" aria-hidden />
                              )}
                            </div>
                            {item.note?.trim() && (
                              <span className="text-[11px] text-indigo-700/90 bg-indigo-50/80 rounded-md px-1 py-0.5 mt-0.5 leading-snug line-clamp-2">
                                {item.note}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      );
    })}
    </>
  );
}
import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isBefore, isAfter } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import {
  CalendarDays, LogOut, Sun, Moon, Palmtree, X, Check,
  MessageSquare, Lock, Pencil, SendHorizonal, CalendarClock
} from "lucide-react";
import { Navigate } from "react-router-dom";
import AppNav from "../components/layout/AppNav";

import {
  HOLIDAY_EVE_DATES,
  WEEKDAY_LABELS,
  getWeekStart,
  getWeekDays,
  getConstraintsDeadline,
} from "@/constants/scheduling";

const getScheduleCacheKey = (dateFrom, dateTo) => `shift-schedule-cache:${dateFrom}:${dateTo}`;

const readCachedSchedule = (dateFrom, dateTo) => {
  try {
    const raw = sessionStorage.getItem(getScheduleCacheKey(dateFrom, dateTo));
    const parsed = raw ? JSON.parse(raw) : undefined;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const writeCachedSchedule = (dateFrom, dateTo, data) => {
  if (!Array.isArray(data) || data.length === 0) return;
  try {
    sessionStorage.setItem(getScheduleCacheKey(dateFrom, dateTo), JSON.stringify(data));
  } catch {
    // Cache is only a speed boost; ignore browsers that block storage.
  }
};

export default function ShiftScheduler() {
  const [agentName, setAgentName] = useState(() => localStorage.getItem("agent_name") || "");
  const [noteDialog, setNoteDialog] = useState(null); // { date, type: "unavailable"|"vacation_request" }
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("schedule"); // "constraints" | "schedule"
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const now = new Date();
  const thisWeekStart = getWeekStart(now);
  const nextWeekStart = addDays(thisWeekStart, 7);

  const scheduleWeekStart = thisWeekStart;
  const constraintsWeekStart = nextWeekStart;

  const scheduleDays = useMemo(() => getWeekDays(scheduleWeekStart), [scheduleWeekStart]);
  const constraintsDays = useMemo(() => getWeekDays(constraintsWeekStart), [constraintsWeekStart]);

  const scheduleDateFrom = format(scheduleDays[0], "yyyy-MM-dd");
  const scheduleDateTo = format(scheduleDays[4], "yyyy-MM-dd");

  const { data: scheduleRegistrations = [], isLoading: loadingSchedule, isFetching: fetchingSchedule } = useQuery({
    queryKey: ["shift-registrations", scheduleDateFrom, scheduleDateTo],
    queryFn: async () => {
      const days = scheduleDays.map(d => format(d, "yyyy-MM-dd"));
      const results = await Promise.all(days.map(d => base44.entities.ShiftRegistration.filter({ date: d })));
      const rows = results.flat();
      writeCachedSchedule(scheduleDateFrom, scheduleDateTo, rows);
      return rows;
    },
    initialData: () => readCachedSchedule(scheduleDateFrom, scheduleDateTo),
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
    enabled: !!agentName,
  });

  const schedulePublished = scheduleRegistrations.length > 0;
  const isInitialScheduleLoad = loadingSchedule && scheduleRegistrations.length === 0;

  const deadline = getConstraintsDeadline(thisWeekStart);
  const isPastDeadline = isAfter(now, deadline);

  const constraintsDateFrom = format(constraintsDays[0], "yyyy-MM-dd");
  const constraintsDateTo = format(constraintsDays[4], "yyyy-MM-dd");

  // Fetch unavailabilities for constraints week (single query)
  const { data: unavailabilities = [], isLoading: loadingUnavail } = useQuery({
    queryKey: ["shift-unavailabilities", constraintsDateFrom, constraintsDateTo, agentName],
    queryFn: () => base44.entities.ShiftUnavailability.filter({ agent_name: agentName }),
    enabled: !!agentName,
  });

  // Fetch vacation requests for constraints week (single query)
  const { data: vacationRequests = [] } = useQuery({
    queryKey: ["vacation-requests", constraintsDateFrom, constraintsDateTo, agentName],
    queryFn: () => base44.entities.VacationRequest.filter({ agent_name: agentName }),
    enabled: !!agentName,
  });

  const createVacationMutation = useMutation({
    mutationFn: (data) => base44.entities.VacationRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacation-requests", constraintsDateFrom, constraintsDateTo, agentName] });
      toast({ title: "✓ בקשת החופש נשלחה", description: "ממתין לאישור מנהל" });
    },
  });

  const deleteVacationMutation = useMutation({
    mutationFn: (id) => base44.entities.VacationRequest.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vacation-requests", constraintsDateFrom, constraintsDateTo, agentName] }),
  });

  const getVacationRequest = (date) =>
    vacationRequests.find(r => r.date === format(date, "yyyy-MM-dd") && r.date >= constraintsDateFrom && r.date <= constraintsDateTo);

  const constraintsWeekStartStr = format(constraintsWeekStart, "yyyy-MM-dd");

  // Fetch confirmation for the constraints week
  const { data: confirmations = [], isLoading: loadingConfirm } = useQuery({
    queryKey: ["constraint-confirmations", constraintsWeekStartStr, agentName],
    queryFn: () => base44.entities.ConstraintConfirmation.filter({
      week_start: constraintsWeekStartStr, agent_name: agentName
    }),
    enabled: !!agentName,
  });

  const confirmation = confirmations[0] || null;
  const isConfirmed = !!confirmation && !isEditing;

  const confirmMutation = useMutation({
    mutationFn: (data) => base44.entities.ConstraintConfirmation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["constraint-confirmations", constraintsWeekStartStr, agentName] });
      setIsEditing(false);
      toast({ title: "✓ האילוצים אושרו!", description: "תוכל לערוך עד לדד-ליין" });
    },
  });

  const handleConfirm = () => {
    if (confirmation) {
      // Already confirmed, just close edit mode
      setIsEditing(false);
      toast({ title: "✓ האילוצים נשמרו" });
    } else {
      confirmMutation.mutate({
        agent_name: agentName,
        week_start: constraintsWeekStartStr,
        confirmed_at: new Date().toISOString(),
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ShiftUnavailability.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shift-unavailabilities", constraintsDateFrom, constraintsDateTo, agentName] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ShiftUnavailability.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shift-unavailabilities", constraintsDateFrom, constraintsDateTo, agentName] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ShiftUnavailability.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shift-unavailabilities", constraintsDateFrom, constraintsDateTo, agentName] }),
  });

  const handleLogout = () => {
    localStorage.removeItem("agent_name");
    setAgentName("");
  };

  const getDayRecord = (date, shiftType) =>
    unavailabilities.find(r => r.date === format(date, "yyyy-MM-dd") && r.shift_type === shiftType);

  const handleDayClick = (date, newReason, shiftType) => {
    const dateStr = format(date, "yyyy-MM-dd");
    // Find ALL records for this date+shiftType (to handle any existing duplicates)
    const allRecords = unavailabilities.filter(r => r.date === dateStr && r.shift_type === shiftType);
    const existing = allRecords[0] || null;

    // Delete any duplicates silently
    if (allRecords.length > 1) {
      allRecords.slice(1).forEach(r => deleteMutation.mutate(r.id));
    }

    if (!existing) {
      createMutation.mutate({ agent_name: agentName, date: dateStr, shift_type: shiftType, reason: newReason });
    } else if (existing.reason === newReason) {
      deleteMutation.mutate(existing.id);
    } else {
      updateMutation.mutate({ id: existing.id, data: { reason: newReason, note: existing.note || "" } });
    }
  };

  const handleNoteSubmit = (note) => {
    const dateStr = format(noteDialog.date, "yyyy-MM-dd");
    if (noteDialog.type === "vacation_request") {
      createVacationMutation.mutate({ agent_name: agentName, date: dateStr, note, status: "pending" });
    } else {
      createMutation.mutate({ agent_name: agentName, date: dateStr, shift_type: noteDialog.shiftType, reason: "unavailable", note });
    }
    setNoteDialog(null);
  };

  if (!agentName) {
    return <Navigate to="/" replace />;
  }

  const constraintsWeekLabel = `${format(constraintsDays[0], "dd/MM")} – ${format(constraintsDays[4], "dd/MM/yyyy")}`;
  const scheduleWeekLabel = `${format(scheduleDays[0], "dd/MM")} – ${format(scheduleDays[4], "dd/MM/yyyy")}`;
  const deadlineLabel = format(deadline, "dd/MM בשעה HH:mm");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50" dir="rtl">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
         {/* Header */}
         <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
           <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-2">
             <LogOut className="w-4 h-4" />
             החלף נציג
           </button>
           <div className="text-center flex-1">
             <div className="flex items-center gap-3 justify-center mb-2">
               <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                 <CalendarDays className="w-5 h-5 text-white" />
               </div>
               <div>
                 <h1 className="text-2xl font-extrabold text-slate-800">העדפות משמרות</h1>
                 <p className="text-slate-500 text-xs">אתה רואה את: <span className="text-indigo-600 font-semibold">{agentName}</span></p>
               </div>
             </div>
           </div>
           <div className="w-24" />
         </motion.div>

         <AppNav />

        {/* ─── Tabs ─── */}
        <div className="flex bg-white border border-slate-200 rounded-2xl shadow-sm p-1 gap-1 mb-6">
          <button
            onClick={() => setActiveTab("schedule")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === "schedule"
                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            שיבוץ
          </button>
          <button
            onClick={() => setActiveTab("constraints")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === "constraints"
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            סימון אילוצים
          </button>
        </div>

        {/* ─── SECTION 1: Constraints input ─── */}
        {activeTab === "constraints" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mb-6 rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-lg shadow-slate-200/60">

          {/* Section header */}
          <div className="px-6 py-4 bg-gradient-to-l from-indigo-50 to-transparent border-b border-slate-100 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow shadow-indigo-500/30">
              <CalendarClock className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-slate-800">סימון אילוצים</h2>
              <p className="text-xs text-slate-400">
                שבוע {constraintsWeekLabel}
                {!isPastDeadline && (
                  <span className="mr-2 text-amber-600 font-semibold">· דד-ליין: {deadlineLabel}</span>
                )}
              </p>
            </div>
            {isPastDeadline && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-xl">
                <Lock className="w-3.5 h-3.5" />
                שבוע הבא נעול
              </div>
            )}
          </div>



          {/* Confirmed banner */}
          {isConfirmed && !isPastDeadline && (
            <div className="mx-4 mt-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
                <Check className="w-4 h-4" />
                האילוצים אושרו בהצלחה
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                עריכה
              </button>
            </div>
          )}

          {/* Legend */}
          {(!isConfirmed || isEditing) && (
            <div className="flex justify-center gap-4 pt-4 px-4 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-5 h-5 rounded-lg bg-green-50 border-2 border-green-200 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-500" />
                </div>
                זמין
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-5 h-5 rounded-lg bg-red-50 border-2 border-red-300 flex items-center justify-center">
                  <X className="w-3 h-3 text-red-500" />
                </div>
                לא זמין
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-4 h-4 rounded border-2 border-orange-300 bg-white inline-block" />
                חופש (לחץ לבקשה)
              </div>
            </div>
          )}

          {loadingUnavail || loadingConfirm ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="p-4">
              <div className="rounded-2xl border border-slate-100">
                <CombinedShiftGrid
                  weekDays={constraintsDays}
                  getDayRecord={getDayRecord}
                  onMark={handleDayClick}
                  locked={isPastDeadline}
                  holidayEveDates={HOLIDAY_EVE_DATES}
                />
              </div>

              {/* ─── Vacation row (per day, below shifts) ─── */}
              <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/40 overflow-hidden">
                <div className="grid grid-cols-6">
                  <div className="px-3 py-3 flex flex-col items-center justify-center gap-1 border-l border-orange-100">
                    <Palmtree className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-bold text-orange-500">חופש</span>
                  </div>
                  {constraintsDays.map((date) => {
                    const vacReq = getVacationRequest(date);
                    const locked = isPastDeadline;
                    const isHolidayEve = HOLIDAY_EVE_DATES.includes(format(date, "yyyy-MM-dd"));
                    const hasUnavailOnDay = unavailabilities.some(u =>
                      u.date === format(date, "yyyy-MM-dd")
                    );
                    const vacStatusLabel = vacReq?.status === "approved" ? "אושר ✓" : vacReq?.status === "rejected" ? "נדחה ✗" : "ממתין…";
                    const vacStatusColor = vacReq?.status === "approved" ? "text-green-600" : vacReq?.status === "rejected" ? "text-red-400" : "text-orange-500";
                    return (
                      <div key={format(date, "yyyy-MM-dd")} className={`px-1 py-3 flex flex-col items-center justify-center gap-1 ${isHolidayEve ? "bg-purple-50/60 rounded-xl" : ""}`}>

                        {!vacReq && !locked && (
                          hasUnavailOnDay ? (
                            <span
                              title="לא ניתן לבקש חופש כשיש כבר אי-זמינות באותו יום"
                              className="w-4 h-4 rounded border-2 border-slate-200 bg-slate-100 opacity-40 cursor-not-allowed"
                            />
                          ) : (
                            <button
                              onClick={() => {
                                toast({ title: "⚠️ שים לב", description: "החופש באישור מנהל" });
                                setNoteDialog({ date, type: "vacation_request" });
                              }}
                              title="בקשת חופש (דורש אישור מנהל)"
                              className="flex items-center gap-1 group"
                            >
                              <span className="w-4 h-4 rounded border-2 border-orange-300 group-hover:border-orange-500 bg-white flex items-center justify-center transition-all flex-shrink-0" />
                            </button>
                          )
                        )}
                        {!vacReq && locked && (
                          <span className="w-4 h-4 rounded border-2 border-orange-100 bg-white opacity-40" />
                        )}
                        {vacReq && (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              vacReq.status === "approved" ? "bg-green-500 border-green-500" :
                              vacReq.status === "rejected" ? "bg-red-300 border-red-300" :
                              "bg-orange-400 border-orange-400"
                            }`}>
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                            <span className={`text-xs font-semibold leading-none ${vacStatusColor}`}>{vacStatusLabel}</span>
                            {!locked && vacReq.status === "pending" && (
                              <button
                                onClick={() => deleteVacationMutation.mutate(vacReq.id)}
                                className="text-xs text-slate-300 hover:text-red-400 transition-colors leading-none"
                              >
                                ביטול
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confirm / hint row */}
              {!isPastDeadline && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <p className="text-center text-xs text-slate-400">
                    לחץ לסימון "לא רוצה לעבוד" ← "חופש" ← חזרה לזמין
                  </p>
                  <button
                    onClick={handleConfirm}
                    disabled={confirmMutation.isPending}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <SendHorizonal className="w-4 h-4" />
                    אישור אילוצים
                  </button>
                </div>
              )}

              {isPastDeadline && (
                <p className="text-center text-xs text-slate-400 mt-3">
                  הדד-ליין עבר — האילוצים נעולים עד שבוע הבא
                </p>
              )}
            </div>
          )}
        </motion.div>
        )}

        {/* ─── SECTION 2: Published schedule (next week) ─── */}
        {activeTab === "schedule" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-lg shadow-slate-200/60">

          <div className="px-6 py-4 bg-gradient-to-l from-amber-50 to-transparent border-b border-slate-100 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow shadow-amber-500/30">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-slate-800">שיבוץ</h2>
              <p className="text-sm font-semibold text-amber-700">{scheduleWeekLabel}</p>
            </div>
            {schedulePublished && (
              <div className="bg-green-100 border border-green-200 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-xl">
                ✓ פורסם
              </div>
            )}
          </div>



          {fetchingSchedule && (
            <div className="mx-4 mt-4 flex justify-center">
              <div className="px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-700">
                מעדכן שיבוץ...
              </div>
            </div>
          )}

          {!schedulePublished ? (
            <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
              <Lock className="w-8 h-8 opacity-30" />
              <p className="text-sm font-medium">
                {isInitialScheduleLoad ? "טוען את השיבוץ..." : "השיבוץ לשבוע הנוכחי טרם פורסם"}
              </p>
              <p className="text-xs">{isInitialScheduleLoad ? "זה יופיע מיד כשנתוני השיבוץ יגיעו" : "המנהל יפרסם בקרוב"}</p>
            </div>
          ) : (
            <div className="p-4">
              {/* My schedule section */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-3xl overflow-hidden border border-indigo-200 bg-white shadow-lg shadow-indigo-200/40">
                <div className="px-6 py-3 bg-gradient-to-l from-indigo-50 to-transparent border-b border-indigo-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow shadow-indigo-500/30">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-slate-800">השיבוץ שלי</h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-6 gap-3 mb-2">
                    <div></div>
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
                    {scheduleDays.map(date => {
                      const dateStr = format(date, "yyyy-MM-dd");
                      const isHolidayEve = HOLIDAY_EVE_DATES.includes(dateStr);
                      const morningReg = scheduleRegistrations.find(
                        r => r.agent_name === agentName && r.date === dateStr && r.shift_type === "morning"
                      );
                      const eveningReg = scheduleRegistrations.find(
                        r => r.agent_name === agentName && r.date === dateStr && r.shift_type === "evening"
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

              {/* All registrations table */}
              <h3 className="font-bold text-slate-800 mb-3">כל הנציגים</h3>
              <div className="space-y-3">
                {[
                   { type: "morning", label: "משמרת בוקר", time: "08:00–16:00", icon: Sun, gradient: "from-amber-400 to-orange-500" },
                   { type: "evening", label: "משמרת ערב", time: "09:00–17:00", icon: Moon, gradient: "from-indigo-400 to-purple-500" },
                   { type: "holiday_eve", label: "ערב חג", time: "09:00–14:00", icon: Palmtree, gradient: "from-purple-400 to-violet-500" },
                 ].map(shift => {
                  const ShiftIcon = shift.icon;
                  return (
                    <motion.div key={shift.type} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
                      <div className="px-3 pt-2 pb-0 grid grid-cols-6 gap-3 border-b border-slate-100">
                        <div></div>
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
                           // On holiday eve, all registrations are stored as "morning"; show them in holiday_eve row
                           const regs = scheduleRegistrations.filter(r =>
                             r.date === dateStr &&
                             r.shift_type === shift.type &&
                             r.agent_name !== agentName &&
                             !isHolidayEveDay
                           ).concat(
                             isHolidayEveDay && shift.type === "holiday_eve"
                               ? scheduleRegistrations.filter(r => r.date === dateStr && r.agent_name !== agentName)
                               : []
                           );
                          const borderColor = shift.type === "morning" ? "border-amber-300" : shift.type === "evening" ? "border-indigo-300" : "border-purple-300";
                          const bgColor = shift.type === "morning" ? "bg-amber-50" : shift.type === "evening" ? "bg-indigo-50" : "bg-purple-50";
                          const textColor = shift.type === "morning" ? "text-amber-700" : shift.type === "evening" ? "text-indigo-700" : "text-purple-700";
                          return (
                            <div key={dateStr} className="flex flex-col gap-1">
                              {regs.length > 0 ? regs.map(reg => (
                                <div key={reg.id} className={`px-2 py-1.5 rounded-lg text-xs font-semibold border-2 ${bgColor} ${borderColor} ${textColor}`}>
                                  {reg.agent_name}
                                </div>
                              )) : (
                                <div className="text-slate-300 text-xs text-center">–</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
        )}
      </div>

      {noteDialog && (
        <NoteDialog
          type={noteDialog.type}
          onSubmit={handleNoteSubmit}
          onCancel={() => setNoteDialog(null)}
        />
      )}
    </div>
  );
}

function NoteDialog({ onSubmit, onCancel, type }) {
  const [note, setNote] = useState("");
  const isVacReq = type === "vacation_request";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm mx-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isVacReq ? "bg-orange-100" : "bg-red-100"}`}>
            {isVacReq ? <Palmtree className="w-4 h-4 text-orange-500" /> : <MessageSquare className="w-4 h-4 text-red-500" />}
          </div>
          <div>
            <h3 className="font-bold text-slate-800">{isVacReq ? "בקשת חופש" : "סיבה לאי-זמינות"}</h3>
            {isVacReq && <p className="text-xs text-slate-400">הבקשה תישלח לאישור מנהל</p>}
          </div>
        </div>
        <textarea
          autoFocus
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={isVacReq ? "סיבה לחופש (אופציונלי)..." : "פרט את הסיבה (אופציונלי)..."}
          rows={3}
          className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-400 resize-none text-right"
        />
        {isVacReq && (
          <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <span className="text-amber-600 text-xs">⚠️ הבקשה תוצג למנהל ותטופל בהתאם</span>
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onSubmit(note)}
            className={`flex-1 py-2.5 rounded-2xl text-white text-sm font-semibold hover:shadow-md transition-all bg-gradient-to-r ${
              isVacReq ? "from-orange-400 to-orange-500" : "from-red-400 to-red-500"
            }`}
          >
            {isVacReq ? "שלח בקשה" : "אישור"}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-500 text-sm font-semibold hover:bg-slate-50 transition-all"
          >
            ביטול
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ShiftCell({ date, shiftType, getDayRecord, onMark, locked }) {
  const record = getDayRecord(date, shiftType);
  const isUnavailable = record?.reason === "unavailable";
  const isVacation = record?.reason === "vacation";

  let btnStyle, btnIcon, btnTitle, btnAction, btnLabel, btnTextColor;
  if (isVacation) {
    btnStyle = "bg-sky-50 border-sky-300";
    btnIcon = <Palmtree className="w-4 h-4 text-sky-500" />;
    btnTitle = "חופש · לחץ לביטול";
    btnAction = () => onMark(date, "vacation", shiftType);
    btnLabel = "חופש";
    btnTextColor = "text-sky-600";
  } else if (isUnavailable) {
    btnStyle = "bg-red-50 border-red-300";
    btnIcon = <X className="w-4 h-4 text-red-500" />;
    btnTitle = "לא זמין · לחץ לחזרה לזמין";
    btnAction = () => onMark(date, "unavailable", shiftType);
    btnLabel = "לא זמין";
    btnTextColor = "text-red-600";
  } else {
    btnStyle = "bg-green-50 border-green-200";
    btnIcon = <Check className="w-4 h-4 text-green-500" />;
    btnTitle = "זמין · לחץ לסימון אי-זמינות";
    btnAction = () => onMark(date, "unavailable", shiftType);
    btnLabel = "זמין";
    btnTextColor = "text-green-700";
  }

  return (
    <div className="px-1 py-2 flex flex-col items-center justify-center gap-1">
      <button
        onClick={() => !locked && btnAction()}
        disabled={locked}
        title={locked ? "הדד-ליין עבר" : btnTitle}
        className={`w-full px-1 py-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all ${btnStyle} ${
          locked ? "opacity-50 cursor-default" : "hover:brightness-95 hover:shadow-sm cursor-pointer active:scale-95"
        }`}
      >
        {btnIcon}
        <span className={`text-xs font-bold leading-none ${btnTextColor}`}>{btnLabel}</span>
        {!locked && <span className="text-xs text-slate-400 leading-none">לחץ לשינוי</span>}
      </button>
    </div>
  );
}

function CombinedShiftGrid({ weekDays, getDayRecord, onMark, locked, holidayEveDates = [] }) {
  return (
    <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "16.666%" }} />
        {weekDays.map((_, i) => <col key={i} style={{ width: "16.666%" }} />)}
      </colgroup>
      <tbody>
        {/* Header row with days and dates */}
        <tr>
          <td className="px-4 py-2 border-l border-slate-100"></td>
          {weekDays.map((date, i) => {
            const isHolidayEve = holidayEveDates.includes(format(date, "yyyy-MM-dd"));
            return (
              <td key={i} className="px-1 py-2 text-center border-b border-slate-100">
                <div className="text-xs font-semibold text-slate-500">{WEEKDAY_LABELS[i]}</div>
                <div className="text-sm font-bold text-slate-700">{format(date, "dd/MM")}</div>
                {isHolidayEve && <div className="text-xs text-purple-500 font-semibold">ערב חג</div>}
              </td>
            );
          })}
        </tr>
        {/* Morning row */}
        <tr>
          <td className="px-4 py-4 border-l border-slate-100 align-middle">
            <div className="flex flex-col items-center justify-center gap-1">
              <Sun className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-amber-600">בוקר</span>
              <span className="text-xs text-slate-400">08:00–16:00</span>
            </div>
          </td>
          {weekDays.map((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const isHolidayEve = holidayEveDates.includes(dateStr);
            if (isHolidayEve) {
              return (
                <td key={dateStr} rowSpan={2} className="px-1 align-middle">
                  <div className="mx-0.5 my-2 px-1 py-4 rounded-2xl border-2 border-green-200 bg-green-50 flex flex-col items-center justify-center gap-1">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-xs font-bold text-green-700 leading-none">זמין</span>
                    <span className="text-xs text-slate-400 leading-none">09:00–14:00</span>
                  </div>
                </td>
              );
            }
            return (
              <td key={dateStr} className="px-1 py-0 align-middle">
                <ShiftCell date={date} shiftType="morning" getDayRecord={getDayRecord} onMark={onMark} locked={locked} />
              </td>
            );
          })}
        </tr>
        {/* Evening row */}
        <tr className="border-t border-slate-100">
          <td className="px-4 py-4 border-l border-slate-100 align-middle">
            <div className="flex flex-col items-center justify-center gap-1">
              <Moon className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-bold text-indigo-600">ערב</span>
              <span className="text-xs text-slate-400">09:00–17:00</span>
            </div>
          </td>
          {weekDays.map((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const isHolidayEve = holidayEveDates.includes(dateStr);
            // Holiday eve cell is already rendered with rowSpan=2 above
            if (isHolidayEve) return null;
            return (
              <td key={dateStr} className="px-1 py-0 align-middle">
                <ShiftCell date={date} shiftType="evening" getDayRecord={getDayRecord} onMark={onMark} locked={locked} />
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
}
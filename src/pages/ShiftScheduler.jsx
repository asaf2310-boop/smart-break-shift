import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import {
  CalendarDays, LogOut, Sun, Moon, Palmtree, X, Check,
  MessageSquare, Lock, Pencil, SendHorizonal, CalendarClock
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  HOLIDAY_EVE_DATES,
  WEEKDAY_LABELS,
  getStoredAgentName,
  getWeekStartIsrael,
  getAgentConstraintsWeekStart,
  getWeekDays,
  getIsraelDateStr,
  getConstraintsDeadline,
  getConstraintsSubmissionWeekStart,
  getEffectiveConstraintsDeadline,
  isConstraintsSubmissionClosed,
  getConstraintsDeadlineExtendedMessage,
  CONSTRAINTS_SUBMISSION_OVERRIDE_MESSAGE,
  formatDateStr,
  canMarkMorningUnavailable,
  countMorningUnavailableDays,
  MAX_MORNING_UNAVAILABLE_DAYS_PER_WEEK,
  MORNING_UNAVAILABLE_LIMIT_MESSAGE,
} from "@/constants/scheduling";
import AgentLogin from "@/components/auth/AgentLogin";
import { useAgentSession } from "@/hooks/useAgentSession";
import { connectAgentAsAvailable } from "@/lib/agentChatPresence";
import { getLiveQueryOptions, LIVE_REFETCH_INTERVAL_MS } from "@/lib/liveQuery";
import {
  fetchWeekShiftRegistrations,
  readCachedSchedule,
  writeCachedSchedule,
  readLastPublishedScheduleWeek,
  LAST_PUBLISHED_SCHEDULE_KEY,
  clearAllScheduleCaches,
  filterRegistrationsForWeek,
  resolveAgentSchedulePanels,
} from "@/lib/shiftScheduleQuery";
import WeeklySchedulePanel from "@/components/shifts/WeeklySchedulePanel";
import BackendConfigBanner from "@/components/BackendConfigBanner";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";

import { dataClient } from "@/api/client";

export default function ShiftScheduler() {
  const { refresh: refreshAgentSession } = useAgentSession();
  const [agentName, setAgentName] = useState(() => getStoredAgentName());
  const [noteDialog, setNoteDialog] = useState(null); // { date, type: "unavailable"|"vacation_request" }
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("schedule"); // "constraints" | "schedule"
  const [lastPublishedFocus, setLastPublishedFocus] = useState(() =>
    readLastPublishedScheduleWeek()
  );
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const syncAgentName = () => setAgentName(getStoredAgentName());
    window.addEventListener("agent-session-changed", syncAgentName);
    return () => window.removeEventListener("agent-session-changed", syncAgentName);
  }, []);

  const now = new Date();
  const israelTodayKey = getIsraelDateStr(now);
  const thisWeekStart = useMemo(() => getWeekStartIsrael(now), [israelTodayKey]);
  const nextWeekStart = useMemo(() => addDays(thisWeekStart, 7), [thisWeekStart]);

  const constraintsWeekStart = useMemo(() => getAgentConstraintsWeekStart(now), [israelTodayKey]);
  const currentWeekDays = useMemo(() => getWeekDays(thisWeekStart), [thisWeekStart.getTime()]);
  const scheduleDays = useMemo(() => getWeekDays(nextWeekStart), [nextWeekStart.getTime()]);
  const constraintsDays = useMemo(() => getWeekDays(constraintsWeekStart), [constraintsWeekStart.getTime()]);

  const currentDateFrom = format(currentWeekDays[0], "yyyy-MM-dd");
  const currentDateTo = format(currentWeekDays[4], "yyyy-MM-dd");
  const scheduleDateFrom = format(scheduleDays[0], "yyyy-MM-dd");
  const scheduleDateTo = format(scheduleDays[4], "yyyy-MM-dd");

  useEffect(() => {
    clearAllScheduleCaches();
    setLastPublishedFocus(readLastPublishedScheduleWeek());
  }, [currentDateFrom, scheduleDateFrom]);

  useEffect(() => {
    const syncPublishedFocus = () =>
      setLastPublishedFocus(readLastPublishedScheduleWeek());
    window.addEventListener("focus", syncPublishedFocus);
    const onStorage = (event) => {
      if (event.key === LAST_PUBLISHED_SCHEDULE_KEY) syncPublishedFocus();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", syncPublishedFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const weekScheduleQueryOptions = (dateFrom, dateTo, weekDays) => ({
    queryKey: ["shift-registrations", dateFrom, dateTo],
    queryFn: async () => {
      const rows = await fetchWeekShiftRegistrations(weekDays);
      writeCachedSchedule(dateFrom, dateTo, rows);
      return rows;
    },
    placeholderData: () => readCachedSchedule(dateFrom, dateTo),
    refetchOnMount: "always",
    enabled: !!agentName,
    throwOnError: false,
    ...getLiveQueryOptions(),
  });

  const {
    data: currentWeekRegistrations = [],
    isLoading: loadingCurrentWeek,
    isFetching: fetchingCurrentWeek,
    isError: currentWeekError,
    error: currentWeekErrorObj,
  } = useQuery(weekScheduleQueryOptions(currentDateFrom, currentDateTo, currentWeekDays));

  const currentWeekRegistrationsFiltered = useMemo(
    () => filterRegistrationsForWeek(currentWeekRegistrations, currentDateFrom, currentDateTo),
    [currentWeekRegistrations, currentDateFrom, currentDateTo]
  );

  const {
    data: scheduleRegistrations = [],
    isLoading: loadingSchedule,
    isFetching: fetchingSchedule,
    isError: scheduleError,
    error: scheduleErrorObj,
  } = useQuery(weekScheduleQueryOptions(scheduleDateFrom, scheduleDateTo, scheduleDays));

  const scheduleRegistrationsFiltered = useMemo(
    () => filterRegistrationsForWeek(scheduleRegistrations, scheduleDateFrom, scheduleDateTo),
    [scheduleRegistrations, scheduleDateFrom, scheduleDateTo]
  );

  const schedulePanels = useMemo(() => {
    const currentPanel = {
      key: "current",
      title: "שיבוץ השבוע (לוח)",
      weekLabel: `${format(currentWeekDays[0], "dd/MM/yyyy")} – ${format(currentWeekDays[4], "dd/MM/yyyy")}`,
      scheduleDays: currentWeekDays,
      scheduleRegistrations: currentWeekRegistrationsFiltered,
      isLoading: loadingCurrentWeek,
      isFetching: fetchingCurrentWeek,
      isError: currentWeekError,
      error: currentWeekErrorObj,
      emptyTitle: "השיבוץ לשבוע הנוכחי טרם פורסם",
      emptyHint: "המנהל יפרסם בלוח «משמרות» → «שיבוץ נוכחי»",
      accent: "emerald",
      dateFrom: currentDateFrom,
    };
    const nextPanel = {
      key: "next",
      title: "שיבוץ משמרות",
      weekLabel: `${format(scheduleDays[0], "dd/MM/yyyy")} – ${format(scheduleDays[4], "dd/MM/yyyy")}`,
      scheduleDays,
      scheduleRegistrations: scheduleRegistrationsFiltered,
      isLoading: loadingSchedule,
      isFetching: fetchingSchedule,
      isError: scheduleError,
      error: scheduleErrorObj,
      emptyTitle: "השיבוץ לשבוע העבודה טרם פורסם",
      emptyHint: "המנהל יפרסם בלוח «משמרות» → «שיבוץ שבוע הבא» (7–11.6 וכו׳)",
      accent: "amber",
      dateFrom: scheduleDateFrom,
    };
    return resolveAgentSchedulePanels({
      currentPanel,
      nextPanel,
      lastPublished: lastPublishedFocus,
    });
  }, [
    currentWeekDays,
    scheduleDays,
    currentWeekRegistrationsFiltered,
    scheduleRegistrationsFiltered,
    loadingCurrentWeek,
    fetchingCurrentWeek,
    currentWeekError,
    currentWeekErrorObj,
    loadingSchedule,
    fetchingSchedule,
    scheduleError,
    scheduleErrorObj,
    currentDateFrom,
    scheduleDateFrom,
    lastPublishedFocus,
  ]);

  const constraintsWeekStartStr = formatDateStr(constraintsWeekStart);

  const { data: constraintsWeekSettingsList = [] } = useQuery({
    queryKey: ["constraints-week-settings", constraintsWeekStartStr],
    queryFn: () =>
      dataClient.entities.ConstraintsWeekSettings.filter({
        week_start: constraintsWeekStartStr,
      }),
    enabled: !!agentName,
    ...getLiveQueryOptions(),
  });

  const constraintsWeekSettings = constraintsWeekSettingsList[0] || null;
  const submissionWeekStart = getConstraintsSubmissionWeekStart(constraintsWeekStart);
  const deadline = getEffectiveConstraintsDeadline(submissionWeekStart, constraintsWeekSettings);
  const isPastDeadline = isConstraintsSubmissionClosed(
    submissionWeekStart,
    constraintsWeekSettings,
    now
  );
  const constraintsOverrideOpen = constraintsWeekSettings?.submission_override_open === true;
  const hasExtendedDeadline =
    !constraintsOverrideOpen &&
    Boolean(constraintsWeekSettings?.deadline_extended_until) &&
    deadline > getConstraintsDeadline(submissionWeekStart);

  const constraintsDateFrom = format(constraintsDays[0], "yyyy-MM-dd");
  const constraintsDateTo = format(constraintsDays[4], "yyyy-MM-dd");

  const unavailQueryKey = useMemo(
    () => ["shift-unavailabilities", constraintsDateFrom, constraintsDateTo, agentName],
    [constraintsDateFrom, constraintsDateTo, agentName]
  );

  const patchUnavailabilities = (updater) => {
    queryClient.setQueryData(unavailQueryKey, (old = []) => updater(old));
  };

  const revertedDuringCreateRef = useRef(new Set());
  const unavailSlotKey = (date, shiftType) => `${date}|${shiftType}`;
  const optimisticUnavailId = (date, shiftType) => `optimistic:${date}:${shiftType}`;
  const isOptimisticUnavailId = (id) => String(id).startsWith("optimistic:");

  const unavailMutationOpts = {
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: unavailQueryKey });
      const previous = queryClient.getQueryData(unavailQueryKey);
      return { previous, variables };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(unavailQueryKey, context.previous);
      }
      toast({
        title: "שגיאה בשמירה",
        description: "לא ניתן לעדכן את האילוץ — נסה שוב",
        variant: "destructive",
      });
    },
  };

  // Fetch vacation requests for constraints week (single query)
  const { data: vacationRequests = [] } = useQuery({
    queryKey: ["vacation-requests", constraintsDateFrom, constraintsDateTo, agentName],
    queryFn: () => dataClient.entities.VacationRequest.filter({ agent_name: agentName }),
    enabled: !!agentName,
    ...getLiveQueryOptions(),
  });

  const createVacationMutation = useMutation({
    mutationFn: (data) => dataClient.entities.VacationRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacation-requests", constraintsDateFrom, constraintsDateTo, agentName] });
      toast({ title: "✓ בקשת החופש נשלחה", description: "ממתין לאישור מנהל" });
    },
  });

  const deleteVacationMutation = useMutation({
    mutationFn: (id) => dataClient.entities.VacationRequest.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vacation-requests", constraintsDateFrom, constraintsDateTo, agentName] }),
  });

  const getVacationRequest = (date) =>
    vacationRequests.find(r => r.date === format(date, "yyyy-MM-dd") && r.date >= constraintsDateFrom && r.date <= constraintsDateTo);

  // Fetch confirmation for the constraints week
  const { data: confirmations = [], isLoading: loadingConfirm } = useQuery({
    queryKey: ["constraint-confirmations", constraintsWeekStartStr, agentName],
    queryFn: () => dataClient.entities.ConstraintConfirmation.filter({
      week_start: constraintsWeekStartStr, agent_name: agentName
    }),
    enabled: !!agentName,
    ...getLiveQueryOptions(),
  });

  const confirmation = confirmations[0] || null;
  const isConfirmed = !!confirmation && !isEditing;

  const confirmMutation = useMutation({
    mutationFn: (data) => dataClient.entities.ConstraintConfirmation.create(data),
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
    mutationFn: (data) => dataClient.entities.ShiftUnavailability.create(data),
    ...unavailMutationOpts,
    onMutate: async (data) => {
      const ctx = await unavailMutationOpts.onMutate(data);
      const slot = unavailSlotKey(data.date, data.shift_type);
      revertedDuringCreateRef.current.delete(slot);
      patchUnavailabilities((old) => {
        const withoutSlot = old.filter(
          (r) => !(r.date === data.date && r.shift_type === data.shift_type)
        );
        return [
          ...withoutSlot,
          { ...data, id: optimisticUnavailId(data.date, data.shift_type), note: data.note ?? "" },
        ];
      });
      return ctx;
    },
    onSuccess: (created) => {
      if (!created?.id) return;
      const slot = unavailSlotKey(created.date, created.shift_type);
      if (revertedDuringCreateRef.current.has(slot)) {
        revertedDuringCreateRef.current.delete(slot);
        dataClient.entities.ShiftUnavailability.delete(created.id).catch(() => {});
        return;
      }
      patchUnavailabilities((old) =>
        old.map((r) =>
          r.date === created.date &&
          r.shift_type === created.shift_type &&
          isOptimisticUnavailId(r.id)
            ? created
            : r
        )
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => dataClient.entities.ShiftUnavailability.update(id, data),
    ...unavailMutationOpts,
    onMutate: async ({ id, data }) => {
      const ctx = await unavailMutationOpts.onMutate({ id, data });
      patchUnavailabilities((old) =>
        old.map((r) => (r.id === id ? { ...r, ...data } : r))
      );
      return ctx;
    },
    onSuccess: (updated) => {
      if (!updated?.id) return;
      patchUnavailabilities((old) =>
        old.map((r) => (r.id === updated.id ? updated : r))
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => {
      if (isOptimisticUnavailId(id)) return Promise.resolve();
      return dataClient.entities.ShiftUnavailability.delete(id);
    },
    ...unavailMutationOpts,
    onMutate: async (id) => {
      const ctx = await unavailMutationOpts.onMutate(id);
      if (isOptimisticUnavailId(id)) {
        const [, date, shiftType] = String(id).split(":");
        if (date && shiftType) {
          revertedDuringCreateRef.current.add(unavailSlotKey(date, shiftType));
        }
      }
      patchUnavailabilities((old) => old.filter((r) => r.id !== id));
      return ctx;
    },
  });

  const isUnavailMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const { data: unavailabilities = [], isLoading: loadingUnavail } = useQuery({
    queryKey: unavailQueryKey,
    queryFn: () => dataClient.entities.ShiftUnavailability.filter({ agent_name: agentName }),
    enabled: !!agentName,
    ...getLiveQueryOptions({
      refetchInterval: isUnavailMutating ? false : LIVE_REFETCH_INTERVAL_MS,
    }),
  });

  const handleLogout = async () => {
    const { agentLogout } = await import("@/lib/agentAuth");
    await agentLogout();
    setAgentName("");
    refreshAgentSession();
    window.location.href = "/";
  };

  const getDayRecord = (date, shiftType) =>
    unavailabilities.find(r => r.date === format(date, "yyyy-MM-dd") && r.shift_type === shiftType);

  const morningUnavailableCount = useMemo(
    () => countMorningUnavailableDays(unavailabilities, constraintsDateFrom, constraintsDateTo),
    [unavailabilities, constraintsDateFrom, constraintsDateTo]
  );

  const rejectMorningUnavailableLimit = (dateStr) => {
    if (
      canMarkMorningUnavailable(
        unavailabilities,
        constraintsDateFrom,
        constraintsDateTo,
        dateStr
      )
    ) {
      return false;
    }
    toast({
      title: "מגבלת אי-זמינות בוקר",
      description: MORNING_UNAVAILABLE_LIMIT_MESSAGE,
      variant: "destructive",
    });
    return true;
  };

  const handleDayClick = (date, newReason, shiftType) => {
    const dateStr = format(date, "yyyy-MM-dd");
    // Find ALL records for this date+shiftType (to handle any existing duplicates)
    const allRecords = unavailabilities.filter(r => r.date === dateStr && r.shift_type === shiftType);
    const existing = allRecords[0] || null;

    // Delete any duplicates silently
    if (allRecords.length > 1) {
      allRecords.slice(1).forEach(r => deleteMutation.mutate(r.id));
    }

    const markingMorningUnavailable =
      shiftType === "morning" &&
      newReason === "unavailable" &&
      (!existing || existing.reason !== "unavailable");

    if (markingMorningUnavailable && rejectMorningUnavailableLimit(dateStr)) {
      return;
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
    }
    setNoteDialog(null);
  };

  const handleConstraintNoteSave = (date, shiftType, note) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const trimmed = String(note ?? "").trim();
    const existing = unavailabilities.find(
      (r) => r.date === dateStr && r.shift_type === shiftType
    );
    if (existing) {
      updateMutation.mutate({
        id: existing.id,
        data: { reason: existing.reason, note: trimmed },
      });
      return;
    }
    if (trimmed) {
      if (
        shiftType === "morning" &&
        rejectMorningUnavailableLimit(dateStr)
      ) {
        return;
      }
      createMutation.mutate({
        agent_name: agentName,
        date: dateStr,
        shift_type: shiftType,
        reason: "unavailable",
        note: trimmed,
      });
    }
  };

  if (!agentName) {
    return (
      <AgentLogin
        onSuccess={(session) => {
          const name = session?.displayName || getStoredAgentName();
          if (name) {
            connectAgentAsAvailable(name).catch(() => {});
            setAgentName(name);
          }
          refreshAgentSession();
        }}
      />
    );
  }

  const constraintsWeekLabel = `${format(constraintsDays[0], "dd/MM")} – ${format(constraintsDays[4], "dd/MM/yyyy")}`;
  const deadlineLabel = format(deadline, "dd/MM בשעה HH:mm");

  return (
    <HypPageLayout variant="scheduling" contentClassName="max-w-4xl px-3 sm:px-4 pb-5 sm:pb-8">
         {/* Header */}
         <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 sm:mb-8">
           <button onClick={handleLogout} className="order-2 sm:order-1 text-sm text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-2">
             <LogOut className="w-4 h-4" />
             החלף נציג
           </button>
           <div className="order-1 sm:order-2 text-center flex-1">
             <div className="flex items-center gap-3 justify-center mb-2">
               <div
                 className={hypHeaderIconClass(
                   "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30"
                 )}
               >
                 <CalendarDays className="w-5 h-5 text-white" />
               </div>
               <div>
                 <h1 className="hyp-scheduling-title text-xl sm:text-2xl font-extrabold text-slate-800">
                   העדפות משמרות
                 </h1>
                 <p className="text-slate-500 text-xs">אתה רואה את: <span className="text-indigo-600 font-semibold">{agentName}</span></p>
               </div>
             </div>
           </div>
           <div className="hidden sm:block sm:order-3 w-24" />
         </motion.div>

        {/* ─── Tabs ─── */}
        <div className="flex bg-white border border-slate-200 rounded-2xl shadow-sm p-1 gap-1 mb-5 sm:mb-6">
          <button
            onClick={() => setActiveTab("schedule")}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
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
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
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

          {(constraintsOverrideOpen || hasExtendedDeadline) && !isPastDeadline && (
            <div className="mx-4 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 leading-relaxed text-center">
              {constraintsOverrideOpen
                ? CONSTRAINTS_SUBMISSION_OVERRIDE_MESSAGE
                : getConstraintsDeadlineExtendedMessage(format(deadline, "dd/MM בשעה HH:mm"))}
            </div>
          )}

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
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-500 fill-indigo-200" />
                הערה לתא (בועה)
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                בוקר: עד {MAX_MORNING_UNAVAILABLE_DAYS_PER_WEEK} ימים לא זמין
                {!isPastDeadline && !loadingUnavail && (
                  <span className="text-amber-600 font-semibold">
                    ({morningUnavailableCount}/{MAX_MORNING_UNAVAILABLE_DAYS_PER_WEEK})
                  </span>
                )}
              </div>
            </div>
          )}

          {loadingUnavail || loadingConfirm ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="p-4">
              <div className="rounded-2xl border border-slate-100 overflow-x-auto">
                <div className="min-w-[640px]">
                  <CombinedShiftGrid
                    weekDays={constraintsDays}
                    getDayRecord={getDayRecord}
                    onMark={handleDayClick}
                    onNoteSave={handleConstraintNoteSave}
                    noteSaving={updateMutation.isPending || createMutation.isPending}
                    locked={isPastDeadline || (isConfirmed && !isEditing)}
                    holidayEveDates={HOLIDAY_EVE_DATES}
                  />
                </div>
              </div>

              {/* ─── Vacation row (per day, below shifts) ─── */}
              <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/40 overflow-x-auto">
                <div className="grid grid-cols-6 min-w-[640px]">
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

        {/* ─── SECTION 2: Published schedules ─── */}
        {activeTab === "schedule" && (
          <div className="space-y-6">
            <BackendConfigBanner />
            <p className="text-center text-xs text-slate-500 px-4">
              מוצג שיבוץ שבוע העבודה ({scheduleDateFrom}–{scheduleDateTo}, א׳–ה׳ ישראל). לא לוח 31/05–04/06 — זה שבוע קלנדרי אחר.
            </p>
            {schedulePanels.map((panel, index) => (
              <WeeklySchedulePanel
                key={panel.key}
                title={panel.title}
                weekLabel={panel.weekLabel}
                scheduleDays={panel.scheduleDays}
                scheduleRegistrations={panel.scheduleRegistrations}
                agentName={agentName}
                isLoading={panel.isLoading}
                isFetching={panel.isFetching}
                isError={panel.isError}
                error={panel.error}
                emptyTitle={panel.emptyTitle}
                emptyHint={panel.emptyHint}
                accent={panel.accent}
                highlighted={index === 0}
              />
            ))}
          </div>
        )}

      {noteDialog && (
        <NoteDialog
          type={noteDialog.type}
          onSubmit={handleNoteSubmit}
          onCancel={() => setNoteDialog(null)}
        />
      )}
    </HypPageLayout>
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

function ConstraintNotePopover({ record, date, shiftType, locked, onSave, saving }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const hasNote = Boolean(record?.note?.trim());

  useEffect(() => {
    if (open) setDraft(record?.note || "");
  }, [open, record?.note]);

  const handleSave = () => {
    onSave(date, shiftType, draft);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(next) => !locked && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          disabled={locked}
          title={hasNote ? record.note : "הוסף הערה לתא"}
          aria-label={hasNote ? "עריכת הערה" : "הוספת הערה"}
          className={`absolute top-1 left-1 z-10 w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
            locked
              ? "opacity-40 cursor-default"
              : "hover:bg-indigo-50 hover:scale-105 active:scale-95"
          }`}
        >
          <MessageSquare
            className={`w-3.5 h-3.5 ${
              hasNote ? "text-indigo-600 fill-indigo-200" : "text-slate-400"
            }`}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        dir="rtl"
        align="start"
        side="top"
        className="rounded-2xl border border-slate-200 bg-white shadow-lg w-72 p-4"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-sm font-bold text-slate-800 mb-2">הערה לאילוץ</p>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="הערה קצרה למנהל (אופציונלי)..."
          rows={3}
          maxLength={280}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none text-right"
        />
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-xs font-semibold shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-50 transition-all"
          >
            {saving ? "שומר..." : "שמירה"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-50"
          >
            ביטול
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ShiftCell({ date, shiftType, getDayRecord, onMark, onNoteSave, noteSaving, locked }) {
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
    <div className="relative px-1 py-2 flex flex-col items-center justify-center gap-1">
      {onNoteSave && (
        <ConstraintNotePopover
          record={record}
          date={date}
          shiftType={shiftType}
          locked={locked}
          onSave={onNoteSave}
          saving={noteSaving}
        />
      )}
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
        {record?.note?.trim() && (
          <span className="text-[10px] text-indigo-600 font-medium leading-tight max-w-full truncate px-1" title={record.note}>
            {record.note}
          </span>
        )}
      </button>
    </div>
  );
}

function CombinedShiftGrid({ weekDays, getDayRecord, onMark, onNoteSave, noteSaving, locked, holidayEveDates = [] }) {
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
                <ShiftCell date={date} shiftType="morning" getDayRecord={getDayRecord} onMark={onMark} onNoteSave={onNoteSave} noteSaving={noteSaving} locked={locked} />
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
                <ShiftCell date={date} shiftType="evening" getDayRecord={getDayRecord} onMark={onMark} onNoteSave={onNoteSave} noteSaving={noteSaving} locked={locked} />
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
}
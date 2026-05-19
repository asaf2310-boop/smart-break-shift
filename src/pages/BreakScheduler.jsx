import React, { useState, useMemo, useEffect } from "react";
import { dataClient } from "@/api/client";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, LogOut, AlertTriangle } from "lucide-react";
import { Navigate } from "react-router-dom";

import BreakSection from "../components/breaks/BreakSection";
import MyRegistrations from "../components/breaks/MyRegistrations";
import DateSelector from "../components/breaks/DateSelector";
import AppNav from "../components/layout/AppNav";
import { SHORT_BREAK_SLOTS, LUNCH_BREAK_SLOTS, getStoredAgentName } from "@/constants/scheduling";
import {
  BreakRegistrationError,
  createBreakRegistration,
  getBreakLimits,
  validateBreakRegistration,
} from "@/lib/breakCapacity";
import { getLiveQueryOptions } from "@/lib/liveQuery";

const getBreakDayCacheKey = (dateStr) => `break-day-cache:${dateStr}`;

const readCachedBreakDay = (dateStr) => {
  try {
    const raw = sessionStorage.getItem(getBreakDayCacheKey(dateStr));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
};

const writeCachedBreakDay = (dateStr, data) => {
  try {
    sessionStorage.setItem(getBreakDayCacheKey(dateStr), JSON.stringify(data));
  } catch {
    // Cache is only a speed boost; ignore browsers that block storage.
  }
};

export default function BreakScheduler() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [agentName, setAgentName] = useState(() => getStoredAgentName());
  const [showNotice, setShowNotice] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: breakDayData, isLoading, isFetching } = useQuery({
    queryKey: ["break-day", dateStr],
    queryFn: async () => {
      const [registrations, settingsList] = await Promise.all([
        dataClient.entities.BreakRegistration.filter({ date: dateStr }),
        dataClient.entities.BreakSettings.filter({ date: dateStr }),
      ]);
      const data = {
        registrations,
        settings: settingsList[0] || null,
      };
      writeCachedBreakDay(dateStr, data);
      return data;
    },
    initialData: () => readCachedBreakDay(dateStr),
    placeholderData: keepPreviousData,
    ...getLiveQueryOptions(),
  });
  const registrations = breakDayData?.registrations ?? [];
  const settings = breakDayData?.settings ?? null;
  const isInitialBreakLoad = isLoading && !breakDayData;

  useEffect(() => {
    if (agentName && settings?.show_shortage_notice) setShowNotice(true);
  }, [agentName, settings?.show_shortage_notice, settings?.id]);

  const breakLimits = useMemo(() => getBreakLimits(settings), [settings]);

  const createMutation = useMutation({
    mutationFn: (data) => createBreakRegistration(dataClient, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["break-day", dateStr] });
      toast({ title: "✓ נרשמת בהצלחה!", description: "ההרשמה נשמרה" });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["break-day", dateStr] });
      if (error instanceof BreakRegistrationError) {
        toast({ title: "לא ניתן להירשם", description: error.message });
        return;
      }
      const message = String(error?.message || "");
      if (message.includes("break_slot_full")) {
        toast({ title: "לא ניתן להירשם", description: "המשבצת מלאה — אין מקום נוסף" });
        return;
      }
      if (message.includes("break_agent_already_registered")) {
        toast({ title: "לא ניתן להירשם", description: "כבר נרשמת להפסקה מסוג זה להיום" });
        return;
      }
      toast({ title: "שגיאה", description: "לא הצלחנו לשמור את ההרשמה" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => dataClient.entities.BreakRegistration.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["break-day", dateStr] });
      toast({ title: "ההרשמה בוטלה", description: "ניתן להירשם מחדש" });
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("agent_name");
    setAgentName("");
  };

  const handleRegister = (breakType) => (slot) => {
    if (createMutation.isPending) {
      return;
    }
    if (isInitialBreakLoad || isFetching) {
      toast({ title: "רגע קטן", description: "מעדכנים זמינות להפסקות" });
      return;
    }

    try {
      validateBreakRegistration({
        registrations,
        settings,
        agentName,
        breakType,
        timeSlot: slot,
      });
    } catch (error) {
      if (error instanceof BreakRegistrationError) {
        toast({ title: "לא ניתן להירשם", description: error.message });
      }
      return;
    }

    createMutation.mutate({
      agent_name: agentName,
      break_type: breakType,
      time_slot: slot,
      date: dateStr,
    });
  };

  const handleCancel = (id) => deleteMutation.mutate(id);

  const shortRegs = useMemo(() => registrations.filter(r => r.break_type === "short"), [registrations]);
  const lunchRegs = useMemo(() => registrations.filter(r => r.break_type === "lunch"), [registrations]);
  const myShortReg = useMemo(() => shortRegs.find(r => r.agent_name === agentName), [shortRegs, agentName]);
  const myLunchReg = useMemo(() => lunchRegs.find(r => r.agent_name === agentName), [lunchRegs, agentName]);

  if (!agentName) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50" dir="rtl">
      {/* Background decorations */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-3xl" />
      </div>

      <AnimatePresence>
        {showNotice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 mb-1">שימו לב</h2>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {settings?.shortage_notice_text || "עקב מחסור בנציגים, היום לא תתאפשר יציאה בזוגות להפסקת צהריים."}
                  </p>
                </div>
                <button
                  onClick={() => setShowNotice(false)}
                  className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  הבנתי
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-5xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 sm:mb-8"
        >
          <button
            onClick={handleLogout}
            className="order-2 sm:order-1 flex items-center gap-2 text-slate-400 hover:text-slate-700 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>החלף משתמש</span>
          </button>

          <div className="order-1 sm:order-2 text-center">
            <div className="flex items-center gap-3 justify-center mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <CalendarClock className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">ניהול הפסקות</h1>
            </div>
            <p className="text-slate-500 text-sm">
              שלום <span className="text-indigo-600 font-semibold">{agentName}</span>
            </p>
          </div>

          <div className="order-3">
            <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} variant="light" />
          </div>
        </motion.div>

        {/* Nav */}
        <AppNav />

        {/* My Registrations */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <MyRegistrations shortReg={myShortReg} lunchReg={myLunchReg} onCancel={handleCancel} />
        </motion.div>

        {isFetching && (
          <div className="mb-3 flex justify-center">
            <div className="px-3 py-1.5 rounded-full bg-white/80 border border-indigo-100 text-xs font-semibold text-indigo-600 shadow-sm">
              מעדכן זמינות...
            </div>
          </div>
        )}

        <div className="space-y-6">
          <BreakSection
            type="short"
            title="הפסקת 10 דקות"
            subtitle="10:00 – 12:00 · מקסימום נציג אחד למשבצת"
            slots={SHORT_BREAK_SLOTS}
            registrations={shortRegs}
            onRegister={handleRegister("short")}
            userRegistration={myShortReg}
            agentName={agentName}
            maxPerSlot={breakLimits.short}
            registrationDisabled={isInitialBreakLoad || isFetching || createMutation.isPending}
          />
          <BreakSection
            type="lunch"
            title="הפסקת צהריים"
            subtitle={`12:30 – 15:30 · חצי שעה · מקסימום ${breakLimits.lunch} נציג${breakLimits.lunch > 1 ? "ים" : ""} למשבצת`}
            slots={LUNCH_BREAK_SLOTS}
            registrations={lunchRegs}
            onRegister={handleRegister("lunch")}
            userRegistration={myLunchReg}
            agentName={agentName}
            maxPerSlot={breakLimits.lunch}
            registrationDisabled={isInitialBreakLoad || isFetching || createMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
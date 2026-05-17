import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, LogOut, AlertTriangle, X } from "lucide-react";

import BreakSection from "../components/breaks/BreakSection";
import AgentNameDialog from "../components/breaks/AgentNameDialog";
import MyRegistrations from "../components/breaks/MyRegistrations";
import DateSelector from "../components/breaks/DateSelector";
import AppNav from "../components/layout/AppNav";
import { SHORT_BREAK_SLOTS, LUNCH_BREAK_SLOTS } from "@/constants/scheduling";

export default function BreakScheduler() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [agentName, setAgentName] = useState(() => localStorage.getItem("agent_name") || "");
  const [showNotice, setShowNotice] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (agentName && settings?.show_shortage_notice) setShowNotice(true);
  }, [agentName, settings?.show_shortage_notice, settings?.id]);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["break-registrations", dateStr],
    queryFn: () => base44.entities.BreakRegistration.filter({ date: dateStr }),
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ["break-settings", dateStr],
    queryFn: () => base44.entities.BreakSettings.filter({ date: dateStr }),
  });
  const settings = settingsList[0] || null;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BreakRegistration.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["break-registrations", dateStr] });
      toast({ title: "✓ נרשמת בהצלחה!", description: "ההרשמה נשמרה" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BreakRegistration.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["break-registrations", dateStr] });
      toast({ title: "ההרשמה בוטלה", description: "ניתן להירשם מחדש" });
    },
  });

  const handleNameSubmit = (name) => {
    setAgentName(name);
    localStorage.setItem("agent_name", name);
  };

  const handleLogout = () => {
    localStorage.removeItem("agent_name");
    setAgentName("");
  };

  const handleRegister = (breakType) => (slot) => {
    createMutation.mutate({ agent_name: agentName, break_type: breakType, time_slot: slot, date: dateStr });
  };

  const handleCancel = (id) => deleteMutation.mutate(id);

  const shortRegs = useMemo(() => registrations.filter(r => r.break_type === "short"), [registrations]);
  const lunchRegs = useMemo(() => registrations.filter(r => r.break_type === "lunch"), [registrations]);
  const myShortReg = useMemo(() => shortRegs.find(r => r.agent_name === agentName), [shortRegs, agentName]);
  const myLunchReg = useMemo(() => lunchRegs.find(r => r.agent_name === agentName), [lunchRegs, agentName]);

  if (!agentName) {
    return <AgentNameDialog open={true} onSubmit={handleNameSubmit} />;
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

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-700 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>החלף משתמש</span>
          </button>

          <div className="text-center">
            <div className="flex items-center gap-3 justify-center mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <CalendarClock className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">ניהול הפסקות</h1>
            </div>
            <p className="text-slate-500 text-sm">
              שלום <span className="text-indigo-600 font-semibold">{agentName}</span>
            </p>
          </div>

          <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} variant="light" />
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

        {isLoading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
          </div>
        ) : (
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
              maxPerSlot={settings?.short_max_per_slot ?? 1}
            />
            <BreakSection
              type="lunch"
              title="הפסקת צהריים"
              subtitle={`12:30 – 15:30 · חצי שעה · מקסימום ${settings?.lunch_max_per_slot ?? 1} נציג${(settings?.lunch_max_per_slot ?? 1) > 1 ? "ים" : ""} למשבצת`}
              slots={LUNCH_BREAK_SLOTS}
              registrations={lunchRegs}
              onRegister={handleRegister("lunch")}
              userRegistration={myLunchReg}
              agentName={agentName}
              maxPerSlot={settings?.lunch_max_per_slot ?? 1}
            />
          </div>
        )}
      </div>
    </div>
  );
}
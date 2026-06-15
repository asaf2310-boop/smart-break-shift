import React, { useState, useMemo } from "react";
import { dataClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { motion } from "framer-motion";
import { Sun, Moon, CalendarDays, Lock, LogOut } from "lucide-react";

const AGENT_NAMES = [
  "רחלה מנשה", "שרון שפיר", "תהילה קיפרווסר", "בני סגל", "אופיר דוד",
  "אוראל קליפה", "הילה שלמה", "אורפז דאבוש", "בוריס טורבין", "נהוראי וקנין",
];

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי"];

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart) {
  return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
}

export default function TestAgentView() {
  const [selectedAgent, setSelectedAgent] = useState("רחלה מנשה");
  const now = new Date();
  const thisWeekStart = getWeekStart(now);
  const nextWeekStart = addDays(thisWeekStart, 7);
  const scheduleDays = useMemo(() => getWeekDays(nextWeekStart), [nextWeekStart]);

  const scheduleDateFrom = format(scheduleDays[0], "yyyy-MM-dd");
  const scheduleDateTo = format(scheduleDays[4], "yyyy-MM-dd");

  const { data: nextWeekRegistrations = [], isLoading: loadingSchedule } = useQuery({
    queryKey: ["shift-registrations", scheduleDateFrom, scheduleDateTo],
    queryFn: () => dataClient.entities.ShiftRegistration.list("-date", 50),
  });

  const schedulePublished = nextWeekRegistrations.some(r =>
    r.date >= scheduleDateFrom && r.date <= scheduleDateTo
  );

  const scheduleWeekLabel = `${format(scheduleDays[0], "dd/MM")} – ${format(scheduleDays[4], "dd/MM/yyyy")}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50" dir="rtl">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
          <button
            onClick={() => setSelectedAgent("")}
            className="text-sm text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            החלף נציג
          </button>
          <div className="text-center flex-1">
            <div className="flex items-center gap-3 justify-center mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-800">תצוגת שיבוץ</h1>
                <p className="text-slate-500 text-xs">אתה רואה את: <span className="text-indigo-600 font-semibold">{selectedAgent}</span></p>
              </div>
            </div>
            <p className="text-slate-500 text-sm">שבוע {scheduleWeekLabel}</p>
          </div>
          <div className="w-24" />
        </motion.div>

        {/* Published schedule (next week) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-lg shadow-slate-200/60">

          <div className="px-6 py-4 bg-gradient-to-l from-amber-50 to-transparent border-b border-slate-100 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow shadow-amber-500/30">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-slate-800">שיבוץ שבוע הבא</h2>
              <p className="text-xs text-slate-400">{scheduleWeekLabel}</p>
            </div>
            {schedulePublished && (
              <div className="bg-green-100 border border-green-200 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-xl">
                ✓ פורסם
              </div>
            )}
          </div>

          {loadingSchedule ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
            </div>
          ) : !schedulePublished ? (
            <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
              <Lock className="w-8 h-8 opacity-30" />
              <p className="text-sm font-medium">השיבוץ לשבוע הבא טרם פורסם</p>
              <p className="text-xs">המנהל יפרסם בקרוב</p>
            </div>
          ) : (
           <div className="p-4">
             {/* Table with my schedule at top */}
             <div className="grid grid-cols-6 gap-3 mb-3">
               <div className="text-xs font-semibold text-slate-400 text-center py-2">משמרת</div>
               {scheduleDays.map((date, i) => (
                 <div key={i} className="text-center">
                   <div className="text-xs font-semibold text-slate-500">{DAYS[i]}</div>
                   <div className="text-sm font-bold text-slate-700">{format(date, "dd/MM")}</div>
                 </div>
               ))}
             </div>

             <div className="space-y-3">
               {/* My schedule row */}
               <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                 className="rounded-2xl overflow-hidden border border-indigo-200 bg-gradient-to-r from-indigo-50 to-transparent shadow-lg shadow-indigo-100/60">
                 <div className="p-3 grid grid-cols-6 gap-3 items-center">
                   <div className="flex items-center gap-2 px-2">
                     <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow shadow-indigo-500/20">
                       <CalendarDays className="w-3.5 h-3.5 text-white" />
                     </div>
                     <span className="text-xs font-bold text-slate-800">השיבוץ שלך</span>
                   </div>
                   {scheduleDays.map((date) => {
                     const dateStr = format(date, "yyyy-MM-dd");
                     const myRegs = nextWeekRegistrations.filter(
                       r => r.date === dateStr && r.agent_name === selectedAgent &&
                       r.date >= scheduleDateFrom && r.date <= scheduleDateTo
                     );
                     const shiftTimes = { morning: "08:00–16:00", evening: "09:00–17:00", holiday: "09:00–14:00" };
                     return (
                       <div key={dateStr} className="flex flex-col gap-1 text-center">
                         {myRegs.length > 0 ? (
                           myRegs.map((reg, idx) => (
                             <div
                               key={idx}
                               className={`px-1.5 py-1 rounded-lg text-xs border ${
                                 reg.shift_type === "morning"
                                   ? "bg-amber-50 border-amber-200 text-amber-700"
                                   : reg.shift_type === "evening"
                                   ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                   : "bg-purple-50 border-purple-200 text-purple-700"
                               }`}
                             >
                               <div className="font-bold">{reg.shift_type === "morning" ? "בוקר" : reg.shift_type === "evening" ? "ערב" : "ערב חג"}</div>
                               <div className="text-xs opacity-70">{shiftTimes[reg.shift_type]}</div>
                             </div>
                           ))
                         ) : (
                           <div className="text-slate-300 text-xs">–</div>
                         )}
                       </div>
                     );
                   })}
                 </div>
               </motion.div>

               {[
                 { type: "morning", label: "משמרת בוקר", time: "08:00–16:00", icon: Sun, gradient: "from-amber-400 to-orange-500" },
                 { type: "evening", label: "משמרת ערב", time: "09:00–17:00", icon: Moon, gradient: "from-indigo-400 to-purple-500" },
                 { type: "holiday", label: "משמרת ערב חג", time: "09:00–14:00", icon: Sun, gradient: "from-purple-400 to-pink-500" },
               ].map(shift => {
                 const ShiftIcon = shift.icon;
                 return (
                   <motion.div key={shift.type} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                     className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
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
                         const dayRegs = nextWeekRegistrations.filter(
                           r => r.date === dateStr && r.shift_type === shift.type &&
                           r.date >= scheduleDateFrom && r.date <= scheduleDateTo &&
                           r.agent_name !== selectedAgent
                         );
                         return (
                           <div key={dateStr} className="flex flex-col gap-1 text-center">
                             {dayRegs.length > 0 ? (
                               dayRegs.map((reg, idx) => (
                                 <div key={idx} className="px-1.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700 truncate">
                                   {reg.agent_name}
                                 </div>
                               ))
                             ) : (
                               <div className="text-slate-300 text-xs">–</div>
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
      </div>

      {/* Agent selector modal */}
      {!selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" dir="rtl">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm mx-4"
          >
            <h2 className="font-bold text-lg text-slate-800 mb-4">בחר נציג</h2>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {AGENT_NAMES.map(name => (
                <button
                  key={name}
                  onClick={() => setSelectedAgent(name)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all text-right"
                >
                  {name}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
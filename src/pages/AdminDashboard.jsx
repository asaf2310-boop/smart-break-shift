import React, { useState, useMemo } from "react";
import { dataClient } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import { ShieldCheck, Plus, X, Settings } from "lucide-react";
import DateSelector from "../components/breaks/DateSelector";
import { Link } from "react-router-dom";
import BreakSettingsPanel from "../components/admin/BreakSettingsPanel";
import { SHORT_BREAK_SLOTS, LUNCH_BREAK_SLOTS } from "@/constants/scheduling";
import BackendConfigBanner from "@/components/BackendConfigBanner";
import {
  BreakRegistrationError,
  createBreakRegistration,
  getBreakLimits,
} from "@/lib/breakCapacity";
import { getLiveQueryOptions } from "@/lib/liveQuery";

export default function AdminDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [addingTo, setAddingTo] = useState(null); // { slot, breakType }
  const [newName, setNewName] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: registrations = [], isLoading, isFetching } = useQuery({
    queryKey: ["break-registrations", dateStr],
    queryFn: () => dataClient.entities.BreakRegistration.filter({ date: dateStr }),
    ...getLiveQueryOptions(),
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ["break-settings", dateStr],
    queryFn: () => dataClient.entities.BreakSettings.filter({ date: dateStr }),
    ...getLiveQueryOptions(),
  });
  const settings = settingsList[0] || null;
  const limits = getBreakLimits(settings);

  const createMutation = useMutation({
    mutationFn: (data) => createBreakRegistration(dataClient, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["break-registrations", dateStr] });
      setAddingTo(null);
      setNewName("");
      toast({ title: "✓ נציג נוסף בהצלחה" });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["break-registrations", dateStr] });
      if (error instanceof BreakRegistrationError) {
        toast({ title: "לא ניתן להוסיף", description: error.message });
        return;
      }
      toast({ title: "שגיאה", description: "לא הצלחנו לשמור את ההרשמה" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => dataClient.entities.BreakRegistration.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["break-registrations", dateStr] });
      toast({ title: "הרשמה הוסרה" });
    },
  });

  const handleAdd = (slot, breakType) => {
    if (!newName.trim()) return;
    createMutation.mutate({ agent_name: newName.trim(), break_type: breakType, time_slot: slot, date: dateStr });
  };

  const getSlotRegs = (slot, breakType) =>
    registrations.filter(r => r.time_slot === slot && r.break_type === breakType);

  const renderSection = (title, slots, breakType, color) => (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className={`px-6 py-4 border-b border-slate-100 flex items-center justify-between ${color}`}>
        <h2 className="font-bold text-slate-800 text-lg">{title}</h2>
        <span className="text-sm text-slate-500">מכסה למשבצת: <strong className="text-slate-800">{limits[breakType]}</strong></span>
      </div>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {slots.map(slot => {
          const slotRegs = getSlotRegs(slot, breakType);
          const isFull = slotRegs.length >= limits[breakType];
          const isAdding = addingTo?.slot === slot && addingTo?.breakType === breakType;

          return (
            <div key={slot} className={`rounded-2xl border p-3 flex flex-col gap-2 ${isFull ? "border-slate-100 bg-slate-50" : "border-slate-200 bg-white"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">{slot}</span>
                <span className={`text-xs font-bold ${isFull ? "text-red-400" : "text-slate-400"}`}>
                  {slotRegs.length}/{limits[breakType]}
                </span>
              </div>

              {slotRegs.map(reg => (
                <div key={reg.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-2 py-1.5">
                  <span className="text-xs text-slate-700 font-medium truncate">{reg.agent_name}</span>
                  <button
                    onClick={() => deleteMutation.mutate(reg.id)}
                    className="w-5 h-5 rounded-lg hover:bg-red-100 hover:text-red-500 text-slate-300 flex items-center justify-center transition-all flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {isAdding ? (
                <div className="flex gap-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleAdd(slot, breakType); if (e.key === "Escape") { setAddingTo(null); setNewName(""); } }}
                    placeholder="שם הנציג..."
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-400 min-w-0"
                  />
                  <button onClick={() => handleAdd(slot, breakType)} className="text-xs bg-indigo-500 text-white rounded-lg px-2 py-1 hover:bg-indigo-600 transition-all">הוסף</button>
                </div>
              ) : !isFull && (
                <button
                  onClick={() => { setAddingTo({ slot, breakType }); setNewName(""); }}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  הוסף נציג
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50" dir="rtl">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        <BackendConfigBanner />
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
          <Link to="/" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">ראשי</Link>
          <Link to="/admin/shifts" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">משמרות</Link>
          <div className="text-center">
            <div className="flex items-center gap-3 justify-center mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">דשבורד מנהל</h1>
            </div>
          </div>
          <div className="w-24" />
        </motion.div>

        {isFetching && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-3 flex justify-center"
          >
            <motion.div className="px-3 py-1.5 rounded-full bg-white/80 border border-amber-100 text-xs font-semibold text-amber-700 shadow-sm">
              מסנכרן הרשמות...
            </motion.div>
          </motion.div>
        )}

        {/* Date Selector */}
        <div className="flex justify-center mb-6">
          <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} variant="light" />
        </div>

        <div className="mb-6">
          <BreakSettingsPanel selectedDate={selectedDate} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {renderSection("הפסקת 10 דקות", SHORT_BREAK_SLOTS, "short", "bg-purple-50/50")}
            {renderSection("הפסקת צהריים", LUNCH_BREAK_SLOTS, "lunch", "bg-indigo-50/50")}
          </div>
        )}
      </div>
    </div>
  );
}
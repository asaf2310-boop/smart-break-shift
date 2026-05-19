import React, { useState, useMemo, useRef, useEffect } from "react";
import { dataClient } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { motion } from "framer-motion";
import { Pencil, Sun, Moon, X, Plus, Check, RefreshCw } from "lucide-react";

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי"];
import { AGENT_NAMES } from "@/constants/scheduling";

function AgentCell({ agents, allAgentsOnDay, onRemove, onAdd }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const availableToAdd = AGENT_NAMES.filter(n => !allAgentsOnDay.includes(n));

  return (
    <div className="flex flex-col gap-1 p-1">
      {agents.map(agent => (
        <div key={agent} className="flex items-center justify-between gap-1 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
          <span className="truncate">{agent}</span>
          <button onClick={() => onRemove(agent)} className="hover:text-red-500 transition-colors flex-shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setShowDropdown(v => !v)}
          disabled={availableToAdd.length === 0}
          className="w-full flex items-center justify-center gap-1 py-1 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs"
        >
          <Plus className="w-3 h-3" />
          הוסף
        </button>
        {showDropdown && availableToAdd.length > 0 && (
          <div className="absolute z-50 top-full mt-1 right-0 w-36 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
            {availableToAdd.map(agent => (
              <button
                key={agent}
                onClick={() => { onAdd(agent); setShowDropdown(false); }}
                className="w-full text-right px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                {agent}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublishedScheduleEditor({ weekStart }) {
  const [localRegs, setLocalRegs] = useState(null); // null = not loaded yet
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const dateFrom = format(weekDays[0], "yyyy-MM-dd");
  const dateTo = format(weekDays[4], "yyyy-MM-dd");

  const { data: publishedRegs = [], isLoading } = useQuery({
    queryKey: ["published-regs-editor", dateFrom, dateTo],
    queryFn: async () => {
      const results = await Promise.all(
        weekDays.map(d => dataClient.entities.ShiftRegistration.filter({ date: format(d, "yyyy-MM-dd") }))
      );
      return results.flat();
    },
  });

  const isPublished = publishedRegs.length > 0;

  // Initialize local state from DB when data loads
  useEffect(() => {
    if (publishedRegs.length > 0 && localRegs === null) {
      const map = {};
      for (const reg of publishedRegs) {
        const key = `${reg.date}|${reg.shift_type}`;
        if (!map[key]) map[key] = [];
        map[key].push(reg.agent_name);
      }
      setLocalRegs(map);
      setSaved(false);
    }
  }, [publishedRegs]);

  const getAgents = (dateStr, shiftType) => {
    if (!localRegs) return [];
    return localRegs[`${dateStr}|${shiftType}`] || [];
  };

  const getAllOnDay = (dateStr) => {
    if (!localRegs) return [];
    return [
      ...(localRegs[`${dateStr}|morning`] || []),
      ...(localRegs[`${dateStr}|evening`] || []),
    ];
  };

  const handleRemove = (dateStr, shiftType, agent) => {
    const key = `${dateStr}|${shiftType}`;
    setLocalRegs(prev => ({ ...prev, [key]: (prev[key] || []).filter(a => a !== agent) }));
    setSaved(false);
  };

  const handleAdd = (dateStr, shiftType, agent) => {
    const key = `${dateStr}|${shiftType}`;
    setLocalRegs(prev => ({ ...prev, [key]: [...(prev[key] || []), agent] }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!localRegs) return;
    setSaving(true);

    const records = Object.entries(localRegs).flatMap(([key, agents]) => {
      const [dateStr, shiftType] = key.split("|");
      return (agents || []).map(agent => ({ agent_name: agent, shift_type: shiftType, date: dateStr }));
    });

    // Delete all existing and recreate
    const allWeekRegs = await Promise.all(
      weekDays.map(d => dataClient.entities.ShiftRegistration.filter({ date: format(d, "yyyy-MM-dd") }))
    ).then(r => r.flat());
    await Promise.all(allWeekRegs.map(r => dataClient.entities.ShiftRegistration.delete(r.id)));

    if (records.length > 0) {
      await dataClient.entities.ShiftRegistration.bulkCreate(records);
    }

    await queryClient.invalidateQueries({ queryKey: ["published-regs-editor", dateFrom, dateTo] });
    await queryClient.invalidateQueries({ queryKey: ["shift-registrations"] });
    setSaving(false);
    setSaved(true);
  };

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white shadow-lg p-6 flex justify-center py-12" dir="rtl">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isPublished) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200 bg-white shadow-lg p-6 text-center text-slate-400 text-sm" dir="rtl">
        <Pencil className="w-6 h-6 mx-auto mb-2 opacity-30" />
        אין שיבוץ פורסם לשבוע זה — צור שיבוץ תחילה
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-slate-200 bg-white shadow-lg p-6" dir="rtl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow shadow-emerald-500/30">
            <Pencil className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">עריכת שיבוץ פורסם</h3>
            <p className="text-xs text-slate-400">
              שבוע {format(weekDays[0], "dd/MM")} – {format(weekDays[4], "dd/MM/yyyy")}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 overflow-hidden mb-4">
        {/* Header */}
        <div className="grid grid-cols-6 bg-slate-50 border-b border-slate-100">
          <div className="py-2 px-3 text-xs font-semibold text-slate-400">משמרת</div>
          {weekDays.map((date, i) => (
            <div key={i} className="py-2 text-center">
              <div className="text-xs text-slate-400">{DAYS[i]}</div>
              <div className="text-xs font-bold text-slate-600">{format(date, "dd/MM")}</div>
            </div>
          ))}
        </div>

        {[
          { type: "morning", label: "בוקר", time: "08:00–16:00", Icon: Sun, color: "text-amber-500" },
          { type: "evening", label: "ערב", time: "09:00–17:00", Icon: Moon, color: "text-indigo-500" },
        ].map(shift => (
          <div key={shift.type} className="grid grid-cols-6 border-t border-slate-100">
            <div className="flex flex-col items-center justify-center gap-0.5 py-3 px-2 border-l border-slate-100">
              <shift.Icon className={`w-4 h-4 ${shift.color}`} />
              <span className={`text-xs font-bold ${shift.color}`}>{shift.label}</span>
              <span className="text-xs text-slate-400">{shift.time}</span>
            </div>
            {weekDays.map(date => {
              const dateStr = format(date, "yyyy-MM-dd");
              return (
                <AgentCell
                  key={dateStr}
                  agents={getAgents(dateStr, shift.type)}
                  allAgentsOnDay={getAllOnDay(dateStr)}
                  onRemove={(agent) => handleRemove(dateStr, shift.type, agent)}
                  onAdd={(agent) => handleAdd(dateStr, shift.type, agent)}
                />
              );
            })}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> שומר...</>
        ) : saved ? (
          <><Check className="w-4 h-4" /> ✓ עודכן בהצלחה!</>
        ) : (
          "שמור שינויים"
        )}
      </button>
    </motion.div>
  );
}
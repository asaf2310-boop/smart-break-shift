import React, { useState } from "react";
import { motion } from "framer-motion";
import { User, CalendarClock, ChevronDown } from "lucide-react";

import { AGENT_NAMES } from "@/constants/scheduling";

export default function AgentNameDialog({ open, onSubmit }) {
  const [selected, setSelected] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selected) onSubmit(selected);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 p-4">
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative w-full max-w-sm sm:max-w-md"
        dir="rtl"
      >
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-5 sm:p-8">
          <div className="flex flex-col items-center gap-3 mb-6 sm:mb-8">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <CalendarClock className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">מערכת הפסקות ומשמרות</h1>
              <p className="text-white/60 text-sm mt-1">בחר/י את שמך להמשך</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none z-10" />
              <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none z-10" />
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                autoFocus
                className="w-full bg-white/10 border border-white/20 rounded-2xl py-3 px-4 pr-11 pl-10 text-white outline-none focus:border-indigo-400 focus:bg-white/15 transition-all text-right appearance-none cursor-pointer"
              >
                <option value="" disabled className="bg-slate-900 text-white/60">בחר/י שם...</option>
                {AGENT_NAMES.map(name => (
                  <option key={name} value={name} className="bg-slate-900 text-white">{name}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!selected}
              className="w-full py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
            >
              כניסה למערכת
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
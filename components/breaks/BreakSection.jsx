import React from "react";
import { motion } from "framer-motion";
import { Coffee, UtensilsCrossed } from "lucide-react";
import TimeSlotCard from "./TimeSlotCard";

export default function BreakSection({
  type, title, subtitle, slots, registrations, onRegister, userRegistration, agentName, maxPerSlot
}) {
  const isLunch = type === "lunch";
  const hasRegistered = !!userRegistration;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: isLunch ? 0.2 : 0.15 }}
      className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-lg shadow-slate-200/60"
    >
      {/* Section header */}
      <div className={`px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border-b border-slate-100 ${
        isLunch
          ? "bg-gradient-to-l from-indigo-50 to-transparent"
          : "bg-gradient-to-l from-purple-50 to-transparent"
      }`}>
        <div className={`w-10 sm:w-11 h-10 sm:h-11 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0 ${
          isLunch
            ? "bg-gradient-to-br from-indigo-400 to-blue-500 shadow-indigo-500/30"
            : "bg-gradient-to-br from-purple-400 to-pink-500 shadow-purple-500/30"
        }`}>
          {isLunch
            ? <UtensilsCrossed className="w-4 sm:w-5 h-4 sm:h-5 text-white" />
            : <Coffee className="w-4 sm:w-5 h-4 sm:h-5 text-white" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-800">{title}</h2>
          <p className="text-xs sm:text-sm text-slate-400">{subtitle}</p>
        </div>
        {hasRegistered && (
          <div className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 sm:mr-0 ${
            isLunch
              ? "bg-indigo-100 text-indigo-600 border border-indigo-200"
              : "bg-purple-100 text-purple-600 border border-purple-200"
          }`}>
            ✓ נרשמת
          </div>
        )}
      </div>

      {/* Slots grid */}
      <div className="p-3 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 auto-rows-fr">
        {slots.map((slot, i) => {
          const slotRegs = registrations.filter(r => r.time_slot === slot);
          const isRegistered = userRegistration?.time_slot === slot;
          return (
            <TimeSlotCard
              key={slot}
              index={i}
              slot={slot}
              breakType={type}
              registrations={slotRegs}
              onRegister={onRegister}
              isRegistered={isRegistered}
              isDisabled={hasRegistered && !isRegistered}
              maxPerSlot={maxPerSlot}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, UtensilsCrossed } from "lucide-react";

export default function MyRegistrations({
  lunchReg,
  shortReg,
  onCancel,
  canCancel = true,
}) {
  if (!lunchReg && !shortReg) return null;

  const cancelButton = (reg, variant) => {
    if (!canCancel || !onCancel) return null;
    const styles =
      variant === "short"
        ? "bg-white border border-purple-200 text-purple-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
        : "bg-white border border-indigo-200 text-indigo-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600";
    return (
      <button
        type="button"
        onClick={() => onCancel(reg.id)}
        className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${styles}`}
      >
        מחק
      </button>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5"
      >
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3 text-right">ההרשמות שלי היום</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <AnimatePresence>
            {shortReg && (
              <motion.div
                key="short"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex-1 flex items-center justify-between rounded-2xl bg-purple-50 border border-purple-100 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-md shadow-purple-500/20">
                    <Coffee className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-purple-400 text-xs">הפסקת 10</p>
                    <p className="text-slate-800 font-bold text-sm">{shortReg.time_slot}</p>
                  </div>
                </div>
                {cancelButton(shortReg, "short")}
              </motion.div>
            )}
            {lunchReg && (
              <motion.div
                key="lunch"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex-1 flex items-center justify-between rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
                    <UtensilsCrossed className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-indigo-400 text-xs">הפסקת צהריים</p>
                    <p className="text-slate-800 font-bold text-sm">{lunchReg.time_slot}</p>
                  </div>
                </div>
                {cancelButton(lunchReg, "lunch")}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

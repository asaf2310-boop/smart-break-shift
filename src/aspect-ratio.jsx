import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, UtensilsCrossed, X } from "lucide-react";

export default function MyRegistrations({ lunchReg, shortReg, onCancel }) {
  if (!lunchReg && !shortReg) return null;

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
                <button
                  onClick={() => onCancel(shortReg.id)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-red-100 hover:text-red-500 text-slate-400 flex items-center justify-center transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
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
                <button
                  onClick={() => onCancel(lunchReg.id)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-red-100 hover:text-red-500 text-slate-400 flex items-center justify-center transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
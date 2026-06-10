import React from "react";
import { motion } from "framer-motion";
import { Clock, User, Check, Lock } from "lucide-react";

export default function TimeSlotCard({
  slot,
  breakType,
  registrations,
  onRegister,
  isRegistered,
  isDisabled,
  isRegistering = false,
  registrationClosed = false,
  index,
  maxPerSlot = 1,
  canCancel = false,
  onCancel,
  isDeleting = false,
  myRegistration = null,
}) {
  const isLunch = breakType === "lunch";
  const capacity = Math.max(1, Number(maxPerSlot) || 1);
  const count = registrations.length;
  const isFull = count >= capacity;
  const isSlotClosed = isFull || registrationClosed;
  const canRegister =
    !isSlotClosed &&
    !isRegistered &&
    !isDisabled &&
    !isRegistering;

  const accentFrom = isLunch ? "from-indigo-500" : "from-purple-500";
  const accentTo = isLunch ? "to-blue-500" : "to-pink-500";
  const accentText = isLunch ? "text-indigo-300" : "text-purple-300";
  const accentBg = isLunch ? "bg-indigo-500/20" : "bg-purple-500/20";
  const accentBorder = isLunch ? "border-indigo-500/30" : "border-purple-500/30";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index }}
      className={`
        relative rounded-2xl border p-4 flex flex-col gap-3 transition-all duration-300 h-full
        ${isRegistered
          ? `border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md`
          : isSlotClosed
            ? "border-slate-100 bg-slate-50 opacity-50"
            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm cursor-pointer"
        }
      `}
    >
      {/* Time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className={`w-3.5 h-3.5 ${isRegistered ? accentText : "text-slate-400"}`} />
          <span className={`text-sm font-bold ${isRegistered ? accentText : "text-slate-700"}`}>{slot}</span>
        </div>

        {/* Occupancy counter */}
        <span className={`text-xs font-bold ${isFull ? "text-red-400" : "text-slate-400"}`}>
          {count}/{capacity}
        </span>
      </div>

      {/* Registered names + availability */}
      <div className="space-y-1 flex-1 min-w-0">
        {registrations.map((reg) => (
          <div key={reg.id ?? `${reg.agent_name}-${reg.time_slot}-${reg.created_at ?? ""}`} className="flex items-start gap-1.5 min-w-0">
            <User className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs sm:text-sm text-slate-700 font-semibold break-words">{reg.agent_name}</span>
          </div>
        ))}
        {!isSlotClosed && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-green-600 font-medium">
              {count === 0 ? "פנוי" : `עוד ${capacity - count} מקום`}
            </span>
          </div>
        )}
      </div>

      {/* Action */}
      {isRegistered ? (
        <div className="flex flex-col gap-2">
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${accentText} ${accentBg} ${accentBorder} border rounded-xl px-3 py-1.5 justify-center`}>
            <Check className="w-3.5 h-3.5" />
            <span>ההפסקה שלי</span>
          </div>
          {canCancel && onCancel && myRegistration?.id && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onCancel(myRegistration.id)}
              className="w-full py-1.5 rounded-xl text-xs font-semibold bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all"
            >
              {isDeleting ? "מוחק..." : "מחק ובחר מחדש"}
            </button>
          )}
        </div>
      ) : isSlotClosed ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-400 justify-center">
          <Lock className="w-3.5 h-3.5" />
          <span>{registrationClosed && !isFull ? "נסגר" : "מלא"}</span>
        </div>
      ) : (
        <button
          type="button"
          disabled={!canRegister}
          onClick={() => onRegister(slot)}
          className={`
            w-full py-1.5 rounded-xl text-xs font-semibold transition-all duration-200
            ${canRegister
              ? `bg-gradient-to-r ${accentFrom} ${accentTo} text-white shadow-md hover:shadow-lg hover:scale-[1.03] active:scale-[0.97]`
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }
          `}
        >
          {isRegistering
            ? "מעדכן..."
            : isDisabled
              ? "כבר נרשמת"
              : "הרשמה"}
        </button>
      )}
    </motion.div>
  );
}

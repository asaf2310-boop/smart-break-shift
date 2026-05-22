import React from "react";
import { PhoneCall, X } from "lucide-react";

const DIAL_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export default function SoftphoneDialPanel({
  number,
  onNumberChange,
  onDigit,
  onBackspace,
  onCall,
  onClose,
  callDisabled,
  isDemo,
}) {
  return (
    <div
      role="dialog"
      aria-label="לוח חיוג"
      className="pointer-events-auto w-[min(calc(100vw-2rem),320px)] min-w-[260px] flex flex-col bg-surface-container-lowest rounded-2xl border border-outline/20 shadow-elevation-3 overflow-hidden animate-in slide-in-from-bottom-2 fade-in-0 duration-200"
      dir="rtl"
    >
      <header className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-outline/15 bg-surface-container-low shrink-0">
        <p className="m3-label-large text-sm font-bold">סופטפון — חיוג יוצא</p>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-surface-container-high"
          aria-label="סגור לוח חיוג"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="p-4">
        <label className="m3-label-medium text-on-surface-variant mb-1 block">מספר</label>
        <input
          type="tel"
          value={number}
          onChange={(e) => onNumberChange(e.target.value)}
          placeholder="05X-XXXXXXX"
          dir="ltr"
          className="w-full rounded-xl border border-outline/30 bg-surface-container-low px-3 py-2.5 text-lg font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/40"
        />
        <div className="grid grid-cols-3 gap-2 mt-3" dir="ltr">
          {DIAL_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onDigit(key)}
              className="h-11 rounded-xl bg-surface-container-low border border-outline/15 text-lg font-semibold text-foreground hover:bg-surface-container-high active:scale-95 transition-transform"
            >
              {key}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-3 justify-between items-center">
          <button
            type="button"
            onClick={onBackspace}
            className="text-xs font-semibold text-on-surface-variant px-2 py-1 hover:text-foreground"
          >
            מחיקה
          </button>
          {isDemo && (
            <button
              type="button"
              onClick={onCall}
              disabled={callDisabled}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-l from-teal-600 to-emerald-600 text-white text-sm font-bold shadow-md shadow-teal-500/30 hover:opacity-95 disabled:opacity-40"
            >
              <PhoneCall className="w-4 h-4" />
              חיוג
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

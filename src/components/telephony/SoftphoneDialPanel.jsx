import React from "react";

export const DIAL_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

/** Compact numpad grid for inline use inside AgentTelephonySidebar */
export function SoftphoneDialGrid({ onDigit, compact = true }) {
  const btnClass = compact
    ? "h-9 rounded-lg bg-surface-container-low border border-outline/15 text-base font-semibold text-foreground hover:bg-surface-container-high active:scale-95 transition-transform"
    : "h-11 rounded-xl bg-surface-container-low border border-outline/15 text-lg font-semibold text-foreground hover:bg-surface-container-high active:scale-95 transition-transform";

  return (
    <div className="grid grid-cols-3 gap-1.5" dir="ltr">
      {DIAL_KEYS.map((key) => (
        <button key={key} type="button" onClick={() => onDigit(key)} className={btnClass}>
          {key}
        </button>
      ))}
    </div>
  );
}

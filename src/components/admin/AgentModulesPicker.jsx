import React from "react";
import { AGENT_MODULE_IDS, AGENT_MODULES } from "@/constants/agentModules";
import { cn } from "@/lib/utils";

export default function AgentModulesPicker({ value = [], onChange, className }) {
  const selected = new Set(value);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const selectAll = () => onChange([...AGENT_MODULE_IDS]);
  const clearAll = () => onChange([]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={selectAll}
          className="text-xs font-semibold text-violet-700 hover:text-violet-900"
        >
          בחר הכל
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={clearAll}
          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          נקה הכל
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {AGENT_MODULE_IDS.map((id) => (
          <label
            key={id}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-colors",
              selected.has(id)
                ? "border-violet-300 bg-violet-50 text-violet-950"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(id)}
              onChange={() => toggle(id)}
              className="rounded border-slate-300 text-violet-600"
            />
            <span>{AGENT_MODULES[id]?.label || id}</span>
          </label>
        ))}
      </div>
      {!selected.size && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          לא נבחרו מודולים — הנציג לא יראה כרטיסים בדף הבית (מלבד התנתקות).
        </p>
      )}
    </div>
  );
}

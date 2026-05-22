import {
  AGENT_TELEPHONY_STATUS,
  TELEPHONY_STATUS_SELECT_OPTIONS,
} from "@/lib/telephonyStore";
import { telephonyStatusDotClass } from "@/lib/telephonyStatus";

export default function TelephonyStatusPicker({
  value,
  onChange,
  disabled = false,
  selectId = "telephony-status-select",
}) {
  const current = AGENT_TELEPHONY_STATUS[value] || AGENT_TELEPHONY_STATUS.available;

  return (
    <div className="flex items-center gap-2 w-full">
      <span
        className={`w-2.5 h-2.5 shrink-0 rounded-full ${telephonyStatusDotClass(current.tone)}`}
        aria-hidden
      />
      <label htmlFor={selectId} className="sr-only">
        סטטוס טלפוניה
      </label>
      <select
        id={selectId}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="flex-1 h-10 rounded-xl border border-outline/30 bg-surface-container-lowest px-3 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
      >
        {TELEPHONY_STATUS_SELECT_OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

import { CHAT_STATUS, CHAT_STATUS_SELECT_OPTIONS } from "@/lib/agentChatPresence";
import { statusDotClass } from "@/lib/chatStatus";

/** בורר סטטוס: רק זמין/בהפסקה, בלי רקע ירוק */
export default function ChatStatusPicker({
  value,
  onChange,
  disabled = false,
  selectId = "chat-status-select",
  compact = false,
}) {
  const current = CHAT_STATUS[value] || CHAT_STATUS.available;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span
        className={`w-2 h-2 shrink-0 rounded-full ${statusDotClass(current.tone)}`}
        aria-hidden
      />
      <label htmlFor={selectId} className="sr-only">
        סטטוס
      </label>
      <select
        id={selectId}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 ${
          compact ? "h-7 min-w-[88px]" : "h-8 min-w-[108px]"
        }`}
      >
        {CHAT_STATUS_SELECT_OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

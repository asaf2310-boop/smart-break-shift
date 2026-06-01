import { Unplug } from "lucide-react";
import { CHAT_STATUS } from "@/lib/agentChatPresence";
import ChatStatusPicker from "@/components/chat/ChatStatusPicker";

/** בקרת סטטוס צ'אט לנציג — למנהל בלבד */
export default function AdminAgentChatControls({
  agent,
  presenceStatus,
  onStatusChange,
  onDisconnect,
  disabled = false,
}) {
  const isOffline = presenceStatus === CHAT_STATUS.offline.key;

  if (isOffline) {
    return (
      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onStatusChange(CHAT_STATUS.available.key)}
          disabled={disabled}
          className="h-7 px-2 rounded-md border border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
        >
          חבר
        </button>
      </div>
    );
  }

  const pickerValue =
    presenceStatus === CHAT_STATUS.break.key
      ? CHAT_STATUS.break.key
      : CHAT_STATUS.available.key;

  return (
    <div
      className="flex items-center gap-0.5 shrink-0"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <ChatStatusPicker
        selectId={`admin-chat-status-${agent}`}
        value={pickerValue}
        onChange={(e) => onStatusChange(e.target.value)}
        disabled={disabled}
        compact
      />
      <button
        type="button"
        onClick={onDisconnect}
        disabled={disabled}
        title="נתק נציג"
        aria-label={`נתק ${agent}`}
        className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
      >
        <Unplug className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

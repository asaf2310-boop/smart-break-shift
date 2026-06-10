<<<<<<< HEAD
import { CHAT_STATUS } from "@/lib/agentChatPresence";
import { statusDotClass } from "@/lib/chatStatus";

/** תווית סטטוס עם עיגול צבעוני (בלי רקע) */
export default function ChatStatusLabel({ status, className = "" }) {
  const resolved = typeof status === "string" ? CHAT_STATUS[status] : status;
  if (!resolved) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 ${className}`}>
      <span
        className={`w-2 h-2 shrink-0 rounded-full ${statusDotClass(resolved.tone)}`}
        aria-hidden
      />
      {resolved.label}
    </span>
  );
}
=======
import { CHAT_STATUS } from "@/lib/agentChatPresence";
import { statusDotClass } from "@/lib/chatStatus";

/** תווית סטטוס עם עיגול צבעוני (בלי רקע) */
export default function ChatStatusLabel({ status, className = "" }) {
  const resolved = typeof status === "string" ? CHAT_STATUS[status] : status;
  if (!resolved) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 ${className}`}>
      <span
        className={`w-2 h-2 shrink-0 rounded-full ${statusDotClass(resolved.tone)}`}
        aria-hidden
      />
      {resolved.label}
    </span>
  );
}
>>>>>>> 842dd9e (Initial commit)

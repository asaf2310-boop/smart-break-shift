import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useChatPanel } from "@/context/ChatPanelContext";
import InternalChatPanel from "@/components/chat/InternalChatPanel";

export default function ChatPanelOverlay() {
  const { open, closeChat } = useChatPanel();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeChat();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, closeChat]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4" dir="rtl">
      <button
        type="button"
        aria-label="סגור צ'אט"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        onClick={closeChat}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-panel-title"
        className="relative z-10 flex flex-col w-full sm:max-w-3xl lg:max-w-5xl max-h-[min(92vh,720px)] sm:max-h-[85vh] bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
      >
        <button
          type="button"
          onClick={closeChat}
          className="absolute left-3 top-3 z-20 w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
          aria-label="סגור"
        >
          <X className="w-5 h-5" />
        </button>
        <span id="chat-panel-title" className="sr-only">
          צ'אט פנימי
        </span>
        <InternalChatPanel />
      </div>
    </div>
  );
}

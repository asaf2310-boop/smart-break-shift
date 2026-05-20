import React, { useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import { useChatPanel } from "@/context/ChatPanelContext";
import InternalChatPanel from "@/components/chat/InternalChatPanel";

/** בועת צ'אט צפה — מופיעה בכל מסך, בלי טאב בסרגל */
export default function FloatingChatWidget() {
  const { open, toggleChat, closeChat } = useChatPanel();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeChat();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeChat]);

  return (
    <div className="fixed bottom-4 left-4 z-[90] flex flex-col items-start gap-3 pointer-events-none" dir="rtl">
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="צ'אט פנימי"
          className="pointer-events-auto w-[min(calc(100vw-2rem),400px)] h-[min(70vh,520px)] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 zoom-in-95 duration-200"
        >
          <InternalChatPanel />
        </div>
      )}

      <button
        type="button"
        onClick={toggleChat}
        aria-expanded={open}
        aria-label={open ? "סגור צ'אט" : "פתח צ'אט פנימי"}
        className="pointer-events-auto w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}

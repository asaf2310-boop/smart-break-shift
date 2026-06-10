import React, { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Minimize2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAgentFirstName } from "@/lib/agentDisplayName";
import { sendSessionChatMessage, loadSessionChatMessages } from "@/lib/supportSessionChat";
import { subscribeSupportSessionChat } from "@/lib/supportSessionChatStore";
import {
  cloudSupportSessionChatEnabled,
  subscribeCloudSessionChat,
} from "@/lib/supportSessionChatSync";

function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * צ'אט קטן בסשן תמיכה — נציג ↔ לקוח (לאחר אישור שיתוף מסך).
 */
export default function SessionSupportChat({
  sessionId,
  senderType = "agent",
  agentDisplayName = "",
  disabled = false,
  autoOpen = false,
  className = "",
}) {
  const agentFirstName = getAgentFirstName(agentDisplayName);
  const title =
    senderType === "guest" ? `צ'אט עם ${agentFirstName}` : "צ'אט עם הלקוח";

  const [open, setOpen] = useState(autoOpen);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const openedOnceRef = useRef(false);

  const refreshMessages = useCallback(async () => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    const list = await loadSessionChatMessages(sessionId);
    setMessages(list);
  }, [sessionId]);

  useEffect(() => {
    if (autoOpen && !openedOnceRef.current) {
      openedOnceRef.current = true;
      setOpen(true);
    }
  }, [autoOpen]);

  useEffect(() => {
    refreshMessages();
    const unsubLocal = subscribeSupportSessionChat(refreshMessages);
    const unsubCloud = subscribeCloudSessionChat(sessionId, () => {
      void refreshMessages();
    });
    return () => {
      unsubLocal();
      unsubCloud();
    };
  }, [sessionId, refreshMessages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !sessionId || disabled || sending) return;
    setSending(true);
    try {
      const label =
        senderType === "guest"
          ? "לקוח"
          : agentFirstName;
      await sendSessionChatMessage(sessionId, {
        senderType,
        senderLabel: label,
        body: text,
      });
      setDraft("");
      await refreshMessages();
    } finally {
      setSending(false);
    }
  };

  if (!sessionId) return null;

  if (!open) {
    return (
      <div className={className} dir="rtl">
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1.5 shadow-md bg-teal-600 hover:bg-teal-700 text-white"
          disabled={disabled}
        >
          <MessageCircle className="w-4 h-4" />
          {title}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ${className}`}
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-teal-50 px-3 py-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-teal-950 min-w-0">
          <MessageCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">{title}</span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          aria-label="מזער צ'אט"
          onClick={() => setOpen(false)}
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div
        ref={listRef}
        className="h-[min(180px,28vh)] overflow-y-auto px-3 py-2 space-y-2 bg-slate-50/80"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 leading-relaxed">
            {senderType === "guest"
              ? `שלחו הודעה ל${agentFirstName} — הצ'אט פתוח לכל אורך הסשן`
              : "שלחו הודעה ללקוח"}
            {!cloudSupportSessionChatEnabled() ? (
              <span className="block mt-1 text-[10px] text-slate-400">
                (מצב מקומי — לסנכרון בין מכשירים הריצו support_session_chat.sql)
              </span>
            ) : null}
          </p>
        ) : (
          messages.map((msg) => {
            const mine = msg.senderType === senderType;
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[92%] ${mine ? "items-start" : "items-end"}`}
              >
                <div
                  className={`rounded-2xl px-3 py-1.5 text-sm leading-relaxed break-words ${
                    mine
                      ? "bg-teal-600 text-white rounded-br-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
                  }`}
                >
                  {msg.body}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 px-1">
                  {!mine && msg.senderLabel ? `${msg.senderLabel} · ` : ""}
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t border-slate-100 p-2 bg-white"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="הקלידו הודעה…"
          disabled={disabled || sending}
          className="h-9 text-sm"
          maxLength={2000}
        />
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9 shrink-0 bg-teal-600 hover:bg-teal-700"
          disabled={disabled || sending || !draft.trim()}
          aria-label="שליחה"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}

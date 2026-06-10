import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageCircle, Send } from "lucide-react";
import { customerChatEnabled, demoModeEnabled } from "@/api/demoClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { m3PageClass } from "@/lib/hypPage";
import CustomerChatTypingIndicator from "@/components/customer-chat/CustomerChatTypingIndicator";
import { useGuestBotConversation } from "@/hooks/useGuestBotConversation";
import { getCustomerChatBotConfig } from "@/lib/customerChatBotConfig";
import { isIntroBotFlowComplete } from "@/lib/customerChatBotFlow";
import {
  buildGuestChatUrl,
  closeSession,
  createGuestSession,
  getSessionByToken,
  getSessionStatusLabel,
  listMessages,
  persistGuestToken,
  readPersistedGuestToken,
  sendGuestMessage,
  subscribeCustomerChatStore,
} from "@/lib/customerChatStore";

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function CustomerChatGuestPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token");
  const [token, setToken] = useState(() => tokenFromUrl || readPersistedGuestToken() || "");
  const [session, setSession] = useState(() => (token ? getSessionByToken(token) : null));
  const [messages, setMessages] = useState(() => (session ? listMessages(session.id) : []));
  const [guestName, setGuestName] = useState("");
  const [draft, setDraft] = useState("");
  const [starting, setStarting] = useState(false);
  const bottomRef = useRef(null);
  const { isBotTyping } = useGuestBotConversation(session);

  const refresh = useCallback(() => {
    if (!token) return;
    const nextSession = getSessionByToken(token);
    setSession(nextSession);
    if (nextSession) setMessages(listMessages(nextSession.id));
  }, [token]);

  useEffect(() => {
    if (tokenFromUrl && tokenFromUrl !== token) {
      setToken(tokenFromUrl);
      persistGuestToken(tokenFromUrl);
    }
  }, [tokenFromUrl, token]);

  useEffect(() => {
    if (!token) return;
    persistGuestToken(token);
    refresh();
    return subscribeCustomerChatStore(refresh);
  }, [token, refresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isBotTyping]);

  const handleStart = async (e) => {
    e.preventDefault();
    setStarting(true);
    try {
      const created = createGuestSession({ guestName });
      setToken(created.token);
      persistGuestToken(created.token);
      setSession(created);
      setMessages(listMessages(created.id));
      const url = buildGuestChatUrl(window.location.origin, created.token);
      window.history.replaceState(null, "", url);
    } finally {
      setStarting(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!token || !draft.trim()) return;
    sendGuestMessage(token, draft);
    setDraft("");
    refresh();
  };

  const handleClose = () => {
    if (!session) return;
    closeSession(session.id, { closedBy: "guest" });
    refresh();
  };

  const shellClass = m3PageClass("min-h-screen flex flex-col");
  const infoBanner = demoModeEnabled
    ? "דמו — צ'אט לקוחות. הנתונים נשמרים בדפדפן בלבד."
    : customerChatEnabled
      ? "צ'אט שירות — בדיקות בסביבת ניהול מוקד (נתונים בדפדפן זה)"
      : "צ'אט עם נציג שירות";

  if (!token || !session) {
    return (
      <div className={shellClass} dir="rtl">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md m3-card p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="m3-headline-small">צ'אט עם נציג</h1>
                <p className="m3-label-medium text-on-surface-variant text-sm">{infoBanner}</p>
              </div>
            </div>
            <form onSubmit={handleStart} className="space-y-4">
              <div>
                <label htmlFor="guest-name" className="m3-label-large block mb-1.5">
                  שם (אופציונלי)
                </label>
                <Input
                  id="guest-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="איך לפנות אליך?"
                  className="text-right"
                  autoComplete="name"
                />
              </div>
              <Button type="submit" className="w-full" disabled={starting}>
                {starting ? "פותח שיחה…" : "התחל צ'אט"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const canSend = session.status !== "closed";
  const statusLabel = getSessionStatusLabel(session.status);
  const introComplete = isIntroBotFlowComplete(session.id);
  const needsMerchantRef =
    introComplete &&
    !session.merchant_ref &&
    getCustomerChatBotConfig().beforeAgent.length > 0;
  const inputPlaceholder = !introComplete || isBotTyping
    ? "ממתין להודעה מהבוט…"
    : needsMerchantRef
      ? "הזינו מספר מסוף או ח.פ…"
      : session.status === "waiting"
        ? "כתבו הודעה בזמן ההמתנה…"
        : "הודעה לנציג…";

  return (
    <div className={shellClass} dir="rtl">
      <header className="sticky top-0 z-10 border-b border-outline/15 bg-surface/95 backdrop-blur-sm px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="m3-title-medium truncate">צ'אט שירות</h1>
            <p className="text-xs text-on-surface-variant">
              {session.guest_name}
              {session.assigned_agent ? ` · ${session.assigned_agent}` : ""}
            </p>
          </div>
          <span
            className={`text-xs font-semibold rounded-full px-2.5 py-1 shrink-0 ${
              session.status === "active"
                ? "bg-emerald-100 text-emerald-800"
                : session.status === "waiting"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {statusLabel}
          </span>
        </div>
        {(demoModeEnabled || customerChatEnabled) && (
          <p className="max-w-lg mx-auto text-[10px] text-on-surface-variant mt-1">{infoBanner}</p>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-lg mx-auto space-y-3">
          {messages.map((msg) => {
            const isGuest = msg.sender_type === "guest";
            const isBot = msg.sender_type === "bot";
            const isSystem = msg.sender_type === "system";
            if (isSystem) {
              return (
                <p key={msg.id} className="text-center text-xs text-on-surface-variant py-1">
                  {msg.body}
                </p>
              );
            }
            if (isBot) {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="customer-chat-bubble customer-chat-bubble--staff max-w-[85%] rounded-2xl rounded-bl-md px-3 py-2 text-sm">
                    <span className="customer-chat-bubble__badge">בוט</span>
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    <p className="customer-chat-bubble__time">{formatTime(msg.created_at)}</p>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={msg.id}
                className={`flex ${isGuest ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`customer-chat-bubble max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    isGuest
                      ? "customer-chat-bubble--guest rounded-br-md"
                      : "customer-chat-bubble--staff rounded-bl-md"
                  }`}
                >
                  {!isGuest && msg.sender_name && (
                    <p className="text-[10px] opacity-80 mb-0.5">{msg.sender_name}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  <p className="customer-chat-bubble__time">
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          {isBotTyping && <CustomerChatTypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="border-t border-outline/15 bg-surface p-4">
        <div className="max-w-lg mx-auto space-y-2">
          {canSend ? (
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={inputPlaceholder}
                className="flex-1 text-right"
                autoComplete="off"
                disabled={isBotTyping}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!draft.trim() || isBotTyping}
                aria-label="שליחה"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-sm text-on-surface-variant">השיחה הסתיימה. תודה שפניתם אלינו.</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  persistGuestToken("");
                  setToken("");
                  setSession(null);
                  setMessages([]);
                  window.history.replaceState(null, "", buildGuestChatUrl(window.location.origin));
                }}
              >
                צ'אט חדש
              </Button>
            </div>
          )}
          {canSend && (
            <button
              type="button"
              onClick={handleClose}
              className="text-xs text-on-surface-variant hover:underline w-full text-center"
            >
              סיום שיחה
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

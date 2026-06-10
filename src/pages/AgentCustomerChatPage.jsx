import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Send, Users } from "lucide-react";
import { getStoredAgentName } from "@/constants/scheduling";
import ChatStatusPicker from "@/components/chat/ChatStatusPicker";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { hypHeaderIconClass } from "@/lib/hypPage";
import {
  CHAT_STATUS,
  connectAgentAsAvailable,
  setAgentStatus,
} from "@/lib/agentChatPresence";
import { resolveAgentStatus } from "@/lib/chatStatus";
import { getChatEntities } from "@/api/localChatStore";
import {
  acceptSession,
  buildGuestChatUrl,
  closeSession,
  getSessionStatusLabel,
  listActiveSessions,
  listAvailableAgents,
  listMessages,
  listWaitingSessions,
  sendAgentMessage,
  subscribeCustomerChatStore,
} from "@/lib/customerChatStore";

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function SessionListItem({ session, active, onSelect, action }) {
  return (
    <div
      className={`m3-card px-3 py-2.5 flex items-center gap-2 ${
        active ? "ring-2 ring-primary/40 border-primary/30" : ""
      }`}
    >
      <button type="button" onClick={() => onSelect(session.id)} className="flex-1 min-w-0 text-right">
        <p className="m3-label-large truncate">{session.guest_name || "אורח"}</p>
        <p className="text-xs text-on-surface-variant">
          {getSessionStatusLabel(session.status)}
          {session.merchant_ref ? ` · מסוף/ח.פ: ${session.merchant_ref}` : ""}
          {session.assigned_agent ? ` · ${session.assigned_agent}` : ""}
        </p>
      </button>
      {action}
    </div>
  );
}

export default function AgentCustomerChatPage() {
  const agentName = getStoredAgentName();
  const { toast } = useToast();
  const [waiting, setWaiting] = useState([]);
  const [activeMine, setActiveMine] = useState([]);
  const [availableAgents, setAvailableAgents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [agentStatus, setAgentStatusState] = useState(CHAT_STATUS.available.key);
  const bottomRef = useRef(null);

  const refresh = useCallback(async () => {
    setWaiting(listWaitingSessions());
    setActiveMine(listActiveSessions({ agentName }));
    setAvailableAgents(await listAvailableAgents());
    const chatEntities = getChatEntities();
    if (chatEntities && agentName) {
      const rows = await chatEntities.ChatPresence.filter({ agent_name: agentName });
      const row = rows[0];
      if (row?.status) setAgentStatusState(resolveAgentStatus(row).key);
    }
  }, [agentName]);

  useEffect(() => {
    if (agentName) connectAgentAsAvailable(agentName).catch(() => {});
  }, [agentName]);

  useEffect(() => {
    refresh();
    return subscribeCustomerChatStore(() => {
      refresh();
    });
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return undefined;
    }
    const updateMessages = () => setMessages(listMessages(selectedId));
    updateMessages();
    return subscribeCustomerChatStore(updateMessages);
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedId]);

  const selectedSession =
    [...waiting, ...activeMine].find((s) => s.id === selectedId) ||
    listActiveSessions().find((s) => s.id === selectedId);

  const handleStatusChange = async (e) => {
    const next = e.target.value;
    setAgentStatusState(next);
    if (!agentName) return;
    await setAgentStatus(agentName, next);
    refresh();
  };

  const handleGoAvailable = async () => {
    if (!agentName) return;
    await connectAgentAsAvailable(agentName);
    setAgentStatusState(CHAT_STATUS.available.key);
    refresh();
    toast({ title: "סטטוס: זמין לצ'אט" });
  };

  const handleAccept = async (sessionId) => {
    if (!agentName) return;
    const accepted = await acceptSession(sessionId, agentName);
    if (!accepted) {
      toast({ title: "לא ניתן לקבל את השיחה", variant: "destructive" });
      return;
    }
    setSelectedId(sessionId);
    refresh();
    toast({ title: "השיחה התחילה" });
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!selectedId || !draft.trim() || !agentName) return;
    sendAgentMessage(selectedId, agentName, draft);
    setDraft("");
    setMessages(listMessages(selectedId));
    refresh();
  };

  const handleClose = () => {
    if (!selectedId) return;
    closeSession(selectedId, { closedBy: agentName });
    setSelectedId(null);
    refresh();
    toast({ title: "השיחה נסגרה" });
  };

  const guestLink = typeof window !== "undefined" ? buildGuestChatUrl(window.location.origin) : "/chat/guest";

  if (!agentName) {
    return (
      <HypPageLayout>
        <div className="max-w-md mx-auto p-6 text-center m3-card mt-8">
          <p className="m3-label-medium mb-4">יש להתחבר כנציג כדי לנהל צ'אט לקוחות.</p>
          <Link to="/" className="text-primary font-medium text-sm hover:underline">
            חזרה לדף הבית
          </Link>
        </div>
      </HypPageLayout>
    );
  }

  return (
    <HypPageLayout contentClassName="max-w-6xl mx-auto px-4 pb-8">
      <header className="flex flex-wrap items-center gap-3 mb-6">
        <Link to="/" className="m3-icon-button rounded-full" aria-label="חזרה">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className={hypHeaderIconClass()}>
          <MessageCircle className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="m3-headline-small">צ'אט לקוחות</h1>
          <p className="m3-label-medium text-on-surface-variant text-sm">
            תור המתנה · שיחות פעילות · {agentName}
          </p>
        </div>
        <ChatStatusPicker value={agentStatus} onChange={handleStatusChange} />
        {agentStatus !== CHAT_STATUS.available.key && (
          <Button type="button" size="sm" variant="outline" onClick={handleGoAvailable}>
            זמין/ה
          </Button>
        )}
      </header>

      <div className="m3-card px-4 py-3 mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Users className="w-4 h-4 text-primary shrink-0" />
        <span className="text-on-surface-variant">נציגים זמינים:</span>
        <span className="font-semibold">
          {availableAgents.length
            ? availableAgents.map((a) => a.agent_name).join(" · ")
            : "אין — עברו ל«זמין»"}
        </span>
        <span className="text-on-surface-variant mr-auto text-xs" dir="ltr">
          {guestLink}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(guestLink);
              toast({ title: "קישור ללקוח הועתק" });
            } catch {
              toast({ title: "לא ניתן להעתיק", variant: "destructive" });
            }
          }}
        >
          העתק קישור ללקוח
        </Button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
        <div className="space-y-4">
          <section>
            <h2 className="m3-title-small mb-2">ממתינים ({waiting.length})</h2>
            <div className="space-y-2">
              {waiting.length === 0 ? (
                <p className="text-sm text-on-surface-variant m3-card px-3 py-4 text-center">
                  אין לקוחות בתור
                </p>
              ) : (
                waiting.map((session) => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    active={selectedId === session.id}
                    onSelect={setSelectedId}
                    action={
                      <Button type="button" size="sm" onClick={() => handleAccept(session.id)}>
                        קבל
                      </Button>
                    }
                  />
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="m3-title-small mb-2">השיחות שלי ({activeMine.length})</h2>
            <div className="space-y-2">
              {activeMine.length === 0 ? (
                <p className="text-sm text-on-surface-variant m3-card px-3 py-4 text-center">
                  אין שיחות פעילות
                </p>
              ) : (
                activeMine.map((session) => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    active={selectedId === session.id}
                    onSelect={setSelectedId}
                  />
                ))
              )}
            </div>
          </section>
        </div>

        <div className="m3-card flex flex-col min-h-[24rem] lg:min-h-[32rem]">
          {!selectedSession ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-on-surface-variant text-sm">
              בחרו לקוח מהתור או מהשיחות הפעילות
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-outline/15 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="m3-label-large truncate">{selectedSession.guest_name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {getSessionStatusLabel(selectedSession.status)}
                    {selectedSession.merchant_ref ? ` · מסוף/ח.פ: ${selectedSession.merchant_ref}` : ""}
                  </p>
                </div>
                {selectedSession.status === "active" && selectedSession.assigned_agent === agentName && (
                  <Button type="button" size="sm" variant="outline" onClick={handleClose}>
                    סגור שיחה
                  </Button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((msg) => {
                  const isAgent = msg.sender_type === "agent";
                  const isBot = msg.sender_type === "bot";
                  const isSystem = msg.sender_type === "system";
                  if (isSystem) {
                    return (
                      <p key={msg.id} className="text-center text-xs text-on-surface-variant">
                        {msg.body}
                      </p>
                    );
                  }
                  if (isBot) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <div className="customer-chat-bubble customer-chat-bubble--staff max-w-[85%] rounded-2xl px-3 py-2 text-sm">
                          <span className="customer-chat-bubble__badge">בוט</span>
                          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                          <p className="customer-chat-bubble__time">{formatTime(msg.created_at)}</p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className={`flex ${isAgent ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`customer-chat-bubble max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          isAgent
                            ? "customer-chat-bubble--staff rounded-br-md"
                            : "customer-chat-bubble--guest rounded-bl-md"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        <p className="customer-chat-bubble__time">{formatTime(msg.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              {selectedSession.status === "active" && selectedSession.assigned_agent === agentName ? (
                <form onSubmit={handleSend} className="p-3 border-t border-outline/15 flex gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="תשובה ללקוח…"
                    className="flex-1 text-right"
                    autoComplete="off"
                  />
                  <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="שליחה">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              ) : selectedSession.status === "waiting" ? (
                <div className="p-3 border-t border-outline/15">
                  <Button type="button" className="w-full" onClick={() => handleAccept(selectedSession.id)}>
                    קבל שיחה
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </HypPageLayout>
  );
}

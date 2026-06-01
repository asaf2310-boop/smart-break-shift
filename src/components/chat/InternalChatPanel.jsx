import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send, X } from "lucide-react";
import ChatBrandingAvatar from "@/components/chat/ChatBrandingAvatar";
import ChatBrandingEditor from "@/components/chat/ChatBrandingEditor";
import { useChatBranding } from "@/hooks/useChatBranding";
import { dataClient } from "@/api/client";
import { getChatEntities, isLocalChatStore } from "@/api/localChatStore";
import { demoModeEnabled } from "@/api/demoClient";
import { getAgentNamesList, getStoredAgentName } from "@/constants/scheduling";
import { getLiveQueryOptions } from "@/lib/liveQuery";
import { resolveAgentStatus, statusDotClass } from "@/lib/chatStatus";
import {
  CHAT_STATUS,
  connectAgentAsAvailable,
  isAgentChatConnected,
  setAgentStatus,
} from "@/lib/agentChatPresence";
import ChatStatusLabel from "@/components/chat/ChatStatusLabel";
import ChatStatusPicker from "@/components/chat/ChatStatusPicker";
import AdminAgentChatControls from "@/components/chat/AdminAgentChatControls";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useChatUnread } from "@/hooks/useChatUnread";
import { useChatPanel } from "@/context/ChatPanelContext";
import { useToast } from "@/components/ui/use-toast";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

const CHAT_AGENTS_SPLIT_ID = "smart-break-shift-chat-agents-split";

/** ~200px chat min at 320px widget; scales with panel width */
const CHAT_PANEL_MIN_SIZE = 40;
/** ~100px agents min at 320px */
const AGENTS_PANEL_MIN_SIZE = 31;
/** ~280px agents max at 520px wide widget */
const AGENTS_PANEL_MAX_SIZE = 54;
const AGENTS_PANEL_DEFAULT_SIZE = 28;

const sessionStoragePanelStorage = {
  getItem: (name) => {
    try {
      return sessionStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      sessionStorage.setItem(name, value);
    } catch {
      /* quota / private mode */
    }
  },
};

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export default function InternalChatPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { open } = useChatPanel();
  const { clearGeneralUnread, clearDmUnread } = useChatUnread();
  const agentName = getStoredAgentName();
  const isAdmin = useIsAdmin();
  const { effective: chatBranding } = useChatBranding();
  const [activeConversation, setActiveConversation] = useState(null);
  const [openDmTabs, setOpenDmTabs] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [chatConnected, setChatConnected] = useState(() => isAgentChatConnected());

  const isGeneral = activeConversation === null;

  const openDmWith = (agent) => {
    if (!agent || agent === agentName) return;
    setOpenDmTabs((prev) => (prev.includes(agent) ? prev : [...prev, agent]));
    setActiveConversation(agent);
  };

  const closeDmTab = (agent) => {
    setOpenDmTabs((prev) => {
      const idx = prev.indexOf(agent);
      const next = prev.filter((name) => name !== agent);
      setActiveConversation((current) => {
        if (current !== agent) return current;
        return idx > 0 ? next[idx - 1] : null;
      });
      return next;
    });
  };

  useEffect(() => {
    const onConnection = () => setChatConnected(isAgentChatConnected());
    window.addEventListener("agent-chat-connection", onConnection);
    return () => window.removeEventListener("agent-chat-connection", onConnection);
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const chatEntities = getChatEntities() || dataClient.entities;
  const localChat = isLocalChatStore();
  useEffect(() => {
    if (!open) return;
    if (isGeneral) clearGeneralUnread();
    else clearDmUnread(activeConversation);
  }, [open, isGeneral, activeConversation, clearGeneralUnread, clearDmUnread]);

  const { data: allMessages = [] } = useQuery({
    queryKey: ["chat-messages", localChat ? "local" : "remote"],
    queryFn: () => chatEntities.ChatMessage.list("-created_at", 400),
    ...getLiveQueryOptions(),
    enabled: Boolean(agentName),
  });

  const { data: presences = [] } = useQuery({
    queryKey: ["chat-presence", localChat ? "local" : "remote"],
    queryFn: () => chatEntities.ChatPresence.list("-updated_at", 100),
    ...getLiveQueryOptions(),
    enabled: Boolean(agentName),
  });

  const { data: todayBreaks = [] } = useQuery({
    queryKey: ["chat-break-status", todayStr],
    queryFn: () => dataClient.entities.BreakRegistration.filter({ date: todayStr }),
    ...getLiveQueryOptions(),
    enabled: Boolean(agentName),
  });

  const presenceMap = useMemo(
    () => new Map(presences.map((row) => [row.agent_name, row])),
    [presences]
  );

  const myPresence = presenceMap.get(agentName);
  const myStatusKey = useMemo(() => {
    if (!chatConnected) return CHAT_STATUS.offline.key;
    if (myPresence?.status === CHAT_STATUS.break.key) return CHAT_STATUS.break.key;
    if (myPresence?.status === CHAT_STATUS.offline.key) return CHAT_STATUS.offline.key;
    return CHAT_STATUS.available.key;
  }, [myPresence, presences, chatConnected]);

  const statusMutation = useMutation({
    mutationFn: (statusKey) => setAgentStatus(agentName, statusKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-presence"] });
    },
    onError: () => {
      toast({ title: "שגיאה", description: "לא ניתן לעדכן סטטוס" });
    },
  });

  const connectMutation = useMutation({
    mutationFn: () => connectAgentAsAvailable(agentName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-presence"] });
    },
    onError: () => {
      toast({ title: "שגיאה", description: "לא ניתן להתחבר מחדש" });
    },
  });

  const handleStatusChange = (e) => {
    statusMutation.mutate(e.target.value);
  };

  const handleDisconnect = () => {
    statusMutation.mutate(CHAT_STATUS.offline.key);
  };

  const adminStatusMutation = useMutation({
    mutationFn: ({ targetAgent, statusKey }) => setAgentStatus(targetAgent, statusKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-presence"] });
    },
    onError: () => {
      toast({ title: "שגיאה", description: "לא ניתן לעדכן סטטוס נציג" });
    },
  });

  const visibleMessages = useMemo(() => {
    if (isGeneral) {
      return allMessages
        .filter((msg) => !msg.recipient_name)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    return allMessages
      .filter((msg) => {
        const isOutgoing =
          msg.sender_name === agentName && msg.recipient_name === activeConversation;
        const isIncoming =
          msg.sender_name === activeConversation && msg.recipient_name === agentName;
        return isOutgoing || isIncoming;
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [isGeneral, allMessages, agentName, activeConversation]);

  const sendMutation = useMutation({
    mutationFn: (payload) => chatEntities.ChatMessage.create(payload),
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
    onError: () => {
      toast({ title: "שגיאה", description: "לא ניתן לשלוח הודעה כרגע" });
    },
  });

  const handleSend = () => {
    const body = messageText.trim();
    if (!body || !agentName) return;
    if (!isGeneral && !activeConversation) return;
    sendMutation.mutate({
      sender_name: agentName,
      recipient_name: isGeneral ? null : activeConversation,
      body,
      created_at: new Date().toISOString(),
    });
  };

  const conversationTitle = isGeneral ? "צ'אט כללי" : `שיחה עם ${activeConversation}`;

  if (!agentName) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center" dir="rtl">
        <MessageCircle className="w-12 h-12 text-indigo-300 mb-4" />
        <p className="text-slate-600 font-semibold mb-3">יש לבחור שם נציג כדי להשתמש בצ'אט</p>
        <Link to="/" className="m3-btn-tonal">
          מעבר לדף הבית
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden" dir="rtl">
      <header className="px-4 py-3 sm:px-5 border-b border-outline/20 bg-surface-container-low flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap shadow-elevation-1">
        <ChatBrandingAvatar imageUrl={chatBranding.imageUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <h2 className="m3-label-large text-base sm:text-lg">{chatBranding.displayName}</h2>
          <p className="m3-label-medium truncate">{conversationTitle}</p>
        </div>
        {isAdmin ? <ChatBrandingEditor variant="header" /> : null}
        <div className="flex items-center gap-1.5 shrink-0">
          {myStatusKey === CHAT_STATUS.offline.key ? (
            <>
              <ChatStatusLabel status={CHAT_STATUS.offline} />
              <button
                type="button"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="h-8 px-3 rounded-full m3-btn-tonal text-[11px] py-0 shadow-none"
              >
                התחבר
              </button>
            </>
          ) : (
            <>
              <ChatStatusPicker
                value={myStatusKey}
                onChange={handleStatusChange}
                disabled={statusMutation.isPending}
              />
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={statusMutation.isPending}
                className="h-8 px-3 rounded-full m3-btn-outlined text-[11px] py-0"
              >
                התנתק
              </button>
            </>
          )}
        </div>
        {localChat && (
          <span className="w-full sm:w-auto m3-badge text-[10px]">
            {demoModeEnabled ? "דמו פעיל" : "צ'אט מקומי (טסט)"}
          </span>
        )}
      </header>

      <ResizablePanelGroup
        direction="horizontal"
        dir="ltr"
        autoSaveId={CHAT_AGENTS_SPLIT_ID}
        storage={sessionStoragePanelStorage}
        className="flex flex-1 min-h-0 min-w-0 overflow-hidden"
      >
        <ResizablePanel
          id="chat-messages"
          order={1}
          defaultSize={100 - AGENTS_PANEL_DEFAULT_SIZE}
          minSize={CHAT_PANEL_MIN_SIZE}
          className="flex flex-col min-h-0 min-w-0 overflow-hidden"
        >
        <section className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden p-3 sm:p-4" dir="rtl">
          <div
            className="flex items-center gap-1 mb-2 shrink-0 overflow-x-auto pb-0.5"
            role="tablist"
            aria-label="שיחות פתוחות"
          >
            <button
              type="button"
              role="tab"
              aria-selected={isGeneral}
              onClick={() => setActiveConversation(null)}
              className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                isGeneral
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              כללי
            </button>
            {openDmTabs.map((peer) => {
              const isActive = activeConversation === peer;
              return (
                <div
                  key={peer}
                  className={`shrink-0 inline-flex items-center gap-0.5 pl-2.5 pr-1 py-1 rounded-full text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveConversation(peer)}
                    className="truncate max-w-[7rem]"
                  >
                    {peer}
                  </button>
                  <button
                    type="button"
                    onClick={() => closeDmTab(peer)}
                    aria-label={`סגור שיחה עם ${peer}`}
                    className={`p-0.5 rounded-full hover:bg-black/10 ${
                      isActive ? "text-white/90" : "text-slate-500"
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 rounded-2xl border border-slate-100 bg-slate-50 p-3 overflow-y-auto space-y-2">
            {visibleMessages.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-10">אין עדיין הודעות בחדר הזה</div>
            ) : (
              visibleMessages.map((msg) => {
                const mine = msg.sender_name === agentName;
                return (
                  <div key={msg.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                        mine ? "bg-indigo-500 text-white" : "bg-white border border-slate-200 text-slate-700"
                      }`}
                    >
                      <div className="text-[11px] opacity-80 mb-0.5">
                        {msg.sender_name} · {formatTime(msg.created_at)}
                      </div>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-3 flex gap-2 shrink-0">
            <textarea
              rows={2}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                isGeneral
                  ? "כתוב הודעה לכל הנציגים..."
                  : `הודעה ל-${activeConversation}...`
              }
              className="flex-1 rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400 resize-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sendMutation.isPending}
              aria-label="שלח"
              title="שלח"
              className="shrink-0 self-end flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white disabled:opacity-50"
            >
              <Send className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </section>
        </ResizablePanel>

        <ResizableHandle
          withHandle
          className="w-2 bg-slate-50 border-x border-slate-100 shrink-0"
          hitAreaMargins={{ coarse: 12, fine: 6 }}
        />

        <ResizablePanel
          id="agents-list"
          order={2}
          defaultSize={AGENTS_PANEL_DEFAULT_SIZE}
          minSize={AGENTS_PANEL_MIN_SIZE}
          maxSize={AGENTS_PANEL_MAX_SIZE}
          className="flex flex-col min-h-0 min-w-0 overflow-hidden"
        >
        <aside
          className="flex flex-1 flex-col min-h-0 overflow-hidden p-3 sm:p-4"
          dir="rtl"
        >
          <h3 className="text-xs font-bold text-slate-500 mb-2 shrink-0">סטטוס נציגים</h3>
          {isAdmin ? (
            <p className="text-[10px] font-bold text-indigo-600 mb-2 shrink-0">ניהול סטטוס (מנהל)</p>
          ) : null}
          <div className="space-y-1 flex-1 min-h-0 overflow-y-auto pr-1">
            {getAgentNamesList().map((agent) => {
              const status = resolveAgentStatus(agent, presenceMap, todayBreaks);
              const presenceStatus = presenceMap.get(agent)?.status ?? CHAT_STATUS.offline.key;
              const isSelf = agent === agentName;
              const isActiveDm = activeConversation === agent;
              const showAdminControls = isAdmin && !isSelf;
              const rowClass = `w-full rounded-lg px-2 py-1.5 transition-colors ${
                isSelf
                  ? "opacity-50"
                  : isActiveDm
                    ? "bg-indigo-50 ring-1 ring-indigo-200"
                    : "hover:bg-slate-50"
              }`;

              const agentIdentity = (
                <>
                  <span
                    className={`w-2 h-2 shrink-0 rounded-full ${statusDotClass(status.tone)}`}
                    aria-label={status.label}
                    title={status.label}
                  />
                  <span className="text-xs font-semibold text-slate-700 truncate">{agent}</span>
                </>
              );

              if (!showAdminControls) {
                return (
                  <button
                    key={agent}
                    type="button"
                    disabled={isSelf}
                    onClick={() => !isSelf && openDmWith(agent)}
                    className={`${rowClass} flex items-center justify-start gap-1.5 text-right ${
                      isSelf ? "cursor-default" : ""
                    }`}
                  >
                    {agentIdentity}
                  </button>
                );
              }

              return (
                <div key={agent} className={`${rowClass} flex items-center justify-between gap-1`}>
                  <button
                    type="button"
                    onClick={() => openDmWith(agent)}
                    className="flex items-center justify-start gap-1.5 min-w-0 flex-1 text-right"
                  >
                    {agentIdentity}
                  </button>
                  <AdminAgentChatControls
                    agent={agent}
                    presenceStatus={presenceStatus}
                    disabled={adminStatusMutation.isPending}
                    onStatusChange={(statusKey) =>
                      adminStatusMutation.mutate({ targetAgent: agent, statusKey })
                    }
                    onDisconnect={() =>
                      adminStatusMutation.mutate({
                        targetAgent: agent,
                        statusKey: CHAT_STATUS.offline.key,
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

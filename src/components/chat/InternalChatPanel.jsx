import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { dataClient } from "@/api/client";
import { getChatEntities, useLocalChatStore } from "@/api/localChatStore";
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
  const [dmPeer, setDmPeer] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [chatConnected, setChatConnected] = useState(() => isAgentChatConnected());

  useEffect(() => {
    const onConnection = () => setChatConnected(isAgentChatConnected());
    window.addEventListener("agent-chat-connection", onConnection);
    return () => window.removeEventListener("agent-chat-connection", onConnection);
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const chatEntities = getChatEntities() || dataClient.entities;
  const localChat = useLocalChatStore();
  const isGeneral = dmPeer === null;

  useEffect(() => {
    if (!open) return;
    if (isGeneral) clearGeneralUnread();
    else clearDmUnread(dmPeer);
  }, [open, isGeneral, dmPeer, clearGeneralUnread, clearDmUnread]);

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
        const isOutgoing = msg.sender_name === agentName && msg.recipient_name === dmPeer;
        const isIncoming = msg.sender_name === dmPeer && msg.recipient_name === agentName;
        return isOutgoing || isIncoming;
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [isGeneral, allMessages, agentName, dmPeer]);

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
    if (!isGeneral && !dmPeer) return;
    sendMutation.mutate({
      sender_name: agentName,
      recipient_name: isGeneral ? null : dmPeer,
      body,
      created_at: new Date().toISOString(),
    });
  };

  const conversationTitle = isGeneral ? "צ'אט כללי" : `שיחה עם ${dmPeer}`;

  if (!agentName) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center" dir="rtl">
        <MessageCircle className="w-12 h-12 text-indigo-300 mb-4" />
        <p className="text-slate-600 font-semibold mb-3">יש לבחור שם נציג כדי להשתמש בצ'אט</p>
        <Link
          to="/"
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
        >
          מעבר לדף הבית
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0" dir="rtl">
      <div className="px-4 py-3 sm:px-5 border-b border-slate-100 flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0">
          <MessageCircle className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-800">צ'אט פנימי</h2>
          <p className="text-[11px] text-slate-500 truncate">{conversationTitle}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {myStatusKey === CHAT_STATUS.offline.key ? (
            <>
              <ChatStatusLabel status={CHAT_STATUS.offline} />
              <button
                type="button"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="h-8 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 whitespace-nowrap"
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
                className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50 whitespace-nowrap"
              >
                התנתק
              </button>
            </>
          )}
        </div>
        {localChat && (
          <span className="w-full sm:w-auto inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200">
            {demoModeEnabled ? "דמו פעיל" : "צ'אט מקומי (טסט)"}
          </span>
        )}
      </div>

      <div
        className="grid grid-rows-[auto_1fr] lg:grid-rows-none flex-1 min-h-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_240px]"
        dir="ltr"
      >
        <section className="order-2 lg:order-none p-3 sm:p-4 flex flex-col min-h-0 flex-1" dir="rtl">
          <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
            <h3 className="text-sm font-extrabold text-slate-800">{conversationTitle}</h3>
            {!isGeneral && (
              <button
                type="button"
                onClick={() => setDmPeer(null)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
              >
                חזרה לכללי
              </button>
            )}
          </div>

          <div className="flex-1 min-h-[200px] lg:min-h-0 rounded-2xl border border-slate-100 bg-slate-50 p-3 overflow-y-auto space-y-2">
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
                isGeneral ? "כתוב הודעה לכל הנציגים..." : `הודעה ל-${dmPeer}...`
              }
              className="flex-1 rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400 resize-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="shrink-0 self-end h-11 px-4 rounded-2xl bg-indigo-600 text-white font-bold text-sm disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1.5">
                שלח
                <Send className="w-4 h-4" />
              </span>
            </button>
          </div>
        </section>

        <aside
          className="order-1 lg:order-none border-b lg:border-b-0 lg:border-l border-slate-100 p-3 sm:p-4 shrink-0 lg:shrink lg:overflow-y-auto max-h-[28vh] lg:max-h-none"
          dir="rtl"
        >
          <h3 className="text-xs font-bold text-slate-500 mb-0.5">סטטוס נציגים</h3>
          {isAdmin && (
            <p className="text-[10px] font-bold text-indigo-600 mb-2">ניהול סטטוס (מנהל)</p>
          )}
          <div className="space-y-1 max-h-32 lg:max-h-48 overflow-y-auto pr-1">
            {getAgentNamesList().map((agent) => {
              const status = resolveAgentStatus(agent, presenceMap, todayBreaks);
              const presenceStatus = presenceMap.get(agent)?.status ?? CHAT_STATUS.offline.key;
              const isSelf = agent === agentName;
              const isActiveDm = dmPeer === agent;
              const rowClass = `w-full rounded-lg px-2 py-1.5 transition-colors ${
                isSelf
                  ? "opacity-50"
                  : isActiveDm
                    ? "bg-indigo-50 ring-1 ring-indigo-200"
                    : "hover:bg-slate-50"
              }`;

              if (!isAdmin || isSelf) {
                return (
                  <button
                    key={agent}
                    type="button"
                    disabled={isSelf}
                    onClick={() => !isSelf && setDmPeer(agent)}
                    className={`${rowClass} flex items-center justify-start gap-1.5 text-right ${
                      isSelf ? "cursor-default" : ""
                    }`}
                  >
                    <span
                      className={`w-2 h-2 shrink-0 rounded-full ${statusDotClass(status.tone)}`}
                      aria-label={status.label}
                      title={status.label}
                    />
                    <span className="text-xs font-semibold text-slate-700 truncate">{agent}</span>
                  </button>
                );
              }

              return (
                <div key={agent} className={`${rowClass} flex items-center justify-between gap-1`}>
                  <button
                    type="button"
                    onClick={() => setDmPeer(agent)}
                    className="flex items-center justify-start gap-1.5 min-w-0 flex-1 text-right"
                  >
                    <span
                      className={`w-2 h-2 shrink-0 rounded-full ${statusDotClass(status.tone)}`}
                      aria-label={status.label}
                      title={status.label}
                    />
                    <span className="text-xs font-semibold text-slate-700 truncate">{agent}</span>
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
      </div>
    </div>
  );
}

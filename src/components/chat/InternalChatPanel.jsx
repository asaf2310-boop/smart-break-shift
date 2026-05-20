import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { dataClient } from "@/api/client";
import { getChatEntities, useLocalChatStore } from "@/api/localChatStore";
import { demoModeEnabled } from "@/api/demoClient";
import { AGENT_NAMES, getStoredAgentName } from "@/constants/scheduling";
import { getLiveQueryOptions } from "@/lib/liveQuery";
import { resolveAgentStatus, statusClass } from "@/lib/chatStatus";
import { useToast } from "@/components/ui/use-toast";

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export default function InternalChatPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const agentName = getStoredAgentName();
  const [activeTab, setActiveTab] = useState("general");
  const [messageText, setMessageText] = useState("");
  const [selectedPeer, setSelectedPeer] = useState(() =>
    AGENT_NAMES.find((name) => name !== getStoredAgentName()) || ""
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const chatEntities = getChatEntities() || dataClient.entities;
  const localChat = useLocalChatStore();

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

  const privatePeers = useMemo(
    () => AGENT_NAMES.filter((name) => name !== agentName),
    [agentName]
  );

  const visibleMessages = useMemo(() => {
    if (activeTab === "general") {
      return allMessages
        .filter((msg) => !msg.recipient_name)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    return allMessages
      .filter((msg) => {
        const isOutgoing = msg.sender_name === agentName && msg.recipient_name === selectedPeer;
        const isIncoming = msg.sender_name === selectedPeer && msg.recipient_name === agentName;
        return isOutgoing || isIncoming;
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [activeTab, allMessages, agentName, selectedPeer]);

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
    if (activeTab === "direct" && !selectedPeer) return;
    sendMutation.mutate({
      sender_name: agentName,
      recipient_name: activeTab === "general" ? null : selectedPeer,
      body,
      created_at: new Date().toISOString(),
    });
  };

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
      <div className="px-4 py-3 sm:px-5 border-b border-slate-100 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center">
          <MessageCircle className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-800">צ'אט פנימי</h2>
          <p className="text-[11px] text-slate-500 truncate">שיחה כללית + הודעות אישיות</p>
          {localChat && (
            <span className="mt-0.5 inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              {demoModeEnabled ? "דמו פעיל" : "צ'אט מקומי (טסט)"}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-rows-[auto_1fr] lg:grid-rows-none lg:grid-cols-[240px_1fr] flex-1 min-h-0 overflow-hidden">
        <aside className="border-b lg:border-b-0 lg:border-l border-slate-100 p-3 sm:p-4 space-y-3 shrink-0 lg:shrink lg:overflow-y-auto max-h-[28vh] lg:max-h-none">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold ${
                activeTab === "general" ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              כללי
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("direct")}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold ${
                activeTab === "direct" ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              אישי
            </button>
          </div>

          {activeTab === "direct" && (
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {privatePeers.map((peer) => (
                <button
                  key={peer}
                  type="button"
                  onClick={() => setSelectedPeer(peer)}
                  className={`shrink-0 lg:shrink lg:w-full text-right px-3 py-2 rounded-xl border text-sm font-semibold ${
                    selectedPeer === peer
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {peer}
                </button>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 hidden sm:block">
            <h3 className="text-xs font-bold text-slate-500 mb-2">סטטוס נציגים</h3>
            <div className="space-y-1.5 max-h-32 lg:max-h-48 overflow-y-auto pr-1">
              {AGENT_NAMES.map((agent) => {
                const status = resolveAgentStatus(agent, presenceMap, todayBreaks);
                return (
                  <div key={agent} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">{agent}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusClass(status.tone)}`}>
                      {status.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="p-3 sm:p-4 flex flex-col min-h-0 flex-1">
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
              placeholder={activeTab === "general" ? "כתוב הודעה לכל הנציגים..." : `הודעה ל-${selectedPeer}...`}
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
      </div>
    </div>
  );
}

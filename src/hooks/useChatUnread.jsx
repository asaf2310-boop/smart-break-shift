import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getChatEntities, isLocalChatStore } from "@/api/localChatStore";
import { dataClient } from "@/api/client";
import { getStoredAgentName } from "@/constants/scheduling";
import { getLiveQueryOptions } from "@/lib/liveQuery";
import { useChatPanel } from "@/context/ChatPanelContext";

const ChatUnreadContext = createContext(null);

function isIncomingForAgent(msg, agentName) {
  if (!agentName || msg.sender_name === agentName) return false;
  if (!msg.recipient_name) return true;
  return msg.recipient_name === agentName;
}

function isGeneralMessage(msg) {
  return !msg.recipient_name;
}

function isDirectMessage(msg) {
  return Boolean(msg.recipient_name);
}

export function ChatUnreadProvider({ children }) {
  const { open } = useChatPanel();
  const queryClient = useQueryClient();
  const agentName = getStoredAgentName();
  const chatEntities = getChatEntities() || dataClient.entities;
  const localChat = isLocalChatStore();

  const [unreadGeneralCount, setUnreadGeneralCount] = useState(0);
  const [unreadDmCountByPeer, setUnreadDmCountByPeer] = useState(() => ({}));
  const [unreadDmPeers, setUnreadDmPeers] = useState(() => new Set());

  const seenIdsRef = useRef(new Set());

  const { data: allMessages = [] } = useQuery({
    queryKey: ["chat-messages", localChat ? "local" : "remote"],
    queryFn: () => chatEntities.ChatMessage.list("-created_at", 400),
    ...getLiveQueryOptions(),
    enabled: Boolean(agentName),
  });

  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    };
    window.addEventListener("local-chat-changed", refresh);
    window.addEventListener("demo-store-changed", refresh);
    return () => {
      window.removeEventListener("local-chat-changed", refresh);
      window.removeEventListener("demo-store-changed", refresh);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!agentName) return;

    for (const msg of allMessages) {
      if (seenIdsRef.current.has(msg.id)) continue;
      seenIdsRef.current.add(msg.id);
      if (!isIncomingForAgent(msg, agentName)) continue;
      if (open) continue;

      if (isGeneralMessage(msg)) {
        setUnreadGeneralCount((c) => c + 1);
      } else if (isDirectMessage(msg)) {
        const peer = msg.sender_name;
        setUnreadDmCountByPeer((prev) => ({
          ...prev,
          [peer]: (prev[peer] || 0) + 1,
        }));
        setUnreadDmPeers((prev) => {
          const next = new Set(prev);
          next.add(peer);
          return next;
        });
      }
    }
  }, [allMessages, open, agentName]);

  const clearGeneralUnread = useCallback(() => {
    setUnreadGeneralCount(0);
  }, []);

  const clearDmUnread = useCallback((peer) => {
    if (!peer) return;
    setUnreadDmCountByPeer((prev) => {
      if (!(peer in prev)) return prev;
      const next = { ...prev };
      delete next[peer];
      return next;
    });
    setUnreadDmPeers((prev) => {
      const next = new Set(prev);
      next.delete(peer);
      return next;
    });
  }, []);

  const clearAllUnread = useCallback(() => {
    setUnreadGeneralCount(0);
    setUnreadDmCountByPeer({});
    setUnreadDmPeers(new Set());
  }, []);

  const unreadDirectCount = useMemo(
    () => Object.values(unreadDmCountByPeer).reduce((sum, n) => sum + n, 0),
    [unreadDmCountByPeer]
  );
  const unreadTotal = unreadGeneralCount + unreadDirectCount;
  const unreadGeneral = unreadGeneralCount > 0;
  const unreadDirect = unreadDirectCount > 0;
  const hasUnread = unreadTotal > 0;

  const value = useMemo(
    () => ({
      unreadGeneral,
      unreadDirect,
      unreadGeneralCount,
      unreadDirectCount,
      unreadTotal,
      unreadDmPeers,
      hasUnread,
      clearGeneralUnread,
      clearDmUnread,
      clearAllUnread,
    }),
    [
      unreadGeneral,
      unreadDirect,
      unreadGeneralCount,
      unreadDirectCount,
      unreadTotal,
      unreadDmPeers,
      hasUnread,
      clearGeneralUnread,
      clearDmUnread,
      clearAllUnread,
    ]
  );

  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>;
}

export function useChatUnread() {
  const ctx = useContext(ChatUnreadContext);
  if (!ctx) {
    throw new Error("useChatUnread must be used within ChatUnreadProvider");
  }
  return ctx;
}

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
import { getChatEntities, useLocalChatStore } from "@/api/localChatStore";
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
  const localChat = useLocalChatStore();

  const [unreadGeneral, setUnreadGeneral] = useState(false);
  const [unreadDirect, setUnreadDirect] = useState(false);
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
        setUnreadGeneral(true);
      } else if (isDirectMessage(msg)) {
        setUnreadDirect(true);
        setUnreadDmPeers((prev) => {
          const next = new Set(prev);
          next.add(msg.sender_name);
          return next;
        });
      }
    }
  }, [allMessages, open, agentName]);

  const clearGeneralUnread = useCallback(() => {
    setUnreadGeneral(false);
  }, []);

  const clearDmUnread = useCallback((peer) => {
    if (!peer) return;
    setUnreadDmPeers((prev) => {
      const next = new Set(prev);
      next.delete(peer);
      if (next.size === 0) setUnreadDirect(false);
      return next;
    });
  }, []);

  const clearAllUnread = useCallback(() => {
    setUnreadGeneral(false);
    setUnreadDirect(false);
    setUnreadDmPeers(new Set());
  }, []);

  const hasUnread = unreadGeneral || unreadDirect;

  const value = useMemo(
    () => ({
      unreadGeneral,
      unreadDirect,
      unreadDmPeers,
      hasUnread,
      clearGeneralUnread,
      clearDmUnread,
      clearAllUnread,
    }),
    [
      unreadGeneral,
      unreadDirect,
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

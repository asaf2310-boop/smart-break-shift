import { useEffect } from "react";
import { getStoredAgentName } from "@/constants/scheduling";
import {
  connectAgentAsAvailable,
  isAgentChatConnected,
  CHAT_STATUS,
} from "@/lib/agentChatPresence";
import { getChatEntities } from "@/api/localChatStore";
import { dataClient } from "@/api/client";

const HEARTBEAT_MS = 45 * 1000;

function startPresence(agentName, cancelledRef) {
  const ping = async () => {
    if (cancelledRef.cancelled || !agentName || !isAgentChatConnected()) return;
    const timestamp = new Date().toISOString();
    const chatEntities = getChatEntities() || dataClient.entities;
    const existing = await chatEntities.ChatPresence.filter({ agent_name: agentName });
    const row = existing[0];
    const status = row?.status === CHAT_STATUS.break.key ? CHAT_STATUS.break.key : CHAT_STATUS.available.key;

    if (row?.id) {
      await chatEntities.ChatPresence.update(row.id, {
        last_seen_at: timestamp,
        updated_at: timestamp,
        status,
      });
    } else {
      await connectAgentAsAvailable(agentName);
    }
  };

  connectAgentAsAvailable(agentName).catch(() => {});
  ping().catch(() => {});

  const intervalId = setInterval(() => ping().catch(() => {}), HEARTBEAT_MS);
  const onFocus = () => ping().catch(() => {});
  const onConnection = () => {
    if (isAgentChatConnected()) ping().catch(() => {});
  };

  document.addEventListener("visibilitychange", onFocus);
  window.addEventListener("focus", onFocus);
  window.addEventListener("agent-chat-connection", onConnection);

  return () => {
    clearInterval(intervalId);
    document.removeEventListener("visibilitychange", onFocus);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("agent-chat-connection", onConnection);
  };
}

export function useAgentPresence() {
  useEffect(() => {
    const cancelledRef = { cancelled: false };
    let stopHeartbeat = () => {};

    const setup = () => {
      stopHeartbeat();
      const agentName = getStoredAgentName();
      if (!agentName) return;
      stopHeartbeat = startPresence(agentName, cancelledRef);
    };

    setup();
    window.addEventListener("agent-name-set", setup);

    return () => {
      cancelledRef.cancelled = true;
      stopHeartbeat();
      window.removeEventListener("agent-name-set", setup);
    };
  }, []);
}

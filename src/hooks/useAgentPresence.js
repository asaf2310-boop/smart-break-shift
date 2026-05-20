import { useEffect } from "react";
import { dataClient } from "@/api/client";
import { getChatEntities } from "@/api/localChatStore";
import { getStoredAgentName } from "@/constants/scheduling";

const HEARTBEAT_MS = 45 * 1000;

export function useAgentPresence() {
  useEffect(() => {
    const agentName = getStoredAgentName();
    if (!agentName) return undefined;

    let cancelled = false;

    const ping = async () => {
      if (cancelled) return;
      const timestamp = new Date().toISOString();
      const chatEntities = getChatEntities() || dataClient.entities;
      const existing = await chatEntities.ChatPresence.filter({ agent_name: agentName });
      const row = existing[0];
      if (row?.id) {
        await chatEntities.ChatPresence.update(row.id, {
          last_seen_at: timestamp,
          updated_at: timestamp,
        });
      } else {
        await chatEntities.ChatPresence.create({
          agent_name: agentName,
          last_seen_at: timestamp,
          updated_at: timestamp,
        });
      }
    };

    ping().catch(() => {});
    const intervalId = setInterval(() => ping().catch(() => {}), HEARTBEAT_MS);
    const onFocus = () => ping().catch(() => {});
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}

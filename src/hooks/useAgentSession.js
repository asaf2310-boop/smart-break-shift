import { useCallback, useEffect, useState } from "react";
import { getAgentSession } from "@/lib/agentAuth";

export function useAgentSession() {
  const [session, setSession] = useState(() => getAgentSession());

  const refresh = useCallback(() => {
    setSession(getAgentSession());
  }, []);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener("agent-session-changed", onChange);
    window.addEventListener("app-users-changed", onChange);
    return () => {
      window.removeEventListener("agent-session-changed", onChange);
      window.removeEventListener("app-users-changed", onChange);
    };
  }, [refresh]);

  return {
    session,
    displayName: session?.displayName || "",
    isLoggedIn: Boolean(session?.displayName),
    bootstrapped: true,
    refresh,
  };
}

import { useCallback, useEffect, useState } from "react";
import { getAgentSession, restoreSupabaseAgentSession } from "@/lib/agentAuth";
import { demoModeEnabled } from "@/api/demoClient";

export function useAgentSession() {
  const [session, setSession] = useState(() => getAgentSession());
  const [bootstrapped, setBootstrapped] = useState(demoModeEnabled);

  const refresh = useCallback(() => {
    setSession(getAgentSession());
  }, []);

  useEffect(() => {
    if (!demoModeEnabled) {
      restoreSupabaseAgentSession().then(() => {
        setSession(getAgentSession());
        setBootstrapped(true);
      });
    }
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
    bootstrapped,
    refresh,
  };
}

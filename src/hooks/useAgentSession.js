import { useCallback, useEffect, useState } from "react";
import { demoModeEnabled } from "@/api/demoClient";
import {
  getAgentSession,
  restoreSupabaseAgentSession,
  validateAndRefreshAgentSession,
} from "@/lib/agentAuth";

export function useAgentSession() {
  const [session, setSession] = useState(() => getAgentSession());
  // Unblock login/home immediately; validate session in the background.
  const [bootstrapped] = useState(true);

  const refresh = useCallback(async () => {
    const valid = await validateAndRefreshAgentSession();
    setSession(valid);
    return valid;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const restored = await restoreSupabaseAgentSession();
      if (cancelled) return;
      if (restored) {
        setSession(restored);
        return;
      }
      const valid = await validateAndRefreshAgentSession();
      if (!cancelled) setSession(valid);
    };

    void bootstrap();

    const onChange = () => {
      void refresh();
    };

    window.addEventListener("agent-session-changed", onChange);
    window.addEventListener("app-users-changed", onChange);
    window.addEventListener("focus", onChange);

    return () => {
      cancelled = true;
      window.removeEventListener("agent-session-changed", onChange);
      window.removeEventListener("app-users-changed", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [refresh]);

  const hasValidSession = Boolean(
    session?.email &&
      session?.userId &&
      session?.needsPasswordSetup !== true &&
      (demoModeEnabled || session?.authUserId)
  );

  return {
    session,
    displayName: hasValidSession ? session.displayName : "",
    isLoggedIn: hasValidSession,
    bootstrapped,
    refresh,
  };
}

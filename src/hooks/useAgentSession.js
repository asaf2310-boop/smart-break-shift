import { useCallback, useEffect, useState } from "react";
import { demoModeEnabled } from "@/api/demoClient";
import {
  restoreSupabaseAgentSession,
  validateAndRefreshAgentSession,
} from "@/lib/agentAuth";

export function useAgentSession() {
  const [session, setSession] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  const refresh = useCallback(async () => {
    const valid = await validateAndRefreshAgentSession();
    setSession(valid);
    return valid;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const restored = await restoreSupabaseAgentSession();
        if (cancelled) return;
        if (restored) {
          setSession(restored);
          return;
        }
        const valid = await validateAndRefreshAgentSession();
        if (!cancelled) setSession(valid);
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
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
    bootstrapped &&
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

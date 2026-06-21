import { useCallback, useEffect, useState } from "react";
import { demoModeEnabled } from "@/api/demoClient";
import { supabase } from "@/api/supabase";
import {
  restoreSupabaseAgentSession,
  validateAndRefreshAgentSession,
} from "@/lib/agentAuth";
import { primeBearerToken, getCachedBearerToken } from "@/lib/agentAuthClient";

async function resolveAccessToken() {
  const cached = getCachedBearerToken();
  if (cached) return cached;
  if (demoModeEnabled || !supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || null;
    if (token) primeBearerToken(token);
    return token;
  } catch {
    return null;
  }
}

export function useAgentSession() {
  const [session, setSession] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  const refresh = useCallback(async () => {
    const valid = await validateAndRefreshAgentSession();
    setSession(valid);
    if (valid) {
      const token = getCachedBearerToken() || (await resolveAccessToken());
      setAccessToken(token);
    } else {
      setAccessToken(null);
    }
    return valid;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await restoreSupabaseAgentSession();
        if (cancelled) return;
        const valid = await validateAndRefreshAgentSession();
        if (!cancelled) {
          setSession(valid);
          if (valid) {
            const token = getCachedBearerToken() || (await resolveAccessToken());
            if (token) setAccessToken(token);
          }
        }
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
    accessToken,
    displayName: hasValidSession ? session.displayName : "",
    isLoggedIn: hasValidSession,
    bootstrapped,
    refresh,
  };
}

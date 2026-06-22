import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { demoModeEnabled } from "@/api/demoClient";
import { supabase } from "@/api/supabase";
import {
  bootstrapAgentSession,
  getAgentSession,
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

function readStoredSession() {
  const stored = getAgentSession();
  if (!stored?.email || !stored?.userId) {
    return { session: null, hasStored: false };
  }
  if (stored.needsPasswordSetup === true) {
    return { session: null, hasStored: true };
  }
  return { session: stored, hasStored: true };
}

function sessionLooksValid(session) {
  return Boolean(
    session?.email &&
      session?.userId &&
      session?.needsPasswordSetup !== true &&
      (demoModeEnabled || session?.authUserId)
  );
}

const AgentSessionContext = createContext(null);

export function AgentSessionProvider({ children }) {
  const initialStored = readStoredSession();
  const [session, setSession] = useState(initialStored.session);
  const [accessToken, setAccessToken] = useState(() => getCachedBearerToken());
  const [bootstrapped] = useState(true);
  const [validated, setValidated] = useState(!initialStored.hasStored);

  const applySession = useCallback(async (valid) => {
    setSession(valid);
    if (valid) {
      const token = getCachedBearerToken() || (await resolveAccessToken());
      setAccessToken(token || null);
    } else {
      setAccessToken(null);
    }
    return valid;
  }, []);

  const refresh = useCallback(async ({ force = false } = {}) => {
    const valid = await validateAndRefreshAgentSession({ force });
    await applySession(valid);
    setValidated(true);
    return valid;
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;

    const stored = readStoredSession();
    if (stored.session) {
      setSession(stored.session);
      const cachedToken = getCachedBearerToken();
      if (cachedToken) setAccessToken(cachedToken);
    }
    if (!stored.hasStored) {
      setValidated(true);
    }

    const runBootstrap = async () => {
      try {
        const valid = await bootstrapAgentSession();
        if (cancelled) return;
        await applySession(valid);
        setValidated(true);
      } catch (err) {
        console.warn("[useAgentSession] bootstrap failed", err);
        if (!cancelled) setValidated(true);
      }
    };

    void runBootstrap();

    const onChange = () => {
      void refresh({ force: true });
    };

    const onFocus = () => {
      void refresh();
    };

    window.addEventListener("agent-session-changed", onChange);
    window.addEventListener("app-users-changed", onChange);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("agent-session-changed", onChange);
      window.removeEventListener("app-users-changed", onChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [applySession, refresh]);

  const hasValidSession = Boolean(bootstrapped && sessionLooksValid(session));
  const isLoggedIn = hasValidSession && validated;
  const isLikelyLoggedIn = hasValidSession;

  const value = useMemo(
    () => ({
      session,
      accessToken,
      displayName: hasValidSession ? session.displayName : "",
      isLoggedIn,
      isLikelyLoggedIn,
      validated,
      bootstrapped,
      refresh,
    }),
    [
      session,
      accessToken,
      hasValidSession,
      isLoggedIn,
      isLikelyLoggedIn,
      validated,
      bootstrapped,
      refresh,
    ]
  );

  return (
    <AgentSessionContext.Provider value={value}>{children}</AgentSessionContext.Provider>
  );
}

export function useAgentSession() {
  const context = useContext(AgentSessionContext);
  if (!context) {
    throw new Error("useAgentSession must be used within AgentSessionProvider");
  }
  return context;
}

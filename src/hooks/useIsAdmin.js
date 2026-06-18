import { useAgentSession } from "@/hooks/useAgentSession";

/**
 * Admin UI permissions — production and demo: agents.is_admin from session.
 */
export function useIsAdmin() {
  const { session, isLoggedIn } = useAgentSession();
  return Boolean(isLoggedIn && session?.isAdmin === true);
}

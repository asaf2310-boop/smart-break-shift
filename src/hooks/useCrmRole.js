import { useMemo } from "react";
import {
  effectiveCrmRole,
  hasCrmAccess,
  hasCrmAdminAccess,
  hasCrmAgentDashboard,
  hasCrmReportsAccess,
} from "@/lib/crmRoles";
import { useAgentSession } from "@/hooks/useAgentSession";

export function useCrmRole() {
  const { session, isLoggedIn } = useAgentSession();

  const role = useMemo(
    () =>
      effectiveCrmRole({
        crmRole: session?.crmRole,
        isAdmin: session?.isAdmin,
      }),
    [session?.crmRole, session?.isAdmin]
  );

  return {
    role,
    isLoggedIn,
    hasCrmAccess: isLoggedIn && hasCrmAccess(role),
    hasCrmAgentDashboard: isLoggedIn && hasCrmAgentDashboard(role),
    hasCrmAdminAccess: isLoggedIn && hasCrmAdminAccess(role),
    hasCrmReportsAccess: isLoggedIn && hasCrmReportsAccess(role),
  };
}

import { useMemo } from "react";
import {
  agentHasModule,
  normalizeAgentModules,
  pathnameAllowedByModules,
} from "@/constants/agentModules";
import { useAgentSession } from "@/hooks/useAgentSession";

export function useAgentModules() {
  const { session, isLoggedIn } = useAgentSession();

  const modules = useMemo(
    () => normalizeAgentModules(session?.modules),
    [session?.modules]
  );

  const hasModule = (moduleId) => agentHasModule(modules, moduleId);

  const canAccessPath = (pathname) => pathnameAllowedByModules(pathname, modules);

  return {
    modules,
    hasModule,
    canAccessPath,
    isLoggedIn,
  };
}

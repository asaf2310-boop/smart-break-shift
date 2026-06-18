import { useMemo } from "react";
import {
  agentHasModule,
  normalizeAgentModules,
  pathnameAllowedByModules,
} from "@/constants/agentModules";
import { useAgentSession } from "@/hooks/useAgentSession";

export function useAgentModules() {
  const { session, isLoggedIn } = useAgentSession();
  const rawModules = session?.modules;

  const modules = useMemo(
    () => normalizeAgentModules(rawModules),
    [rawModules]
  );

  const hasModule = (moduleId) => agentHasModule(rawModules, moduleId);

  const canAccessPath = (pathname) => pathnameAllowedByModules(pathname, rawModules);

  return {
    modules,
    rawModules,
    hasModule,
    canAccessPath,
    isLoggedIn,
  };
}

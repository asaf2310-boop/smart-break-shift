import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import { agentLogout } from "@/lib/agentAuth";
import { useAgentSession } from "@/hooks/useAgentSession";

export default function AdminTopBar() {
  const { pathname } = useLocation();
  const { refresh, displayName } = useAgentSession();
  const isDashboard = pathname === "/admin";

  const handleLogout = async () => {
    await agentLogout();
    await refresh();
  };

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      {isDashboard ? (
        <span className="text-sm text-slate-400 shrink-0">דשבורד מנהל</span>
      ) : (
        <Link
          to="/admin"
          className="text-sm text-slate-400 hover:text-slate-700 transition-colors shrink-0"
        >
          ← ראשי
        </Link>
      )}
      <div className="flex items-center gap-3 ms-auto">
        {displayName ? (
          <span className="text-xs text-slate-500 hidden sm:inline truncate max-w-[12rem]">
            {displayName}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          <LogOut className="w-4 h-4" aria-hidden />
          התנתקות
        </button>
      </div>
    </div>
  );
}

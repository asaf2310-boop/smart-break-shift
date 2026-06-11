import React from "react";
import { Link } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { useAgentModules } from "@/hooks/useAgentModules";
import { AGENT_MODULES } from "@/constants/agentModules";

/**
 * חוסם גישה למודול שלא הוקצה לנציג (לאחר התחברות).
 */
export default function ModuleGate({ module: moduleId, children }) {
  const { hasModule, isLoggedIn } = useAgentModules();

  if (!isLoggedIn) {
    return children;
  }

  if (hasModule(moduleId)) {
    return children;
  }

  const label = AGENT_MODULES[moduleId]?.label || moduleId;

  return (
    <div
      className="min-h-[50vh] flex items-center justify-center px-4 py-12"
      dir="rtl"
    >
      <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-amber-50/90 p-6 text-center shadow-sm">
        <ShieldOff className="w-10 h-10 text-amber-600 mx-auto mb-3" aria-hidden />
        <h1 className="text-lg font-bold text-slate-800 mb-2">אין הרשאה למודול זה</h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          לחשבון שלך אין גישה ל<strong>{label}</strong>. פנה/י למנהל המערכת לעדכון הרשאות.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}

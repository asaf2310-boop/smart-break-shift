import React from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { knowledgeEnabled } from "@/api/knowledgeMode";
import { isKnowledgeGuidePath } from "@/constants/agentModules";
import { m3PageClass } from "@/lib/hypPage";

/** חוסם נתיבי מדריך תשלומים כשהמודול כבוי ב-build (מלבד wealthy-guide שתמיד זמין למודול knowledge_guide) */
export default function KnowledgeGate({ children, redirect = true }) {
  const { pathname } = useLocation();
  const guidePath = isKnowledgeGuidePath(pathname);

  if (knowledgeEnabled || guidePath) return children;

  if (redirect) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
      <div className="max-w-md text-center m3-card p-8">
        <p className="m3-label-medium mb-2">מדריך תשלומים אינו פעיל בסביבה זו.</p>
        <p className="text-sm text-on-surface-variant mb-6">
          הוסיפו{" "}
          <code className="text-xs bg-surface-container px-1 rounded-md">VITE_KNOWLEDGE_ENABLED=true</code>{" "}
          ב-Vercel.
        </p>
        <Link to="/" className="text-primary font-medium text-sm hover:underline">
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}

import React from "react";
import { Link, Navigate } from "react-router-dom";
import { knowledgeEnabled } from "@/api/knowledgeMode";
import { m3PageClass } from "@/lib/hypPage";

/** חוסם נתיבי בסיס ידע כשהמודול כבוי ב-build */
export default function KnowledgeGate({ children, redirect = true }) {
  if (knowledgeEnabled) return children;

  if (redirect) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
      <div className="max-w-md text-center m3-card p-8">
        <p className="m3-label-medium mb-2">בסיס ידע AI אינו פעיל בסביבה זו.</p>
        <p className="text-sm text-on-surface-variant mb-6">
          הוסיפו{" "}
          <code className="text-xs bg-surface-container px-1 rounded-md">VITE_KNOWLEDGE_ENABLED=true</code>{" "}
          ב-Vercel, <code className="text-xs bg-surface-container px-1 rounded-md">GEMINI_API_KEY</code> בשרת,
          והריצו <code className="text-xs bg-surface-container px-1 rounded-md">supabase/knowledge.sql</code>.
        </p>
        <Link to="/" className="text-primary font-medium text-sm hover:underline">
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}

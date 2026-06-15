import React from "react";
import { Link, Navigate } from "react-router-dom";
import { crmEnabled } from "@/api/crmMode";
import { m3PageClass } from "@/lib/hypPage";

/** חוסם נתיבי CRM כשהמודול כבוי ב-build */
export default function CrmGate({ children, redirect = true }) {
  if (crmEnabled) return children;

  if (redirect) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
      <div className="max-w-md text-center m3-card p-8">
        <p className="m3-label-medium mb-2">מודול CRM אינו פעיל בסביבה זו.</p>
        <p className="text-sm text-on-surface-variant mb-6">
          הוסיפו{" "}
          <code className="text-xs bg-surface-container px-1 rounded-md">VITE_CRM_ENABLED=true</code>{" "}
          ב-Vercel (או הסירו <code className="text-xs bg-surface-container px-1 rounded-md">=false</code>) וריצו
          Redeploy.
        </p>
        <Link to="/" className="text-primary font-medium text-sm hover:underline">
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}

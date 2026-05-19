import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { backendMode } from "@/api/client";

export default function BackendConfigBanner() {
  if (backendMode === "demo") {
    return (
      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2 text-sm text-emerald-800" dir="rtl">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        סביבת דמו פעילה
      </div>
    );
  }

  if (backendMode === "supabase") {
    return (
      <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 flex items-center gap-2 text-sm text-green-800" dir="rtl">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        מחובר ל-Supabase
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 flex gap-3 items-start" dir="rtl">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-amber-900">
        <p className="font-bold mb-1">אין חיבור לשרת נתונים</p>
        <p className="text-amber-800/90 mb-2">
          הגדר Supabase ב-Vercel: VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY
        </p>
        <Link to="/" className="inline-block mt-2 text-amber-700 font-semibold hover:underline">
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}

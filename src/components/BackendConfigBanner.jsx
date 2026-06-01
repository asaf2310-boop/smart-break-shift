import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { backendMode } from "@/api/client";

export default function BackendConfigBanner() {
  if (backendMode === "demo") {
    return (
      <div className="demo-config-banner" dir="rtl" role="status">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        סביבת דמו פעילה · נתונים מקומיים
      </div>
    );
  }

  if (backendMode === "supabase") {
    return (
      <div
        className="demo-config-banner border-accent/30"
        style={{
          background:
            "linear-gradient(90deg, hsl(189 89% 53% / 0.1) 0%, hsl(271 76% 53% / 0.08) 100%)",
        }}
        dir="rtl"
        role="status"
      >
        <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-accent" />
        מחובר ל-Supabase
      </div>
    );
  }

  return (
    <div
      className="mb-6 rounded-2xl border border-amber-300/80 bg-amber-50/90 backdrop-blur-sm px-4 py-3 flex gap-3 items-start shadow-elevation-1"
      dir="rtl"
    >
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

import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { appParams } from "@/lib/app-params";

export default function Base44ConfigBanner() {
  const missingBaseUrl = !appParams.appBaseUrl;

  if (!missingBaseUrl) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 flex gap-3 items-start" dir="rtl">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-amber-900">
        <p className="font-bold mb-1">חיבור ל-Base44 לא הוגדר</p>
        <p className="text-amber-800/90">
          הוסף בקובץ <code className="bg-amber-100 px-1 rounded">.env.local</code> את השורה{" "}
          <code className="bg-amber-100 px-1 rounded">VITE_BASE44_APP_BASE_URL=https://YOUR-APP.base44.app</code>{" "}
          והפעל מחדש את <code className="bg-amber-100 px-1 rounded">npm run dev</code>.
          בינתיים הנתונים לא יישמרו.
        </p>
        <Link to="/" className="inline-block mt-2 text-amber-700 font-semibold hover:underline">
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}

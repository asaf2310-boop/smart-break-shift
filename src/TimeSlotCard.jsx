import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Home } from "lucide-react";

export default function AppLoadError({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-red-50 px-4" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-red-200 p-8">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">לא הצלחנו לטעון את האפליקציה</h1>
          <p className="text-sm text-slate-500">{message || "בדוק את חיבור Base44 והגדרות .env.local"}</p>
          <ul className="text-xs text-slate-500 text-right w-full space-y-1 list-disc list-inside">
            <li>האם הרצת <code className="bg-slate-100 px-1 rounded">npm run dev</code>?</li>
            <li>האם מולא <code className="bg-slate-100 px-1 rounded">VITE_BASE44_APP_BASE_URL</code>?</li>
            <li>נסה לרענן את הדף אחרי שמירת .env.local</li>
          </ul>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-800 text-white text-sm font-semibold"
          >
            <Home className="w-4 h-4" />
            דף הבית
          </Link>
        </div>
      </div>
    </div>
  );
}

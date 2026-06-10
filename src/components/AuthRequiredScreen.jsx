<<<<<<< HEAD
import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { Link } from "react-router-dom";
import { LogIn, Home } from "lucide-react";
export default function AuthRequiredScreen() {
  const { navigateToLogin } = useAuth();

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 px-4" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-100 flex items-center justify-center">
          <LogIn className="w-7 h-7 text-indigo-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">נדרשת התחברות</h1>
        <p className="text-sm text-slate-500 mb-6">
          האפליקציה מוגדרת לעבוד מול Supabase או סביבת דמו.
        </p>
        <button
          type="button"
          onClick={() => navigateToLogin()}
          className="w-full py-3 mb-3 rounded-2xl font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600"
        >
          רענון הגדרות
        </button>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
        >
          <Home className="w-4 h-4" />
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
=======
import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { Link } from "react-router-dom";
import { LogIn, Home } from "lucide-react";
export default function AuthRequiredScreen() {
  const { navigateToLogin } = useAuth();

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 px-4" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-100 flex items-center justify-center">
          <LogIn className="w-7 h-7 text-indigo-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">נדרשת התחברות</h1>
        <p className="text-sm text-slate-500 mb-6">
          האפליקציה מוגדרת לעבוד מול Supabase או סביבת דמו.
        </p>
        <button
          type="button"
          onClick={() => navigateToLogin()}
          className="w-full py-3 mb-3 rounded-2xl font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600"
        >
          רענון הגדרות
        </button>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
        >
          <Home className="w-4 h-4" />
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
>>>>>>> 842dd9e (Initial commit)

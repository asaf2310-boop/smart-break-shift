import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { demoModeEnabled } from "@/api/demoClient";
import {
  DEMO_FIELD_CLASS,
  DEMO_SUBMIT_CLASS,
  Field,
  LoginShell,
} from "@/components/auth/LoginShell";
import {
  isAdminPinConfigured,
  isProductionAdminOpen,
  useIsAdmin,
  unlockAdminSession,
} from "@/hooks/useIsAdmin";

export default function AdminGate({ children }) {
  const isAdmin = useIsAdmin();
  const productionOpen = isProductionAdminOpen();
  const pinRequired = isAdminPinConfigured();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  if (isAdmin || productionOpen) {
    return children;
  }

  if (!pinRequired) {
    return <AdminPinUnavailable />;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === import.meta.env.VITE_ADMIN_PIN) {
      unlockAdminSession();
      setError("");
      window.location.reload();
    } else {
      setError("קוד גישה שגוי");
    }
  };

  if (demoModeEnabled) {
    return (
      <LoginShell subtitle="כניסת מנהל — הזן קוד גישה" showDemoBadge demoHero>
        <form onSubmit={handleSubmit}>
          <Field icon={Lock} label="קוד גישה">
            <Input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError("");
              }}
              placeholder="קוד גישה"
              className={DEMO_FIELD_CLASS}
              autoFocus
            />
          </Field>
          {error && <p className="text-sm text-red-300 text-center">{error}</p>}
          <button type="submit" className={DEMO_SUBMIT_CLASS}>
            כניסה
          </button>
        </form>
        <Link to="/" className="login-demo-link mt-4 block text-center text-sm">
          חזרה לדף הבית
        </Link>
      </LoginShell>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-extrabold text-slate-800">כניסת מנהל</h1>
            <p className="text-sm text-slate-500 mt-1">הזן קוד גישה</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="password"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(""); }}
              placeholder="קוד גישה"
              className="w-full border border-slate-200 rounded-2xl py-3 pr-11 px-4 text-sm outline-none focus:border-indigo-400 text-right"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            className="w-full py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-amber-400 to-orange-500 shadow-lg"
          >
            כניסה
          </button>
        </form>
        <Link
          to="/"
          className="mt-4 block text-center text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}

function AdminPinUnavailable() {
  if (demoModeEnabled) {
    return (
      <LoginShell subtitle="כניסת מנהל לא זמינה" showDemoBadge demoHero>
        <p className="text-sm text-center leading-relaxed">
          לא הוגדר <code className="text-xs bg-muted/60 px-1 rounded">VITE_ADMIN_PIN</code> במשתני
          הסביבה של הבילד. בפיתוח: <code className="text-xs bg-muted/60 px-1 rounded">.env.local</code>
          ; בפריסה: Vercel → Environment Variables. הפעל build מחדש אחרי השינוי.
        </p>
        <Link to="/" className="login-demo-link mt-6 block text-center text-sm">
          חזרה לדף הבית
        </Link>
      </LoginShell>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-100 flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-amber-700" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-800 mb-2">כניסת מנהל לא זמינה</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          לא הוגדר <code className="text-xs bg-slate-100 px-1 rounded">VITE_ADMIN_PIN</code> במשתני
          הסביבה של הבילד. בפיתוח: <code className="text-xs bg-slate-100 px-1 rounded">.env.local</code>
          ; בפריסה: Vercel → Environment Variables. הפעל build מחדש אחרי השינוי.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}

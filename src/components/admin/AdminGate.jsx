import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { demoModeEnabled } from "@/api/demoClient";
import AgentLogin from "@/components/auth/AgentLogin";
import {
  DEMO_FIELD_CLASS,
  DEMO_SUBMIT_CLASS,
  Field,
  LoginShell,
} from "@/components/auth/LoginShell";
import { useAgentSession } from "@/hooks/useAgentSession";
import {
  isAdminPinConfigured,
  useIsAdmin,
  unlockAdminSession,
} from "@/hooks/useIsAdmin";
import { rememberAdminPinForApi } from "@/lib/adminPinClient";

export default function AdminGate({ children }) {
  const { isLoggedIn, bootstrapped, refresh } = useAgentSession();
  const isAdmin = useIsAdmin();
  const pinRequired = isAdminPinConfigured();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  if (!demoModeEnabled) {
    if (!bootstrapped) {
      return (
        <div className="min-h-[40vh] flex items-center justify-center text-slate-500 text-sm">
          בודק התחברות...
        </div>
      );
    }

    if (!isLoggedIn) {
      return (
        <AgentLogin
          onSuccess={() => {
            void refresh();
          }}
        />
      );
    }
  }

  if (demoModeEnabled && isAdmin) {
    return children;
  }

  if (!demoModeEnabled && pinRequired && isAdmin) {
    return children;
  }

  if (!demoModeEnabled && !pinRequired) {
    return children;
  }

  if (!pinRequired) {
    return <AdminPinUnavailable />;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === import.meta.env.VITE_ADMIN_PIN) {
      rememberAdminPinForApi(pin);
      unlockAdminSession();
      setError("");
      window.location.reload();
    } else {
      setError("קוד גישה שגוי");
    }
  };

  if (demoModeEnabled) {
    return (
      <LoginShell subtitle="כניסת מנהל — הזן קוד גישה" showDemoBadge hypCard>
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
    <LoginShell subtitle="כניסת מנהל — הזן קוד גישה" hypCard>
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

function AdminPinUnavailable() {
  if (demoModeEnabled) {
    return (
      <LoginShell subtitle="כניסת מנהל לא זמינה" showDemoBadge hypCard>
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
    <LoginShell subtitle="כניסת מנהל לא זמינה" hypCard>
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

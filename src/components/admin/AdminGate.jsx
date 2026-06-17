import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, ShieldAlert } from "lucide-react";
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
  DEMO_ADMIN_PIN,
  unlockAdminSession,
  useIsAdmin,
} from "@/hooks/useIsAdmin";

export default function AdminGate({ children }) {
  const { isLoggedIn, refresh, session } = useAgentSession();
  const isAdmin = useIsAdmin();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  if (!demoModeEnabled && !isLoggedIn) {
    return (
      <AgentLogin
        onSuccess={() => {
          void refresh();
        }}
      />
    );
  }

  if (isAdmin) {
    return children;
  }

  if (demoModeEnabled) {
    const handleSubmit = (e) => {
      e.preventDefault();
      if (pin === DEMO_ADMIN_PIN) {
        unlockAdminSession();
        setError("");
        window.location.reload();
      } else {
        setError("קוד גישה שגוי");
      }
    };

    return (
      <LoginShell subtitle="כניסת מנהל — הזן קוד גישה (דמו)" showDemoBadge hypCard>
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
    <LoginShell subtitle="אין הרשאת מנהל" hypCard>
      <div className="flex flex-col items-center gap-3 text-center">
        <ShieldAlert className="w-10 h-10 text-amber-500" aria-hidden />
        <p className="text-sm leading-relaxed">
          החשבון {session?.displayName ? `«${session.displayName}»` : ""} אינו מוגדר כמנהל במערכת.
          פנה/י למנהל המערכת לעדכון <code className="text-xs bg-muted/60 px-1 rounded">is_admin</code> בטבלת
          הנציגים.
        </p>
      </div>
      <Link to="/" className="login-demo-link mt-6 block text-center text-sm">
        חזרה לדף הבית
      </Link>
    </LoginShell>
  );
}

import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { demoModeEnabled } from "@/api/demoClient";
import AgentLogin from "@/components/auth/AgentLogin";
import { LoginShell } from "@/components/auth/LoginShell";
import { useAgentSession } from "@/hooks/useAgentSession";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export default function AdminGate({ children }) {
  const { isLoggedIn, refresh, session } = useAgentSession();
  const isAdmin = useIsAdmin();

  if (!isLoggedIn) {
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

  return (
    <LoginShell
      subtitle={demoModeEnabled ? "כניסת מנהל — דמו" : "אין הרשאת מנהל"}
      hypCard
      showDemoBadge={demoModeEnabled}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <ShieldAlert className="w-10 h-10 text-amber-500" aria-hidden />
        <p className="text-sm leading-relaxed">
          {demoModeEnabled ? (
            <>
              החשבון {session?.displayName ? `«${session.displayName}»` : ""} אינו מוגדר כמנהל.
              התחברו עם נציג שיש לו <code className="text-xs bg-muted/60 px-1 rounded">is_admin</code> (בדמו:{" "}
              <code className="text-xs bg-muted/60 px-1 rounded">agent01@demo.local</code> לאחר הגדרת סיסמה, או סמנו
              מנהל בעמוד ניהול משתמשים).
            </>
          ) : (
            <>
              החשבון {session?.displayName ? `«${session.displayName}»` : ""} אינו מוגדר כמנהל במערכת.
              פנה/י למנהל המערכת לעדכון <code className="text-xs bg-muted/60 px-1 rounded">is_admin</code> בטבלת
              הנציגים.
            </>
          )}
        </p>
      </div>
      <Link to="/" className="login-demo-link mt-6 block text-center text-sm">
        חזרה לדף הבית
      </Link>
    </LoginShell>
  );
}

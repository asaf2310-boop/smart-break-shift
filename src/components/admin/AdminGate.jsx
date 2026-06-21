import React from "react";
import { Link } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { demoModeEnabled } from "@/api/demoClient";
import AgentLogin from "@/components/auth/AgentLogin";
import { LoginShell } from "@/components/auth/LoginShell";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { useAgentSession } from "@/hooks/useAgentSession";
import { m3PageClass } from "@/lib/hypPage";

export default function AdminGate({ children }) {
  const { isLoggedIn, refresh, session, bootstrapped } = useAgentSession();
  const isAdmin = Boolean(isLoggedIn && session?.isAdmin === true);

  if (!bootstrapped) {
    return (
      <div className={m3PageClass("flex items-center justify-center p-12")} dir="rtl">
        <Loader2 className="w-6 h-6 animate-spin text-primary" aria-label="בודק הרשאות מנהל" />
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

  if (isAdmin) {
    return (
      <>
        <div className="relative z-20 mx-auto w-full max-w-5xl px-4 pt-4" dir="rtl">
          <AdminTopBar />
        </div>
        {children}
      </>
    );
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

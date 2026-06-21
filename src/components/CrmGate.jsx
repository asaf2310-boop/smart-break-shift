import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2, ShieldOff } from "lucide-react";
import { crmEnabled } from "@/api/crmMode";
import { isCrmCloudEnabled } from "@/api/crmCloudMode";
import { hydrateCrmStore, isCrmStoreHydrated } from "@/lib/crmStore";
import {
  effectiveCrmRole,
  hasCrmAccess,
  hasCrmAdminAccess,
  hasCrmAgentDashboard,
} from "@/lib/crmRoles";
import { useAgentSession } from "@/hooks/useAgentSession";
import AgentLogin from "@/components/auth/AgentLogin";
import { m3PageClass } from "@/lib/hypPage";

const REQUIREMENT_CHECKS = {
  access: hasCrmAccess,
  agent: hasCrmAgentDashboard,
  admin: hasCrmAdminAccess,
};

const REQUIREMENT_MESSAGES = {
  access: "אין לך גישה למודול CRM. פנה/י למנהל לקבלת הרשאה.",
  agent: "נדרשת הרשאת נציג CRM לגישה לעמוד זה.",
  admin: "נדרשת הרשאת מנהל CRM לגישה לעמוד זה.",
};

/** חוסם נתיבי CRM לפי crm_role (וב-build flag) */
export default function CrmGate({ children, redirect = true, require = "access", deferHydration = false }) {
  const { isLoggedIn, refresh, session, bootstrapped } = useAgentSession();
  const [hydrating, setHydrating] = useState(
    () => !deferHydration && crmEnabled && isCrmCloudEnabled() && !isCrmStoreHydrated()
  );

  useEffect(() => {
    if (!crmEnabled || !isCrmCloudEnabled()) {
      setHydrating(false);
      return undefined;
    }
    if (isCrmStoreHydrated()) {
      setHydrating(false);
      return undefined;
    }
    let cancelled = false;
    if (!deferHydration) setHydrating(true);
    hydrateCrmStore()
      .catch((err) => {
        console.warn("[CrmGate] hydrate failed", err);
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deferHydration]);

  if (!crmEnabled) {
    if (redirect) {
      return <Navigate to="/" replace />;
    }

    return (
      <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
        <div className="max-w-md text-center m3-card p-8">
          <p className="m3-label-medium mb-2">מודול CRM אינו פעיל בסביבה זו.</p>
          <p className="text-sm text-on-surface-variant mb-6">
            הוסיפו{" "}
            <code className="text-xs bg-surface-container px-1 rounded-md">VITE_CRM_ENABLED=true</code>{" "}
            ב-Vercel (או הסירו <code className="text-xs bg-surface-container px-1 rounded-md">=false</code>) וריצו
            Redeploy.
          </p>
          <Link to="/" className="text-primary font-medium text-sm hover:underline">
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  if ((!deferHydration && hydrating) || !bootstrapped) {
    return (
      <div className={m3PageClass("flex items-center justify-center p-12")} dir="rtl">
        <Loader2 className="w-6 h-6 animate-spin text-primary" aria-label="טוען CRM" />
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

  const role = effectiveCrmRole({
    crmRole: session?.crmRole,
    isAdmin: session?.isAdmin,
  });
  const check = REQUIREMENT_CHECKS[require] || hasCrmAccess;
  const allowed = check(role);

  if (!allowed) {
    if (redirect) {
      return <Navigate to="/" replace />;
    }

    return (
      <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
        <div className="max-w-md text-center m3-card p-8">
          <ShieldOff className="w-10 h-10 text-amber-600 mx-auto mb-3" aria-hidden />
          <p className="m3-label-medium mb-2">אין הרשאת CRM</p>
          <p className="text-sm text-on-surface-variant mb-6">
            {REQUIREMENT_MESSAGES[require] || REQUIREMENT_MESSAGES.access}
          </p>
          <Link to="/" className="text-primary font-medium text-sm hover:underline">
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

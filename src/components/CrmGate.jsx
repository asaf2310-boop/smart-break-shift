import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { crmEnabled } from "@/api/crmMode";
import { isCrmCloudEnabled } from "@/api/crmCloudMode";
import { hydrateCrmStore, isCrmStoreHydrated } from "@/lib/crmStore";
import { m3PageClass } from "@/lib/hypPage";

/** חוסם נתיבי CRM כשהמודול כבוי ב-build */
export default function CrmGate({ children, redirect = true }) {
  const [hydrating, setHydrating] = useState(
    () => crmEnabled && isCrmCloudEnabled() && !isCrmStoreHydrated()
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
    setHydrating(true);
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
  }, []);

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

  if (hydrating) {
    return (
      <div className={m3PageClass("flex items-center justify-center p-12")} dir="rtl">
        <Loader2 className="w-6 h-6 animate-spin text-primary" aria-label="טוען CRM" />
      </div>
    );
  }

  return children;
}

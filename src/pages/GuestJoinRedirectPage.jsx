import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { m3PageClass } from "@/lib/hypPage";
import {
  bootstrapGuestSessionFromUrl,
  getSessionByShortCode as getScreenByShortCode,
  screenShareFeaturesAvailable,
} from "@/lib/screenShareStore";
import {
  bootstrapConsentSessionFromUrl,
  getSessionByShortCode as getConsentByShortCode,
} from "@/lib/remoteSupportStore";
import {
  buildFullGuestPath,
  resolveGuestFromTokenAsync,
} from "@/lib/shortGuestLink";

export default function GuestJoinRedirectPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!token) {
        setError("קישור לא תקין");
        return;
      }

      const resolved = await resolveGuestFromTokenAsync(token, {
        bootstrapScreen: bootstrapGuestSessionFromUrl,
        bootstrapConsent: bootstrapConsentSessionFromUrl,
        getScreenByShortCode,
        getConsentByShortCode,
      });

      if (cancelled) return;

      if (!resolved?.sessionId || !resolved.kind) {
        setError("קישור לא תקין או שפג תוקפו. בקשו מהנציג קישור חדש.");
        return;
      }

      const path = buildFullGuestPath(resolved.sessionId, resolved.kind, resolved.bootstrap);
      navigate(path, { replace: true });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  if (error) {
    return (
      <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
        <div className="max-w-md w-full rounded-2xl border border-red-100 bg-red-50 p-4 flex items-start gap-2 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!screenShareFeaturesAvailable()) {
    return (
      <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
        <p className="text-slate-600">שיתוף מסך אינו פעיל בסביבה זו.</p>
      </div>
    );
  }

  return (
    <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
      <div className="flex items-center gap-2 text-slate-600 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
        <span>פותח קישור שיתוף…</span>
      </div>
    </div>
  );
}

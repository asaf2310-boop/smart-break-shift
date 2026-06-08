import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Monitor, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GUEST_BOOTSTRAP_QUERY_KEY,
} from "@/lib/screenShareStore";
import {
  logConsent,
  remoteSupportFeaturesAvailable,
  resolveConsentSession,
  subscribeRemoteSupport,
} from "@/lib/remoteSupportStore";
import { demoModeEnabled } from "@/api/demoClient";
import { m3PageClass } from "@/lib/hypPage";

const CUSTOMER_CONSENT_TEXT =
  "אני מאשר/ת לנציג התמיכה לגשת מרחוק למחשב שלי באמצעות RustDesk לצורך טיפול בתקלה שדווחה בשיחה זו.";

export default function RemoteSupportConsentPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const bootstrapKey = searchParams.get(GUEST_BOOTSTRAP_QUERY_KEY);
  const [session, setSession] = useState(() => resolveConsentSession(token, bootstrapKey));
  const [done, setDone] = useState(false);

  useEffect(() => {
    const refresh = () => setSession(resolveConsentSession(token, bootstrapKey));
    refresh();
    return subscribeRemoteSupport(refresh);
  }, [token, bootstrapKey]);

  const alreadyConsented = Boolean(session?.consentAt && session.consentSource === "customer");

  const handleConsent = () => {
    if (!session) return;
    logConsent(session.id, { consentText: CUSTOMER_CONSENT_TEXT, source: "customer" });
    setDone(true);
    setSession(resolveConsentSession(token, bootstrapKey));
  };

  if (!remoteSupportFeaturesAvailable()) {
    return (
      <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
        <p className="text-slate-600 text-center">מודול תמיכה מרחוק אינו פעיל בסביבה זו.</p>
      </div>
    );
  }

  return (
    <div className={m3PageClass("flex items-center justify-center p-4")} dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden"
      >
        {demoModeEnabled && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-start gap-2 text-amber-950 text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>דמו — לפרודקשן: שרת RustDesk עצמי + מדיניות אבטחה</span>
          </div>
        )}

        <div className="p-6 space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 mb-3">
              <Monitor className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-800">אישור גישה מרחוק</h1>
            <p className="text-sm text-slate-500 mt-1">תמיכה טכנית באמצעות RustDesk</p>
          </div>

          {!session ? (
            <p className="text-sm text-center text-slate-600">
              קישור לא תקין או שפג תוקפו. בקשו מהנציג קישור חדש.
            </p>
          ) : session.status === "ended" ? (
            <p className="text-sm text-center text-slate-600">סשן התמיכה הסתיים.</p>
          ) : alreadyConsented || done ? (
            <div className="text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <p className="font-semibold text-emerald-800">האישור נרשם</p>
              <p className="text-xs text-slate-500">
                {session.consentAt &&
                  new Date(session.consentAt).toLocaleString("he-IL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                {CUSTOMER_CONSENT_TEXT}
              </p>
              <p className="text-xs text-slate-500 text-center">
                נציג: {session.agentName || "תמיכה"}
              </p>
              <Button
                type="button"
                onClick={handleConsent}
                className="w-full h-12 text-base bg-gradient-to-l from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
              >
                אני מאשר גישה מרחוק
              </Button>
            </>
          )}

          <p className="text-center">
            <Link to="/" className="text-xs text-indigo-600 hover:underline">
              חזרה לדף הבית
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

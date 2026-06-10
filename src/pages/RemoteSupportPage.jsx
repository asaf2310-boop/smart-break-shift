import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Contact, Film, Monitor, MonitorPlay } from "lucide-react";
import DemoRecordingsLibrary from "@/components/remote/DemoRecordingsLibrary";
import { demoModeEnabled } from "@/api/demoClient";
import { getStoredAgentName } from "@/constants/scheduling";
import RemoteSupportPanel from "@/components/remote/RemoteSupportPanel";
import EmailStatusBanner from "@/components/remote/EmailStatusBanner";
import {
  listSessions as listRustDeskSessions,
  remoteSupportFeaturesAvailable,
  subscribeRemoteSupport,
} from "@/lib/remoteSupportStore";
import {
  getLastEmailLogForSession,
  listSessions as listScreenSessions,
  screenShareFeaturesAvailable,
  subscribeScreenShare,
} from "@/lib/screenShareStore";
import {
  cloudSessionSyncEnabled,
  syncRustDeskSessionToCloud,
  syncScreenShareSessionToCloud,
} from "@/lib/supportSessionsSync";
import { hypHeaderIconClass, m3PageClass } from "@/lib/hypPage";
import { cn } from "@/lib/utils";

function formatWhen(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function RemoteSupportPage() {
  const agentName = getStoredAgentName();
  const demoAvailable =
    remoteSupportFeaturesAvailable() || screenShareFeaturesAvailable();
  const [rustDeskSessions, setRustDeskSessions] = useState(() => listRustDeskSessions());
  const [screenSessions, setScreenSessions] = useState(() => listScreenSessions());

  useEffect(() => {
    const refreshRust = () => setRustDeskSessions(listRustDeskSessions());
    const refreshScreen = () => setScreenSessions(listScreenSessions());
    refreshRust();
    refreshScreen();
    const unsubRust = subscribeRemoteSupport(refreshRust);
    const unsubScreen = subscribeScreenShare(refreshScreen);
    return () => {
      unsubRust();
      unsubScreen();
    };
  }, []);

  useEffect(() => {
    if (!cloudSessionSyncEnabled()) return;
    for (const session of listScreenSessions()) {
      syncScreenShareSessionToCloud(session);
    }
    for (const session of listRustDeskSessions()) {
      syncRustDeskSessionToCloud(session);
    }
  }, []);

  const activeRust = rustDeskSessions.filter((s) => s.status === "active").length;
  const activeScreen = screenSessions.filter((s) => s.status === "active").length;

  return (
    <div className={m3PageClass("pt-app-nav")} dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <div className={hypHeaderIconClass("w-12 h-12 shadow-elevation-2")}>
              <Monitor className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="m3-headline-small text-xl font-semibold">השתלטות מרחוק</h1>
              <p className="m3-label-medium">צפייה בדפדפן · RustDesk · אישור ותיעוד</p>
            </div>
          </div>
          <Link to="/" className="m3-btn-outlined text-xs py-2">
            <ArrowRight className="w-4 h-4" />
            ראשי
          </Link>
        </motion.div>

        <div className="mb-4">
          <EmailStatusBanner />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="m3-card p-4 sm:p-6 space-y-4 mb-4"
        >
          <h2 className="m3-label-large font-semibold">שני מצבי תמיכה</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 space-y-1">
              <div className="flex items-center gap-2 m3-label-medium font-semibold text-teal-900">
                <MonitorPlay className="w-4 h-4" />
                שלב א — צפייה במסך (דפדפן)
              </div>
              <p className="m3-label-medium text-on-surface-variant text-xs leading-relaxed">
                קישור במייל → הלקוח משתף מסך ב-Chrome/Edge. צפייה בלבד, ללא התקנה.
              </p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-1">
              <div className="flex items-center gap-2 m3-label-medium font-semibold text-indigo-900">
                <Monitor className="w-4 h-4" />
                שליטה מלאה — RustDesk
              </div>
              <p className="m3-label-medium text-on-surface-variant text-xs leading-relaxed">
                התקנת RustDesk, מזהה וסיסמה — שליטה מלאה בעכבר ומקלדת לאחר אישור.
              </p>
            </div>
          </div>
          <ol className="m3-label-medium space-y-2 list-decimal list-inside text-on-surface-variant leading-relaxed">
            {demoModeEnabled ? (
              <li>בכרטיס לקוח ב-CRM — «תמיכה מרחוק», או מהכפתור למטה.</li>
            ) : (
              <li>התחילו סשן מהכפתור למטה (או מסרגל הטלפוניה כשיש לקוח מקושר).</li>
            )}
            <li>בחרו שלב א (דפדפן) או RustDesk לפי צורך הטיפול.</li>
            <li>שלחו מייל או העתיקו קישור — הלקוח מאשר בדף הקישור.</li>
            <li>סיימו את הסשן בסיום הטיפול.</li>
          </ol>
          {demoModeEnabled && (
            <Link
              to="/crm"
              className="inline-flex items-center gap-2 m3-btn-outlined text-sm py-2"
            >
              <Contact className="w-4 h-4" />
              מעבר ל-CRM
            </Link>
          )}
        </motion.div>

        {demoAvailable ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="m3-card p-4 sm:p-6 mb-4"
            >
              <p className="m3-label-medium mb-4">
                התחלת סשן ללא לקוח נבחר (ניתן גם מכרטיס לקוח ב-CRM).
              </p>
              <RemoteSupportPanel agentName={agentName} hideEmailStatusBanner />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="m3-card p-4 sm:p-6 mb-4"
            >
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="m3-label-large font-semibold flex items-center gap-2">
                  <MonitorPlay className="w-4 h-4 text-teal-700" />
                  סשני צפייה (דפדפן)
                </h2>
                <span className="m3-badge">{activeScreen} פעילים</span>
              </div>
              {screenSessions.length === 0 ? (
                <p className="m3-label-medium text-on-surface-variant">אין סשני צפייה עדיין.</p>
              ) : (
                <ul className="divide-y divide-outline-variant/40">
                  {screenSessions.slice(0, 15).map((s) => {
                    const lastMail = getLastEmailLogForSession(s.id);
                    const mailLabel =
                      lastMail?.status === "sent"
                        ? `מייל: נשלח ${formatWhen(lastMail.sentAt)}`
                        : lastMail?.status === "failed"
                          ? "מייל: נכשל"
                          : lastMail?.status === "simulated"
                            ? "מייל: סימולציה"
                            : s.emailSentAt
                              ? `מייל: ${formatWhen(s.emailSentAt)}`
                              : null;
                    return (
                    <li key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="m3-label-medium font-mono text-left text-xs" dir="ltr">
                          {s.id}
                        </p>
                        <p className="m3-label-medium text-on-surface-variant text-xs mt-0.5">
                          {s.agentName || "נציג"} · {formatWhen(s.createdAt)}
                          {s.customerEmail ? ` · ${s.customerEmail}` : ""}
                        </p>
                        {mailLabel ? (
                          <p className="m3-label-medium text-xs mt-0.5 text-teal-800">{mailLabel}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`m3-badge text-xs ${
                            s.status === "active"
                              ? "bg-teal-100 text-teal-900"
                              : "bg-surface-container-high"
                          }`}
                        >
                          {s.status === "active" ? "פעיל" : "הסתיים"}
                        </span>
                        {s.crmCustomerId && (
                          <Link
                            to={`/crm/${s.crmCustomerId}`}
                            className="text-primary text-xs hover:underline"
                          >
                            לקוח
                          </Link>
                        )}
                      </div>
                    </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>

            {demoModeEnabled && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 }}
                className="m3-card p-4 sm:p-6 mb-4"
              >
                <h2 className="m3-label-large font-semibold flex items-center gap-2 mb-4">
                  <Film className="w-4 h-4 text-rose-700" />
                  הקלטות שמורות (דמו)
                </h2>
                <DemoRecordingsLibrary />
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="m3-card p-4 sm:p-6"
            >
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="m3-label-large font-semibold flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-indigo-700" />
                  סשני RustDesk
                </h2>
                <span className="m3-badge">{activeRust} פעילים</span>
              </div>
              {rustDeskSessions.length === 0 ? (
                <p className="m3-label-medium text-on-surface-variant">אין סשנים עדיין.</p>
              ) : (
                <ul className="divide-y divide-outline-variant/40">
                  {rustDeskSessions.slice(0, 15).map((s) => (
                    <li key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="m3-label-medium font-mono text-left" dir="ltr">
                          {s.rustDeskId || "—"}
                        </p>
                        <p className="m3-label-medium text-on-surface-variant text-xs mt-0.5">
                          {s.agentName || "נציג"} · {formatWhen(s.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`m3-badge text-xs ${
                            s.status === "active"
                              ? "bg-teal-100 text-teal-900"
                              : "bg-surface-container-high"
                          }`}
                        >
                          {s.status === "active" ? "פעיל" : "הסתיים"}
                        </span>
                        {s.crmCustomerId && (
                          <Link
                            to={`/crm/${s.crmCustomerId}`}
                            className="text-primary text-xs hover:underline"
                          >
                            לקוח
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="m3-card p-4 sm:p-6 m3-label-medium text-on-surface-variant"
          >
            מודול תמיכה מרחוק אינו פעיל. פנו למנהל המערכת.
          </motion.div>
        )}
      </div>
    </div>
  );
}

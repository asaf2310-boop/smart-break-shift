import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Contact, Monitor } from "lucide-react";
import { getStoredAgentName } from "@/constants/scheduling";
import RemoteSupportPanel from "@/components/remote/RemoteSupportPanel";
import {
  listSessions,
  remoteSupportDemoAvailable,
  subscribeRemoteSupport,
} from "@/lib/remoteSupportStore";

function formatWhen(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function RemoteSupportPage() {
  const agentName = getStoredAgentName();
  const demoAvailable = remoteSupportDemoAvailable();
  const [sessions, setSessions] = useState(() => listSessions());

  useEffect(() => {
    setSessions(listSessions());
    return subscribeRemoteSupport(() => setSessions(listSessions()));
  }, []);

  const activeCount = sessions.filter((s) => s.status === "active").length;

  return (
    <div className="m3-page pt-app-nav" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-l from-violet-600 to-indigo-600 flex items-center justify-center shadow-elevation-2">
              <Monitor className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="m3-headline-small text-xl font-semibold">השתלטות מרחוק</h1>
              <p className="m3-label-medium">RustDesk · אישור לקוח ותיעוד</p>
            </div>
          </div>
          <Link to="/" className="m3-btn-outlined text-xs py-2">
            <ArrowRight className="w-4 h-4" />
            ראשי
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="m3-card p-4 sm:p-6 space-y-4 mb-4"
        >
          <h2 className="m3-label-large font-semibold">איך מתחילים</h2>
          <ol className="m3-label-medium space-y-2 list-decimal list-inside text-on-surface-variant leading-relaxed">
            <li>בכרטיס לקוח ב-CRM — «תמיכה מרחוק», או מהכפתור למטה ללא לקוח.</li>
            <li>הסבירו ללקוח להתקין RustDesk ולאשר גישה בקול — או שלחו במייל קישור הורדה (דמו).</li>
            <li>הזינו מזהה (9 ספרות) וסיסמה, פתחו RustDesk או העתיקו פרטים.</li>
            <li>סיימו את הסשן בסיום הטיפול — הסיסמה תוסר מהאחסון המקומי.</li>
          </ol>
          <Link
            to="/crm"
            className="inline-flex items-center gap-2 m3-btn-outlined text-sm py-2"
          >
            <Contact className="w-4 h-4" />
            מעבר ל-CRM
          </Link>
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
              <RemoteSupportPanel agentName={agentName} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="m3-card p-4 sm:p-6"
            >
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="m3-label-large font-semibold">סשנים אחרונים</h2>
                <span className="m3-badge">{activeCount} פעילים</span>
              </div>
              {sessions.length === 0 ? (
                <p className="m3-label-medium text-on-surface-variant">אין סשנים עדיין.</p>
              ) : (
                <ul className="divide-y divide-outline-variant/40">
                  {sessions.slice(0, 20).map((s) => (
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
            תמיכה מרחוק זמינה בסביבת דמו. השתמשו בכרטיס לקוח ב-CRM כשהפיצ&apos;ר פעיל.
          </motion.div>
        )}
      </div>
    </div>
  );
}

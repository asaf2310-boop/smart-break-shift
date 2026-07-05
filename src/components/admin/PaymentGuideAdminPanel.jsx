import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink, FileText, Smartphone, Video } from "lucide-react";
import {
  PUBLIC_MANUAL_CHARGE_PDF_PATH,
  PUBLIC_MANUAL_CHARGE_VIDEO_PATH,
  PUBLIC_PAYMENT_LINK_PDF_PATH,
  PUBLIC_PAYMENT_LINK_VIDEO_PATH,
  PUBLIC_TRANSACTION_DETAILS_PDF_PATH,
  PUBLIC_TRANSACTION_DETAILS_VIDEO_PATH,
  WEALTHY_GUIDE_BASE,
  wealthyGuideFeatures,
} from "@/lib/wealthyGuideConfig";
import { AGENT_MODULES } from "@/constants/agentModules";

const readyGuides = wealthyGuideFeatures.filter((f) => f.ready);

export default function PaymentGuideAdminPanel() {
  const moduleLabel = AGENT_MODULES.knowledge_guide?.label || "מדריך תשלומים";

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-2">סקירה</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          מדריך תשלומים (Wealthy Guide) מוצג לנציגים עם מודול{" "}
          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">knowledge_guide</code>. התוכן
          מוגדר בקוד (שדות, צילומי מסך, סרטוני הדרכה) — אין ממשק CMS נפרד.
        </p>
        <p className="text-sm text-slate-500 mt-2">
          להפעלה/כיבוי לנציג:{" "}
          <Link to="/admin/users" className="text-primary font-semibold hover:underline">
            ניהול נציגים → מודולים
          </Link>
          {" · "}
          מודול: <strong>{moduleLabel}</strong>
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-4">מדריכים פעילים</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {readyGuides.map((guide) => (
            <div
              key={guide.slug}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-800">{guide.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{guide.description}</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                  פעיל
                </span>
              </div>
              <Link
                to={`${WEALTHY_GUIDE_BASE}/${guide.slug}`}
                className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline mt-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                תצוגת נציג
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-2">קישורים ציבוריים (SMS)</h2>
        <p className="text-sm text-slate-500 mb-4">
          דפי אורח לשליחה ב-SMS — ללא התחברות נציג
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2 flex-wrap">
            <Video className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700">חיוב ידני — וידאו:</span>
            <Link to={PUBLIC_MANUAL_CHARGE_VIDEO_PATH} className="text-primary hover:underline font-mono text-xs">
              {PUBLIC_MANUAL_CHARGE_VIDEO_PATH}
            </Link>
          </li>
          <li className="flex items-center gap-2 flex-wrap">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700">חיוב ידני — PDF:</span>
            <Link to={PUBLIC_MANUAL_CHARGE_PDF_PATH} className="text-primary hover:underline font-mono text-xs">
              {PUBLIC_MANUAL_CHARGE_PDF_PATH}
            </Link>
          </li>
          <li className="flex items-center gap-2 flex-wrap">
            <Video className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700">לינק לתשלום — וידאו:</span>
            <Link to={PUBLIC_PAYMENT_LINK_VIDEO_PATH} className="text-primary hover:underline font-mono text-xs">
              {PUBLIC_PAYMENT_LINK_VIDEO_PATH}
            </Link>
          </li>
          <li className="flex items-center gap-2 flex-wrap">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700">לינק לתשלום — PDF:</span>
            <Link to={PUBLIC_PAYMENT_LINK_PDF_PATH} className="text-primary hover:underline font-mono text-xs">
              {PUBLIC_PAYMENT_LINK_PDF_PATH}
            </Link>
          </li>
          <li className="flex items-center gap-2 flex-wrap">
            <Video className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700">פירוט עסקאות — וידאו:</span>
            <Link to={PUBLIC_TRANSACTION_DETAILS_VIDEO_PATH} className="text-primary hover:underline font-mono text-xs">
              {PUBLIC_TRANSACTION_DETAILS_VIDEO_PATH}
            </Link>
          </li>
          <li className="flex items-center gap-2 flex-wrap">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700">פירוט עסקאות — PDF:</span>
            <Link to={PUBLIC_TRANSACTION_DETAILS_PDF_PATH} className="text-primary hover:underline font-mono text-xs">
              {PUBLIC_TRANSACTION_DETAILS_PDF_PATH}
            </Link>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
        <div className="flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-1">בדיקה מהירה</h2>
            <p className="text-sm text-slate-600 mb-3">
              פתחו את מדריך התשלומים כפי שהנציג רואה אותו, כולל שליחת SMS ללקוח.
            </p>
            <Link
              to={WEALTHY_GUIDE_BASE}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold px-4 py-2 hover:bg-indigo-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              מדריך תשלומים (נציג)
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

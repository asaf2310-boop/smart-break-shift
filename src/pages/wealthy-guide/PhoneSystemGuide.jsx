import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ExternalLink,
  FileDown,
  Headphones,
  Info,
  LogIn,
  MessageSquare,
  Phone,
  Settings,
  BarChart3,
  X,
  ZoomIn,
} from "lucide-react";
import FieldCard from "@/components/wealthy-guide/FieldCard";
import WealthyGuideSmsDialog from "@/components/wealthy-guide/WealthyGuideSmsDialog";
import {
  PHONE_SYSTEM_DIRECTORY_URL,
  PHONE_SYSTEM_INTRO,
  phoneSystemScreenshots,
  phoneSystemSections,
  phoneSystemWorkflowSteps,
  wealthyGuidePath,
} from "@/lib/wealthyGuideConfig";
import { exportPhoneSystemGuidePdf } from "@/lib/wealthyGuidePdfExport";

const WORKFLOW_ICONS = [LogIn, Settings, Headphones, Phone, BarChart3];

export default function PhoneSystemGuide() {
  const [searchParams] = useSearchParams();
  const initialPhone = searchParams.get("phone") || "";
  const [zoomImage, setZoomImage] = useState(null);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportPhoneSystemGuidePdf({
        title: "מערכת טלפוניה (Genesys Cloud) — מדריך תשלומים",
        intro: PHONE_SYSTEM_INTRO,
        sections: phoneSystemSections,
        directoryUrl: PHONE_SYSTEM_DIRECTORY_URL,
        screenshotUrl: phoneSystemScreenshots[0]?.url,
        workflowSteps: phoneSystemWorkflowSteps,
      });
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  let runningIndex = 0;

  return (
    <div className="pb-12 min-w-0" dir="rtl">
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-on-surface-variant mb-4">
          <span>הדרכה</span>
          <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
          <span className="text-primary font-medium">מערכת טלפוניה</span>
        </div>
        <div className="flex flex-col gap-4 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
              <Phone className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-on-surface">מערכת טלפוניה</h1>
              <p className="text-on-surface-variant text-sm mt-0.5">
                חוברת הדרכה לנציג — Genesys Cloud
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowSmsDialog(true)}
              className="m3-btn-outlined text-sm py-2.5 flex items-center justify-center gap-2 w-full lg:w-auto"
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              שלח קישור ב-SMS
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="m3-btn-filled text-sm py-2.5 flex items-center justify-center gap-2 w-full sm:col-span-2 lg:col-span-1 lg:w-auto disabled:opacity-60"
            >
              <FileDown className="w-4 h-4 shrink-0" />
              {exportingPdf ? "מייצא..." : "ייצוא ל-PDF"}
            </button>
          </div>
        </div>
      </motion.div>

      <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 sm:p-6 mb-8">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-on-surface mb-1">מה זה Genesys Cloud?</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">{PHONE_SYSTEM_INTRO}</p>
          </div>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-primary rounded-full" />
          תהליך העבודה
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {phoneSystemWorkflowSteps.map((step, index) => {
            const Icon = WORKFLOW_ICONS[index] || Phone;
            return (
              <div
                key={step.title}
                className="m3-card p-4 sm:p-5 border border-outline/15 text-center"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs text-on-surface-variant mb-1">שלב {index + 1}</p>
                <h3 className="text-sm font-bold text-on-surface mb-2">{step.title}</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-primary rounded-full" />
          צילומי מסך של הממשק
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {phoneSystemScreenshots.map((shot) => (
            <button
              key={shot.url}
              type="button"
              onClick={() => setZoomImage(shot)}
              className="relative group cursor-pointer m3-card overflow-hidden border border-outline/15 hover:shadow-elevation-2 transition-all duration-300 text-right flex flex-col"
            >
              <img
                src={shot.url}
                alt={shot.alt}
                loading="lazy"
                className="w-full object-contain max-h-72 bg-surface-container-low"
              />
              <div className="p-3 text-xs text-on-surface-variant leading-relaxed border-t border-outline/10">
                {shot.caption}
              </div>
              <div className="absolute inset-x-0 top-0 h-72 bg-black/0 group-hover:bg-black/5 transition-all duration-300 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-surface/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                  <ZoomIn className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-on-surface">לחץ להגדלה</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
          role="dialog"
          aria-modal
          aria-label="צילום מסך מוגדל"
        >
          <button
            type="button"
            onClick={() => setZoomImage(null)}
            className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            aria-label="סגור"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={zoomImage.url}
            alt={zoomImage.alt}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {phoneSystemSections.map((section) => {
        const startIndex = runningIndex;
        runningIndex += section.steps.length;
        return (
          <div key={section.number} className="mb-10">
            <h2 className="text-lg font-bold text-on-surface mb-2 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full" />
              {section.number}. {section.title}
              <span className="text-xs text-on-surface-variant font-normal mr-1">
                ({section.steps.length} שלבים)
              </span>
            </h2>
            {section.intro && (
              <p className="text-sm text-on-surface-variant leading-relaxed mb-4 mr-3.5">
                {section.intro}
              </p>
            )}
            {section.showDirectoryLink && (
              <div className="mb-4 mr-0 sm:mr-3.5 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
                <p className="text-sm font-bold text-on-surface mb-2">קישור כניסה למערכת</p>
                <a
                  href={PHONE_SYSTEM_DIRECTORY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline break-all"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  {PHONE_SYSTEM_DIRECTORY_URL.replace(/^https?:\/\//, "")}
                </a>
                <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                  לחצו על הקישור כדי לפתוח את ספריית האפליקציות של Genesys Cloud בכרטיסייה חדשה.
                </p>
              </div>
            )}
            <div className="space-y-3">
              {section.steps.map((field, index) => (
                <FieldCard
                  key={`${section.number}-${field.name}`}
                  field={field}
                  index={startIndex + index}
                />
              ))}
            </div>
          </div>
        );
      })}

      <WealthyGuideSmsDialog
        open={showSmsDialog}
        onOpenChange={setShowSmsDialog}
        initialPhone={initialPhone}
        guideType="phone-system"
      />

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-outline/15">
        <Link to={wealthyGuidePath()} className="text-sm text-primary hover:underline">
          חזרה לרשימת הנושאים
        </Link>
        <Link
          to={wealthyGuidePath("shva-errors")}
          className="text-xs text-on-surface-variant px-3 py-2 rounded-lg bg-surface-container text-center sm:text-right hover:text-primary transition-colors"
        >
          ← מדריך שגיאות שב״א
        </Link>
      </div>
    </div>
  );
}

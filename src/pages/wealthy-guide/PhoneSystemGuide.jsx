import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, FileDown, Info, MessageSquare, Phone } from "lucide-react";
import PhoneSystemSections from "@/components/wealthy-guide/PhoneSystemSections";
import WealthyGuideSmsDialog from "@/components/wealthy-guide/WealthyGuideSmsDialog";
import {
  PHONE_SYSTEM_INTRO,
  phoneSystemSections,
  wealthyGuidePath,
} from "@/lib/wealthyGuideConfig";
import { exportPhoneSystemGuidePdf } from "@/lib/wealthyGuidePdfExport";

export default function PhoneSystemGuide() {
  const [searchParams] = useSearchParams();
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportPhoneSystemGuidePdf({
        title: "מערכת טלפוניה — Genesys Widget בתוך Dynamics",
        intro: PHONE_SYSTEM_INTRO,
        sections: phoneSystemSections,
      });
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="pb-12 min-w-0" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-on-surface-variant mb-4">
          <span>הדרכה</span>
          <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
          <span className="text-primary font-medium">מערכת טלפוניה</span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
              <Phone className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-on-surface">
                מערכת טלפוניה
              </h1>
              <p className="text-on-surface-variant text-sm mt-0.5">
                Genesys Widget בתוך Dynamics
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
              className="m3-btn-filled text-sm py-2.5 flex items-center justify-center gap-2 w-full lg:w-auto disabled:opacity-60"
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
            <h2 className="text-sm font-bold text-on-surface mb-1">
              חיבור באמצעות SSO בלבד
            </h2>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {PHONE_SYSTEM_INTRO}
            </p>
          </div>
        </div>
      </div>

      <PhoneSystemSections sections={phoneSystemSections} />

      <WealthyGuideSmsDialog
        open={showSmsDialog}
        onOpenChange={setShowSmsDialog}
        initialPhone={searchParams.get("phone") || ""}
        guideType="phone-system"
      />

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 mt-10 border-t border-outline/15">
        <Link to={wealthyGuidePath()} className="text-sm text-primary hover:underline">
          חזרה לרשימת הנושאים
        </Link>
        <Link
          to={wealthyGuidePath("shva-errors")}
          className="text-xs text-on-surface-variant px-3 py-2 rounded-lg bg-surface-container text-center hover:text-primary transition-colors"
        >
          ← מדריך שגיאות שב״א
        </Link>
      </div>
    </div>
  );
}

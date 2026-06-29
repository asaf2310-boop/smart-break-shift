import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, CreditCard, FileDown, Info, MessageSquare, PlayCircle, X, ZoomIn } from "lucide-react";
import FieldCard from "@/components/wealthy-guide/FieldCard";
import WealthyGuideSmsDialog from "@/components/wealthy-guide/WealthyGuideSmsDialog";
import {
  MANUAL_CHARGE_INTRO,
  MANUAL_CHARGE_SCREENSHOT_URL,
  MANUAL_CHARGE_TRAINING_VIDEO_URL,
  manualChargeFields,
  wealthyGuidePath,
} from "@/lib/wealthyGuideConfig";
import { exportManualChargeGuidePdf } from "@/lib/wealthyGuidePdfExport";

export default function ManualChargeGuide() {
  const [searchParams] = useSearchParams();
  const initialPhone = searchParams.get("phone") || "";
  const [showFullImage, setShowFullImage] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportManualChargeGuidePdf({
        title: "חיוב ידני — מדריך תשלומים",
        intro: MANUAL_CHARGE_INTRO,
        fields: manualChargeFields,
        screenshotUrl: MANUAL_CHARGE_SCREENSHOT_URL,
      });
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="pb-12 min-w-0">
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-on-surface-variant mb-4">
          <span>הדרכה</span>
          <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
          <span>ביצוע פעולות</span>
          <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
          <span className="text-primary font-medium">חיוב ידני</span>
        </div>
        <div className="flex flex-col gap-4 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-on-surface">חיוב ידני</h1>
              <p className="text-on-surface-variant text-sm mt-0.5">ביצוע פעולות → חיוב ידני</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowSmsDialog(true)}
              className="m3-btn-outlined text-sm py-2.5 flex items-center justify-center gap-2 w-full lg:w-auto"
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              שלח קישורים ב-SMS
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="m3-btn-outlined text-sm py-2.5 flex items-center justify-center gap-2 w-full lg:w-auto disabled:opacity-60"
            >
              <FileDown className="w-4 h-4 shrink-0" />
              {exportingPdf ? "מייצא..." : "ייצוא ל-PDF"}
            </button>
            <button
              type="button"
              onClick={() => setShowVideo(true)}
              className="m3-btn-filled text-sm py-2.5 flex items-center justify-center gap-2 w-full sm:col-span-2 lg:col-span-1 lg:w-auto"
            >
              <PlayCircle className="w-4 h-4 shrink-0" />
              סרטון הדרכה
            </button>
          </div>
        </div>
      </motion.div>

      <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 sm:p-6 mb-8">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-on-surface mb-1">מה זה חיוב ידני?</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">{MANUAL_CHARGE_INTRO}</p>
          </div>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-primary rounded-full" />
          צילום מסך הממשק
        </h2>
        <button
          type="button"
          onClick={() => setShowFullImage(true)}
          className="relative group w-full cursor-pointer m3-card overflow-hidden border border-outline/15 hover:shadow-elevation-2 transition-all duration-300 text-right"
        >
          <img
            src={MANUAL_CHARGE_SCREENSHOT_URL}
            alt="ממשק חיוב ידני"
            className="w-full object-contain max-h-[600px]"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all duration-300 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-surface/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <ZoomIn className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-on-surface">לחץ להגדלה</span>
            </div>
          </div>
        </button>
      </div>

      {showVideo && (
        <div
          className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4"
          onClick={() => setShowVideo(false)}
          role="dialog"
          aria-modal
          aria-label="סרטון הדרכה לחיוב ידני"
        >
          <button
            type="button"
            onClick={() => setShowVideo(false)}
            className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            aria-label="סגור"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <video
            src={MANUAL_CHARGE_TRAINING_VIDEO_URL}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-lg bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            הדפדפן שלך אינו תומך בהצגת וידאו.
          </video>
        </div>
      )}

      {showFullImage && (
        <div
          className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4"
          onClick={() => setShowFullImage(false)}
          role="dialog"
          aria-modal
          aria-label="צילום מסך מוגדל"
        >
          <button
            type="button"
            onClick={() => setShowFullImage(false)}
            className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            aria-label="סגור"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={MANUAL_CHARGE_SCREENSHOT_URL}
            alt="ממשק חיוב ידני"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <WealthyGuideSmsDialog
        open={showSmsDialog}
        onOpenChange={setShowSmsDialog}
        initialPhone={initialPhone}
      />

      <div className="mb-10">
        <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-primary rounded-full" />
          הסבר שדות הטופס
          <span className="text-xs text-on-surface-variant font-normal mr-1">
            ({manualChargeFields.length} שדות)
          </span>
        </h2>
        <div className="space-y-3">
          {manualChargeFields.map((field, index) => (
            <FieldCard key={field.name} field={field} index={index} />
          ))}
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-outline/15">
        <Link to={wealthyGuidePath()} className="text-sm text-primary hover:underline">
          חזרה לרשימת הנושאים
        </Link>
        <span className="text-xs text-on-surface-variant px-3 py-2 rounded-lg bg-surface-container text-center sm:text-right">
          הפיצ׳ר הבא: לינק לתשלום · בקרוב
        </span>
      </div>
    </div>
  );
}

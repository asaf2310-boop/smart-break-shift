import React, { useState } from "react";
import { FileDown, Info } from "lucide-react";
import PhoneSystemSections from "@/components/wealthy-guide/PhoneSystemSections";
import WealthyGuideGuestShell from "@/components/wealthy-guide/WealthyGuideGuestShell";
import {
  PHONE_SYSTEM_INTRO,
  phoneSystemSections,
} from "@/lib/wealthyGuideConfig";
import { exportPhoneSystemGuidePdf } from "@/lib/wealthyGuidePdfExport";

export default function PhoneSystemGuestPdfPage() {
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleDownload = async () => {
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
    <WealthyGuideGuestShell
      title="מדריך מערכת טלפוניה"
      subtitle="Genesys Widget בתוך Dynamics — מדריך מלא החל מסעיף 1"
    >
      <div className="space-y-7" dir="rtl">
        <button
          type="button"
          onClick={handleDownload}
          disabled={exportingPdf}
          className="m3-btn-filled w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <FileDown className="w-5 h-5" />
          {exportingPdf ? "מוריד..." : "הורדת מדריך PDF"}
        </button>

        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:p-5">
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
      </div>
    </WealthyGuideGuestShell>
  );
}

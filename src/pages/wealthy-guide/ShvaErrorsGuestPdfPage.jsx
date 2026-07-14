import React, { useState } from "react";
import { FileDown, Info } from "lucide-react";
import WealthyGuideGuestShell from "@/components/wealthy-guide/WealthyGuideGuestShell";
import { SHVA_ERRORS_INTRO, shvaErrorCodes } from "@/lib/wealthyGuidePaymentErrors";
import { exportShvaErrorsGuidePdf } from "@/lib/wealthyGuidePdfExport";

export default function ShvaErrorsGuestPdfPage() {
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleDownload = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportShvaErrorsGuidePdf({
        title: 'שגיאות שב"א — מדריך תשלומים',
        intro: SHVA_ERRORS_INTRO,
        errors: shvaErrorCodes,
      });
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <WealthyGuideGuestShell
      title='מדריך שגיאות שב"א'
      subtitle="הורידו את רשימת קודי השגיאה בפורמט PDF או עיינו בתקציר למטה."
    >
      <div className="space-y-6">
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
              <h2 className="text-sm font-bold text-on-surface mb-1">מה זה קוד שב״א?</h2>
              <p className="text-sm text-on-surface-variant leading-relaxed">{SHVA_ERRORS_INTRO}</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-on-surface mb-3">
            קודי שגיאה ({shvaErrorCodes.length})
          </h2>
          <ul className="space-y-2 max-h-[28rem] overflow-y-auto">
            {shvaErrorCodes.map((err) => (
              <li
                key={err.code}
                className="rounded-xl border border-outline/15 bg-surface px-3 py-2.5 text-sm text-on-surface flex gap-2"
              >
                <code className="font-mono text-xs font-bold text-primary shrink-0">{err.code}</code>
                <span className="text-on-surface-variant leading-snug">{err.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </WealthyGuideGuestShell>
  );
}

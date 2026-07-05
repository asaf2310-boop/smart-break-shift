import React, { useState } from "react";
import { FileDown, Info } from "lucide-react";
import WealthyGuideGuestShell from "@/components/wealthy-guide/WealthyGuideGuestShell";
import {
  TRANSACTION_DETAILS_INTRO,
  TRANSACTION_DETAILS_SCREENSHOT_URL,
  transactionDetailsFilterFields,
  transactionDetailsTableFields,
} from "@/lib/wealthyGuideConfig";
import { exportTransactionDetailsGuidePdf } from "@/lib/wealthyGuidePdfExport";

export default function TransactionDetailsGuestPdfPage() {
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleDownload = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportTransactionDetailsGuidePdf({
        title: "פירוט עסקאות — מדריך תשלומים",
        intro: TRANSACTION_DETAILS_INTRO,
        filterFields: transactionDetailsFilterFields,
        tableFields: transactionDetailsTableFields,
        screenshotUrl: TRANSACTION_DETAILS_SCREENSHOT_URL,
      });
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  const totalItems = transactionDetailsFilterFields.length + transactionDetailsTableFields.length;

  return (
    <WealthyGuideGuestShell
      title="מדריך פירוט עסקאות"
      subtitle="הורידו את המדריך המלא בפורמט PDF או עיינו בתקציר למטה."
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
              <h2 className="text-sm font-bold text-on-surface mb-1">מה זה פירוט עסקאות?</h2>
              <p className="text-sm text-on-surface-variant leading-relaxed">{TRANSACTION_DETAILS_INTRO}</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-on-surface mb-3">תוכן המדריך ({totalItems} פריטים)</h2>
          <ul className="space-y-2">
            {[...transactionDetailsFilterFields, ...transactionDetailsTableFields].map((field, index) => (
              <li
                key={field.name}
                className="rounded-xl border border-outline/15 bg-surface px-3 py-2.5 text-sm text-on-surface"
              >
                <span className="text-on-surface-variant ml-2">{index + 1}.</span>
                {field.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </WealthyGuideGuestShell>
  );
}

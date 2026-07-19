import React, { useState } from "react";
import { ExternalLink, FileDown, Info } from "lucide-react";
import WealthyGuideGuestShell from "@/components/wealthy-guide/WealthyGuideGuestShell";
import {
  PHONE_SYSTEM_DIRECTORY_URL,
  PHONE_SYSTEM_INTRO,
  flattenPhoneSystemFields,
  phoneSystemSections,
  phoneSystemWorkflowSteps,
  phoneSystemScreenshots,
} from "@/lib/wealthyGuideConfig";
import { exportPhoneSystemGuidePdf } from "@/lib/wealthyGuidePdfExport";

export default function PhoneSystemGuestPdfPage() {
  const [exportingPdf, setExportingPdf] = useState(false);
  const allFields = flattenPhoneSystemFields();

  const handleDownload = async () => {
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

  return (
    <WealthyGuideGuestShell
      title="מדריך מערכת טלפוניה (Genesys Cloud)"
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
              <h2 className="text-sm font-bold text-on-surface mb-1">מה זה Genesys Cloud?</h2>
              <p className="text-sm text-on-surface-variant leading-relaxed">{PHONE_SYSTEM_INTRO}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/25 bg-surface p-4 sm:p-5">
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
        </div>

        <div>
          <h2 className="text-sm font-bold text-on-surface mb-3">
            תוכן המדריך ({allFields.length} פריטים)
          </h2>
          <ul className="space-y-2">
            {allFields.map((field, index) => (
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

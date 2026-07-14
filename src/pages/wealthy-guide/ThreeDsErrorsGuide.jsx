import React from "react";
import { ShieldAlert } from "lucide-react";
import PaymentErrorsGuideView from "@/components/wealthy-guide/PaymentErrorsGuideView";
import {
  THREE_DS_ERROR_SOURCES,
  THREE_DS_ERRORS_INTRO,
  threeDsErrorCodes,
  threeDsMerchantFacingErrors,
  threeDsTransStatusCodes,
  threeDsTransStatusReasonCodes,
} from "@/lib/wealthyGuidePaymentErrors";
import { exportThreeDsErrorsGuidePdf } from "@/lib/wealthyGuidePdfExport";

const CATEGORY_LABELS = {
  transStatus: "סטטוס אימות (transStatus)",
  transStatusReason: "סיבת כישלון (transStatusReason)",
  merchant: "הודעות נפוצות לנציג / לקוח",
};

/**
 * Temporarily unused — removed from nav/routes ("שגיאות 3DS").
 * Re-enable by restoring App.jsx routes and wealthyGuideConfig menu/features.
 */
export default function ThreeDsErrorsGuide() {
  return (
    <PaymentErrorsGuideView
      title="שגיאות 3DS"
      subtitle="אימות זהות מול כישלון אישור אשראי"
      intro={THREE_DS_ERRORS_INTRO}
      sourcesNote={THREE_DS_ERROR_SOURCES}
      icon={ShieldAlert}
      errors={threeDsErrorCodes}
      groupByCategory
      categoryLabels={CATEGORY_LABELS}
      guideType="3ds-errors"
      onExportPdf={() =>
        exportThreeDsErrorsGuidePdf({
          title: "שגיאות 3DS — מדריך תשלומים",
          intro: THREE_DS_ERRORS_INTRO,
          statusCodes: threeDsTransStatusCodes,
          reasonCodes: threeDsTransStatusReasonCodes,
          merchantCodes: threeDsMerchantFacingErrors,
        })
      }
    />
  );
}

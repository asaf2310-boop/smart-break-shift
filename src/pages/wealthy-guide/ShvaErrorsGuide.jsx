import React from "react";
import { Ban } from "lucide-react";
import PaymentErrorsGuideView from "@/components/wealthy-guide/PaymentErrorsGuideView";
import {
  SHVA_ERROR_SOURCES,
  SHVA_ERRORS_INTRO,
  shvaErrorCodes,
} from "@/lib/wealthyGuidePaymentErrors";
import { exportShvaErrorsGuidePdf } from "@/lib/wealthyGuidePdfExport";

export default function ShvaErrorsGuide() {
  return (
    <PaymentErrorsGuideView
      title='שגיאות שב"א'
      subtitle="קודי תשובה של מערכת הסליקה הארצית"
      intro={SHVA_ERRORS_INTRO}
      sourcesNote={SHVA_ERROR_SOURCES}
      icon={Ban}
      errors={shvaErrorCodes}
      guideType="shva-errors"
      onExportPdf={() =>
        exportShvaErrorsGuidePdf({
          title: 'שגיאות שב"א — מדריך תשלומים',
          intro: SHVA_ERRORS_INTRO,
          errors: shvaErrorCodes,
        })
      }
    />
  );
}

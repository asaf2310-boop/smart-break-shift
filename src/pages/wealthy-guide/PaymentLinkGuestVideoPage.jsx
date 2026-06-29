import React from "react";
import WealthyGuideGuestShell from "@/components/wealthy-guide/WealthyGuideGuestShell";
import { PAYMENT_LINK_TRAINING_VIDEO_URL } from "@/lib/wealthyGuideConfig";

export default function PaymentLinkGuestVideoPage() {
  return (
    <WealthyGuideGuestShell
      title="סרטון הדרכה — לינק לתשלום"
      subtitle="צפו בסרטון כדי להבין כיצד ליצור ולשלוח לינק לתשלום ללקוח."
    >
      <div className="rounded-2xl overflow-hidden border border-outline/15 bg-black shadow-elevation-1">
        <video
          src={PAYMENT_LINK_TRAINING_VIDEO_URL}
          controls
          playsInline
          className="w-full max-h-[70vh] bg-black"
          preload="metadata"
        >
          הדפדפן שלך אינו תומך בהצגת וידאו.
        </video>
      </div>
      <p className="text-xs text-on-surface-variant text-center mt-4">
        אם הסרטון לא נטען, פנו לנציג התמיכה לקבלת עזרה.
      </p>
    </WealthyGuideGuestShell>
  );
}

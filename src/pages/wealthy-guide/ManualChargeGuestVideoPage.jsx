import React from "react";
import WealthyGuideGuestShell from "@/components/wealthy-guide/WealthyGuideGuestShell";
import { MANUAL_CHARGE_TRAINING_VIDEO_URL } from "@/lib/wealthyGuideConfig";

export default function ManualChargeGuestVideoPage() {
  return (
    <WealthyGuideGuestShell
      title="סרטון הדרכה — חיוב ידני"
      subtitle="צפו בסרטון כדי להבין כיצד לבצע חיוב ידני במערכת."
    >
      <div className="rounded-2xl overflow-hidden border border-outline/15 bg-black shadow-elevation-1">
        <video
          src={MANUAL_CHARGE_TRAINING_VIDEO_URL}
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

import React from "react";
import { brandVisualEnabled } from "@/lib/brandShell";
import { cn } from "@/lib/utils";
import { m3PageClass, schedulingPageRootClass } from "@/lib/hypPage";

function SchedulingAmbient() {
  return (
    <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-300/20 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-3xl" />
    </div>
  );
}

/**
 * HYP page shell — transparent on html.app-hyp-demo ambient; legacy purple orbs only when brand shell is off.
 */
export default function HypPageLayout({
  children,
  variant = "m3",
  className,
  contentClassName,
  withNav = true,
}) {
  if (variant === "scheduling") {
    return (
      <div className={schedulingPageRootClass(className)} dir="rtl">
        {!brandVisualEnabled && <SchedulingAmbient />}
        <div className={cn("relative z-10 mx-auto w-full", contentClassName)}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={m3PageClass(className)} dir="rtl">
      {children}
    </div>
  );
}

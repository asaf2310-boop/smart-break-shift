import React from "react";
import { cn } from "@/lib/utils";

/** Entry hero — subtitle only (no logo). */
export default function BrandEntryBlock({
  onDark = false,
  subtitle = "מערכת מוקד",
  className,
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center text-center gap-3 px-2",
        className,
      )}
    >
      {subtitle ? (
        <p
          className={cn(
            "text-xs tracking-wide",
            onDark ? "text-white/70 tracking-wider" : "m3-label-medium text-on-surface-variant",
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

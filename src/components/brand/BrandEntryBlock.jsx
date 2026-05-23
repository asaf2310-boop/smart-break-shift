import React from "react";
import { cn } from "@/lib/utils";
import BrandLogo from "@/components/brand/BrandLogo";

/**
 * Entry hero: full primary PNG on light surfaces; hub icon + bright wordmark on dark login.
 */
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
      {onDark ? (
        <BrandLogo
          variant="lockup"
          onDark
          linkToHome={false}
          size="lg"
          height={96}
          className="mx-auto justify-center drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
        />
      ) : (
        <img
          src="/allincenter-logo.png"
          alt="AllInCenter"
          className="w-full max-w-lg sm:max-w-xl mx-auto h-auto object-contain brightness-105"
        />
      )}
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

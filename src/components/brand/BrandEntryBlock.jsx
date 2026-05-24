import React from "react";
import { cn } from "@/lib/utils";
import BrandLogo from "@/components/brand/BrandLogo";

/** Entry hero — home: full bright PNG; `variant="login"`: subtitle only (no logo). */
export default function BrandEntryBlock({
  onDark = false,
  variant = "full",
  size,
  subtitle = "מערכת מוקד",
  className,
  hideLogo = false,
}) {
  const isLogin = variant === "login" || hideLogo;
  const logoVariant = variant;
  const logoSize = size ?? (onDark ? "hero" : "xl");

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center text-center gap-3 px-2",
        className,
      )}
    >
      {!isLogin ? (
        <BrandLogo
          variant={logoVariant}
          onDark={onDark}
          linkToHome={false}
          size={logoSize}
          className={cn(
            "mx-auto w-full justify-center",
            onDark ? "max-w-[min(90vw,960px)]" : "max-w-lg sm:max-w-xl",
          )}
        />
      ) : null}
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

import React from "react";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "text-base sm:text-lg",
  md: "text-xl sm:text-2xl",
  lg: "text-4xl sm:text-[2.75rem] tracking-tight",
};

/** Connected brand name (wordmark / alt text). */
export const BRAND_DISPLAY_NAME = "AllInCenter";

/** Primary accent (cyan) for A / I / C highlights. */
export const BRAND_ACCENT_COLOR = "#22D3EE";

/** Dark-surface body gradient — shared with hub icon mask on login lockup. */
export const BRAND_GRADIENT_DARK_CLASS =
  "bg-gradient-to-r from-violet-200 via-fuchsia-200 to-teal-300";

/** Dark-surface accent gradient (A / I / C). */
export const BRAND_ACCENT_DARK_CLASS =
  "bg-gradient-to-br from-cyan-200 via-fuchsia-300 to-amber-200";

const ACCENT_SEGMENT = {
  light:
    "bg-gradient-to-br from-[#22D3EE] via-[#A78BFA] to-[#E879F9] bg-clip-text text-transparent",
  dark: `${BRAND_ACCENT_DARK_CLASS} bg-clip-text text-transparent drop-shadow-[0_0_14px_rgba(103,232,249,0.55)]`,
};

const GRADIENT_SEGMENT = {
  light: "bg-gradient-to-r from-[#8B5CF6] to-[#2DD4BF] bg-clip-text text-transparent",
  dark: `${BRAND_GRADIENT_DARK_CLASS} bg-clip-text text-transparent drop-shadow-[0_1px_14px_rgba(196,181,253,0.45)]`,
};

/**
 * AllInCenter wordmark — single connected word; A/I/C accented, remaining letters gradient.
 * `dir-ltr` keeps visual order A-ll-I-n-C-enter on RTL pages.
 * Use `onDark` on purple login / dark hero backgrounds.
 */
export default function BrandWordmark({ size = "md", onDark = false, className }) {
  const gradient = onDark ? GRADIENT_SEGMENT.dark : GRADIENT_SEGMENT.light;
  const accent = onDark ? ACCENT_SEGMENT.dark : ACCENT_SEGMENT.light;

  return (
    <span
      dir="ltr"
      className={cn(
        "dir-ltr inline-flex font-semibold tracking-tight select-none whitespace-nowrap",
        SIZE_CLASS[size] ?? SIZE_CLASS.md,
        onDark && "brightness-105",
        className,
      )}
      aria-label={BRAND_DISPLAY_NAME}
    >
      <span className={accent}>A</span>
      <span className={gradient}>ll</span>
      <span className={accent}>I</span>
      <span className={gradient}>n</span>
      <span className={accent}>C</span>
      <span className={gradient}>enter</span>
    </span>
  );
}

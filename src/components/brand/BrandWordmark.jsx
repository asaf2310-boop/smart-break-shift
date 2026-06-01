import React from "react";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "text-base sm:text-lg",
  md: "text-xl sm:text-2xl",
  lg: "text-4xl sm:text-[2.75rem] tracking-tight",
  hero: "text-[2.25rem] sm:text-5xl md:text-[3.25rem] tracking-tight",
};

/** A and C — accent color + larger capitals (I stays regular gradient). */
const ACCENT_LETTER_CLASS = "inline-block align-baseline text-[1.32em] leading-[0.9]";

/** Demo login — capital A only, slightly enlarged. */
const ACCENT_FIRST_LETTER_CLASS =
  "inline-block align-baseline text-[1.18em] leading-[0.92]";

/** Connected brand name (wordmark / alt text). */
export const BRAND_DISPLAY_NAME = "AllInCenter";

/** Demo login display when only the first letter is capitalized. */
export const BRAND_DISPLAY_NAME_FIRST_CAP = "Allincenter";

/** Primary accent (cyan) for A / C highlights. */
export const BRAND_ACCENT_COLOR = "#22D3EE";

/** Demo login lockup — deep brand violet→teal (shared with hub icon mask). */
export const BRAND_GRADIENT_DARK_CLASS =
  "bg-gradient-to-r from-[#8B5CF6] to-[#2DD4BF]";

/** Demo login accent (A / C). */
export const BRAND_ACCENT_DARK_CLASS =
  "bg-gradient-to-br from-[#22D3EE] via-[#A78BFA] to-[#E879F9]";

const ACCENT_SEGMENT = {
  light:
    "bg-gradient-to-br from-[#22D3EE] via-[#A78BFA] to-[#E879F9] bg-clip-text text-transparent",
  dark: `${BRAND_ACCENT_DARK_CLASS} bg-clip-text text-transparent`,
};

const GRADIENT_SEGMENT = {
  light: "bg-gradient-to-r from-[#8B5CF6] to-[#2DD4BF] bg-clip-text text-transparent",
  dark: `${BRAND_GRADIENT_DARK_CLASS} bg-clip-text text-transparent`,
};

/** Muted sketch strokes on dark login — pairs with multiply hub PNG. */
const GRADIENT_SKETCH_DARK_CLASS =
  "bg-gradient-to-r from-violet-300/90 via-indigo-200/85 to-slate-300/80 bg-clip-text text-transparent";

/**
 * AllInCenter wordmark — A and C accented (larger capitals); remaining letters gradient.
 * `dir-ltr` keeps visual order A-ll-I-n-C-enter on RTL pages.
 * Use `onDark` on purple login / dark hero backgrounds.
 * @param {"brand"|"first"} [accentLetters] — `first`: only A enlarged (demo login lockup).
 */
export default function BrandWordmark({
  size = "md",
  onDark = false,
  accentLetters = "brand",
  className,
}) {
  const gradient = onDark ? GRADIENT_SEGMENT.dark : GRADIENT_SEGMENT.light;
  const accent = onDark ? ACCENT_SEGMENT.dark : ACCENT_SEGMENT.light;
  const firstCapOnly = accentLetters === "first";

  if (firstCapOnly) {
    const bodyGradient = onDark ? GRADIENT_SKETCH_DARK_CLASS : gradient;
    return (
      <span
        dir="ltr"
        className={cn(
          "dir-ltr inline-flex items-baseline font-semibold tracking-tight select-none whitespace-nowrap",
          SIZE_CLASS[size] ?? SIZE_CLASS.md,
          className,
        )}
        aria-label={BRAND_DISPLAY_NAME_FIRST_CAP}
      >
        <span className={cn(accent, ACCENT_FIRST_LETTER_CLASS)}>A</span>
        <span className={bodyGradient}>llincenter</span>
      </span>
    );
  }

  return (
    <span
      dir="ltr"
      className={cn(
        "dir-ltr inline-flex items-baseline font-semibold tracking-tight select-none whitespace-nowrap",
        SIZE_CLASS[size] ?? SIZE_CLASS.md,
        className,
      )}
      aria-label={BRAND_DISPLAY_NAME}
    >
      <span className={cn(accent, ACCENT_LETTER_CLASS)}>A</span>
      <span className={gradient}>ll</span>
      <span className={gradient}>I</span>
      <span className={gradient}>n</span>
      <span className={cn(accent, ACCENT_LETTER_CLASS)}>C</span>
      <span className={gradient}>enter</span>
    </span>
  );
}

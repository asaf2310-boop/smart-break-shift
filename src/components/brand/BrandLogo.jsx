import React, { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import BrandWordmark, { BRAND_DISPLAY_NAME } from "@/components/brand/BrandWordmark";

/** Demo agent login hero (full lockup + tagline) — img in AgentLogin demoHero only. */
export const BRAND_LOGIN_HERO_SRC = "/brand/allincenter-login-hero-dark.png";

/** Legacy snapshot PNG (login-hero-full-v1 source — restore / scripts only). */
export const BRAND_LOGO_SNAPSHOT_SRC = "/allincenter-logo.png";

/** Transparent dark-surface lockup — hub + AllinCenter wordmark from HERO snapshot (demo home/header). */
export const BRAND_LOGO_DARK_SRC = "/allincenter-logo-allincenter-hero.png";

/** @deprecated Use BRAND_LOGO_DARK_SRC — hero-ac moved to brand-snapshots/. */
export const BRAND_LOGO_HERO_AC_SRC = "/brand-snapshots/allincenter-logo-hero-ac.png";

/** @deprecated Use BRAND_LOGO_SNAPSHOT_SRC — kept for imports that expect BRAND_LOGO_SRC. */
export const BRAND_LOGO_SRC = BRAND_LOGO_SNAPSHOT_SRC;

/** Bright transparent logo for light m3-page / home (hub + wordmark). */
export const BRAND_LOGO_BRIGHT_SRC = "/allincenter-logo-bright.png";

/** Hub icon only — left crop of logo (no wordmark). */
export const BRAND_ICON_SRC = "/allincenter-icon.png";

/** Hub icon — bright variant for light backgrounds. */
export const BRAND_ICON_BRIGHT_SRC = "/allincenter-icon-bright.png";

function logoSrcForSurface(onDark) {
  return onDark ? BRAND_LOGO_DARK_SRC : BRAND_LOGO_BRIGHT_SRC;
}

function iconSrcForSurface(onDark) {
  return onDark ? BRAND_ICON_SRC : BRAND_ICON_BRIGHT_SRC;
}

const SIZE_HEIGHT = {
  sm: 28,
  md: 38,
  lg: 64,
  xl: 128,
  hero: 200,
};

/** Width-driven sizing for xl/hero — no max-height (aspect ratio sets height). */
const SIZE_IMG_CLASS = {
  sm: "max-h-7",
  md: "",
  lg: "max-w-[min(100%,22rem)] max-h-20",
  xl: "h-auto w-full max-w-[min(100%,480px)] sm:max-w-[560px] md:max-w-[640px] object-contain",
  hero:
    "h-auto w-full max-w-[min(90vw,960px)] sm:max-w-[720px] md:max-w-[840px] lg:max-w-[960px] object-contain",
};

const WIDTH_ONLY_SIZES = new Set(["xl", "hero"]);

/** Primary logo asset (hub + wordmark). */
const BRAND_LOGO_WIDTH = 1536;
const BRAND_LOGO_HEIGHT = 1024;

/** Hub + headphones occupy ~left 38% of the horizontal logo (not the tall icon strip). */
const BRAND_HUB_SRC_WIDTH = Math.round(BRAND_LOGO_WIDTH * 0.38);

const LOGO_ICON_WIDTH_RATIO = BRAND_HUB_SRC_WIDTH / BRAND_LOGO_WIDTH;

/** Hub icon — left crop of primary logo. */
function BrandLogoIcon({
  size = "md",
  height,
  onDark = false,
  className,
  imgClassName,
}) {
  const px = height ?? SIZE_HEIGHT[size] ?? SIZE_HEIGHT.md;
  const primaryIcon = iconSrcForSurface(onDark);
  const [iconSrc, setIconSrc] = useState(primaryIcon);
  const logoClip = logoSrcForSurface(onDark);
  const usePrimaryClip = iconSrc === logoClip;
  const clipWidth = Math.max(30, Math.round(px * LOGO_ICON_WIDTH_RATIO));

  if (onDark) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center leading-none overflow-hidden",
          className,
        )}
        style={{ height: px, width: clipWidth }}
        aria-hidden
      >
        <img
          src={logoSrcForSurface(onDark)}
          alt=""
          className={cn(
            "block h-full w-auto max-w-none object-cover object-left min-w-[290%]",
            "drop-shadow-[0_0_12px_rgba(255,255,255,0.1)] brightness-110 contrast-105",
            imgClassName,
          )}
          style={{ height: px, maxHeight: px }}
          decoding="async"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center leading-none overflow-hidden",
        className,
      )}
      style={{ height: px, ...(usePrimaryClip ? { width: clipWidth } : undefined) }}
      aria-hidden
    >
      <img
        src={iconSrc}
        alt=""
        onError={() => {
          if (iconSrc !== logoClip) setIconSrc(logoClip);
        }}
        className={cn(
          "relative z-[1] block h-full max-w-none object-contain",
          usePrimaryClip ? "w-auto object-left object-cover min-w-[200%]" : "w-auto object-center",
          imgClassName,
        )}
        style={{ height: px, maxHeight: px }}
        decoding="async"
      />
    </span>
  );
}

/** Login hero hub — square left crop, light lines via invert (no multiply / no baked wordmark). */
function BrandLogoLoginHub({ height = 112, className, imgClassName }) {
  const px = height;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center leading-none overflow-hidden",
        className,
      )}
      style={{ height: px, width: px }}
      aria-hidden
    >
      <img
        src={BRAND_LOGO_SRC}
        alt=""
        className={cn(
          "block h-full w-auto max-w-none object-cover object-left",
          "brightness-0 invert",
          imgClassName,
        )}
        style={{ height: px, minWidth: `${Math.round(100 / LOGO_ICON_WIDTH_RATIO)}%` }}
        decoding="async"
      />
    </span>
  );
}

/** Demo login — hub + live wordmark, separate layers (onDark purple hero only). */
function BrandLogoLoginLockup({ size = "xl", height, className, wordmarkClassName }) {
  const px = height ?? SIZE_HEIGHT[size] ?? SIZE_HEIGHT.xl;
  const wordmarkSize = size === "hero" ? "hero" : size === "xl" || size === "lg" ? "lg" : size;

  return (
    <span
      dir="ltr"
      className={cn(
        "dir-ltr inline-flex items-center justify-center gap-3 sm:gap-4 shrink-0",
        className,
      )}
    >
      <BrandLogoLoginHub height={px} />
      <BrandWordmark size={wordmarkSize} onDark accentLetters="brand" className={wordmarkClassName} />
    </span>
  );
}

/** Hub icon + AllInCenter wordmark — no duplicate text from PNG. */
function BrandLogoLockup({
  size = "md",
  height,
  onDark = false,
  className,
  imgClassName,
  wordmarkClassName,
}) {
  const px = height ?? SIZE_HEIGHT[size] ?? SIZE_HEIGHT.md;
  const wordmarkSize =
    size === "hero" ? "hero" : onDark && (size === "lg" || size === "xl") ? "lg" : size;

  return (
    <span
      dir="ltr"
      className={cn(
        "dir-ltr inline-flex items-center gap-2 sm:gap-3 shrink-0 max-w-[min(90vw,960px)]",
        className,
      )}
    >
      <BrandLogoIcon
        size={size}
        height={px}
        onDark={onDark}
        imgClassName={imgClassName}
      />
      <BrandWordmark
        size={wordmarkSize}
        onDark={onDark}
        className={wordmarkClassName}
      />
    </span>
  );
}

/**
 * AllInCenter logo — transparent PNG or icon + wordmark lockup.
 * @param {"auto"|"lockup"|"full"|"icon"|"login"} [variant] — login: split hub + wordmark on dark
 * @param {boolean} [onDark] — wordmark styling on dark backgrounds; auto uses lockup on dark
 * @param {boolean} [brightLogo] — use bright PNG on dark full variant (not login split)
 */
export default function BrandLogo({
  size = "md",
  height,
  linkToHome = true,
  onDark = false,
  brightLogo = false,
  variant = "auto",
  className,
  imgClassName,
  wordmarkClassName,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const px = height ?? SIZE_HEIGHT[size] ?? SIZE_HEIGHT.md;

  const resolvedVariant =
    variant !== "auto"
      ? variant
      : onDark
        ? "full"
        : size === "lg" || size === "md"
          ? "lockup"
          : "full";

  const useLockup = resolvedVariant === "lockup" || resolvedVariant === "icon";
  const wordmarkOnly = imgFailed && resolvedVariant === "full";

  let graphic;
  if (wordmarkOnly) {
    graphic = <BrandWordmark size={size} onDark={onDark} className={wordmarkClassName} />;
  } else if (resolvedVariant === "icon") {
    graphic = <BrandLogoIcon size={size} height={px} onDark={onDark} imgClassName={imgClassName} />;
  } else if (resolvedVariant === "login") {
    graphic = (
      <BrandLogoLoginLockup
        size={size}
        height={px}
        wordmarkClassName={wordmarkClassName}
      />
    );
  } else if (useLockup) {
    graphic = (
      <BrandLogoLockup
        size={size}
        height={px}
        onDark={onDark}
        imgClassName={imgClassName}
        wordmarkClassName={wordmarkClassName}
      />
    );
  } else {
    const widthOnly = WIDTH_ONLY_SIZES.has(size);
    const logoSrc = brightLogo ? BRAND_LOGO_BRIGHT_SRC : logoSrcForSurface(onDark);
    const darkTransparent = onDark && !brightLogo;
    graphic = (
      <img
        src={logoSrc}
        alt={BRAND_DISPLAY_NAME}
        width={widthOnly ? undefined : Math.round(px * 2.8)}
        height={widthOnly ? undefined : px}
        className={cn(
          widthOnly ? "h-auto w-full" : "w-auto",
          "object-contain",
          darkTransparent &&
            "drop-shadow-[0_0_24px_rgba(255,255,255,0.12)] drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)] brightness-110 contrast-105",
          onDark &&
            brightLogo &&
            "drop-shadow-[0_0_24px_rgba(255,255,255,0.14)] drop-shadow-[0_4px_20px_rgba(0,0,0,0.35)]",
          SIZE_IMG_CLASS[size],
          imgClassName,
        )}
        style={widthOnly ? undefined : { height: px, maxHeight: px }}
        decoding="async"
        onError={() => setImgFailed(true)}
      />
    );
  }

  const wrapClass = cn("inline-flex items-center shrink-0", className);

  if (linkToHome) {
    return (
      <Link to="/" className={wrapClass} aria-label="דף הבית">
        {graphic}
      </Link>
    );
  }

  return <span className={wrapClass}>{graphic}</span>;
}

export { BrandLogoIcon, BrandLogoLockup };

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import BrandWordmark, {
  BRAND_DISPLAY_NAME,
  BRAND_GRADIENT_DARK_CLASS,
} from "@/components/brand/BrandWordmark";

/** Horizontal logo PNG (primary sketch). */
export const BRAND_LOGO_SRC = "/allincenter-logo.png";

/** Hub icon only — left crop of logo (no wordmark). */
export const BRAND_ICON_SRC = "/allincenter-icon.png";

const SIZE_HEIGHT = {
  sm: 28,
  md: 38,
  lg: 64,
};

const SIZE_IMG_CLASS = {
  sm: "max-h-7",
  md: "",
  lg: "max-w-[min(100%,22rem)] max-h-20",
};

const LOGO_ICON_WIDTH_RATIO = 352 / 1024;

/** Hub icon — gradient mask on dark lockup; dedicated icon PNG on light surfaces. */
function BrandLogoIcon({ size = "md", height, onDark = false, className, imgClassName }) {
  const px = height ?? SIZE_HEIGHT[size] ?? SIZE_HEIGHT.md;
  const [iconSrc, setIconSrc] = useState(onDark ? BRAND_LOGO_SRC : BRAND_ICON_SRC);
  const usePrimaryClip = iconSrc === BRAND_LOGO_SRC;
  const clipWidth = Math.max(30, Math.round(px * LOGO_ICON_WIDTH_RATIO));

  if (onDark) {
    const maskSize = usePrimaryClip
      ? `${Math.round(100 / LOGO_ICON_WIDTH_RATIO)}% 100%`
      : "contain";

    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center leading-none overflow-hidden",
          className,
        )}
        style={{ height: px, width: usePrimaryClip ? clipWidth : px }}
        aria-hidden
      >
        <span
          className={cn(
            "block h-full w-full",
            BRAND_GRADIENT_DARK_CLASS,
            "drop-shadow-[0_0_14px_rgba(103,232,249,0.55)]",
            imgClassName,
          )}
          style={{
            WebkitMaskImage: `url("${iconSrc}")`,
            maskImage: `url("${iconSrc}")`,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: maskSize,
            maskSize,
            WebkitMaskPosition: usePrimaryClip ? "left center" : "center",
            maskPosition: usePrimaryClip ? "left center" : "center",
          }}
        />
        <img
          src={iconSrc}
          alt=""
          onError={() => {
            if (iconSrc !== BRAND_LOGO_SRC) setIconSrc(BRAND_LOGO_SRC);
          }}
          className="absolute h-px w-px opacity-0 pointer-events-none"
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
          if (iconSrc !== BRAND_LOGO_SRC) setIconSrc(BRAND_LOGO_SRC);
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

  return (
    <span
      dir="ltr"
      className={cn("dir-ltr inline-flex items-center gap-4 shrink-0", className)}
    >
      <BrandLogoIcon size={size} height={px} onDark={onDark} imgClassName={imgClassName} />
      <BrandWordmark
        size={onDark && size === "lg" ? "lg" : size}
        onDark={onDark}
        className={wordmarkClassName}
      />
    </span>
  );
}

/**
 * AllInCenter logo — transparent PNG or icon + wordmark lockup.
 * @param {"auto"|"lockup"|"full"|"icon"} [variant] — lockup: icon + wordmark; full: horizontal PNG
 * @param {boolean} [onDark] — wordmark styling on dark backgrounds; auto uses lockup on dark
 */
export default function BrandLogo({
  size = "md",
  height,
  linkToHome = true,
  onDark = false,
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
        ? "lockup"
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
    graphic = (
      <img
        src={BRAND_LOGO_SRC}
        alt={BRAND_DISPLAY_NAME}
        width={Math.round(px * 2.8)}
        height={px}
        className={cn("w-auto object-contain", SIZE_IMG_CLASS[size], imgClassName)}
        style={{ height: px, maxHeight: px }}
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

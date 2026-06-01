import React from "react";
import { BRAND_LOGIN_HERO_SRC } from "@/components/brand/BrandLogo";

/** AllInCenter lockup — same asset as demo login hero, for production home. */
export default function BrandHomeHero({ className = "" }) {
  return (
    <div
      className={`login-shell__brand-zone logo-wrapper mx-auto mb-6 sm:mb-8 ${className}`.trim()}
      aria-hidden={false}
    >
      <img
        src={BRAND_LOGIN_HERO_SRC}
        alt="AllInCenter — CONNECT • MANAGE • GROW"
        className="login-shell__hero-img"
        width={1024}
        height={682}
        decoding="async"
      />
    </div>
  );
}

import React from "react";
import { useLocation } from "react-router-dom";
import BrandLogo from "@/components/brand/BrandLogo";
import { demoModeEnabled } from "@/api/demoClient";
import { hasTopAppNav, isAgentEntryPath, isDarkBrandHeaderPath } from "@/lib/appNavPaths";

/** Fixed brand mark at top-start (top-right in RTL). Hidden on login/entry paths. */
export default function BrandHeader() {
  const { pathname } = useLocation();

  if (isAgentEntryPath(pathname)) return null;
  if (!demoModeEnabled && !hasTopAppNav(pathname)) return null;

  const onDark = isDarkBrandHeaderPath(pathname);

  return (
    <header
      className="fixed top-3 start-3 z-[85] pointer-events-none pt-[max(0px,env(safe-area-inset-top,0px))]"
      aria-label="מיתוג"
    >
      <BrandLogo
        size="sm"
        variant="full"
        onDark={onDark}
        className="pointer-events-auto opacity-90 hover:opacity-100 transition-opacity"
        imgClassName={onDark ? "brightness-110 contrast-105" : "drop-shadow-sm"}
      />
    </header>
  );
}

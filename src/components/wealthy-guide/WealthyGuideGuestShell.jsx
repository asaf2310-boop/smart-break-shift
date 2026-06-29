import React from "react";
import { m3PageClass } from "@/lib/hypPage";

export default function WealthyGuideGuestShell({ title, subtitle, children }) {
  return (
    <div className={m3PageClass("min-h-screen flex flex-col overflow-x-clip")} dir="rtl">
      <header className="border-b border-outline/10 bg-surface/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 sm:py-5">
          <p className="text-xs font-medium text-primary mb-1">מדריך תשלומים</p>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{subtitle}</p>
          ) : null}
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 sm:py-8">{children}</main>
      <footer className="border-t border-outline/10 py-4 text-center">
        <p className="text-xs text-on-surface-variant">נשלח אליכם על ידי נציג התמיכה</p>
      </footer>
    </div>
  );
}

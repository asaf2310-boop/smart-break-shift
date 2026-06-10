import React from "react";
import { Link, Navigate } from "react-router-dom";
import { demoModeEnabled } from "@/api/demoClient";
import { m3PageClass } from "@/lib/hypPage";

/** Blocks demo-only routes in production — redirects to home when demo is off. */
export default function DemoGate({ children, redirect = true }) {
  if (demoModeEnabled) return children;

  if (redirect) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
      <div className="max-w-md text-center m3-card p-8">
        <p className="m3-label-medium mb-6">מודול זה זמין רק בסביבת דמו.</p>
        <Link to="/" className="text-primary font-medium text-sm hover:underline">
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}

import React from "react";
import { Link, Navigate } from "react-router-dom";
import { customerChatEnabled } from "@/api/customerChatMode";
import { m3PageClass } from "@/lib/hypPage";

/** Blocks customer-chat routes when the module is disabled in this build. */
export default function CustomerChatGate({ children, redirect = true }) {
  if (customerChatEnabled) return children;

  if (redirect) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
      <div className="max-w-md text-center m3-card p-8">
        <p className="m3-label-medium mb-2">צ&apos;אט לקוחות אינו פעיל בסביבה זו.</p>
        <p className="text-sm text-on-surface-variant mb-6">
          לבדיקות בלייב הוסיפו{" "}
          <code className="text-xs bg-surface-container px-1 rounded-md">VITE_CUSTOMER_CHAT_ENABLED=true</code>{" "}
          ובנו מחדש.
        </p>
        <Link to="/" className="text-primary font-medium text-sm hover:underline">
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}

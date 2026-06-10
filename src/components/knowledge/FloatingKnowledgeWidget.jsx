import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Maximize2, X } from "lucide-react";
import KnowledgeChat from "@/components/knowledge/KnowledgeChat";
import { CHAT_FLOAT_CHROME_CLASS } from "@/lib/floatingWidgetChrome";
import { demoModeEnabled } from "@/api/demoClient";
import { isCustomerChatGuestPath } from "@/lib/customerChatPaths";

/** FAB + מיני-צ'אט ידע — לא מוצג בדף /knowledge המלא */
export default function FloatingKnowledgeWidget() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (!demoModeEnabled) return null;
  if (location.pathname === "/knowledge") return null;
  if (isCustomerChatGuestPath(location.pathname, location.search)) return null;

  return (
    <>
      {open && (
        <div
          className={`fixed z-[75] inset-x-3 sm:inset-x-auto sm:left-4 sm:right-auto sm:w-[min(100%,22rem)] ${CHAT_FLOAT_CHROME_CLASS}`}
          style={{ bottom: "calc(var(--app-bottom-chrome) + var(--fab-size) + var(--fab-stack-gap) + 0.25rem)" }}
          dir="rtl"
        >
          <div className="m3-card flex flex-col overflow-hidden shadow-elevation-3 border border-outline/20 max-h-[min(70vh,28rem)]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-outline/15 bg-surface-container-low">
              <span className="m3-label-large text-sm font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                בסיס ידע
              </span>
              <div className="flex items-center gap-1">
                <Link
                  to="/knowledge"
                  className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant"
                  title="מסך מלא"
                  onClick={() => setOpen(false)}
                >
                  <Maximize2 className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-full hover:bg-surface-container-high"
                  aria-label="סגירה"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-3 flex-1 min-h-[240px] max-h-[min(60vh,24rem)] flex flex-col">
              <KnowledgeChat compact />
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`fixed z-[76] left-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-elevation-3 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform ${CHAT_FLOAT_CHROME_CLASS}`}
        style={{ bottom: "var(--app-bottom-chrome)" }}
        aria-label={open ? "סגור בסיס ידע" : "פתח בסיס ידע"}
        aria-expanded={open}
      >
        {open ? <X className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
      </button>
    </>
  );
}

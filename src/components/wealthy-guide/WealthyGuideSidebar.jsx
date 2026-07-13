import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ChevronDown,
  FileText,
  Home,
  Plug,
  Receipt,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { wealthyGuideMenuItems, wealthyGuidePath } from "@/lib/wealthyGuideConfig";
import { cn } from "@/lib/utils";

const ICONS = {
  ראשי: Home,
  "ביצוע פעולות": Zap,
  "פירוט עסקאות": Receipt,
  "תוספי סליקה": Plug,
  "חשבוניות דיגיטליות": FileText,
  דוחות: BarChart3,
  הגדרות: Settings,
  "ניהול התראות": Bell,
};

const ALWAYS_OPEN_SECTIONS = ["הגדרות"];

export default function WealthyGuideSidebar({ isOpen, onClose }) {
  const location = useLocation();
  const [openSections, setOpenSections] = React.useState(["ביצוע פעולות", ...ALWAYS_OPEN_SECTIONS]);

  const toggleSection = (label) => {
    if (ALWAYS_OPEN_SECTIONS.includes(label)) return;
    setOpenSections((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isActive = (slug) => {
    const path = wealthyGuidePath(slug);
    return slug === "" ? location.pathname === path : location.pathname === path;
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} aria-hidden />
      )}
      <aside
        dir="rtl"
        className={cn(
          "fixed top-0 right-0 h-full w-72 bg-surface border-l border-outline/15 shadow-xl z-50",
          "transform transition-transform duration-300 ease-out overflow-y-auto",
          "lg:static lg:translate-x-0 lg:shadow-none lg:z-auto",
          isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between p-5 border-b border-outline/15">
          <h2 className="text-lg font-bold text-on-surface">תפריט הדרכה</h2>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-surface-container transition-colors"
            aria-label="סגור תפריט"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        <nav className="p-3 space-y-0.5">
          {wealthyGuideMenuItems.map((item) => {
            const Icon = ICONS[item.label] || Home;

            if (item.children) {
              const isAlwaysOpen = ALWAYS_OPEN_SECTIONS.includes(item.label);
              const isSectionOpen = isAlwaysOpen || openSections.includes(item.label);
              const hasActiveChild = item.children.some((c) => isActive(c.slug));
              const sectionHeaderClass = cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                hasActiveChild
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface hover:bg-surface-container"
              );

              return (
                <div key={item.label}>
                  {isAlwaysOpen ? (
                    <div className={sectionHeaderClass}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-right">{item.label}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSection(item.label)}
                      className={sectionHeaderClass}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-right">{item.label}</span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-on-surface-variant transition-transform duration-200",
                          isSectionOpen && "rotate-180"
                        )}
                      />
                    </button>
                  )}
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-200",
                      isSectionOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="mr-7 border-r border-outline/15 space-y-0.5 py-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.slug}
                          to={wealthyGuidePath(child.slug)}
                          onClick={onClose}
                          className={cn(
                            "block px-4 py-2 rounded-lg text-sm transition-all duration-200",
                            isActive(child.slug)
                              ? "bg-primary text-on-primary font-medium shadow-sm"
                              : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
                            !child.ready && "opacity-70"
                          )}
                        >
                          {child.label}
                          {!child.ready && (
                            <span className="text-[10px] mr-1 text-on-surface-variant">· בקרוב</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.slug ?? "root"}
                to={wealthyGuidePath(item.slug)}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive(item.slug)
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface hover:bg-surface-container"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

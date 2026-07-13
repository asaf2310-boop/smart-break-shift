import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Check,
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

function ReadyBadge({ className }) {
  return (
    <span
      className={cn(
        "shrink-0 text-[10px] font-semibold leading-none text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-full",
        className
      )}
    >
      זמין
    </span>
  );
}

function SoonBadge() {
  return (
    <span className="shrink-0 text-[10px] font-medium leading-none text-on-surface-variant/80 bg-surface-container border border-outline/15 px-1.5 py-0.5 rounded-full">
      בקרוב
    </span>
  );
}

function GuideChildItem({ child, active, onClose }) {
  if (!child.ready) {
    return (
      <div
        aria-disabled="true"
        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm border border-dashed border-outline/20 bg-surface-container/25 text-on-surface-variant/65 cursor-not-allowed select-none"
      >
        <span className="truncate italic">{child.label}</span>
        <SoonBadge />
      </div>
    );
  }

  return (
    <Link
      to={wealthyGuidePath(child.slug)}
      onClick={onClose}
      className={cn(
        "group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200",
        active
          ? "bg-primary text-on-primary font-semibold shadow-md ring-1 ring-primary/25"
          : "text-on-surface font-medium hover:bg-primary/8 hover:text-primary border border-transparent hover:border-primary/15"
      )}
    >
      <span className="flex items-center gap-2 min-w-0">
        {active ? (
          <span className="w-1.5 h-1.5 rounded-full bg-on-primary shrink-0" aria-hidden />
        ) : (
          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 opacity-75 group-hover:opacity-100" aria-hidden />
        )}
        <span className="truncate">{child.label}</span>
      </span>
      {!active && <ReadyBadge />}
    </Link>
  );
}

function GuideTopItem({ item, Icon, active, onClose }) {
  const isReady = item.ready !== false;

  if (!isReady) {
    return (
      <div
        aria-disabled="true"
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm border border-dashed border-outline/20 bg-surface-container/25 text-on-surface-variant/65 cursor-not-allowed select-none"
      >
        <Icon className="w-4 h-4 shrink-0 opacity-50" />
        <span className="flex-1 truncate italic">{item.label}</span>
        <SoonBadge />
      </div>
    );
  }

  return (
    <Link
      to={wealthyGuidePath(item.slug)}
      onClick={onClose}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
        active
          ? "bg-primary text-on-primary font-semibold shadow-md ring-1 ring-primary/25"
          : "text-on-surface hover:bg-primary/8 hover:text-primary border border-transparent hover:border-primary/15"
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0", active ? "text-on-primary" : "text-primary/80")} />
      <span className="flex-1 truncate">{item.label}</span>
      {!active && <ReadyBadge />}
    </Link>
  );
}

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

  const countReady = (children) => children?.filter((c) => c.ready).length ?? 0;

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
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline/15 bg-surface-container/30">
          <h2 className="text-base font-bold text-on-surface tracking-tight">תפריט הדרכה</h2>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-surface-container transition-colors"
            aria-label="סגור תפריט"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        <nav className="p-3 space-y-1.5">
          {wealthyGuideMenuItems.map((item) => {
            const Icon = ICONS[item.label] || Home;

            if (item.children) {
              const isAlwaysOpen = ALWAYS_OPEN_SECTIONS.includes(item.label);
              const isSectionOpen = isAlwaysOpen || openSections.includes(item.label);
              const hasActiveChild = item.children.some((c) => isActive(c.slug));
              const readyCount = countReady(item.children);
              const sectionHeaderClass = cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                hasActiveChild
                  ? "bg-primary/10 text-primary border border-primary/15"
                  : "text-on-surface hover:bg-surface-container border border-transparent"
              );

              return (
                <div key={item.label} className="space-y-1">
                  {isAlwaysOpen ? (
                    <div className={sectionHeaderClass}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-right">{item.label}</span>
                      {readyCount > 0 && (
                        <span className="text-[10px] font-medium text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full">
                          {readyCount} זמינים
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSection(item.label)}
                      className={sectionHeaderClass}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-right">{item.label}</span>
                      {readyCount > 0 && !isSectionOpen && (
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.5 rounded-full">
                          {readyCount}
                        </span>
                      )}
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
                      isSectionOpen
                        ? cn(isAlwaysOpen ? "max-h-[32rem]" : "max-h-96", "opacity-100")
                        : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="mr-5 pr-2.5 border-r-2 border-outline/10 space-y-1 py-1.5">
                      {item.children.map((child) => (
                        <GuideChildItem
                          key={child.slug}
                          child={child}
                          active={isActive(child.slug)}
                          onClose={onClose}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <GuideTopItem
                key={item.slug ?? "root"}
                item={item}
                Icon={Icon}
                active={isActive(item.slug)}
                onClose={onClose}
              />
            );
          })}
        </nav>
      </aside>
    </>
  );
}

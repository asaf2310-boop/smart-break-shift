import React from "react";
import { LayoutDashboard, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CrmDashboardTabBar({ tabs, activeTabId, onSelect, onClose }) {
  if (tabs.length <= 1) return null;

  return (
    <div className="crm-tab-bar" role="tablist" aria-label="טאבים בדשבורד CRM">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            className={cn("crm-tab", isActive && "crm-tab--active")}
          >
            <button
              type="button"
              onClick={() => onSelect(tab.id)}
              className="crm-tab__label"
              title={tab.label}
            >
              {tab.type === "home" && <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{tab.label}</span>
            </button>
            {tab.closable && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                className="crm-tab__close"
                aria-label={`סגור ${tab.label}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

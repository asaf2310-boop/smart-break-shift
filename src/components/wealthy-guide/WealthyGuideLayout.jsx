import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import KnowledgeSubNav from "@/components/knowledge/KnowledgeSubNav";
import WealthyGuideSidebar from "@/components/wealthy-guide/WealthyGuideSidebar";
import { m3PageClass } from "@/lib/hypPage";

export default function WealthyGuideLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={m3PageClass("min-h-[calc(100vh-var(--app-nav-height,0px))]")} dir="rtl">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <KnowledgeSubNav />
        <div className="flex gap-0 lg:gap-6">
          <div className="lg:hidden mb-4 w-full">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="m3-btn-outlined text-sm py-2 flex items-center gap-2"
            >
              <Menu className="w-4 h-4" />
              תפריט הדרכה
            </button>
          </div>
          <WealthyGuideSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

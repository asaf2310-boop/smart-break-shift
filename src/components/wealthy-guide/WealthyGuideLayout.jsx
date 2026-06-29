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
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 overflow-x-clip">
        <KnowledgeSubNav />
        <div className="lg:hidden mb-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="m3-btn-outlined text-sm py-2 flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Menu className="w-4 h-4" />
            תפריט הדרכה
          </button>
        </div>
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 min-w-0">
          <WealthyGuideSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="flex-1 min-w-0 w-full">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";
import CustomerChatBotAdmin from "@/components/admin/CustomerChatBotAdmin";
import CustomerChatBotFlowAdmin from "@/components/admin/CustomerChatBotFlowAdmin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";

export default function AdminCustomerChat() {
  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className={hypHeaderIconClass(
              "w-12 h-12 bg-gradient-to-br from-sky-500 to-cyan-600 shadow-elevation-2"
            )}
          >
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">צ'אט לקוחות — בוט</h1>
            <p className="text-sm text-slate-500">ניהול הודעות הבוט לפני חיבור לנציג</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1">
            <ArrowRight className="w-4 h-4" />
            חזרה
          </Link>
          <Link to="/chat/guest" className="text-xs text-primary hover:underline">
            תצוגת לקוח
          </Link>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Tabs defaultValue="messages" dir="rtl" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="messages">הודעות</TabsTrigger>
            <TabsTrigger value="flow">בניית Flow</TabsTrigger>
          </TabsList>
          <TabsContent value="messages">
            <CustomerChatBotAdmin />
          </TabsContent>
          <TabsContent value="flow">
            <CustomerChatBotFlowAdmin />
          </TabsContent>
        </Tabs>
      </motion.div>
    </HypPageLayout>
  );
}

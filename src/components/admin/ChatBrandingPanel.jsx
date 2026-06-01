import React from "react";
import { MessageCircle } from "lucide-react";
import ChatBrandingEditor from "@/components/chat/ChatBrandingEditor";
import ChatBrandingAvatar from "@/components/chat/ChatBrandingAvatar";
import { useChatBranding } from "@/hooks/useChatBranding";

/** הגדרות מיתוג צ'אט במסך מנהל */
export default function ChatBrandingPanel() {
  const { effective } = useChatBranding();

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6"
      dir="rtl"
    >
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0">
          <MessageCircle className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-[12rem]">
          <h2 className="text-lg font-extrabold text-slate-800">מיתוג צ'אט פנימי</h2>
          <p className="text-sm text-slate-500 mt-1">
            שם ותמונה שמוצגים לכל הנציגים בכותרת הצ'אט ובבועה הצפה
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <ChatBrandingAvatar imageUrl={effective.imageUrl} size="sm" />
            <span className="font-semibold">{effective.displayName}</span>
          </div>
        </div>
        <ChatBrandingEditor variant="admin" />
      </div>
    </section>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { useChatBranding } from "@/hooks/useChatBranding";
import { useToast } from "@/components/ui/use-toast";
import ChatBrandingAvatar from "@/components/chat/ChatBrandingAvatar";
import { CHAT_BRANDING_DEFAULT_NAME } from "@/lib/chatBranding";

const MAX_IMAGE_BYTES = 512 * 1024;

/** עריכת שם ותמונת צ'אט — למנהל בלבד */
export default function ChatBrandingEditor({ variant = "header" }) {
  const { toast } = useToast();
  const { effective, saveBranding, isSaving } = useChatBranding();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName(effective.hasCustomName ? effective.displayName : "");
    setImageUrl(effective.imageUrl || "");
  }, [open, effective.displayName, effective.hasCustomName, effective.imageUrl]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "קובץ לא תקין", description: "יש לבחור קובץ תמונה", variant: "destructive" });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        title: "קובץ גדול מדי",
        description: "גודל מקסימלי: 512KB (לדמו)",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    try {
      await saveBranding({
        displayName: displayName.trim() || null,
        imageUrl: imageUrl.trim() || null,
      });
      toast({ title: "נשמר", description: "מיתוג הצ'אט עודכן לכל הנציגים" });
      setOpen(false);
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן לשמור", variant: "destructive" });
    }
  };

  const handleReset = async () => {
    try {
      await saveBranding({ displayName: null, imageUrl: null });
      toast({ title: "אופס לברירת מחדל", description: "שם ותמונת הצ'אט אופסו" });
      setOpen(false);
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן לאפס", variant: "destructive" });
    }
  };

  const panelClass =
    variant === "admin"
      ? "w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      : "absolute left-0 top-full mt-2 z-50 w-[min(calc(100vw-2rem),320px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="עריכת שם ותמונת צ'אט"
        title="עריכת צ'אט"
        className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          {variant === "header" && (
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="סגור"
              onClick={() => setOpen(false)}
            />
          )}
          <div className={variant === "header" ? `${panelClass} z-50` : panelClass} dir="rtl">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-extrabold text-slate-800">מיתוג צ'אט</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="סגור"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <ChatBrandingAvatar imageUrl={imageUrl || null} size="md" />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                ברירת מחדל: {CHAT_BRANDING_DEFAULT_NAME} ואייקון גרדיאנט
              </p>
            </div>

            <label className="block text-xs font-bold text-slate-600 mb-1">שם הצ'אט</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={CHAT_BRANDING_DEFAULT_NAME}
              className="w-full mb-3 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />

            <label className="block text-xs font-bold text-slate-600 mb-1">קישור לתמונה</label>
            <input
              type="url"
              value={imageUrl.startsWith("data:") ? "" : imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full mb-2 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full mb-3 py-2 rounded-xl border border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              העלאת תמונה מהמחשב (דמו)
            </button>

            {imageUrl ? (
              <button
                type="button"
                onClick={() => setImageUrl("")}
                className="text-[11px] text-slate-500 hover:text-slate-800 mb-3 block"
              >
                הסר תמונה
              </button>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
              >
                שמירה
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                איפוס
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

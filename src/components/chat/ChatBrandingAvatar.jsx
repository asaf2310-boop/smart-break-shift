import React from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** אווטאר צ'אט — תמונה מותאמת או אייקון ברירת מחדל */
export default function ChatBrandingAvatar({
  imageUrl,
  size = "md",
  className,
  iconClassName,
}) {
  const sizeClass =
    size === "sm" ? "w-9 h-9 rounded-xl" : size === "lg" ? "w-14 h-14 rounded-full" : "w-9 h-9 rounded-xl";
  const iconSize = size === "lg" ? "w-6 h-6" : "w-4 h-4";

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={cn(sizeClass, "object-cover shrink-0 border border-slate-200/80", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0",
        className
      )}
    >
      <MessageCircle className={cn(iconSize, iconClassName)} aria-hidden />
    </div>
  );
}

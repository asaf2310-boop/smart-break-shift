import React, { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Link2, X } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  ADMIN_DEV_ROUTES,
  buildAdminDevUrl,
  isAdminDevLinksVisible,
} from "@/lib/adminDevLinks";

/** Top-left mini panel — avoids bottom chat / phone FABs. */
export default function AdminLocalhostLinksFloating() {
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const onCopy = useCallback(
    async (url) => {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "הקישור הועתק" });
      } catch {
        toast({ title: "לא ניתן להעתיק", variant: "destructive" });
      }
    },
    [toast]
  );

  if (!isAdmin || !isAdminDevLinksVisible() || !origin) return null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="fixed top-4 left-4 z-[72] pointer-events-auto flex items-center gap-2 rounded-full bg-surface-container-high/95 border border-outline/20 shadow-elevation-2 px-3 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-high backdrop-blur-sm"
        dir="rtl"
        title="קישורי localhost לאדמין"
      >
        <Link2 className="w-4 h-4 text-primary" />
        קישורי אדמין
      </button>
    );
  }

  return (
    <div
      className="fixed top-4 left-4 z-[72] pointer-events-auto w-[min(100vw-2rem,20rem)] m3-card border border-outline/20 shadow-elevation-3 overflow-hidden"
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-outline/15 bg-surface-container-low">
        <span className="m3-label-large text-sm font-semibold flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-primary" />
          localhost · אדמין
        </span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant"
          aria-label="סגור"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="px-3 py-1.5 text-[10px] text-on-surface-variant font-mono truncate" dir="ltr">
        {origin}
      </p>
      <ul className="max-h-[min(50vh,16rem)] overflow-y-auto px-2 pb-2">
        {ADMIN_DEV_ROUTES.map(({ path, label }) => {
          const url = buildAdminDevUrl(origin, path);
          return (
            <li
              key={path}
              className="rounded-xl px-2 py-2 hover:bg-surface-container-low/80"
            >
              <p className="text-xs font-semibold text-on-surface mb-1">{label}</p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => onCopy(url)}
                  title="העתק"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  asChild
                  title="פתח בטאב חדש"
                >
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

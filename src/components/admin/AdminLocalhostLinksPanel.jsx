import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, Copy, ExternalLink, Link2 } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ADMIN_DEV_ROUTES,
  buildAdminDevUrl,
  isAdminDevLinksVisible,
} from "@/lib/adminDevLinks";

function AdminDevLinkRow({ url, label, onCopy }) {
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-2 py-2.5 border-b border-outline/10 last:border-0">
      <div className="flex-1 min-w-0 text-right">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 font-mono truncate" dir="ltr">
          {url}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full gap-1.5"
          onClick={() => onCopy(url)}
        >
          <Copy className="w-3.5 h-3.5" />
          העתק
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-full gap-1.5"
          asChild
        >
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3.5 h-3.5" />
            פתח בטאב חדש
          </a>
        </Button>
      </div>
    </li>
  );
}

/** Collapsible card — e.g. on AdminDashboard. */
export default function AdminLocalhostLinksPanel({ defaultOpen = false }) {
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const [open, setOpen] = useState(defaultOpen);
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

  return (
    <Collapsible open={open} onOpenChange={setOpen} dir="rtl">
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 px-5 py-4 text-right hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-slate-800">
                  קישורי localhost לאדמין
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate" dir="ltr">
                  {origin}
                </p>
              </div>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-5 pb-4 pt-0 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">
              קישורים לפי מקור הנוכחי (פורט דינמי). זמין בפיתוח / דמו בלבד.
            </p>
            <ul>
              {ADMIN_DEV_ROUTES.map(({ path, label }) => (
                <AdminDevLinkRow
                  key={path}
                  label={label}
                  url={buildAdminDevUrl(origin, path)}
                  onCopy={onCopy}
                />
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

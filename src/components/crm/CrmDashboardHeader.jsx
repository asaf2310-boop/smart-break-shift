import { demoModeEnabled } from "@/api/demoClient";
import { isCrmCloudEnabled } from "@/api/crmCloudMode";
import { cn } from "@/lib/utils";

export default function CrmDashboardHeader({
  mainTitle,
  subtitle,
  handwritten = false,
  className,
}) {
  const showSupabaseBadge = isCrmCloudEnabled();
  const showFloatingBadge = showSupabaseBadge || demoModeEnabled;

  return (
    <header
      className={cn(
        "crm-dashboard-header relative mb-6",
        showFloatingBadge ? "mt-5" : "mt-1",
        className
      )}
      dir="rtl"
    >
      <div className="relative flex flex-col items-center justify-between gap-4 rounded-[32px] border border-white/40 bg-white/60 p-5 shadow-xl shadow-slate-100/20 backdrop-blur-xl md:flex-row">
        {showSupabaseBadge ? (
          <div
            className="absolute -top-[18px] right-10 flex items-center gap-2 rounded-full border border-sky-100 bg-white/80 px-4 py-1.5 shadow-md backdrop-blur-md"
            aria-label="מחובר ל-Supabase בענן"
          >
            <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
            <span className="text-[11px] font-semibold tracking-wide text-sky-900">
              Supabase / ענן
            </span>
          </div>
        ) : demoModeEnabled ? (
          <span className="demo-tag absolute -top-[18px] right-10 shadow-md">דמו · localStorage</span>
        ) : null}

        <div className="flex w-full flex-col items-start gap-0.5 md:w-auto">
          <h1
            className={cn(
              "m-0 tracking-wide text-indigo-950",
              handwritten
                ? "font-caveat text-xl font-medium md:text-2xl"
                : "text-lg font-semibold md:text-xl"
            )}
          >
            {mainTitle}
          </h1>
          {subtitle ? (
            <p className="m-0 mr-0.5 text-[11px] font-medium text-slate-400">{subtitle}</p>
          ) : null}
        </div>

        <div
          className="mx-10 hidden h-px flex-grow bg-gradient-to-l from-slate-200 to-transparent md:block"
          aria-hidden
        />

        <div className="flex w-full justify-start md:w-auto md:justify-end">
          <span className="text-xl font-bold tracking-wider text-indigo-950 opacity-80 md:text-2xl">
            CRM
          </span>
        </div>
      </div>
    </header>
  );
}

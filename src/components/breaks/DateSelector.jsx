import React from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { CalendarIcon, ChevronRight, ChevronLeft } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

<<<<<<< HEAD
export default function DateSelector({
  selectedDate,
  onDateChange,
  variant = "dark",
  readOnly = false,
}) {
=======
export default function DateSelector({ selectedDate, onDateChange, variant = "dark" }) {
>>>>>>> 842dd9e (Initial commit)
  const isLight = variant === "light";
  const navBtn = isLight
    ? "w-9 h-9 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 flex items-center justify-center transition-all shadow-sm"
    : "w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-all";
  const dateBtn = isLight
    ? "flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 font-medium text-sm transition-all shadow-sm"
    : "flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 text-white font-medium text-sm transition-all";
  const iconCls = isLight ? "w-4 h-4 text-indigo-500" : "w-4 h-4 text-indigo-300";
  const goTo = (offset) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    onDateChange(d);
  };

  const formattedDate = format(selectedDate, "EEEE, d בMMMM yyyy", { locale: he });

<<<<<<< HEAD
  if (readOnly) {
    const labelCls = isLight
      ? "flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-medium text-sm shadow-sm"
      : "flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white/10 border border-white/10 text-white font-medium text-sm";
    return (
      <div className={labelCls} aria-label={`תאריך: ${formattedDate}`}>
        <CalendarIcon className={iconCls} aria-hidden />
        <span>{formattedDate}</span>
      </div>
    );
  }

=======
>>>>>>> 842dd9e (Initial commit)
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => goTo(1)} className={navBtn}>
        <ChevronRight className="w-4 h-4" />
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button className={dateBtn}>
            <CalendarIcon className={iconCls} />
            {formattedDate}
          </button>
        </PopoverTrigger>
        <PopoverContent className={`w-auto p-0 ${isLight ? "border-slate-200 bg-white" : "border-white/10 bg-slate-900"}`} align="center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onDateChange(date)}
            className={isLight ? "" : "text-white"}
          />
        </PopoverContent>
      </Popover>

      <button onClick={() => goTo(-1)} className={navBtn}>
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  );
}
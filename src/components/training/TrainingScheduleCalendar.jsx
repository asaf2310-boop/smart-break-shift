import React, { useMemo } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { he } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function toDateKey(date) {
  return format(date, "yyyy-MM-dd");
}

export default function TrainingScheduleCalendar({
  sessionsByDate = {},
  selectedDate,
  onSelectDate,
  visibleMonth,
  onVisibleMonthChange,
}) {
  const monthStart = startOfMonth(visibleMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const selectedKey = selectedDate ? toDateKey(selectedDate) : null;

  const monthLabel = useMemo(
    () => format(visibleMonth, "MMMM yyyy", { locale: he }),
    [visibleMonth]
  );

  return (
    <section
      className="m3-card p-4"
      aria-label="לוח שנה — מפגשי הדרכה"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <button
          type="button"
          className="m3-btn-outlined p-2 min-w-[2.5rem]"
          onClick={() => onVisibleMonthChange(addMonths(visibleMonth, 1))}
          aria-label="חודש הבא"
        >
          <ChevronRight className="w-4 h-4" aria-hidden />
        </button>
        <h2 className="m3-title-large text-base font-semibold capitalize">{monthLabel}</h2>
        <button
          type="button"
          className="m3-btn-outlined p-2 min-w-[2.5rem]"
          onClick={() => onVisibleMonthChange(addMonths(visibleMonth, -1))}
          aria-label="חודש קודם"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden />
        </button>
      </div>

      <div
        className="grid grid-cols-7 gap-1 text-center"
        role="grid"
        aria-readonly="false"
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-xs font-medium text-on-surface-variant py-1"
            role="columnheader"
          >
            {label}
          </div>
        ))}

        {days.map((day) => {
          const key = toDateKey(day);
          const daySessions = sessionsByDate[key] || [];
          const teachableCount = daySessions.filter((s) => !s.isBreak).length;
          const inMonth = isSameMonth(day, visibleMonth);
          const isSelected = selectedKey === key;
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`${format(day, "d בMMMM", { locale: he })}${teachableCount ? `, ${teachableCount} מפגשים` : ""}`}
              onClick={() => onSelectDate(parseISO(`${key}T12:00:00`))}
              className={cn(
                "relative flex flex-col items-center justify-center min-h-[2.75rem] rounded-xl text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                !inMonth && "text-on-surface-variant/40",
                inMonth && !isSelected && "hover:bg-surface-container-high",
                isSelected && "bg-primary text-primary-foreground shadow-elevation-1",
                isToday && !isSelected && "ring-1 ring-primary/40"
              )}
            >
              <span className="tabular-nums font-medium">{format(day, "d")}</span>
              {teachableCount > 0 ? (
                <span
                  className={cn(
                    "absolute bottom-0.5 text-[10px] leading-none font-medium tabular-nums",
                    isSelected ? "text-primary-foreground/90" : "text-primary"
                  )}
                  aria-hidden
                >
                  {teachableCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

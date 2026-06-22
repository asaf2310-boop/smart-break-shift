import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import courseConfig from "@/data/trainingCourseConfig.json";
import courseTemplate from "@/data/trainingCourseTemplate.json";
import {
  applyScheduleCustomizations,
  getEffectiveCourseConfig,
} from "@/lib/trainingScheduleStore";

const HEBREW_WEEKDAY = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function parseDateOnly(isoDate) {
  return parseISO(`${isoDate}T12:00:00`);
}

export function shiftTrainingDateKey(dateStr, deltaDays) {
  if (!dateStr) return null;
  return format(addDays(parseDateOnly(dateStr), deltaDays), "yyyy-MM-dd");
}

export function alignTrainingDateSelection(dateStr, previousCourseStartDate, nextCourseStartDate, days = []) {
  const availableDates = new Set(days.map((day) => day.date));
  if (dateStr && availableDates.has(dateStr)) {
    return dateStr;
  }

  if (dateStr && previousCourseStartDate && nextCourseStartDate) {
    const deltaDays = differenceInCalendarDays(
      parseDateOnly(nextCourseStartDate),
      parseDateOnly(previousCourseStartDate)
    );
    const shiftedDate = shiftTrainingDateKey(dateStr, deltaDays);
    if (shiftedDate && availableDates.has(shiftedDate)) {
      return shiftedDate;
    }
  }

  return days[0]?.date ?? nextCourseStartDate ?? null;
}

/** Shift template day offsets to actual dates for the current course (before localStorage overrides). */
export function resolveTrainingScheduleBase(config = courseConfig, template = courseTemplate) {
  const templateStart = parseDateOnly(config.templateStartDate);
  const courseStart = parseDateOnly(config.courseStartDate);

  const sessions = template.sessions.map((session, index) => {
    const templateDate = addDays(templateStart, session.dayOffset);
    const shiftDays = differenceInCalendarDays(courseStart, templateStart);
    const date = addDays(templateDate, shiftDays);
    const dateStr = format(date, "yyyy-MM-dd");

    return {
      id: session.id ?? `${dateStr}-${session.startTime}-${index}`,
      date: dateStr,
      dayOffset: session.dayOffset,
      startTime: session.startTime,
      endTime: session.endTime,
      timeLabel: `${session.startTime}–${session.endTime}`,
      title: session.title,
      description: session.description ?? "",
      isBreak: Boolean(session.isBreak),
      order: index + 1,
    };
  });

  const dayMap = new Map();
  for (const session of sessions) {
    if (!dayMap.has(session.date)) {
      const dateObj = parseDateOnly(session.date);
      dayMap.set(session.date, {
        date: session.date,
        weekdayLabel: HEBREW_WEEKDAY[dateObj.getDay()],
        displayDate: dateObj.toLocaleDateString("he-IL", {
          day: "numeric",
          month: "numeric",
          year: "numeric",
        }),
        sessions: [],
      });
    }
    dayMap.get(session.date).sessions.push(session);
  }

  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = days[0]?.date ?? config.courseStartDate;
  const lastDate = days[days.length - 1]?.date ?? config.courseStartDate;

  return {
    title: config.title,
    description: config.description ?? "",
    courseStartDate: config.courseStartDate,
    templateStartDate: config.templateStartDate,
    dateRangeLabel: `${format(parseDateOnly(firstDate), "d.M.yyyy")} – ${format(parseDateOnly(lastDate), "d.M.yyyy")}`,
    days,
    sessions,
  };
}

/** Full schedule: JSON seed + effective config + localStorage customizations. */
export function resolveTrainingSchedule(config, template = courseTemplate) {
  const effectiveConfig = config ?? getEffectiveCourseConfig();
  const base = resolveTrainingScheduleBase(effectiveConfig, template);
  return applyScheduleCustomizations(base);
}

export function getTrainingCourseConfig() {
  return getEffectiveCourseConfig();
}

/** Sunday (Israel) week key yyyy-MM-dd for grouping training days. */
export function getTrainingWeekStartKey(dateStr) {
  const date = parseDateOnly(dateStr);
  return format(startOfWeek(date, { weekStartsOn: 0 }), "yyyy-MM-dd");
}

function formatTrainingWeekRangeLabel(days) {
  if (!days.length) return "";
  const first = days[0].date;
  const last = days[days.length - 1].date;
  return `${format(parseDateOnly(first), "d.M.yyyy")} – ${format(parseDateOnly(last), "d.M.yyyy")}`;
}

/**
 * Group resolved training days by calendar week (week starts Sunday).
 * Each week object contains only days that fall in that Sun–Sat span (typically Sun–Thu).
 */
export function groupTrainingDaysIntoWeeks(days) {
  const byWeek = new Map();
  for (const day of days) {
    const key = getTrainingWeekStartKey(day.date);
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key).push(day);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, weekDays]) => {
      const sorted = [...weekDays].sort((a, b) => a.date.localeCompare(b.date));
      return {
        weekStart,
        days: sorted,
        rangeLabel: formatTrainingWeekRangeLabel(sorted),
      };
    });
}

/** First course week, or the week that contains today when within the course date span. */
export function getDefaultTrainingWeekIndex(weeks, referenceDate = new Date()) {
  if (!weeks.length) return 0;

  const todayStr = format(referenceDate, "yyyy-MM-dd");
  const firstDate = weeks[0].days[0]?.date;
  const lastWeek = weeks[weeks.length - 1];
  const lastDate = lastWeek.days[lastWeek.days.length - 1]?.date;

  if (!firstDate || !lastDate) return 0;
  if (todayStr < firstDate) return 0;
  if (todayStr > lastDate) return weeks.length - 1;

  const todayWeekKey = getTrainingWeekStartKey(todayStr);
  const idx = weeks.findIndex((w) => w.weekStart === todayWeekKey);
  return idx >= 0 ? idx : 0;
}

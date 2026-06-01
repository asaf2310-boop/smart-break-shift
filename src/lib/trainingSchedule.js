import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
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

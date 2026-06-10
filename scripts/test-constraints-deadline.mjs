/**
 * Run: node scripts/test-constraints-deadline.mjs
 * Self-contained — mirrors scheduling.js constraints deadline logic.
 */

import { addDays } from "date-fns";

function getConstraintsDeadline(submissionWeekStart) {
  const wednesday = addDays(submissionWeekStart, 3);
  wednesday.setHours(16, 0, 0, 0);
  return wednesday;
}

function getEffectiveConstraintsDeadline(submissionWeekStart, weekSettings) {
  const defaultDeadline = getConstraintsDeadline(submissionWeekStart);
  const extendedRaw = weekSettings?.deadline_extended_until;
  if (extendedRaw) {
    const extended = new Date(extendedRaw);
    if (!Number.isNaN(extended.getTime()) && extended > defaultDeadline) {
      return extended;
    }
  }
  return defaultDeadline;
}

function isConstraintsSubmissionClosed(submissionWeekStart, weekSettings, now = new Date()) {
  if (weekSettings?.submission_override_open) return false;
  const deadline = getEffectiveConstraintsDeadline(submissionWeekStart, weekSettings);
  return now.getTime() > deadline.getTime();
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

const submissionWeek = new Date(2026, 5, 7); // Sunday 2026-06-07
submissionWeek.setHours(0, 0, 0, 0);
const defaultDeadline = getConstraintsDeadline(submissionWeek);

assert(
  defaultDeadline.getDay() === 3 && defaultDeadline.getHours() === 16,
  "default deadline is Wednesday 16:00"
);

const beforeDeadline = new Date(2026, 5, 10, 15, 59); // Wed 15:59
const afterDeadline = new Date(2026, 5, 10, 16, 1); // Wed 16:01

assert(
  !isConstraintsSubmissionClosed(submissionWeek, null, beforeDeadline),
  "open before Wednesday 16:00"
);
assert(
  isConstraintsSubmissionClosed(submissionWeek, null, afterDeadline),
  "closed after Wednesday 16:00"
);

const extendedUntil = new Date(2026, 5, 12, 18, 0).toISOString(); // Fri 18:00
const settings = { deadline_extended_until: extendedUntil };
const thuAfternoon = new Date(2026, 5, 11, 14, 0);

assert(
  !isConstraintsSubmissionClosed(submissionWeek, settings, thuAfternoon),
  "extended — open Thursday afternoon after default deadline"
);
assert(
  isConstraintsSubmissionClosed(submissionWeek, settings, new Date(2026, 5, 12, 19, 0)),
  "extended — closed after extended deadline"
);

assert(
  !isConstraintsSubmissionClosed(submissionWeek, { submission_override_open: true }, afterDeadline),
  "override — open after default deadline"
);

console.log("\nAll constraints deadline tests passed.");

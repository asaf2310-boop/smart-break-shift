/**
 * Run: node scripts/test-break-deadline.mjs
 * Self-contained — mirrors scheduling.js deadline logic (no Vite aliases).
 */

const BREAK_REGISTRATION_TIMEZONE = "Asia/Jerusalem";
const BREAK_REGISTRATION_DEADLINE_HOUR = 10;

function getZonedDateTimeParts(date, timeZone = BREAK_REGISTRATION_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zonedDateTimeToUtc(dateStr, hour, minute = 0, second = 0, timeZone = BREAK_REGISTRATION_TIMEZONE) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  let utcMs = Date.UTC(y, m - 1, d, hour, minute, second);
  for (let i = 0; i < 6; i++) {
    const p = getZonedDateTimeParts(new Date(utcMs), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const want = Date.UTC(y, m - 1, d, hour, minute, second);
    utcMs += want - asUtc;
  }
  return new Date(utcMs);
}

function isBreakRegistrationClosed(dateStr, now = new Date()) {
  if (!dateStr) return false;
  const deadline = zonedDateTimeToUtc(dateStr, BREAK_REGISTRATION_DEADLINE_HOUR, 0, 0);
  return now.getTime() > deadline.getTime();
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

const dateStr = "2026-06-03";
const at10 = zonedDateTimeToUtc(dateStr, 10, 0, 0);
const at1001 = zonedDateTimeToUtc(dateStr, 10, 0, 1);
const at11 = zonedDateTimeToUtc(dateStr, 11, 0, 0);

assert(!isBreakRegistrationClosed(dateStr, at10), "10:00 Israel — still open");
assert(isBreakRegistrationClosed(dateStr, at1001), "10:00:01 Israel — closed");
assert(isBreakRegistrationClosed(dateStr, at11), "11:00 Israel — closed");
assert(
  isBreakRegistrationClosed(dateStr, at11),
  "instant for 11:00 Israel closes even if host TZ differs"
);
assert(!isBreakRegistrationClosed("2026-12-25", at11), "future date open before its 10:00");

console.log("\nAll break deadline tests passed.");

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// `date` is treated as a naive local calendar date (see CLAUDE.md §3) — callers pass a Date
// whose UTC-getters reflect the intended local date (this is how Prisma round-trips @db.Date
// columns), so we read via getUTC* rather than get* to avoid a host-timezone shift.
export function getDayName(date: Date): string {
  return DAY_NAMES[date.getUTCDay()];
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

// Normalizes a "YYYY-MM-DD" string (e.g. from a <input type="date">) into the UTC-midnight
// Date that Prisma's @db.Date columns expect.
export function parseDateOnly(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new RangeError(`Expected a "YYYY-MM-DD" date string, got "${isoDate}"`);
  }
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// e.g. "Monday, March 8, 2026". timeZone: "UTC" for the same reason as getDayName/isWeekend —
// this Date's UTC fields, not the rendering machine's local fields, are the intended calendar
// date.
export function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

// Unlike formatDateOnly (which reads UTC getters for a Prisma @db.Date value), this reads
// local getters — for turning "the current moment on this machine" into a "YYYY-MM-DD" string
// that matches what the person actually considers "today" in their own timezone. Used
// client-side (see src/app/worklog/page.tsx) so "today" is never computed from server UTC time.
export function getLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Encodes "this machine's current wall-clock moment" using the same fake-UTC convention as
// every other naive-local field (checkIn/checkOut/WorkDay.date) — i.e. a Date whose UTC
// getters equal the *local* getters of the real current time. This must be called client-side
// (browser) so the captured time is the user's own local time, not the server's. Naively
// storing a real `new Date()` from a Server Action would silently store the server's UTC clock
// reading instead of the user's local time — see CLAUDE.md §3 for why this distinction exists.
export function getNaiveLocalNow(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    ),
  );
}

// Combines a WorkDay's date with an "HH:MM" (or "HH:MM:SS") time-of-day string from a manual
// edit form into one naive-local-encoded Date, for backfilling historical check-in/out times.
export function combineDateAndTime(date: Date, time: string): Date {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match) {
    throw new RangeError(`Expected time as "HH:MM" or "HH:MM:SS", got "${time}"`);
  }
  const [, hours, minutes, seconds] = match;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      Number(hours),
      Number(minutes),
      Number(seconds ?? 0),
    ),
  );
}

// e.g. "10:10 AM". Reads UTC getters — same naive-local convention as checkIn/checkOut.
export function formatClockTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date);
}

// For an <input type="time"> defaultValue, e.g. "10:10".
export function formatTimeInputValue(date: Date): string {
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Local (not UTC) calendar month, e.g. "2026-08" — the Calendar page's equivalent of
// getLocalISODate, used client-side so the initial month shown is the browser's local "this
// month," not the server's.
export function getLocalMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Normalizes a "YYYY-MM" string into the UTC-midnight Date for the 1st of that month.
export function parseMonthOnly(month: string): Date {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new RangeError(`Expected a "YYYY-MM" month string, got "${month}"`);
  }
  return new Date(`${month}-01T00:00:00.000Z`);
}

// e.g. "August 2026".
export function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

// Shifts a date by `delta` whole months, staying on the 1st (Calendar navigation only ever
// operates on first-of-month values from parseMonthOnly).
export function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

// e.g. "03/08/2026" — the Excel export's Date column format, inferred from the spec's example
// (CLAUDE.md §3: no submission screenshot was ever provided, this is an assumption to confirm).
// Reads UTC getters — same naive-local convention as everywhere else `WorkDay.date` is handled.
export function formatDateUS(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${month}/${day}/${date.getUTCFullYear()}`;
}

const DATE_US_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

// Inverse of formatDateUS, for Excel Import (spec §30/§41) reading a Date cell written by our
// own export. Validates the calendar date is real (e.g. rejects "02/30/2026") rather than
// letting JS's Date silently roll it into March.
export function parseDateUS(value: string): Date {
  const match = DATE_US_PATTERN.exec(value.trim());
  if (!match) {
    throw new RangeError(`Expected a "MM/DD/YYYY" date string, got "${value}"`);
  }
  const [, monthStr, dayStr, yearStr] = match;
  const month = Number(monthStr);
  const day = Number(dayStr);
  const year = Number(yearStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError(`"${value}" is not a valid calendar date`);
  }
  return date;
}

const CLOCK_TIME_PATTERN = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

// Inverse of formatClockTime, e.g. "10:10 AM" -> "10:10", "7:25 PM" -> "19:25" — for Excel
// Import. Returns "HH:MM" so the caller can feed it straight into combineDateAndTime.
export function parseClockTimeToHHMM(value: string): string {
  const match = CLOCK_TIME_PATTERN.exec(value.trim());
  if (!match) {
    throw new RangeError(`Expected a "h:mm AM/PM" time string, got "${value}"`);
  }
  const [, hourStr, minutes, meridiem] = match;
  let hours = Number(hourStr);
  if (hours < 1 || hours > 12) {
    throw new RangeError(`"${value}" is not a valid time`);
  }
  if (meridiem.toUpperCase() === "AM") {
    hours = hours === 12 ? 0 : hours;
  } else {
    hours = hours === 12 ? 12 : hours + 12;
  }
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

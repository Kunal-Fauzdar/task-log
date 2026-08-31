// Day-of-week numbers, 0 (Sunday) - 6 (Saturday) — same convention as isWeekend/getDayName in
// src/lib/domain/date.ts (JS's Date#getUTCDay()).
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
] as const;

export function isWorkingDay(dayOfWeek: number, workingDays: number[]): boolean {
  return workingDays.includes(dayOfWeek);
}

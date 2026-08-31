import { WorkDayStatus } from "../../generated/prisma/enums.ts";
import { formatDateOnly } from "@/lib/domain/date";
import { isWorkingDay } from "@/lib/domain/settings";

// Tolerance for the "Total Task Duration exceeds Net Work Duration" warning (spec §12) — small
// rounding/entry differences shouldn't trigger a warning banner. Named constant, not a magic
// number, per CLAUDE.md §5.
export const DURATION_TOLERANCE_SECONDS = 60;

// Net Work Duration = Check Out - Check In - Break. Returns null when the day isn't complete
// yet (no checkIn, or checkIn without checkOut) — there's no "net" duration to report.
export function calculateNetWorkSeconds(workDay: {
  checkIn: Date | null;
  checkOut: Date | null;
  breakSeconds: number;
}): number | null {
  if (!workDay.checkIn || !workDay.checkOut) return null;
  const grossSeconds = Math.round(
    (workDay.checkOut.getTime() - workDay.checkIn.getTime()) / 1000,
  );
  return grossSeconds - workDay.breakSeconds;
}

export function calculateTotalTaskSeconds(tasks: { durationSeconds: number }[]): number {
  return tasks.reduce((sum, task) => sum + task.durationSeconds, 0);
}

// Warn-only (spec §12) — never used to modify task durations. `null` net duration (day not
// complete yet) never counts as a discrepancy; there's nothing to compare against.
export function hasDurationDiscrepancy(
  netWorkSeconds: number | null,
  totalTaskSeconds: number,
): boolean {
  if (netWorkSeconds === null) return false;
  return totalTaskSeconds > netWorkSeconds + DURATION_TOLERANCE_SECONDS;
}

// Shared display labels for WorkDayStatus — Dashboard, Calendar, and the WorkLog page's
// TimeTrackingCard all need to render the same four states the same way.
export const WORK_DAY_STATUS_LABELS: Record<WorkDayStatus, string> = {
  NOT_STARTED: "No work recorded",
  IN_PROGRESS: "Currently working",
  COMPLETED: "Work completed",
  HOLIDAY: "Holiday",
};

// Shared Badge `variant` per status — same reasoning as WORK_DAY_STATUS_LABELS above, kept in
// sync so every place that shows a status badge (Dashboard's Today's Work card and Recent Work
// Days table so far) reads the same color the same way. The four values walk the app's green
// ramp: hairline -> sage -> bright green -> deepest green.
export const WORK_DAY_STATUS_BADGE_VARIANT: Record<
  WorkDayStatus,
  "outline" | "accent" | "success" | "brand"
> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "accent",
  COMPLETED: "success",
  HOLIDAY: "brand",
};

// Derives the stored WorkDayStatus enum from the fields that determine it. Holiday always
// wins; otherwise NOT_STARTED / IN_PROGRESS / COMPLETED follow from whether check-in/out are
// set. Called from the data layer whenever checkIn/checkOut/isHoliday change, so `status`
// never drifts out of sync with the fields it's derived from.
export function deriveWorkDayStatus(workDay: {
  checkIn: Date | null;
  checkOut: Date | null;
  isHoliday: boolean;
}): WorkDayStatus {
  if (workDay.isHoliday) return WorkDayStatus.HOLIDAY;
  if (workDay.checkIn && workDay.checkOut) return WorkDayStatus.COMPLETED;
  if (workDay.checkIn) return WorkDayStatus.IN_PROGRESS;
  return WorkDayStatus.NOT_STARTED;
}

// Sunday-Saturday week containing `date`. Uses UTC getters/setters throughout — same
// naive-local convention as everywhere else `WorkDay.date` is handled (see CLAUDE.md §3).
export function getWeekRange(date: Date): { from: Date; to: Date } {
  const from = new Date(date);
  from.setUTCDate(date.getUTCDate() - date.getUTCDay());
  const to = new Date(from);
  to.setUTCDate(from.getUTCDate() + 6);
  return { from, to };
}

// Calendar month containing `date` (1st to last day, inclusive).
export function getMonthRange(date: Date): { from: Date; to: Date } {
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { from, to };
}

// Sums Net Work Duration across days, treating incomplete days (no netWorkSeconds yet) as 0
// rather than excluding them — an in-progress or not-yet-started day contributes nothing to a
// weekly/monthly total, but shouldn't error out the sum.
export function sumNetWorkSeconds(
  workDays: { checkIn: Date | null; checkOut: Date | null; breakSeconds: number }[],
): number {
  return workDays.reduce((sum, workDay) => sum + (calculateNetWorkSeconds(workDay) ?? 0), 0);
}

export type BlankExportDay = {
  date: Date;
  checkIn: null;
  checkOut: null;
  breakSeconds: 0;
  isHoliday: false;
  holidayReason: null;
  tasks: [];
};

// A month/range Excel export previously only ever showed days that already had a WorkDay row —
// since findOrCreateWorkDayByDate only creates one when a date is actually visited, an unvisited
// working day (e.g. one you forgot to log) silently vanished from the export instead of showing
// up as a gap. Fixed per explicit user request: fill every configured working day in the range
// that has no real WorkDay yet with a blank placeholder row (same shape buildWorkLogWorkbook
// already renders for a zero-task day) — so a submission file has one row per working day, not
// just the days that happen to have data. Only fills up to `today` — an unfilled *future*
// working day isn't a gap, there's nothing to log yet. Days outside the configured working days
// (e.g. weekends) with no data are correctly left out entirely, same as before.
export function fillMissingWorkingDays<T extends { date: Date }>(
  workDays: T[],
  range: { from: Date; to: Date },
  workingDays: number[],
  today: Date,
): (T | BlankExportDay)[] {
  const existingDates = new Set(workDays.map((workDay) => formatDateOnly(workDay.date)));
  const lastDate = range.to.getTime() < today.getTime() ? range.to : today;

  const filled: (T | BlankExportDay)[] = [...workDays];
  const cursor = new Date(range.from);
  while (cursor.getTime() <= lastDate.getTime()) {
    if (!existingDates.has(formatDateOnly(cursor)) && isWorkingDay(cursor.getUTCDay(), workingDays)) {
      filled.push({
        date: new Date(cursor),
        checkIn: null,
        checkOut: null,
        breakSeconds: 0,
        isHoliday: false,
        holidayReason: null,
        tasks: [],
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return filled;
}

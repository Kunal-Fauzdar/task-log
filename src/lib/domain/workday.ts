import { WorkDayStatus, WorkDayType } from "../../generated/prisma/enums.ts";
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

// Projected Check Out = Check In + total task duration + break time. A planning aid shown while
// a day is still open ("log this much task time, take this much break, and you'd finish at
// ..."), never a stored value. `checkIn` is naive-local-encoded (its UTC getters hold the local
// wall-clock time — see CLAUDE.md §3), and adding a plain millisecond offset preserves that, so
// the result formats correctly with formatClockTime. Returns null when there's no check-in to
// project from.
export function projectedCheckOutTime(
  workDay: { checkIn: Date | null; breakSeconds: number },
  totalTaskSeconds: number,
): Date | null {
  if (!workDay.checkIn) return null;
  return new Date(
    workDay.checkIn.getTime() + (workDay.breakSeconds + Math.max(0, totalTaskSeconds)) * 1000,
  );
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
  LEAVE: "Leave",
};

// Shared Badge `variant` per status — same reasoning as WORK_DAY_STATUS_LABELS above, kept in
// sync so every place that shows a status badge (Dashboard's Today's Work card and Recent Work
// Days table so far) reads the same color the same way. The four values walk the app's green
// ramp: hairline -> sage -> bright green -> deepest green.
export const WORK_DAY_STATUS_BADGE_VARIANT: Record<
  WorkDayStatus,
  "outline" | "accent" | "success" | "brand" | "secondary"
> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "accent",
  COMPLETED: "success",
  HOLIDAY: "brand",
  LEAVE: "secondary",
};

// Derives the stored WorkDayStatus enum from the fields that determine it. Holiday always
// wins; otherwise NOT_STARTED / IN_PROGRESS / COMPLETED follow from whether check-in/out are
// set. Called from the data layer whenever checkIn/checkOut/dayType change, so `status`
// never drifts out of sync with the fields it's derived from.
export function deriveWorkDayStatus(workDay: {
  checkIn: Date | null;
  checkOut: Date | null;
  dayType: WorkDayType;
}): WorkDayStatus {
  if (workDay.dayType === WorkDayType.HOLIDAY) return WorkDayStatus.HOLIDAY;
  if (workDay.dayType === WorkDayType.LEAVE) return WorkDayStatus.LEAVE;
  if (workDay.checkIn && workDay.checkOut) return WorkDayStatus.COMPLETED;
  if (workDay.checkIn) return WorkDayStatus.IN_PROGRESS;
  return WorkDayStatus.NOT_STARTED;
}

// Calendar month containing `date` (1st to last day, inclusive).
export function getMonthRange(date: Date): { from: Date; to: Date } {
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { from, to };
}

// The last `days` calendar days ending on (and including) `date` — e.g. days=7 is a rolling
// week, days=30 a rolling month. Used by the Dashboard instead of calendar week/month so its
// totals don't look empty just because "today" is early in a calendar month.
export function getRollingRange(date: Date, days: number): { from: Date; to: Date } {
  const from = new Date(date);
  from.setUTCDate(date.getUTCDate() - (days - 1));
  return { from, to: new Date(date) };
}

// Seconds actually worked so far: for a completed day this equals net work duration; for an
// in-progress day (checked in, not out) it counts check-in → `now`, minus accumulated break.
// `now` MUST be a naive-local time (getNaiveLocalNow()) so it's on the same clock basis as
// `checkIn` — see the "two clocks" note in CLAUDE.md §3. An in-progress break is not subtracted
// in real time (would mix clocks); the figure over-counts slightly until the break ends, which
// is acceptable for a dashboard overview.
export function elapsedWorkSeconds(
  workDay: { checkIn: Date | null; checkOut: Date | null; breakSeconds: number },
  now: Date,
): number {
  if (!workDay.checkIn) return 0;
  const end = workDay.checkOut ?? now;
  const grossSeconds = Math.round((end.getTime() - workDay.checkIn.getTime()) / 1000);
  return Math.max(0, grossSeconds - workDay.breakSeconds);
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
  dayType: "WORKING";
  dayNote: null;
  tasks: [];
};

// A month/range Excel export previously only ever showed days that already had a WorkDay row —
// since findOrCreateWorkDayByDate only creates one when a date is actually visited, an unvisited
// day silently vanished from the export instead of showing up as a gap. Fixed per explicit user
// request: fill EVERY calendar day in the range that has no real WorkDay yet with a blank
// placeholder (same shape buildWorkLogWorkbook renders for a zero-task day) — working days and
// non-working days alike, so a submission file has one row per day. The Excel builder decides
// each blank day's label from the date + `workingDays`: a non-working day (weekend) renders as a
// "WEEKLY OFF" row, a working day as an empty work row. Only fills up to `today` — an unfilled
// *future* day isn't a gap, there's nothing to log yet.
export function fillMissingExportDays<T extends { date: Date }>(
  workDays: T[],
  range: { from: Date; to: Date },
  today: Date,
): (T | BlankExportDay)[] {
  const existingDates = new Set(workDays.map((workDay) => formatDateOnly(workDay.date)));
  const lastDate = range.to.getTime() < today.getTime() ? range.to : today;

  const filled: (T | BlankExportDay)[] = [...workDays];
  const cursor = new Date(range.from);
  while (cursor.getTime() <= lastDate.getTime()) {
    if (!existingDates.has(formatDateOnly(cursor))) {
      filled.push({
        date: new Date(cursor),
        checkIn: null,
        checkOut: null,
        breakSeconds: 0,
        dayType: "WORKING",
        dayNote: null,
        tasks: [],
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return filled;
}

// True when a day has nothing logged and isn't a declared holiday/leave — i.e. it should render
// in the export as a "WEEKLY OFF" row rather than an empty work row. `isWorkingDay` here is the
// user's AppSettings.workingDays set (Sun=0..Sat=6).
export function isWeeklyOffExportDay(
  day: { checkIn: Date | null; dayType: WorkDayType | "WORKING"; tasks: unknown[] },
  workingDays: number[],
  date: Date,
): boolean {
  return (
    day.dayType === WorkDayType.WORKING &&
    !day.checkIn &&
    day.tasks.length === 0 &&
    !isWorkingDay(date.getUTCDay(), workingDays)
  );
}

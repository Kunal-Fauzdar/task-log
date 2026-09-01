import { LayoutDashboard } from "lucide-react";

import { getRecentWorkDays, getWorkDayByDate, listWorkDays } from "@/lib/data/workday";
import {
  formatDateOnly,
  formatDisplayDate,
  formatMonthLabel,
  parseMonthOnly,
} from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import { getMonthRange, getRollingRange, sumNetWorkSeconds } from "@/lib/domain/workday";
import { PageHeader } from "@/components/layout/page-header";
import { LiveTodayHours } from "@/components/dashboard/live-today-hours";
import { MonthHoursPanel, type MonthOption } from "@/components/dashboard/month-hours-panel";
import { RecentWorkDaysTable } from "@/components/dashboard/recent-workdays-table";
import { StatTile } from "@/components/dashboard/stat-tile";
import { TodayWorkCard } from "@/components/dashboard/today-work-card";

// Read-only overview, but always rendered fresh from the database — never served from a
// build-time static snapshot. Without this, the deployed Dashboard kept showing stale "Recent
// Work Days" (and stats) because /dashboard has no other dynamic input to force a re-render.
export const dynamic = "force-dynamic";

// "Today" is computed server-side here — unlike /worklog (the data-entry surface, which must
// use the browser's local date), the Dashboard is a read-only summary, so being off by a few
// hours near a timezone's midnight boundary only means brief, self-correcting staleness. (The
// in-progress "hours so far" figure IS computed client-side — see LiveTodayHours — since that
// one subtracts a naive-local check-in time.)
function getServerToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const MONTH_PARAM_PATTERN = /^\d{4}-\d{2}$/;

// The last `count` months, newest first, as { value: "YYYY-MM", label: "September 2026" }.
function recentMonths(today: Date, count: number): MonthOption[] {
  const options: MonthOption[] = [];
  for (let i = 0; i < count; i += 1) {
    const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    options.push({ value: formatDateOnly(first).slice(0, 7), label: formatMonthLabel(first) });
  }
  return options;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const today = getServerToday();

  const selectedMonth =
    monthParam && MONTH_PARAM_PATTERN.test(monthParam)
      ? parseMonthOnly(monthParam)
      : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const selectedMonthValue = formatDateOnly(selectedMonth).slice(0, 7);
  const monthRange = getMonthRange(selectedMonth);

  const monthOptions = recentMonths(today, 12);
  // A bookmarked ?month older than the dropdown covers still needs to appear as its selected option.
  if (!monthOptions.some((option) => option.value === selectedMonthValue)) {
    monthOptions.push({ value: selectedMonthValue, label: formatMonthLabel(selectedMonth) });
  }

  // Rolling 30-day window drives the task counts — a calendar month reads as empty on the 1st
  // even with a full week of work in the days just before it (user feedback).
  const last30 = getRollingRange(today, 30);

  const [todayWorkDay, month30WorkDays, selectedMonthWorkDays, recentWorkDays] = await Promise.all([
    getWorkDayByDate(today),
    listWorkDays(last30),
    listWorkDays(monthRange),
    getRecentWorkDays(10),
  ]);

  const todaysHours = todayWorkDay ? sumNetWorkSeconds([todayWorkDay]) : 0;
  const selectedMonthHours = sumNetWorkSeconds(selectedMonthWorkDays);

  // When today is checked in but not out, LiveTodayHours adds the elapsed-so-far.
  const inProgress =
    todayWorkDay && todayWorkDay.checkIn && !todayWorkDay.checkOut
      ? { checkInIso: todayWorkDay.checkIn.toISOString(), breakSeconds: todayWorkDay.breakSeconds }
      : null;

  const monthTasks = month30WorkDays.flatMap((workDay) => workDay.tasks);
  const monthTaskCount = monthTasks.length;
  const monthCompletedTaskCount = monthTasks.filter(
    (task) => task.timerStatus === "COMPLETED",
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={LayoutDashboard}
        eyebrow={formatDisplayDate(today)}
        title="Dashboard"
        description="Where today stands, your task activity over the last 30 days, and your last ten work days."
      />
      <TodayWorkCard workDay={todayWorkDay} />

      <section className="flex flex-col gap-2.5">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          Statistics
        </h2>
        <MonthHoursPanel
          months={monthOptions}
          selected={selectedMonthValue}
          totalHours={formatSecondsToDuration(selectedMonthHours)}
        />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <LiveTodayHours todayBase={todaysHours} inProgress={inProgress} />
          <StatTile label="Tasks · last 30 days" value={String(monthTaskCount)} accent="primary" />
          <StatTile
            label="Completed · last 30 days"
            value={String(monthCompletedTaskCount)}
            accent="success"
          />
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          Recent Work Days
        </h2>
        <RecentWorkDaysTable workDays={recentWorkDays} />
      </section>
    </div>
  );
}

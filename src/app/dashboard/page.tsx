import { LayoutDashboard } from "lucide-react";

import { getRecentWorkDays, getWorkDayByDate, listWorkDays } from "@/lib/data/workday";
import { formatDisplayDate } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import {
  calculateTotalTaskSeconds,
  getRollingRange,
  sumNetWorkSeconds,
} from "@/lib/domain/workday";
import { PageHeader } from "@/components/layout/page-header";
import { LiveHoursTiles } from "@/components/dashboard/live-hours-tiles";
import { RecentWorkDaysTable } from "@/components/dashboard/recent-workdays-table";
import { StatTile } from "@/components/dashboard/stat-tile";
import { TodayWorkCard } from "@/components/dashboard/today-work-card";

// "Today" is computed server-side here — unlike /worklog (the data-entry surface, which must
// use the browser's local date, see src/app/worklog/page.tsx), the Dashboard is a read-only
// summary. Being off by a few hours near a timezone's midnight boundary only means a brief,
// self-correcting staleness in an overview card — not a wrong mutation — so the added
// complexity of a client-side date fetch isn't worth it here. (The in-progress "hours so far"
// figure IS computed client-side though — see LiveHoursTiles — since that one subtracts a
// naive-local check-in time.)
function getServerToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export default async function DashboardPage() {
  const today = getServerToday();
  // Rolling windows, not calendar week/month — a calendar month looks empty on the 1st even
  // when there's a full week of work in the days just before it (user feedback).
  const last7 = getRollingRange(today, 7);
  const last30 = getRollingRange(today, 30);

  const [todayWorkDay, week7WorkDays, month30WorkDays, recentWorkDays] = await Promise.all([
    getWorkDayByDate(today),
    listWorkDays(last7),
    listWorkDays(last30),
    getRecentWorkDays(10),
  ]);

  const todaysHours = todayWorkDay ? sumNetWorkSeconds([todayWorkDay]) : 0;
  const week7Hours = sumNetWorkSeconds(week7WorkDays);
  const month30Hours = sumNetWorkSeconds(month30WorkDays);

  // When today is checked in but not out, LiveHoursTiles adds the elapsed-so-far to each window.
  const inProgress =
    todayWorkDay && todayWorkDay.checkIn && !todayWorkDay.checkOut
      ? { checkInIso: todayWorkDay.checkIn.toISOString(), breakSeconds: todayWorkDay.breakSeconds }
      : null;

  const monthTasks = month30WorkDays.flatMap((workDay) => workDay.tasks);
  const monthTaskCount = monthTasks.length;
  const monthCompletedTaskCount = monthTasks.filter((task) => task.timerStatus === "COMPLETED").length;
  const monthTotalTaskSeconds = calculateTotalTaskSeconds(monthTasks);
  const averageTaskSeconds =
    monthTaskCount > 0 ? Math.round(monthTotalTaskSeconds / monthTaskCount) : 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={LayoutDashboard}
        eyebrow={formatDisplayDate(today)}
        title="Dashboard"
        description="Where today stands, your last 7 and 30 days of work, and your last ten work days."
      />
      <TodayWorkCard workDay={todayWorkDay} />

      <section className="flex flex-col gap-2.5">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          Statistics
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <LiveHoursTiles
            todayBase={todaysHours}
            weekBase={week7Hours}
            monthBase={month30Hours}
            inProgress={inProgress}
          />
          <StatTile label="Tasks · last 30 days" value={String(monthTaskCount)} accent="primary" />
          <StatTile
            label="Completed · last 30 days"
            value={String(monthCompletedTaskCount)}
            accent="success"
          />
          <StatTile
            label="Avg. task duration"
            value={formatSecondsToDuration(averageTaskSeconds)}
            accent="primary"
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

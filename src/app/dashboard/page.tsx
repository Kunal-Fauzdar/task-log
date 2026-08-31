import {
  CalendarCheck2,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  ListTodo,
  Timer,
  TrendingUp,
} from "lucide-react";

import { getRecentWorkDays, getWorkDayByDate, listWorkDays } from "@/lib/data/workday";
import { formatDisplayDate } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import {
  calculateTotalTaskSeconds,
  getMonthRange,
  getWeekRange,
  sumNetWorkSeconds,
} from "@/lib/domain/workday";
import { PageHeader } from "@/components/layout/page-header";
import { RecentWorkDaysTable } from "@/components/dashboard/recent-workdays-table";
import { StatTile } from "@/components/dashboard/stat-tile";
import { TodayWorkCard } from "@/components/dashboard/today-work-card";

// "Today" is computed server-side here — unlike /worklog (the data-entry surface, which must
// use the browser's local date, see src/app/worklog/page.tsx), the Dashboard is a read-only
// summary. Being off by a few hours near a timezone's midnight boundary only means a brief,
// self-correcting staleness in an overview card — not a wrong mutation — so the added
// complexity of a client-side date fetch isn't worth it here.
function getServerToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export default async function DashboardPage() {
  const today = getServerToday();
  const { from: weekFrom, to: weekTo } = getWeekRange(today);
  const { from: monthFrom, to: monthTo } = getMonthRange(today);

  const [todayWorkDay, weekWorkDays, monthWorkDays, recentWorkDays] = await Promise.all([
    getWorkDayByDate(today),
    listWorkDays({ from: weekFrom, to: weekTo }),
    listWorkDays({ from: monthFrom, to: monthTo }),
    getRecentWorkDays(10),
  ]);

  const todaysHours = todayWorkDay ? sumNetWorkSeconds([todayWorkDay]) : 0;
  const weekHours = sumNetWorkSeconds(weekWorkDays);
  const monthHours = sumNetWorkSeconds(monthWorkDays);

  const monthTasks = monthWorkDays.flatMap((workDay) => workDay.tasks);
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
        description="Where today stands, this week's and this month's totals, and your last ten work days."
      />
      <TodayWorkCard workDay={todayWorkDay} />

      <section className="flex flex-col gap-2.5">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <TrendingUp className="text-link size-5" />
          Statistics
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <StatTile
            label="Today's hours"
            value={formatSecondsToDuration(todaysHours)}
            icon={Clock}
            accent="info"
          />
          <StatTile
            label="This week's hours"
            value={formatSecondsToDuration(weekHours)}
            icon={CalendarCheck2}
            accent="info"
          />
          <StatTile
            label="This month's hours"
            value={formatSecondsToDuration(monthHours)}
            icon={CalendarCheck2}
            accent="primary"
          />
          <StatTile
            label="Tasks this month"
            value={String(monthTaskCount)}
            icon={ListTodo}
            accent="primary"
          />
          <StatTile
            label="Completed this month"
            value={String(monthCompletedTaskCount)}
            icon={CheckCircle2}
            accent="success"
          />
          <StatTile
            label="Avg. task duration"
            value={formatSecondsToDuration(averageTaskSeconds)}
            icon={Timer}
            accent="warning"
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

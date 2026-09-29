import Link from "next/link";
import { Plus } from "lucide-react";

import { requireUser } from "@/lib/auth/current-user";
import { getRecentWorkDays, getWorkDayByDate, listWorkDays } from "@/lib/data/workday";
import { formatDateOnly, formatDisplayDate, getDayName } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import {
  WORK_DAY_STATUS_BADGE_VARIANT,
  WORK_DAY_STATUS_LABELS,
  calculateTotalTaskSeconds,
  getRollingRange,
  sumNetWorkSeconds,
} from "@/lib/domain/workday";
import { BarChart } from "@/components/charts/bar-chart";
import { CurrentlyWorking } from "@/components/dashboard/currently-working";
import { TodaySummary } from "@/components/dashboard/today-summary";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Always rendered fresh from the database — never a build-time static snapshot.
export const dynamic = "force-dynamic";

// "Today" is computed server-side (the dashboard is a read-only overview; being off by a few
// hours near midnight is a brief, self-correcting staleness). Live figures use the browser clock.
function getServerToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export default async function DashboardPage() {
  const user = await requireUser();
  const today = getServerToday();
  const last7 = getRollingRange(today, 7);

  const [todayWorkDay, weekWorkDays, recentWorkDays] = await Promise.all([
    getWorkDayByDate(user.id, today),
    listWorkDays(user.id, last7),
    getRecentWorkDays(user.id, 5),
  ]);

  const tasks = todayWorkDay?.tasks ?? [];
  const taskSeconds = calculateTotalTaskSeconds(tasks);

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(last7.from);
    date.setUTCDate(last7.from.getUTCDate() + i);
    const key = formatDateOnly(date);
    const day = weekWorkDays.find((d) => formatDateOnly(d.date) === key);
    return { label: String(date.getUTCDate()), value: day ? sumNetWorkSeconds([day]) / 3600 : 0 };
  });

  const currentTask = tasks.length > 0 ? tasks[tasks.length - 1].description : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard"
        description={`Here's your work overview for ${formatDisplayDate(today)}.`}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <CurrentlyWorking
          currentTask={currentTask}
          workDay={
            todayWorkDay
              ? {
                  id: todayWorkDay.id,
                  checkInIso: todayWorkDay.checkIn?.toISOString() ?? null,
                  checkOutIso: todayWorkDay.checkOut?.toISOString() ?? null,
                  breakSeconds: todayWorkDay.breakSeconds,
                  onBreak: todayWorkDay.breakStartedAt !== null,
                }
              : null
          }
        />
        <TodaySummary
          taskCount={tasks.length}
          taskSeconds={taskSeconds}
          breakSeconds={todayWorkDay?.breakSeconds ?? 0}
          checkInIso={todayWorkDay?.checkIn?.toISOString() ?? null}
          checkOutIso={todayWorkDay?.checkOut?.toISOString() ?? null}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section className="panel flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Today&apos;s Tasks</h2>
            <div className="flex items-center gap-3">
              <Link href="/worklog" className="text-link text-xs hover:underline">
                View All
              </Link>
              <Button asChild size="sm">
                <Link href="/worklog">
                  <Plus /> Add Task
                </Link>
              </Button>
            </div>
          </div>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No tasks logged today.</p>
          ) : (
            <ul className="divide-border divide-y">
              {tasks.slice(0, 6).map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.description}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {task.project?.name ?? "No project"}
                    </p>
                  </div>
                  <span className="text-muted-foreground w-14 text-right text-xs tabular-nums">
                    {formatSecondsToDuration(task.durationSeconds)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <section className="panel flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Last 7 Days</h2>
              <span className="text-muted-foreground text-xs">Hours</span>
            </div>
            <BarChart data={chartData} />
          </section>

          <section className="panel flex flex-col gap-2 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent Work Days</h2>
              <Link href="/calendar" className="text-link text-xs hover:underline">
                View All
              </Link>
            </div>
            {recentWorkDays.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">No work logged yet.</p>
            ) : (
              <ul className="divide-border divide-y text-sm">
                {recentWorkDays.map((day) => (
                  <li key={day.id} className="flex items-center gap-3 py-2">
                    <Link
                      href={`/worklog/${formatDateOnly(day.date)}`}
                      className="hover:text-link flex-1 tabular-nums"
                    >
                      {formatDateOnly(day.date)}
                      <span className="text-muted-foreground ml-3">{getDayName(day.date)}</span>
                    </Link>
                    <Badge variant={WORK_DAY_STATUS_BADGE_VARIANT[day.status]}>
                      {WORK_DAY_STATUS_LABELS[day.status]}
                    </Badge>
                    <span className="text-muted-foreground w-6 text-right tabular-nums">
                      {day.tasks.length}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

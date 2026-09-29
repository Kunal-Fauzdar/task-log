import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { requireUser } from "@/lib/auth/current-user";
import { listWorkDays } from "@/lib/data/workday";
import {
  addMonths,
  formatDateOnly,
  formatDisplayDate,
  formatMonthLabel,
  parseMonthOnly,
} from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import {
  WORK_DAY_STATUS_BADGE_VARIANT,
  WORK_DAY_STATUS_LABELS,
  calculateTotalTaskSeconds,
  getMonthRange,
} from "@/lib/domain/workday";
import { PriorityBadge } from "@/components/task/priority-badge";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { Button } from "@/components/ui/button";

const MONTH_PARAM_PATTERN = /^\d{4}-\d{2}$/;

function getServerToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export default async function CalendarMonthPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month: monthParam } = await params;

  if (!MONTH_PARAM_PATTERN.test(monthParam)) {
    notFound();
  }

  const user = await requireUser();
  const monthStart = parseMonthOnly(monthParam);
  const { to: monthEnd } = getMonthRange(monthStart);
  const daysInMonth = monthEnd.getUTCDate();

  const workDays = await listWorkDays(user.id, { from: monthStart, to: monthEnd });
  const workDaysByDate = new Map(workDays.map((workDay) => [formatDateOnly(workDay.date), workDay]));

  const prevMonth = addMonths(monthStart, -1);
  const nextMonth = addMonths(monthStart, 1);
  const todayParam = formatDateOnly(getServerToday());

  const todayWorkDay = workDaysByDate.get(todayParam);
  const summaryTasks = todayWorkDay?.tasks ?? [];
  const summarySeconds = calculateTotalTaskSeconds(summaryTasks);
  const currentMonthParam = formatDateOnly(getServerToday()).slice(0, 7);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Calendar"
        actions={
          <>
            <Button asChild variant="outline" size="sm" aria-label="Previous month">
              <Link href={`/calendar/${formatDateOnly(prevMonth).slice(0, 7)}`}>
                <ChevronLeft /> Prev
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/calendar/${currentMonthParam}`}>Today</Link>
            </Button>
            <Button asChild variant="outline" size="sm" aria-label="Next month">
              <Link href={`/calendar/${formatDateOnly(nextMonth).slice(0, 7)}`}>
                Next <ChevronRight />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{formatMonthLabel(monthStart)}</h2>
          <CalendarGrid
            monthStart={monthStart}
            daysInMonth={daysInMonth}
            workDaysByDate={workDaysByDate}
            todayParam={todayParam}
          />
          <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="bg-primary size-3 rounded-sm" /> Today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-brand-strong/60 border-brand-strong size-3 rounded-sm border" /> Holiday
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-secondary border-border size-3 rounded-sm border" /> Leave
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-card border-border size-3 rounded-sm border" /> Other days
            </span>
          </div>
        </section>

        <aside className="panel flex flex-col gap-4 self-start p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{formatDisplayDate(getServerToday())}</h2>
            {todayWorkDay && (
              <Badge variant={WORK_DAY_STATUS_BADGE_VARIANT[todayWorkDay.status]}>
                {WORK_DAY_STATUS_LABELS[todayWorkDay.status]}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary border-border rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Focused Time</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatSecondsToDuration(summarySeconds)}
              </p>
            </div>
            <div className="bg-secondary border-border rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Tasks</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{summaryTasks.length}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tasks ({summaryTasks.length})</h3>
            <Link href={`/worklog/${todayParam}`} className="text-link text-xs hover:underline">
              View All
            </Link>
          </div>
          {summaryTasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tasks logged for today.</p>
          ) : (
            <ul className="divide-border divide-y">
              {summaryTasks.slice(0, 5).map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-2">
                  <p className="min-w-0 flex-1 truncate text-sm">{task.description}</p>
                  <PriorityBadge priority={task.priority} />
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {formatSecondsToDuration(task.durationSeconds)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";

import { listWorkDays } from "@/lib/data/workday";
import { addMonths, formatDateOnly, formatMonthLabel, parseMonthOnly } from "@/lib/domain/date";
import { getMonthRange } from "@/lib/domain/workday";
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

  const monthStart = parseMonthOnly(monthParam);
  const { to: monthEnd } = getMonthRange(monthStart);
  const daysInMonth = monthEnd.getUTCDate();

  const workDays = await listWorkDays({ from: monthStart, to: monthEnd });
  const workDaysByDate = new Map(workDays.map((workDay) => [formatDateOnly(workDay.date), workDay]));

  const prevMonth = addMonths(monthStart, -1);
  const nextMonth = addMonths(monthStart, 1);
  const todayParam = formatDateOnly(getServerToday());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{formatMonthLabel(monthStart)}</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/calendar/${formatDateOnly(prevMonth).slice(0, 7)}`}>← Prev</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/calendar/${formatDateOnly(nextMonth).slice(0, 7)}`}>Next →</Link>
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="border-success bg-success/10 size-3 rounded-sm border" /> Work recorded
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-warning bg-warning/10 size-3 rounded-sm border" /> Incomplete
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-secondary-foreground/30 bg-secondary size-3 rounded-sm border" /> Holiday
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-border size-3 rounded-sm border" /> No record
        </span>
      </div>

      <CalendarGrid
        monthStart={monthStart}
        daysInMonth={daysInMonth}
        workDaysByDate={workDaysByDate}
        todayParam={todayParam}
      />
    </div>
  );
}

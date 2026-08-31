import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { listWorkDays } from "@/lib/data/workday";
import { addMonths, formatDateOnly, formatMonthLabel, parseMonthOnly } from "@/lib/domain/date";
import { getMonthRange } from "@/lib/domain/workday";
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

  const monthStart = parseMonthOnly(monthParam);
  const { to: monthEnd } = getMonthRange(monthStart);
  const daysInMonth = monthEnd.getUTCDate();

  const workDays = await listWorkDays({ from: monthStart, to: monthEnd });
  const workDaysByDate = new Map(workDays.map((workDay) => [formatDateOnly(workDay.date), workDay]));

  const prevMonth = addMonths(monthStart, -1);
  const nextMonth = addMonths(monthStart, 1);
  const todayParam = formatDateOnly(getServerToday());

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        icon={CalendarDays}
        eyebrow="Month"
        title={formatMonthLabel(monthStart)}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/calendar/${formatDateOnly(prevMonth).slice(0, 7)}`}>
                <ChevronLeft /> Prev
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/calendar/${formatDateOnly(nextMonth).slice(0, 7)}`}>
                Next <ChevronRight />
              </Link>
            </Button>
          </>
        }
      />

      <div className="border-border bg-card flex flex-wrap gap-4 rounded-lg border px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="border-success bg-success/35 size-3 rounded-sm border" /> Work recorded
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-accent bg-accent/25 size-3 rounded-sm border" /> In progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-brand-strong bg-brand-strong size-3 rounded-sm border" /> Holiday
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-border bg-card size-3 rounded-sm border" /> No record
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

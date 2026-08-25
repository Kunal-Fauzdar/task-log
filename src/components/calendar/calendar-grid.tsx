import Link from "next/link";

import { formatDateOnly } from "@/lib/domain/date";
import { cn } from "@/lib/utils";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLES: Record<string, string> = {
  NOT_STARTED: "border-border",
  IN_PROGRESS: "border-warning bg-warning/10",
  COMPLETED: "border-success bg-success/10",
  HOLIDAY: "border-secondary-foreground/30 bg-secondary",
};

type CalendarWorkDay = {
  date: Date;
  status: string;
};

export function CalendarGrid({
  monthStart,
  daysInMonth,
  workDaysByDate,
  todayParam,
}: {
  monthStart: Date;
  daysInMonth: number;
  workDaysByDate: Map<string, CalendarWorkDay>;
  todayParam: string | null;
}) {
  const leadingBlanks = monthStart.getUTCDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_HEADERS.map((day) => (
          <div key={day} className="text-muted-foreground py-1 text-xs font-medium">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} />;

          const cellDate = new Date(
            Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day),
          );
          const dateParam = formatDateOnly(cellDate);
          const workDay = workDaysByDate.get(dateParam);
          const isToday = dateParam === todayParam;

          return (
            <Link
              key={dateParam}
              href={`/worklog/${dateParam}`}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-md border text-sm transition-colors hover:bg-accent",
                workDay ? STATUS_STYLES[workDay.status] : "border-border",
                isToday && "ring-ring ring-2",
              )}
            >
              {day}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

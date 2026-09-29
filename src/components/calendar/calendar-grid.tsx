import Link from "next/link";
import { CheckCircle2, Clock3, PalmtreeIcon, Plane } from "lucide-react";

import { formatDateOnly } from "@/lib/domain/date";
import { cn } from "@/lib/utils";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Flat state fills on the app's green ramp — sage (in progress), bright green (completed),
// deepest green (holiday). Redundant with the per-status icon below, not reliant on hue alone.
const STATUS_STYLES: Record<string, string> = {
  NOT_STARTED: "bg-card border-border",
  IN_PROGRESS: "bg-card border-border",
  COMPLETED: "bg-card border-border",
  HOLIDAY: "bg-brand-strong/60 border-brand-strong",
  LEAVE: "bg-secondary border-border",
};

// A small icon per status, redundant with (not a replacement for) the color coding — keeps the
// grid legible for anyone relying on shape rather than hue to tell cells apart.
const STATUS_ICONS: Record<string, typeof CheckCircle2 | undefined> = {
  IN_PROGRESS: Clock3,
  COMPLETED: CheckCircle2,
  HOLIDAY: PalmtreeIcon,
  LEAVE: Plane,
};

type CalendarWorkDay = {
  date: Date;
  status: string;
  tasks: unknown[];
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
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAY_HEADERS.map((day, index) => (
          <div
            key={day}
            className={cn(
              "py-1 text-xs font-medium",
              index === 0 || index === 6 ? "text-muted-foreground/70" : "text-muted-foreground",
            )}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} />;

          const cellDate = new Date(
            Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day),
          );
          const dateParam = formatDateOnly(cellDate);
          const workDay = workDaysByDate.get(dateParam);
          const isToday = dateParam === todayParam;
          const isWeekendCol = cellDate.getUTCDay() === 0 || cellDate.getUTCDay() === 6;
          const StatusIcon = workDay ? STATUS_ICONS[workDay.status] : undefined;

          return (
            <Link
              key={dateParam}
              href={`/worklog/${dateParam}`}
              className={cn(
                "flex min-h-20 flex-col items-start justify-start gap-1 rounded-lg border p-2 text-sm transition-colors",
                workDay
                  ? STATUS_STYLES[workDay.status]
                  : cn(
                      "hover:border-accent hover:bg-secondary",
                      isWeekendCol ? "bg-secondary/60 border-border/60" : "bg-card border-border",
                    ),
                isToday && "bg-primary border-primary text-primary-foreground",
              )}
            >
              <span className="flex w-full items-center justify-between">
                <span className="tabular-nums">{day}</span>
                {StatusIcon && <StatusIcon className="size-3 opacity-80" />}
              </span>
              {workDay && workDay.tasks.length > 0 && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-[11px]",
                    isToday ? "text-primary-foreground/90" : "text-link",
                  )}
                >
                  <span className="size-1 rounded-full bg-current" />
                  {workDay.tasks.length} {workDay.tasks.length === 1 ? "task" : "tasks"}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

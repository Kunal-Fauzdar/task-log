import Link from "next/link";
import { CheckCircle2, Clock3, PalmtreeIcon } from "lucide-react";

import { formatDateOnly } from "@/lib/domain/date";
import { cn } from "@/lib/utils";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLES: Record<string, string> = {
  NOT_STARTED: "border-border",
  IN_PROGRESS:
    "border-warning bg-gradient-to-br from-warning/20 to-warning/5 text-warning-foreground font-medium",
  COMPLETED:
    "border-success bg-gradient-to-br from-success/20 to-success/5 text-success font-medium",
  HOLIDAY:
    "border-primary/40 bg-gradient-to-br from-primary/15 to-accent/10 text-link font-medium",
};

// A small icon per status, redundant with (not a replacement for) the color coding — keeps the
// grid legible for anyone relying on shape rather than hue to tell cells apart.
const STATUS_ICONS: Record<string, typeof CheckCircle2 | undefined> = {
  IN_PROGRESS: Clock3,
  COMPLETED: CheckCircle2,
  HOLIDAY: PalmtreeIcon,
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
      <div className="grid grid-cols-7 gap-1">
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
                // A light frosted-glass base (bg-card/35 + backdrop-blur) sits under every cell,
                // status-colored or not — without it, a plain "no record" cell has nothing behind
                // the day number but the busy background image, which hurt legibility badly on
                // exactly the cells with the least other visual weight to compensate.
                "bg-card/35 flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-sm backdrop-blur-sm transition-all hover:shadow-sm hover:brightness-95 dark:hover:brightness-125",
                workDay
                  ? STATUS_STYLES[workDay.status]
                  : cn("hover:bg-accent", isWeekendCol ? "border-border/60" : "border-border"),
                isToday && "ring-primary ring-2 ring-offset-1",
              )}
            >
              {day}
              {StatusIcon && <StatusIcon className="size-3" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

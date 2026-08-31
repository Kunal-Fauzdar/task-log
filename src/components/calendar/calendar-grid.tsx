import Link from "next/link";
import { CheckCircle2, Clock3, PalmtreeIcon } from "lucide-react";

import { formatDateOnly } from "@/lib/domain/date";
import { cn } from "@/lib/utils";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Flat state fills on the app's green ramp — sage (in progress), bright green (completed),
// deepest green (holiday). Redundant with the per-status icon below, not reliant on hue alone.
const STATUS_STYLES: Record<string, string> = {
  NOT_STARTED: "bg-card border-border",
  IN_PROGRESS: "bg-accent/25 border-accent text-foreground font-medium",
  COMPLETED: "bg-success/35 border-success text-success-foreground font-medium",
  HOLIDAY: "bg-brand-strong border-brand-strong text-brand-strong-foreground font-medium",
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
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-sm transition-colors",
                workDay
                  ? STATUS_STYLES[workDay.status]
                  : cn(
                      "hover:border-accent hover:bg-secondary",
                      isWeekendCol ? "bg-muted/50 border-border/60" : "bg-card border-border",
                    ),
                isToday && "ring-ring ring-2 ring-offset-2 ring-offset-background",
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

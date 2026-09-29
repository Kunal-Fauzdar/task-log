"use client";

import { useEffect, useState } from "react";
import { BarChart3, Clock, Coffee, ListChecks } from "lucide-react";

import { getNaiveLocalNow } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import { elapsedWorkSeconds } from "@/lib/domain/workday";
import { StatTile } from "@/components/dashboard/stat-tile";

// Productivity = logged task time as a share of time worked so far (capped at 100%).
export function TodaySummary({
  taskCount,
  taskSeconds,
  breakSeconds,
  checkInIso,
  checkOutIso,
}: {
  taskCount: number;
  taskSeconds: number;
  breakSeconds: number;
  checkInIso: string | null;
  checkOutIso: string | null;
}) {
  const [, tick] = useState(0);
  const running = !!checkInIso && !checkOutIso;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const worked = checkInIso
    ? elapsedWorkSeconds(
        {
          checkIn: new Date(checkInIso),
          checkOut: checkOutIso ? new Date(checkOutIso) : null,
          breakSeconds,
        },
        getNaiveLocalNow(),
      )
    : 0;
  const productivity = worked > 0 ? Math.min(100, Math.round((taskSeconds / worked) * 100)) : 0;

  return (
    <section className="panel flex flex-col gap-3 p-5">
      <h2 className="text-sm font-semibold">Today&apos;s Summary</h2>
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={ListChecks} label="Total Tasks" value={String(taskCount)} />
        <StatTile
          icon={Clock}
          label="Focused Time"
          value={formatSecondsToDuration(taskSeconds)}
          accent="info"
        />
        <StatTile icon={BarChart3} label="Productivity" value={`${productivity}%`} />
        <StatTile
          icon={Coffee}
          label="Break Time"
          value={formatSecondsToDuration(breakSeconds)}
          accent="info"
        />
      </div>
    </section>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { formatClockTime } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import {
  WORK_DAY_STATUS_BADGE_VARIANT,
  WORK_DAY_STATUS_LABELS,
  calculateNetWorkSeconds,
  calculateTotalTaskSeconds,
} from "@/lib/domain/workday";
import { Badge } from "@/components/ui/badge";

type TodayWorkDay = {
  checkIn: Date | null;
  checkOut: Date | null;
  breakSeconds: number;
  status: keyof typeof WORK_DAY_STATUS_LABELS;
  tasks: { durationSeconds: number }[];
};

export function TodayWorkCard({ workDay }: { workDay: TodayWorkDay | null }) {
  if (!workDay) {
    return (
      <section className="bg-secondary rounded-lg p-5 shadow-md">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Today&apos;s Work</h2>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">No work recorded yet today.</p>
        <Link
          href="/worklog"
          className="text-link mt-2 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
        >
          Go to today&apos;s Work Log <ArrowRight className="size-3.5" />
        </Link>
      </section>
    );
  }

  const netWorkSeconds = calculateNetWorkSeconds(workDay);
  const totalTaskSeconds = calculateTotalTaskSeconds(workDay.tasks);

  return (
    <section className="bg-secondary rounded-lg p-5 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Today&apos;s Work</h2>
        </div>
        <Badge variant={WORK_DAY_STATUS_BADGE_VARIANT[workDay.status]}>
          {WORK_DAY_STATUS_LABELS[workDay.status]}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Check In</dt>
          <dd className="font-medium">{workDay.checkIn ? formatClockTime(workDay.checkIn) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Check Out</dt>
          <dd className="font-medium">
            {workDay.checkOut ? formatClockTime(workDay.checkOut) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Break</dt>
          <dd className="font-medium">{formatSecondsToDuration(workDay.breakSeconds)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Net Work Duration</dt>
          <dd className="font-medium">
            {netWorkSeconds !== null ? formatSecondsToDuration(Math.max(0, netWorkSeconds)) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tasks</dt>
          <dd className="font-medium">{workDay.tasks.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total Task Duration</dt>
          <dd className="font-medium">{formatSecondsToDuration(totalTaskSeconds)}</dd>
        </div>
      </dl>
      <Link
        href="/worklog"
        className="text-link mt-3 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
      >
        Open today&apos;s Work Log <ArrowRight className="size-3.5" />
      </Link>
    </section>
  );
}

import Link from "next/link";

import { formatClockTime } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import {
  WORK_DAY_STATUS_LABELS,
  calculateNetWorkSeconds,
  calculateTotalTaskSeconds,
} from "@/lib/domain/workday";

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
      <section className="border-border rounded-lg border p-4">
        <h2 className="mb-2 text-lg font-semibold tracking-tight">Today&apos;s Work</h2>
        <p className="text-muted-foreground text-sm">No work recorded yet today.</p>
        <Link href="/worklog" className="text-primary mt-2 inline-block text-sm underline underline-offset-4">
          Go to today&apos;s Work Log →
        </Link>
      </section>
    );
  }

  const netWorkSeconds = calculateNetWorkSeconds(workDay);
  const totalTaskSeconds = calculateTotalTaskSeconds(workDay.tasks);

  return (
    <section className="border-border rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Today&apos;s Work</h2>
        <span className="text-muted-foreground text-sm">
          {WORK_DAY_STATUS_LABELS[workDay.status]}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
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
      <Link href="/worklog" className="text-primary mt-3 inline-block text-sm underline underline-offset-4">
        Open today&apos;s Work Log →
      </Link>
    </section>
  );
}

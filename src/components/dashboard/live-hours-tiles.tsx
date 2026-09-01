"use client";

import { useEffect, useState } from "react";

import { formatSecondsToDuration } from "@/lib/domain/duration";
import { getNaiveLocalNow } from "@/lib/domain/date";
import { elapsedWorkSeconds } from "@/lib/domain/workday";
import { StatTile } from "@/components/dashboard/stat-tile";

type InProgress = { checkInIso: string; breakSeconds: number };

// The three "hours" dashboard tiles. Server passes base sums that count today's in-progress day
// as 0 (there's no net duration until check-out). When today IS in progress, this adds the
// elapsed-so-far (check-in → now − break) to all three windows and ticks it once a second, so
// "Today's hours" doesn't read 0:00:00 while you're actively checked in.
export function LiveHoursTiles({
  todayBase,
  weekBase,
  monthBase,
  inProgress,
}: {
  todayBase: number;
  weekBase: number;
  monthBase: number;
  inProgress: InProgress | null;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!inProgress) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [inProgress]);

  const extra = inProgress
    ? elapsedWorkSeconds(
        { checkIn: new Date(inProgress.checkInIso), checkOut: null, breakSeconds: inProgress.breakSeconds },
        getNaiveLocalNow(),
      )
    : 0;

  return (
    <>
      <StatTile label="Today's hours" value={formatSecondsToDuration(todayBase + extra)} accent="info" />
      <StatTile label="Last 7 days" value={formatSecondsToDuration(weekBase + extra)} accent="info" />
      <StatTile label="Last 30 days" value={formatSecondsToDuration(monthBase + extra)} accent="primary" />
    </>
  );
}

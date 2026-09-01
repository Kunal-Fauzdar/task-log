"use client";

import { useEffect, useState } from "react";

import { formatSecondsToDuration } from "@/lib/domain/duration";
import { getNaiveLocalNow } from "@/lib/domain/date";
import { elapsedWorkSeconds } from "@/lib/domain/workday";
import { StatTile } from "@/components/dashboard/stat-tile";

type InProgress = { checkInIso: string; breakSeconds: number };

// The Dashboard's "Today's hours" tile. The server passes `todayBase` (net work seconds), which
// is 0 until check-out. While today is in progress (checked in, not out) this adds
// elapsed-so-far (check-in → now − break) and re-renders once a second so the tile ticks up
// instead of sitting at 0:00:00 all day. (The old version also drove "Last 7 days" / "Last 30
// days" hours tiles — those were removed: they only summed days that had both a check-in and a
// check-out, so they read far lower than reality whenever a day wasn't checked out, which was
// more confusing than useful.)
export function LiveTodayHours({
  todayBase,
  inProgress,
}: {
  todayBase: number;
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
        {
          checkIn: new Date(inProgress.checkInIso),
          checkOut: null,
          breakSeconds: inProgress.breakSeconds,
        },
        getNaiveLocalNow(),
      )
    : 0;

  return (
    <StatTile
      label="Today's hours"
      value={formatSecondsToDuration(todayBase + extra)}
      accent="info"
    />
  );
}

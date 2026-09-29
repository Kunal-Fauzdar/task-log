"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Coffee, Play, Square } from "lucide-react";

import {
  endBreakAction,
  endWorkAction,
  startBreakAction,
} from "@/lib/actions/workday-actions";
import { getLocalISODate, getNaiveLocalNow } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import { elapsedWorkSeconds } from "@/lib/domain/workday";
import { Button } from "@/components/ui/button";

type Snapshot = {
  id: string;
  checkInIso: string | null;
  checkOutIso: string | null;
  breakSeconds: number;
  onBreak: boolean;
};

// The dashboard hero: a big live timer with the day's current state and the two primary actions.
export function CurrentlyWorking({
  workDay,
  currentTask,
}: {
  workDay: Snapshot | null;
  currentTask: string | null;
}) {
  const [, tick] = useState(0);
  const [, startTransition] = useTransition();
  const running = !!workDay?.checkInIso && !workDay.checkOutIso;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!workDay || !workDay.checkInIso) {
    return (
      <section className="panel flex flex-col gap-3 p-5">
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="bg-muted-foreground size-1.5 rounded-full" /> Not started
        </p>
        <p className="text-foreground text-4xl font-semibold tabular-nums">00:00:00</p>
        <p className="text-muted-foreground text-sm">No work recorded yet today.</p>
        <div>
          <Button asChild>
            <Link href="/worklog">
              <Play /> Start Work
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  const checkIn = new Date(workDay.checkInIso);
  const checkOut = workDay.checkOutIso ? new Date(workDay.checkOutIso) : null;
  const seconds = Math.max(
    0,
    elapsedWorkSeconds(
      { checkIn, checkOut, breakSeconds: workDay.breakSeconds },
      checkOut ?? getNaiveLocalNow(),
    ) ?? 0,
  );
  const clock = formatSecondsToDuration(seconds).replace(/^(\d):/, "0$1:");
  const date = getLocalISODate(new Date());

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
    });
  }

  return (
    <section className="panel flex flex-col gap-3 p-5">
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <span
          className={
            running && !workDay.onBreak
              ? "size-1.5 rounded-full bg-emerald-400"
              : "bg-muted-foreground size-1.5 rounded-full"
          }
        />
        {!running ? "Work completed" : workDay.onBreak ? "On break" : "Currently working"}
      </p>
      <p className="text-foreground text-4xl font-semibold tabular-nums">{clock}</p>
      {currentTask && <p className="text-muted-foreground truncate text-sm">{currentTask}</p>}
      {running && (
        <div className="mt-1 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              run(() =>
                workDay.onBreak
                  ? endBreakAction(workDay.id, date)
                  : startBreakAction(workDay.id, date),
              )
            }
          >
            <Coffee /> {workDay.onBreak ? "End Break" : "Start Break"}
          </Button>
          <Button
            onClick={() =>
              run(() => endWorkAction(workDay.id, date, getNaiveLocalNow().toISOString()))
            }
          >
            <Square /> End Work
          </Button>
        </div>
      )}
      {!running && (
        <div>
          <Button variant="secondary" asChild>
            <Link href="/worklog">Open Work Log</Link>
          </Button>
        </div>
      )}
    </section>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import { Clock, Coffee, LogIn, LogOut, Save } from "lucide-react";

import {
  endBreakAction,
  endWorkAction,
  startBreakAction,
  startWorkAction,
  updateWorkDayTimesAction,
} from "@/lib/actions/workday-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";
import { formatClockTime, formatTimeInputValue, getNaiveLocalNow } from "@/lib/domain/date";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import {
  WORK_DAY_STATUS_BADGE_VARIANT,
  WORK_DAY_STATUS_LABELS,
  calculateNetWorkSeconds,
} from "@/lib/domain/workday";
import { useIsToday } from "@/hooks/use-is-today";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiveElapsed } from "@/components/workday/live-elapsed";

type WorkDaySummary = {
  id: string;
  checkIn: Date | null;
  checkOut: Date | null;
  breakSeconds: number;
  breakStartedAt: Date | null;
  status: string;
};

export function TimeTrackingCard({
  workDay,
  dateParam,
}: {
  workDay: WorkDaySummary;
  dateParam: string;
}) {
  const isToday = useIsToday(dateParam);
  const [isPending, startTransition] = useTransition();
  const [timesState, timesFormAction, isTimesPending] = useActionState(
    updateWorkDayTimesAction,
    IDLE_ACTION_STATE,
  );

  const netWorkSeconds = calculateNetWorkSeconds(workDay);
  const isOnBreak = workDay.breakStartedAt !== null;

  // Controlled, not defaultValue — see the comment in task-form-dialog.tsx: React 19 resets a
  // <form action> after every action call that resolves, including validation-error returns,
  // which would otherwise wipe what the user just typed. This form also needs to stay in sync
  // when checkIn/checkOut/breakSeconds change from elsewhere (the quick-action buttons above,
  // which revalidate the same underlying WorkDay). Re-syncing that during an effect would be
  // the derived-state-in-an-effect anti-pattern (extra render, flagged by
  // react-hooks/set-state-in-effect) — this is React's documented "adjust state when a prop
  // changes" pattern instead: compare against a snapshot of the last-seen server values and
  // setState directly in the render body when they differ, which bails out before painting
  // rather than causing a visible extra frame.
  const workDaySignature = `${workDay.checkIn?.getTime() ?? ""}|${workDay.checkOut?.getTime() ?? ""}|${workDay.breakSeconds}`;
  const [prevSignature, setPrevSignature] = useState(workDaySignature);
  const [checkInInput, setCheckInInput] = useState(
    workDay.checkIn ? formatTimeInputValue(workDay.checkIn) : "",
  );
  const [checkOutInput, setCheckOutInput] = useState(
    workDay.checkOut ? formatTimeInputValue(workDay.checkOut) : "",
  );
  const [breakInput, setBreakInput] = useState(formatSecondsToDuration(workDay.breakSeconds));

  if (workDaySignature !== prevSignature) {
    setPrevSignature(workDaySignature);
    setCheckInInput(workDay.checkIn ? formatTimeInputValue(workDay.checkIn) : "");
    setCheckOutInput(workDay.checkOut ? formatTimeInputValue(workDay.checkOut) : "");
    setBreakInput(formatSecondsToDuration(workDay.breakSeconds));
  }

  function handleStartWork() {
    startTransition(async () => {
      await startWorkAction(workDay.id, dateParam, getNaiveLocalNow().toISOString());
    });
  }

  function handleEndWork() {
    startTransition(async () => {
      await endWorkAction(workDay.id, dateParam, getNaiveLocalNow().toISOString());
    });
  }

  function handleStartBreak() {
    startTransition(async () => {
      await startBreakAction(workDay.id, dateParam);
    });
  }

  function handleEndBreak() {
    startTransition(async () => {
      await endBreakAction(workDay.id, dateParam);
    });
  }

  const statusKey = workDay.status as keyof typeof WORK_DAY_STATUS_LABELS;

  return (
    <section className="border-border bg-card flex flex-col gap-3.5 rounded-lg border border-l-2 border-l-accent p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="bg-secondary text-link flex size-8 items-center justify-center rounded-lg">
            <Clock className="size-4" />
          </span>
          Time Tracking
        </h2>
        {WORK_DAY_STATUS_LABELS[statusKey] ? (
          <Badge variant={WORK_DAY_STATUS_BADGE_VARIANT[statusKey]}>
            {WORK_DAY_STATUS_LABELS[statusKey]}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">{workDay.status}</span>
        )}
      </div>

      {isToday && (
        <div className="flex flex-wrap items-center gap-2">
          {!workDay.checkIn && (
            <Button size="sm" onClick={handleStartWork} disabled={isPending}>
              <LogIn /> Start Work
            </Button>
          )}
          {workDay.checkIn && !workDay.checkOut && (
            <Button size="sm" onClick={handleEndWork} disabled={isPending}>
              <LogOut /> End Work
            </Button>
          )}
          {workDay.checkIn && !workDay.checkOut && !isOnBreak && (
            <Button size="sm" variant="outline" onClick={handleStartBreak} disabled={isPending}>
              <Coffee /> Start Break
            </Button>
          )}
          {isOnBreak && (
            <Button size="sm" variant="outline" onClick={handleEndBreak} disabled={isPending}>
              <Coffee /> End Break
            </Button>
          )}
        </div>
      )}

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
          <dd className="font-medium">
            {isOnBreak ? (
              <LiveElapsed baseSeconds={workDay.breakSeconds} startedAt={workDay.breakStartedAt} />
            ) : (
              formatSecondsToDuration(workDay.breakSeconds)
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Net Work Duration</dt>
          <dd className="font-medium">
            {netWorkSeconds !== null ? formatSecondsToDuration(Math.max(0, netWorkSeconds)) : "—"}
          </dd>
        </div>
      </dl>

      <details className="text-sm">
        <summary className="text-muted-foreground cursor-pointer select-none">
          Edit times manually
        </summary>
        <form action={timesFormAction} className="mt-3 flex flex-col gap-4">
          <input type="hidden" name="id" value={workDay.id} />
          <input type="hidden" name="date" value={dateParam} />

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="checkIn">Check In</Label>
              <Input
                id="checkIn"
                name="checkIn"
                type="time"
                value={checkInInput}
                onChange={(e) => setCheckInInput(e.target.value)}
                aria-invalid={!!timesState.fieldErrors?.checkIn}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="checkOut">Check Out</Label>
              <Input
                id="checkOut"
                name="checkOut"
                type="time"
                value={checkOutInput}
                onChange={(e) => setCheckOutInput(e.target.value)}
                aria-invalid={!!timesState.fieldErrors?.checkOut}
              />
              {timesState.fieldErrors?.checkOut && (
                <p className="text-destructive text-sm">{timesState.fieldErrors.checkOut[0]}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="breakDuration">Break (H:MM:SS)</Label>
              <Input
                id="breakDuration"
                name="breakDuration"
                value={breakInput}
                onChange={(e) => setBreakInput(e.target.value)}
                aria-invalid={!!timesState.fieldErrors?.breakDuration}
              />
              {timesState.fieldErrors?.breakDuration && (
                <p className="text-destructive text-sm">{timesState.fieldErrors.breakDuration[0]}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={isTimesPending}>
              <Save /> {isTimesPending ? "Saving…" : "Save times"}
            </Button>
            <span role="status" className="text-muted-foreground text-sm">
              {timesState.status === "error" && timesState.message}
              {timesState.status === "success" && "Saved."}
            </span>
          </div>
        </form>
      </details>
    </section>
  );
}

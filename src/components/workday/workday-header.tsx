"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, PalmtreeIcon, Plane, Trash2 } from "lucide-react";

import { deleteWorkDayAction, updateWorkDayAction } from "@/lib/actions/workday-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";
import { addDays, formatDateOnly, formatDisplayDate, isWeekend } from "@/lib/domain/date";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type DayType = "WORKING" | "HOLIDAY" | "LEAVE";

const DAY_TYPE_OPTIONS: { value: DayType; label: string }[] = [
  { value: "WORKING", label: "Working" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "LEAVE", label: "Leave" },
];

type WorkDaySummary = {
  id: string;
  date: Date;
  notes: string | null;
  dayType: DayType;
  dayNote: string | null;
};

export function WorkDayHeader({
  workDay,
  dateParam,
  dayType,
  onDayTypeChange,
}: {
  workDay: WorkDaySummary;
  dateParam: string;
  // `dayType` is lifted to WorkDayPanels so picking Holiday/Leave here immediately freezes the
  // sibling Time Tracking / Tasks cards, before Save round-trips.
  dayType: DayType;
  onDayTypeChange: (value: DayType) => void;
}) {
  const [state, formAction, isPending] = useActionState(updateWorkDayAction, IDLE_ACTION_STATE);
  // Controlled, not defaultValue — see the comment in task-form-dialog.tsx for why: React 19
  // resets a <form action> after every action call that resolves, including our own
  // validation-error returns, which would otherwise silently wipe what the user just typed.
  //
  // Also re-syncs when workDay changes from the server (e.g. this same Save submits and
  // revalidates) via the signature/re-sync-during-render pattern (same as TimeTrackingCard),
  // not an effect (would trip react-hooks/set-state-in-effect and cost an extra render).
  // `dayType`'s own re-sync lives in the parent (WorkDayPanels) now.
  const workDaySignature = `${workDay.dayNote ?? ""}|${workDay.notes ?? ""}`;
  const [prevSignature, setPrevSignature] = useState(workDaySignature);
  const [dayNote, setDayNote] = useState(workDay.dayNote ?? "");
  const [notes, setNotes] = useState(workDay.notes ?? "");

  if (workDaySignature !== prevSignature) {
    setPrevSignature(workDaySignature);
    setDayNote(workDay.dayNote ?? "");
    setNotes(workDay.notes ?? "");
  }

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeletePending, startDeleteTransition] = useTransition();

  function confirmDelete() {
    setConfirmingDelete(false);
    startDeleteTransition(async () => {
      await deleteWorkDayAction(workDay.id);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{formatDisplayDate(workDay.date)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Previous day">
            <Link href={`/worklog/${formatDateOnly(addDays(workDay.date, -1))}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/worklog">Today</Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label="Next day">
            <Link href={`/worklog/${formatDateOnly(addDays(workDay.date, 1))}`}>
              <ChevronRight />
            </Link>
          </Button>
          {isWeekend(workDay.date) && <Badge variant="outline">Weekend</Badge>}
          {dayType === "HOLIDAY" && (
            <Badge variant="brand">
              <PalmtreeIcon /> Holiday
            </Badge>
          )}
          {dayType === "LEAVE" && (
            <Badge variant="secondary">
              <Plane /> Leave
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmingDelete(true)}
            disabled={isDeletePending}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 />
            {isDeletePending ? "Deleting…" : "Delete Work Day"}
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {formatDisplayDate(workDay.date)}?</AlertDialogTitle>
            <AlertDialogDescription>
              This also deletes every task logged on this day. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <form action={formAction} className="flex flex-col gap-3.5">
        <input type="hidden" name="id" value={workDay.id} />
        <input type="hidden" name="date" value={dateParam} />
        <input type="hidden" name="dayType" value={dayType} />

        <div className="flex flex-col gap-1.5">
          <Label className="sr-only">Day type</Label>
          <div className="flex w-fit gap-1 rounded-lg border border-border p-1">
            {DAY_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={dayType === option.value}
                onClick={() => onDayTypeChange(option.value)}
                className={cn(
                  "rounded-md px-3.5 py-1.5 text-sm transition-colors",
                  dayType === option.value
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {dayType !== "WORKING" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dayNote">{dayType === "HOLIDAY" ? "Holiday" : "Leave"} reason</Label>
            <Input
              id="dayNote"
              name="dayNote"
              value={dayNote}
              onChange={(e) => setDayNote(e.target.value)}
              placeholder={dayType === "HOLIDAY" ? "e.g. Independence Day" : "e.g. Sick leave"}
              aria-invalid={!!state.fieldErrors?.dayNote}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes" className="text-muted-foreground text-xs">
            Notes
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write your notes for today..."
              aria-invalid={!!state.fieldErrors?.notes}
              className="flex-1"
            />
            <Button type="submit" disabled={isPending}>
              Save Changes
            </Button>
          </div>
          {state.status === "error" && (
            <span role="status" className="text-destructive text-sm">
              {state.message}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

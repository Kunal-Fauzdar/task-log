"use client";

import { useActionState, useState, useTransition } from "react";
import { PalmtreeIcon, Save, Trash2 } from "lucide-react";

import { deleteWorkDayAction, updateWorkDayAction } from "@/lib/actions/workday-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";
import { formatDisplayDate, isWeekend } from "@/lib/domain/date";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type WorkDaySummary = {
  id: string;
  date: Date;
  notes: string | null;
  isHoliday: boolean;
  holidayReason: string | null;
};

export function WorkDayHeader({
  workDay,
  dateParam,
}: {
  workDay: WorkDaySummary;
  dateParam: string;
}) {
  const [state, formAction, isPending] = useActionState(updateWorkDayAction, IDLE_ACTION_STATE);
  // Controlled, not defaultValue — see the comment in task-form-dialog.tsx for why: React 19
  // resets a <form action> after every action call that resolves, including our own
  // validation-error returns, which would otherwise silently wipe what the user just typed.
  //
  // Also needs to re-sync when workDay changes from the server (e.g. this same Save submits and
  // revalidates) — a plain `useState(workDay.isHoliday)` only reads the prop on first mount, so
  // after a successful save the switch/reason/notes kept showing what was on screen just before
  // the click instead of the just-saved value (found via manual QA in Phase 11: toggling
  // "Mark as holiday" on and saving visually reverted the switch to off, even though the
  // Holiday badge and a fresh page load both confirmed it saved correctly — the mutation was
  // fine, only this component's local state was stale). Same signature/re-sync-during-render
  // pattern as TimeTrackingCard, not an effect (would trip react-hooks/set-state-in-effect and
  // cost an extra render).
  const workDaySignature = `${workDay.isHoliday}|${workDay.holidayReason ?? ""}|${workDay.notes ?? ""}`;
  const [prevSignature, setPrevSignature] = useState(workDaySignature);
  const [isHoliday, setIsHoliday] = useState(workDay.isHoliday);
  const [holidayReason, setHolidayReason] = useState(workDay.holidayReason ?? "");
  const [notes, setNotes] = useState(workDay.notes ?? "");

  if (workDaySignature !== prevSignature) {
    setPrevSignature(workDaySignature);
    setIsHoliday(workDay.isHoliday);
    setHolidayReason(workDay.holidayReason ?? "");
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
    <section className="bg-secondary flex flex-col gap-3.5 rounded-lg p-5 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl">{formatDisplayDate(workDay.date)}</h1>
        </div>
        <div className="flex items-center gap-2">
          {isWeekend(workDay.date) && <Badge variant="outline">Weekend</Badge>}
          {workDay.isHoliday && (
            <Badge variant="brand">
              <PalmtreeIcon /> Holiday
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

        <div className="flex items-center gap-2">
          <Switch
            id="isHoliday"
            name="isHoliday"
            checked={isHoliday}
            onCheckedChange={setIsHoliday}
          />
          <Label htmlFor="isHoliday">Mark as holiday</Label>
        </div>

        {isHoliday && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="holidayReason">Holiday reason</Label>
            <Input
              id="holidayReason"
              name="holidayReason"
              value={holidayReason}
              onChange={(e) => setHolidayReason(e.target.value)}
              placeholder="e.g. Independence Day"
              aria-invalid={!!state.fieldErrors?.holidayReason}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            aria-invalid={!!state.fieldErrors?.notes}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending} size="sm">
            <Save className="size-4"/> {isPending ? "Saving…" : "Save"}
          </Button>
          <span role="status" className="text-muted-foreground text-sm">
            {state.status === "error" && state.message}
            {state.status === "success" && "Saved."}
          </span>
        </div>
      </form>
    </section>
  );
}

"use client";

import { useActionState, useState } from "react";
import { CalendarCog, Save } from "lucide-react";

import { updateWorkingDaysAction } from "@/lib/actions/settings-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";
import { WEEKDAY_OPTIONS } from "@/lib/domain/settings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function WorkingDaysForm({ workingDays }: { workingDays: number[] }) {
  const [state, formAction, isPending] = useActionState(updateWorkingDaysAction, IDLE_ACTION_STATE);
  // Controlled, not defaultValue — same reasoning as every other useActionState form in this app
  // (task-form-dialog.tsx): an error return would otherwise wipe the just-changed selection.
  const [selected, setSelected] = useState<Set<number>>(new Set(workingDays));

  function toggle(value: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(value);
      else next.delete(value);
      return next;
    });
  }

  return (
    <section className="border-border bg-card flex flex-col gap-3.5 rounded-lg border p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="bg-secondary text-link flex size-8 items-center justify-center rounded-lg">
          <CalendarCog className="size-4" />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Working Days</h2>
          <p className="text-muted-foreground text-sm">
            Days a month or range Excel export fills in as a blank row when nothing was logged —
            so the file always has one row per working day, not just the ones you happened to
            visit.
          </p>
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WEEKDAY_OPTIONS.map((day) => (
            <label
              key={day.value}
              className="border-border has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 flex items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors"
            >
              <Checkbox
                name="workingDays"
                value={day.value}
                checked={selected.has(day.value)}
                onCheckedChange={(checked) => toggle(day.value, checked === true)}
              />
              {day.label}
            </label>
          ))}
        </div>

        {state.fieldErrors?.workingDays && (
          <p className="text-destructive text-sm">{state.fieldErrors.workingDays[0]}</p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={isPending}>
            <Save /> {isPending ? "Saving…" : "Save"}
          </Button>
          <span role="status" className="text-muted-foreground text-sm">
            {state.status === "error" && !state.fieldErrors && state.message}
            {state.status === "success" && "Saved."}
          </span>
        </div>
      </form>
    </section>
  );
}

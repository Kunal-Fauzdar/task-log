"use client";

import { useActionState, useEffect, useState } from "react";

import { createSkillAction, updateSkillAction } from "@/lib/actions/skill-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type SkillRecord = {
  id: string;
  name: string;
  proficiencyPercentage: number;
  notes: string | null;
};

export function SkillFormDialog({
  skill,
  onClose,
}: {
  skill?: SkillRecord;
  onClose: () => void;
}) {
  const action = skill ? updateSkillAction : createSkillAction;
  const [state, formAction, isPending] = useActionState(action, IDLE_ACTION_STATE);

  // Controlled, not defaultValue — see the comment in task-form-dialog.tsx: React 19 resets a
  // <form action> after every action call that resolves, including validation-error returns.
  const [name, setName] = useState(skill?.name ?? "");
  const [proficiency, setProficiency] = useState(String(skill?.proficiencyPercentage ?? 0));
  const [notes, setNotes] = useState(skill?.notes ?? "");

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [state.status, onClose]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{skill ? "Edit Skill" : "Add Skill"}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          {skill && <input type="hidden" name="id" value={skill.id} />}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Skill name</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!state.fieldErrors?.name}
              required
            />
            {state.fieldErrors?.name && (
              <p className="text-destructive text-sm">{state.fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="proficiencyPercentage">Proficiency (%)</Label>
            <Input
              id="proficiencyPercentage"
              name="proficiencyPercentage"
              type="number"
              min={0}
              max={100}
              value={proficiency}
              onChange={(e) => setProficiency(e.target.value)}
              aria-invalid={!!state.fieldErrors?.proficiencyPercentage}
              required
            />
            {state.fieldErrors?.proficiencyPercentage && (
              <p className="text-destructive text-sm">
                {state.fieldErrors.proficiencyPercentage[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              aria-invalid={!!state.fieldErrors?.notes}
            />
          </div>

          {state.status === "error" && state.message && (
            <p role="alert" className="text-destructive text-sm">
              {state.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

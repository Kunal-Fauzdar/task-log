"use client";

import { useActionState, useEffect, useState } from "react";
import { Save } from "lucide-react";

import { createTaskAction, updateTaskAction } from "@/lib/actions/task-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export type TaskRecord = {
  id: string;
  taskId: string;
  description: string;
  durationSeconds: number;
  link: string | null;
  projectId: string | null;
  timerStatus: string;
  timerStartedAt: Date | null;
  skills?: { skillId: string; skill: { name: string } }[];
};

export type AvailableSkill = { id: string; name: string };
export type AvailableProject = { id: string; name: string };

export function TaskFormDialog({
  workDayId,
  dateParam,
  task,
  availableSkills,
  availableProjects,
  defaultProjectId,
  onClose,
}: {
  workDayId: string;
  dateParam: string;
  task?: TaskRecord;
  availableSkills: AvailableSkill[];
  availableProjects: AvailableProject[];
  // Pre-selected project when adding a task from inside a project's section on the day page.
  defaultProjectId?: string | null;
  onClose: () => void;
}) {
  const action = task ? updateTaskAction : createTaskAction;
  const [state, formAction, isPending] = useActionState(action, IDLE_ACTION_STATE);

  // Controlled inputs, not defaultValue: React 19 resets a <form action={...}> after every
  // action call that resolves without throwing — including our own validation-error returns,
  // since those still resolve successfully as far as React's form machinery is concerned. With
  // defaultValue, a validation error would silently wipe everything the user just typed. Found
  // via manual browser verification in Phase 4.
  const [taskId, setTaskId] = useState(task?.taskId ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [duration, setDuration] = useState(task ? formatSecondsToDuration(task.durationSeconds) : "");
  const [link, setLink] = useState(task?.link ?? "");
  const [projectId, setProjectId] = useState(task?.projectId ?? defaultProjectId ?? "");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(
    task?.skills?.map((s) => s.skillId) ?? [],
  );

  function toggleSkill(skillId: string, checked: boolean) {
    setSelectedSkillIds((current) =>
      checked ? [...current, skillId] : current.filter((id) => id !== skillId),
    );
  }

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [state.status, onClose]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Add Task"}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="workDayId" value={workDayId} />
          <input type="hidden" name="date" value={dateParam} />
          {task && <input type="hidden" name="id" value={task.id} />}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="taskId">Task ID (optional)</Label>
              <Input
                id="taskId"
                name="taskId"
                placeholder="T-1039"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                aria-invalid={!!state.fieldErrors?.taskId}
                className="font-mono"
              />
              {state.fieldErrors?.taskId && (
                <p className="text-destructive text-sm">{state.fieldErrors.taskId[0]}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="duration">Duration (H:MM:SS)</Label>
              <Input
                id="duration"
                name="duration"
                placeholder="4:00:00"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                aria-invalid={!!state.fieldErrors?.duration}
                required
              />
              {state.fieldErrors?.duration && (
                <p className="text-destructive text-sm">{state.fieldErrors.duration[0]}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="projectId">Project</Label>
            <select
              id="projectId"
              name="projectId"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
            >
              <option value="">— No project —</option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {availableProjects.length === 0 && (
              <p className="text-muted-foreground text-xs">
                Add projects on the Projects page to file tasks under one.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Task description</Label>
            <Textarea
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={!!state.fieldErrors?.description}
              required
              rows={3}
            />
            {state.fieldErrors?.description && (
              <p className="text-destructive text-sm">{state.fieldErrors.description[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link">Link (optional)</Label>
            <Input
              id="link"
              name="link"
              type="url"
              placeholder="https://…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              aria-invalid={!!state.fieldErrors?.link}
            />
            {state.fieldErrors?.link && (
              <p className="text-destructive text-sm">{state.fieldErrors.link[0]}</p>
            )}
          </div>

          {availableSkills.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>
                Skills (optional)
                {selectedSkillIds.length > 0 && (
                  <span className="text-muted-foreground font-normal"> · {selectedSkillIds.length} selected</span>
                )}
              </Label>
              <div className="bg-muted/30 grid max-h-36 grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto rounded-lg border p-2.5">
                {availableSkills.map((skill) => (
                  <label key={skill.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      name="skillIds"
                      value={skill.id}
                      checked={selectedSkillIds.includes(skill.id)}
                      onCheckedChange={(checked) => toggleSkill(skill.id, checked === true)}
                    />
                    <span className="truncate">{skill.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

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
              <Save /> {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

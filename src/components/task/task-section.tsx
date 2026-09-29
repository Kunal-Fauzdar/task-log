"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { AlertTriangle, ListChecks, Plus } from "lucide-react";

import {
  createTaskAction,
  deleteTaskAction,
  duplicateTaskAction,
  moveTaskAction,
  updateTaskAction,
} from "@/lib/actions/task-actions";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";
import { parseDurationToSeconds } from "@/lib/domain/duration";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import { getEffectiveTaskSeconds } from "@/lib/domain/task";
import { groupTasksByProject } from "@/lib/domain/project";
import { hasDurationDiscrepancy } from "@/lib/domain/workday";
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
import { Button } from "@/components/ui/button";
import {
  TaskFormDialog,
  type AvailableProject,
  type AvailableSkill,
  type TaskRecord,
} from "@/components/task/task-form-dialog";
import { TaskTable } from "@/components/task/task-table";

type TaskOp =
  | { type: "delete"; id: string }
  | { type: "upsert"; task: TaskRecord }
  | { type: "duplicate"; id: string; newId: string }
  | { type: "move"; id: string; direction: "up" | "down" };

// Applies a pending mutation to the list immediately; React reverts to the server-provided
// `tasks` prop once the action settles and the page revalidates.
function applyTaskOp(tasks: TaskRecord[], op: TaskOp): TaskRecord[] {
  switch (op.type) {
    case "delete":
      return tasks.filter((t) => t.id !== op.id);
    case "upsert": {
      const exists = tasks.some((t) => t.id === op.task.id);
      return exists ? tasks.map((t) => (t.id === op.task.id ? op.task : t)) : [...tasks, op.task];
    }
    case "duplicate": {
      const source = tasks.find((t) => t.id === op.id);
      if (!source) return tasks;
      const copy = { ...source, id: op.newId, timerStatus: "NONE", timerStartedAt: null };
      const at = tasks.indexOf(source);
      return [...tasks.slice(0, at + 1), copy, ...tasks.slice(at + 1)];
    }
    case "move": {
      const target = tasks.find((t) => t.id === op.id);
      if (!target) return tasks;
      const siblings = tasks.filter((t) => t.projectId === target.projectId);
      const i = siblings.findIndex((t) => t.id === op.id);
      const swap = siblings[op.direction === "up" ? i - 1 : i + 1];
      if (!swap) return tasks;
      const next = [...tasks];
      const a = next.indexOf(target);
      const b = next.indexOf(swap);
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    }
  }
}

export function TaskSection({
  workDayId,
  dateParam,
  tasks: serverTasks,
  netWorkSeconds,
  availableSkills,
  availableProjects,
  dayType,
}: {
  workDayId: string;
  dateParam: string;
  tasks: TaskRecord[];
  netWorkSeconds: number | null;
  availableSkills: AvailableSkill[];
  availableProjects: AvailableProject[];
  dayType: "WORKING" | "HOLIDAY" | "LEAVE";
}) {
  // On a holiday / leave day there's no work to log — freeze task creation and the per-row
  // controls (edit / duplicate / reorder / timer / delete). Switching the day type back to
  // Working in the header re-enables everything.
  const isDayOff = dayType !== "WORKING";
  const dayOffLabel = dayType === "HOLIDAY" ? "holiday" : "leave";
  const [dialogTask, setDialogTask] = useState<TaskRecord | null>(null);
  // null = not creating; { projectId } = creating, with that project pre-selected in the dialog.
  const [createIn, setCreateIn] = useState<{ projectId: string | null } | null>(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState<TaskRecord | null>(null);
  const [, startTransition] = useTransition();
  const [tasks, applyOptimistic] = useOptimistic(serverTasks, applyTaskOp);
  const isPending = false;

  function saveTask(formData: FormData, existing?: TaskRecord) {
    const projectId = String(formData.get("projectId") ?? "") || null;
    const optimisticTask: TaskRecord = {
      id: existing?.id ?? `optimistic-${crypto.randomUUID()}`,
      taskId: String(formData.get("taskId") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      durationSeconds: parseDurationToSeconds(String(formData.get("duration") ?? "")),
      link: String(formData.get("link") ?? "") || null,
      projectId,
      priority: String(formData.get("priority") ?? "MEDIUM"),
      timerStatus: existing?.timerStatus ?? "NONE",
      timerStartedAt: existing?.timerStartedAt ?? null,
      skills: existing?.skills,
    };
    startTransition(async () => {
      applyOptimistic({ type: "upsert", task: optimisticTask });
      await (existing ? updateTaskAction : createTaskAction)(IDLE_ACTION_STATE, formData);
    });
  }

  const hasRunningTimer = tasks.some((task) => task.timerStatus === "RUNNING");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!hasRunningTimer) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [hasRunningTimer]);

  // Ticks while any task timer is running (see `now` above) so a long-running active timer
  // counts toward the total immediately, not just once paused/completed (spec §12).
  const totalSeconds = useMemo(
    () => tasks.reduce((sum, task) => sum + getEffectiveTaskSeconds(task, now), 0),
    [tasks, now],
  );

  const isOverBudget = hasDurationDiscrepancy(netWorkSeconds, totalSeconds);

  // Named-project groups first (by name), then "No project" — only groups that have tasks today.
  const groups = useMemo(
    () => groupTasksByProject(tasks, availableProjects),
    [tasks, availableProjects],
  );

  function confirmDelete() {
    const task = taskPendingDelete;
    if (!task) return;
    setTaskPendingDelete(null);
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: task.id });
      await deleteTaskAction(task.id, dateParam);
    });
  }

  function handleDuplicate(task: TaskRecord) {
    startTransition(async () => {
      applyOptimistic({ type: "duplicate", id: task.id, newId: `optimistic-${crypto.randomUUID()}` });
      await duplicateTaskAction(task.id, dateParam);
    });
  }

  function handleMove(task: TaskRecord, direction: "up" | "down") {
    startTransition(async () => {
      applyOptimistic({ type: "move", id: task.id, direction });
      await moveTaskAction(workDayId, dateParam, task.id, direction);
    });
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <ListChecks className="text-link size-5" />
          Tasks
        </h2>
        <Button size="sm" onClick={() => setCreateIn({ projectId: null })} disabled={isDayOff}>
          <Plus /> Add Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-muted-foreground bg-secondary/50 rounded-lg p-6 text-center text-sm">
          {isDayOff
            ? `This day is marked as ${dayOffLabel} — no tasks needed.`
            : "No tasks logged for this day yet."}
        </p>
      ) : (
        <>
          {isDayOff && (
            <p className="text-muted-foreground border-accent/40 bg-secondary/40 rounded-md border border-dashed px-3 py-2 text-sm">
              This day is marked as {dayOffLabel}. Existing tasks are shown read-only — set the
              day type back to Working to edit them.
            </p>
          )}

          {groups.map((group) => {
            const groupSeconds = group.tasks.reduce(
              (sum, task) => sum + getEffectiveTaskSeconds(task, now),
              0,
            );
            return (
              <div key={group.projectId ?? "__none__"} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-baseline gap-2 text-sm font-semibold tracking-tight">
                    {group.name}
                    <span className="text-muted-foreground text-xs font-normal">
                      {group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"} ·{" "}
                      {formatSecondsToDuration(groupSeconds)}
                    </span>
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isDayOff}
                    onClick={() => setCreateIn({ projectId: group.projectId })}
                  >
                    <Plus className="size-3.5" /> New task
                  </Button>
                </div>
                <TaskTable
                  tasks={group.tasks}
                  isPending={isPending || isDayOff}
                  onEdit={setDialogTask}
                  onDelete={setTaskPendingDelete}
                  onDuplicate={handleDuplicate}
                  onMove={handleMove}
                />
              </div>
            );
          })}

          <p className="text-muted-foreground text-sm">
            Total task duration: {formatSecondsToDuration(totalSeconds)}
          </p>
          {isOverBudget && (
            <p
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Total task duration ({formatSecondsToDuration(totalSeconds)}) exceeds net work
              duration ({formatSecondsToDuration(Math.max(0, netWorkSeconds ?? 0))}). Task
              durations haven&apos;t been changed — double check they&apos;re accurate.
            </p>
          )}
        </>
      )}

      {createIn && (
        <TaskFormDialog
          workDayId={workDayId}
          dateParam={dateParam}
          availableSkills={availableSkills}
          availableProjects={availableProjects}
          defaultProjectId={createIn.projectId}
          onSave={(formData) => saveTask(formData)}
          onClose={() => setCreateIn(null)}
        />
      )}

      {dialogTask && (
        <TaskFormDialog
          workDayId={workDayId}
          dateParam={dateParam}
          task={dialogTask}
          onSave={(formData) => saveTask(formData, dialogTask)}
          availableSkills={availableSkills}
          availableProjects={availableProjects}
          onClose={() => setDialogTask(null)}
        />
      )}

      <AlertDialog
        open={taskPendingDelete !== null}
        onOpenChange={(open) => !open && setTaskPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {taskPendingDelete?.taskId ? `task ${taskPendingDelete.taskId}` : "this task"}?
            </AlertDialogTitle>
            <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, ListChecks, Plus } from "lucide-react";

import { deleteTaskAction, duplicateTaskAction, moveTaskAction } from "@/lib/actions/task-actions";
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

export function TaskSection({
  workDayId,
  dateParam,
  tasks,
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
  const [isPending, startTransition] = useTransition();

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
      await deleteTaskAction(task.id, dateParam);
    });
  }

  function handleDuplicate(task: TaskRecord) {
    startTransition(async () => {
      await duplicateTaskAction(task.id, dateParam);
    });
  }

  function handleMove(task: TaskRecord, direction: "up" | "down") {
    startTransition(async () => {
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
                  dateParam={dateParam}
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
          onClose={() => setCreateIn(null)}
        />
      )}

      {dialogTask && (
        <TaskFormDialog
          workDayId={workDayId}
          dateParam={dateParam}
          task={dialogTask}
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

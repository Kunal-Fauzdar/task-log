"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, ListChecks, Plus } from "lucide-react";

import { deleteTaskAction, duplicateTaskAction, moveTaskAction } from "@/lib/actions/task-actions";
import { formatSecondsToDuration } from "@/lib/domain/duration";
import { getEffectiveTaskSeconds } from "@/lib/domain/task";
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
}: {
  workDayId: string;
  dateParam: string;
  tasks: TaskRecord[];
  netWorkSeconds: number | null;
  availableSkills: AvailableSkill[];
}) {
  const [dialogTask, setDialogTask] = useState<TaskRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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
        <Button size="sm" onClick={() => setIsCreating(true)}>
          <Plus /> Add Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-muted-foreground bg-card/40 backdrop-blur-md rounded-lg border border-dashed p-5 text-center text-sm">
          No tasks logged for this day yet.
        </p>
      ) : (
        <>
          <TaskTable
            tasks={tasks}
            dateParam={dateParam}
            isPending={isPending}
            onEdit={setDialogTask}
            onDelete={setTaskPendingDelete}
            onDuplicate={handleDuplicate}
            onMove={handleMove}
          />
          <p className="text-muted-foreground text-sm">
            Total task duration: {formatSecondsToDuration(totalSeconds)}
          </p>
          {isOverBudget && (
            <p
              role="alert"
              className="border-warning bg-warning/10 text-warning-foreground flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Total task duration ({formatSecondsToDuration(totalSeconds)}) exceeds net work
              duration ({formatSecondsToDuration(Math.max(0, netWorkSeconds ?? 0))}). Task
              durations haven&apos;t been changed — double check they&apos;re accurate.
            </p>
          )}
        </>
      )}

      {isCreating && (
        <TaskFormDialog
          workDayId={workDayId}
          dateParam={dateParam}
          availableSkills={availableSkills}
          onClose={() => setIsCreating(false)}
        />
      )}

      {dialogTask && (
        <TaskFormDialog
          workDayId={workDayId}
          dateParam={dateParam}
          task={dialogTask}
          availableSkills={availableSkills}
          onClose={() => setDialogTask(null)}
        />
      )}

      <AlertDialog
        open={taskPendingDelete !== null}
        onOpenChange={(open) => !open && setTaskPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task {taskPendingDelete?.taskId}?</AlertDialogTitle>
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

"use client";

import { useTransition } from "react";
import { Check, Pause, Play } from "lucide-react";

import {
  completeTaskTimerAction,
  pauseTaskTimerAction,
  resumeTaskTimerAction,
  startTaskTimerAction,
} from "@/lib/actions/task-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TaskRecord } from "@/components/task/task-form-dialog";

// Optional per spec §11 ("Do NOT make the task timer mandatory") — manual duration entry via
// the Edit dialog always remains available regardless of timerStatus.
export function TaskTimerControls({
  task,
  dateParam,
}: {
  task: TaskRecord;
  dateParam: string;
}) {
  const [isPending, startTransition] = useTransition();

  function run(action: (id: string, date: string) => Promise<void>) {
    startTransition(async () => {
      await action(task.id, dateParam);
    });
  }

  if (task.timerStatus === "COMPLETED") {
    return <Badge variant="secondary">Completed</Badge>;
  }

  return (
    <div className="flex items-center gap-1">
      {task.timerStatus === "NONE" && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Start timer for ${task.taskId}`}
          disabled={isPending}
          onClick={() => run(startTaskTimerAction)}
        >
          <Play />
        </Button>
      )}
      {task.timerStatus === "RUNNING" && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Pause timer for ${task.taskId}`}
          disabled={isPending}
          onClick={() => run(pauseTaskTimerAction)}
        >
          <Pause />
        </Button>
      )}
      {task.timerStatus === "PAUSED" && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Resume timer for ${task.taskId}`}
          disabled={isPending}
          onClick={() => run(resumeTaskTimerAction)}
        >
          <Play />
        </Button>
      )}
      {task.timerStatus !== "NONE" && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Complete ${task.taskId}`}
          disabled={isPending}
          onClick={() => run(completeTaskTimerAction)}
        >
          <Check />
        </Button>
      )}
    </div>
  );
}

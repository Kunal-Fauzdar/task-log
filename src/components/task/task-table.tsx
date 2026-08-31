"use client";

import { ArrowDown, ArrowUp, Copy, ExternalLink, Pencil, Trash2 } from "lucide-react";

import { formatSecondsToDuration } from "@/lib/domain/duration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TaskRecord } from "@/components/task/task-form-dialog";
import { LiveElapsed } from "@/components/workday/live-elapsed";
import { TaskTimerControls } from "@/components/task/task-timer-controls";

export function TaskTable({
  tasks,
  dateParam,
  isPending,
  onEdit,
  onDelete,
  onDuplicate,
  onMove,
}: {
  tasks: TaskRecord[];
  dateParam: string;
  isPending: boolean;
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => void;
  onDuplicate: (task: TaskRecord) => void;
  onMove: (task: TaskRecord, direction: "up" | "down") => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Task ID</TableHead>
            <TableHead>Task</TableHead>
            <TableHead className="w-28">Duration</TableHead>
            <TableHead className="w-28">Timer</TableHead>
            <TableHead className="w-24">Link</TableHead>
            <TableHead className="w-40 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task, index) => (
            <TableRow key={task.id}>
              <TableCell className="label-mono whitespace-nowrap">{task.taskId}</TableCell>
              <TableCell className="max-w-md">
                <p className="whitespace-pre-wrap">{task.description}</p>
                {task.skills && task.skills.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {task.skills.map((taskSkill) => (
                      <Badge key={taskSkill.skillId} variant="outline">
                        {taskSkill.skill.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {task.timerStatus === "RUNNING" ? (
                  <LiveElapsed baseSeconds={task.durationSeconds} startedAt={task.timerStartedAt} />
                ) : (
                  formatSecondsToDuration(task.durationSeconds)
                )}
              </TableCell>
              <TableCell>
                <TaskTimerControls task={task} dateParam={dateParam} />
              </TableCell>
              <TableCell>
                {task.link && (
                  <Button asChild variant="outline" size="sm">
                    <a href={task.link} target="_blank" rel="noopener noreferrer">
                      Open <ExternalLink className="size-3" />
                    </a>
                  </Button>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Move up"
                    disabled={isPending || index === 0}
                    onClick={() => onMove(task, "up")}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Move down"
                    disabled={isPending || index === tasks.length - 1}
                    onClick={() => onMove(task, "down")}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Duplicate ${task.taskId}`}
                    disabled={isPending}
                    onClick={() => onDuplicate(task)}
                  >
                    <Copy />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${task.taskId}`}
                    disabled={isPending}
                    onClick={() => onEdit(task)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${task.taskId}`}
                    disabled={isPending}
                    onClick={() => onDelete(task)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

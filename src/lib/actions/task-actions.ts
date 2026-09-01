"use server";

import { revalidatePath } from "next/cache";

import { taskInputSchema } from "@/lib/validation/task";
import {
  completeTaskTimer,
  createTask,
  deleteTask,
  duplicateTask,
  getTasksByWorkDay,
  pauseTaskTimer,
  reorderTasks,
  resumeTaskTimer,
  setTaskSkills,
  startTaskTimer,
  updateTask,
} from "@/lib/data/task";
import type { ActionState } from "@/lib/actions/types";

function parseTaskForm(formData: FormData) {
  return taskInputSchema.safeParse({
    // `?? undefined` so an absent field is "optional", not a null that fails the union.
    taskId: formData.get("taskId") ?? undefined,
    description: formData.get("description"),
    duration: formData.get("duration"),
    link: formData.get("link"),
  });
}

// Skill association is optional (spec §24) and validated separately from the rest of the task
// fields — a checkbox list, not something that needs Zod beyond "these are strings".
function parseSkillIds(formData: FormData): string[] {
  return formData.getAll("skillIds").map(String);
}

export async function createTaskAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const workDayId = String(formData.get("workDayId") ?? "");
  const date = String(formData.get("date") ?? "");

  const parsed = parseTaskForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const task = await createTask({
    workDayId,
    taskId: parsed.data.taskId ?? "",
    description: parsed.data.description,
    durationSeconds: parsed.data.duration,
    link: parsed.data.link || undefined,
  });
  await setTaskSkills(task.id, parseSkillIds(formData));

  revalidatePath(`/worklog/${date}`);
  return { status: "success" };
}

export async function updateTaskAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "");

  const parsed = parseTaskForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await updateTask(id, {
    taskId: parsed.data.taskId ?? "",
    description: parsed.data.description,
    durationSeconds: parsed.data.duration,
    link: parsed.data.link || null,
  });
  await setTaskSkills(id, parseSkillIds(formData));

  revalidatePath(`/worklog/${date}`);
  return { status: "success" };
}

export async function deleteTaskAction(id: string, date: string): Promise<void> {
  await deleteTask(id);
  revalidatePath(`/worklog/${date}`);
}

export async function duplicateTaskAction(id: string, date: string): Promise<void> {
  await duplicateTask(id);
  revalidatePath(`/worklog/${date}`);
}

export async function moveTaskAction(
  workDayId: string,
  date: string,
  taskId: string,
  direction: "up" | "down",
): Promise<void> {
  const tasks = await getTasksByWorkDay(workDayId);
  const index = tasks.findIndex((t) => t.id === taskId);
  const swapWith = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || swapWith < 0 || swapWith >= tasks.length) return;

  const ids = tasks.map((t) => t.id);
  [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];

  await reorderTasks(ids);
  revalidatePath(`/worklog/${date}`);
}

export async function startTaskTimerAction(id: string, date: string): Promise<void> {
  await startTaskTimer(id);
  revalidatePath(`/worklog/${date}`);
}

export async function pauseTaskTimerAction(id: string, date: string): Promise<void> {
  await pauseTaskTimer(id);
  revalidatePath(`/worklog/${date}`);
}

export async function resumeTaskTimerAction(id: string, date: string): Promise<void> {
  await resumeTaskTimer(id);
  revalidatePath(`/worklog/${date}`);
}

export async function completeTaskTimerAction(id: string, date: string): Promise<void> {
  await completeTaskTimer(id);
  revalidatePath(`/worklog/${date}`);
}

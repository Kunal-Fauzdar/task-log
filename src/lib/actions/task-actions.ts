"use server";

import { requireUser } from "@/lib/auth/current-user";
import { parseDateOnly } from "@/lib/domain/date";
import { taskInputSchema } from "@/lib/validation/task";
import { findOrCreateWorkDayByDate } from "@/lib/data/workday";
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
import { revalidateWorkViews } from "@/lib/actions/revalidate-work-views";
import type { ActionState } from "@/lib/actions/types";

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseTaskForm(formData: FormData) {
  return taskInputSchema.safeParse({
    // `?? undefined` so an absent field is "optional", not a null that fails the union.
    taskId: formData.get("taskId") ?? undefined,
    description: formData.get("description"),
    duration: formData.get("duration"),
    link: formData.get("link"),
    projectId: formData.get("projectId") ?? undefined,
    priority: formData.get("priority") ?? undefined,
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
  const user = await requireUser();
  const date = String(formData.get("date") ?? "");
  if (!DATE_PARAM_PATTERN.test(date)) {
    return { status: "error", message: "Something went wrong. Please reload and try again." };
  }

  const parsed = parseTaskForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Resolve the WorkDay from the user + date ourselves — never trust a client-supplied workDayId.
  const workDay = await findOrCreateWorkDayByDate(user.id, parseDateOnly(date));
  const task = await createTask({
    workDayId: workDay.id,
    taskId: parsed.data.taskId ?? "",
    description: parsed.data.description,
    durationSeconds: parsed.data.duration,
    link: parsed.data.link || undefined,
    projectId: parsed.data.projectId || null,
    priority: parsed.data.priority,
  });
  await setTaskSkills(user.id, task.id, parseSkillIds(formData));

  revalidateWorkViews(date);
  return { status: "success" };
}

export async function updateTaskAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
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

  await updateTask(user.id, id, {
    taskId: parsed.data.taskId ?? "",
    description: parsed.data.description,
    durationSeconds: parsed.data.duration,
    link: parsed.data.link || null,
    projectId: parsed.data.projectId || null,
    priority: parsed.data.priority,
  });
  await setTaskSkills(user.id, id, parseSkillIds(formData));

  revalidateWorkViews(date);
  return { status: "success" };
}

export async function deleteTaskAction(id: string, date: string): Promise<void> {
  const user = await requireUser();
  await deleteTask(user.id, id);
  revalidateWorkViews(date);
}

export async function duplicateTaskAction(id: string, date: string): Promise<void> {
  const user = await requireUser();
  await duplicateTask(user.id, id);
  revalidateWorkViews(date);
}

export async function moveTaskAction(
  workDayId: string,
  date: string,
  taskId: string,
  direction: "up" | "down",
): Promise<void> {
  const user = await requireUser();
  const tasks = await getTasksByWorkDay(user.id, workDayId);
  const target = tasks.find((t) => t.id === taskId);
  if (!target) return;

  // The day page renders tasks grouped by project, so up/down moves a task relative to its
  // group-mates (same projectId), not across the whole day. Swap the two tasks' positions in
  // the full ordered id list and reindex — everything else keeps its relative order.
  const siblings = tasks.filter((t) => t.projectId === target.projectId);
  const siblingIndex = siblings.findIndex((t) => t.id === taskId);
  const swapSibling = siblings[direction === "up" ? siblingIndex - 1 : siblingIndex + 1];
  if (!swapSibling) return;

  const ids = tasks.map((t) => t.id);
  const a = ids.indexOf(taskId);
  const b = ids.indexOf(swapSibling.id);
  [ids[a], ids[b]] = [ids[b], ids[a]];

  await reorderTasks(user.id, ids);
  revalidateWorkViews(date);
}

export async function startTaskTimerAction(id: string, date: string): Promise<void> {
  const user = await requireUser();
  await startTaskTimer(user.id, id);
  revalidateWorkViews(date);
}

export async function pauseTaskTimerAction(id: string, date: string): Promise<void> {
  const user = await requireUser();
  await pauseTaskTimer(user.id, id);
  revalidateWorkViews(date);
}

export async function resumeTaskTimerAction(id: string, date: string): Promise<void> {
  const user = await requireUser();
  await resumeTaskTimer(user.id, id);
  revalidateWorkViews(date);
}

export async function completeTaskTimerAction(id: string, date: string): Promise<void> {
  const user = await requireUser();
  await completeTaskTimer(user.id, id);
  revalidateWorkViews(date);
}

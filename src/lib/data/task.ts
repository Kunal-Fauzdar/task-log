import { prisma } from "@/lib/db";
import { tolerateAlreadyDeleted } from "@/lib/data/shared";

async function getNextTaskOrder(workDayId: string): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { workDayId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return last ? last.order + 1 : 0;
}

export async function createTask(data: {
  workDayId: string;
  taskId: string;
  description: string;
  durationSeconds?: number;
  link?: string;
  order?: number;
}) {
  const order = data.order ?? (await getNextTaskOrder(data.workDayId));
  return prisma.task.create({ data: { ...data, order } });
}

export function getTasksByWorkDay(workDayId: string) {
  return prisma.task.findMany({
    where: { workDayId },
    orderBy: { order: "asc" },
  });
}

// Optional association (spec §24) — a task may have zero skills. Full-replace semantics: the
// Task edit form submits the complete desired skill-id list on every save, so this deletes any
// association not in the new list and adds any that's missing, rather than the caller having
// to diff old vs. new itself.
export function setTaskSkills(taskId: string, skillIds: string[]) {
  return prisma.$transaction([
    prisma.taskSkill.deleteMany({ where: { taskId } }),
    prisma.taskSkill.createMany({
      data: skillIds.map((skillId) => ({ taskId, skillId })),
    }),
  ]);
}

export function updateTask(
  id: string,
  data: {
    taskId?: string;
    description?: string;
    durationSeconds?: number;
    link?: string | null;
  },
) {
  return tolerateAlreadyDeleted(prisma.task.update({ where: { id }, data }));
}

export function deleteTask(id: string) {
  return tolerateAlreadyDeleted(prisma.task.delete({ where: { id } }));
}

export async function duplicateTask(id: string) {
  const original = await prisma.task.findUnique({ where: { id } });
  if (!original) return null;

  const order = await getNextTaskOrder(original.workDayId);
  return prisma.task.create({
    data: {
      workDayId: original.workDayId,
      taskId: original.taskId,
      description: original.description,
      durationSeconds: original.durationSeconds,
      link: original.link,
      order,
    },
  });
}

// `orderedTaskIds` is the full list of task IDs for one WorkDay, in the desired final order.
export function reorderTasks(orderedTaskIds: string[]) {
  return prisma.$transaction(
    orderedTaskIds.map((id, index) => prisma.task.update({ where: { id }, data: { order: index } })),
  );
}

// Task timer (spec §11): Start/Pause/Resume/Complete, accumulating elapsed time rather than
// resetting. `timerStartedAt` uses the server's clock, same reasoning as WorkDay breaks — it's
// never displayed as a clock-face time, only the elapsed difference is ever used.

export function startTaskTimer(id: string) {
  return tolerateAlreadyDeleted(
    prisma.task.update({
      where: { id },
      data: { timerStatus: "RUNNING", timerStartedAt: new Date() },
    }),
  );
}

export async function pauseTaskTimer(id: string) {
  const current = await prisma.task.findUnique({ where: { id } });
  if (!current) return null;
  if (current.timerStatus !== "RUNNING" || !current.timerStartedAt) return current;

  const elapsed = Math.max(0, Math.round((Date.now() - current.timerStartedAt.getTime()) / 1000));
  return tolerateAlreadyDeleted(
    prisma.task.update({
      where: { id },
      data: {
        durationSeconds: current.durationSeconds + elapsed,
        timerStatus: "PAUSED",
        timerStartedAt: null,
      },
    }),
  );
}

export function resumeTaskTimer(id: string) {
  return tolerateAlreadyDeleted(
    prisma.task.update({
      where: { id },
      data: { timerStatus: "RUNNING", timerStartedAt: new Date() },
    }),
  );
}

export async function completeTaskTimer(id: string) {
  const current = await prisma.task.findUnique({ where: { id } });
  if (!current) return null;

  const durationSeconds =
    current.timerStatus === "RUNNING" && current.timerStartedAt
      ? current.durationSeconds +
        Math.max(0, Math.round((Date.now() - current.timerStartedAt.getTime()) / 1000))
      : current.durationSeconds;

  return tolerateAlreadyDeleted(
    prisma.task.update({
      where: { id },
      data: { durationSeconds, timerStatus: "COMPLETED", timerStartedAt: null },
    }),
  );
}

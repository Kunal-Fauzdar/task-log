import { prisma } from "@/lib/db";
import { tolerateAlreadyDeleted } from "@/lib/data/shared";

// Tasks have no `userId` column of their own — ownership is "the task's WorkDay belongs to the
// user", expressed as `where: { workDay: { userId } }` (or `{ id, workDay: { userId } }` for a
// by-id mutation). Callers that create tasks pass a workDayId they already resolved through a
// userId-scoped findOrCreateWorkDayByDate, so createTask itself stays keyed on workDayId.

async function getNextTaskOrder(workDayId: string): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { workDayId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return last ? last.order + 1 : 0;
}

// The task exists AND belongs to `userId` (its WorkDay does). null → not found / not the
// caller's — same contract callers already handle from tolerateAlreadyDeleted.
function ownedTask(userId: string, id: string) {
  return prisma.task.findFirst({ where: { id, workDay: { userId } } });
}

export async function createTask(data: {
  workDayId: string;
  taskId: string;
  description: string;
  durationSeconds?: number;
  link?: string;
  projectId?: string | null;
  order?: number;
}) {
  const order = data.order ?? (await getNextTaskOrder(data.workDayId));
  return prisma.task.create({ data: { ...data, order } });
}

export function getTasksByWorkDay(userId: string, workDayId: string) {
  return prisma.task.findMany({
    where: { workDayId, workDay: { userId } },
    orderBy: { order: "asc" },
  });
}

// Full-replace semantics (spec §24): the Task edit form submits the complete desired skill-id
// list on every save, so this deletes any association not in the new list and adds any missing.
// Scoped to the user: the task must be theirs, and only their own skills can be attached (a
// client can't link its task to another user's skill by id).
export async function setTaskSkills(userId: string, taskId: string, skillIds: string[]) {
  const owned = await prisma.task.count({ where: { id: taskId, workDay: { userId } } });
  if (owned === 0) return;

  const ownedSkillIds =
    skillIds.length === 0
      ? []
      : (
          await prisma.skill.findMany({
            where: { id: { in: skillIds }, userId },
            select: { id: true },
          })
        ).map((skill) => skill.id);

  await prisma.$transaction([
    prisma.taskSkill.deleteMany({ where: { taskId } }),
    prisma.taskSkill.createMany({
      data: ownedSkillIds.map((skillId) => ({ taskId, skillId })),
    }),
  ]);
}

export async function updateTask(
  userId: string,
  id: string,
  data: {
    taskId?: string;
    description?: string;
    durationSeconds?: number;
    link?: string | null;
    projectId?: string | null;
  },
) {
  if (!(await ownedTask(userId, id))) return null;
  return tolerateAlreadyDeleted(prisma.task.update({ where: { id }, data }));
}

export async function deleteTask(userId: string, id: string) {
  if (!(await ownedTask(userId, id))) return null;
  return tolerateAlreadyDeleted(prisma.task.delete({ where: { id } }));
}

export async function duplicateTask(userId: string, id: string) {
  const original = await prisma.task.findFirst({ where: { id, workDay: { userId } } });
  if (!original) return null;

  const order = await getNextTaskOrder(original.workDayId);
  return prisma.task.create({
    data: {
      workDayId: original.workDayId,
      taskId: original.taskId,
      description: original.description,
      durationSeconds: original.durationSeconds,
      link: original.link,
      projectId: original.projectId,
      order,
    },
  });
}

// `orderedTaskIds` is the full list of task IDs for one WorkDay, in the desired final order —
// built by the caller from a userId-scoped getTasksByWorkDay, so every id is already the user's;
// the `workDay: { userId }` filter here is defence-in-depth.
export function reorderTasks(userId: string, orderedTaskIds: string[]) {
  return prisma.$transaction(
    orderedTaskIds.map((id, index) =>
      prisma.task.updateMany({ where: { id, workDay: { userId } }, data: { order: index } }),
    ),
  );
}

// Task timer (spec §11): Start/Pause/Resume/Complete, accumulating elapsed time rather than
// resetting. `timerStartedAt` uses the server's clock — it's never displayed as a clock-face
// time, only the elapsed difference is ever used.

export async function startTaskTimer(userId: string, id: string) {
  if (!(await ownedTask(userId, id))) return null;
  return tolerateAlreadyDeleted(
    prisma.task.update({
      where: { id },
      data: { timerStatus: "RUNNING", timerStartedAt: new Date() },
    }),
  );
}

export async function pauseTaskTimer(userId: string, id: string) {
  const current = await prisma.task.findFirst({ where: { id, workDay: { userId } } });
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

export async function resumeTaskTimer(userId: string, id: string) {
  if (!(await ownedTask(userId, id))) return null;
  return tolerateAlreadyDeleted(
    prisma.task.update({
      where: { id },
      data: { timerStatus: "RUNNING", timerStartedAt: new Date() },
    }),
  );
}

export async function completeTaskTimer(userId: string, id: string) {
  const current = await prisma.task.findFirst({ where: { id, workDay: { userId } } });
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

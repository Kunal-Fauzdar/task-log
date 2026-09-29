import { prisma } from "@/lib/db";

// Reports need each task's WorkDay date (for date/month grouping) and associated skills (for
// Skill Usage) in one shape — listWorkDays()'s `include: { tasks: true }` doesn't carry either,
// so this queries Task directly rather than going through WorkDay. Scoped to the owner via the
// task's WorkDay.
export function getTasksInRange(userId: string, range: { from: Date; to: Date }) {
  return prisma.task.findMany({
    where: { workDay: { userId, date: { gte: range.from, lte: range.to } } },
    include: {
      workDay: { select: { date: true } },
      project: { select: { name: true } },
      skills: { include: { skill: true } },
    },
    orderBy: [{ workDay: { date: "asc" } }, { order: "asc" }],
  });
}

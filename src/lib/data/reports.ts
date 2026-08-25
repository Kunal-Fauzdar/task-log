import { prisma } from "@/lib/db";

// Reports need each task's WorkDay date (for date/month grouping) and associated skills (for
// Skill Usage) in one shape — listWorkDays()'s `include: { tasks: true }` doesn't carry either,
// so this queries Task directly rather than going through WorkDay.
export function getTasksInRange(range: { from: Date; to: Date }) {
  return prisma.task.findMany({
    where: { workDay: { date: { gte: range.from, lte: range.to } } },
    include: { workDay: { select: { date: true } }, skills: { include: { skill: true } } },
    orderBy: [{ workDay: { date: "asc" } }, { order: "asc" }],
  });
}

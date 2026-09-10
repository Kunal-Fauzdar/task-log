import { prisma } from "@/lib/db";
import { tolerateAlreadyDeleted } from "@/lib/data/shared";

// Every function is scoped to one owner (`userId`). Project names are unique per user
// (`@@unique([userId, name])`).

export function listProjects(userId: string) {
  return prisma.project.findMany({ where: { userId }, orderBy: { name: "asc" } });
}

export function getProjectById(userId: string, id: string) {
  return prisma.project.findFirst({ where: { id, userId } });
}

// For the Projects management page — each row shows how many tasks would be unassigned if the
// project were removed.
export function listProjectsWithTaskCounts(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { _count: { select: { tasks: true } } },
  });
}

export function createProject(data: { userId: string; name: string }) {
  return prisma.project.create({ data });
}

// Task.projectId is ON DELETE SET NULL — removing a project unassigns its tasks (they stay in
// their work days), it never deletes work. Returns null if the project isn't the caller's.
export async function deleteProject(userId: string, id: string) {
  if (!(await prisma.project.findFirst({ where: { id, userId } }))) return null;
  return tolerateAlreadyDeleted(prisma.project.delete({ where: { id } }));
}

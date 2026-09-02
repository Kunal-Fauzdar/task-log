import { prisma } from "@/lib/db";
import { tolerateAlreadyDeleted } from "@/lib/data/shared";

// A personal project list is a handful of entries — fetch all, ordered by name, and let callers
// filter/group in memory (same reasoning as listSkills, src/lib/data/skill.ts).
export function listProjects() {
  return prisma.project.findMany({ orderBy: { name: "asc" } });
}

export function getProjectById(id: string) {
  return prisma.project.findUnique({ where: { id } });
}

// For the Projects management page — each row shows how many tasks would be unassigned if the
// project were removed.
export function listProjectsWithTaskCounts() {
  return prisma.project.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { tasks: true } } },
  });
}

export function createProject(data: { name: string }) {
  return prisma.project.create({ data });
}

// Task.projectId is ON DELETE SET NULL — removing a project unassigns its tasks (they stay in
// their work days), it never deletes work. tolerateAlreadyDeleted for the same double-click /
// concurrent-delete safety every id-keyed mutation in this app has (CLAUDE.md §3).
export function deleteProject(id: string) {
  return tolerateAlreadyDeleted(prisma.project.delete({ where: { id } }));
}

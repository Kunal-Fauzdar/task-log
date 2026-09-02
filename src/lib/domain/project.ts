// Pure helpers for the Project feature. A project is a global label a Task can be filed under
// (Task.projectId, nullable) — see schema.prisma. The /worklog day page groups a day's tasks
// by project; the Excel export can filter to one project to produce a per-project timesheet.

export const PROJECT_NAME_MAX = 80;

// Shown as the heading for tasks that have no project, and as the "— None —" style option in
// pickers. A day with only project-less tasks (or none) still shows its timings in every
// per-project export — this label is UI grouping only, never a stored value.
export const NO_PROJECT_LABEL = "No project";

export type ProjectRef = { id: string; name: string };

export type TaskProjectGroup<T> = {
  // null = the "No project" group.
  projectId: string | null;
  name: string;
  tasks: T[];
};

// Groups `tasks` by their `projectId`. Named project groups come first, ordered by project name
// (case-insensitive), then the "No project" group last. Only groups that actually have tasks are
// returned — an empty project isn't rendered as a section on a day it has no work in. `projects`
// supplies the display names (tasks only carry `projectId`).
export function groupTasksByProject<T extends { projectId: string | null }>(
  tasks: T[],
  projects: ProjectRef[],
): TaskProjectGroup<T>[] {
  const nameById = new Map(projects.map((project) => [project.id, project.name]));

  const named = new Map<string, T[]>();
  const unassigned: T[] = [];
  for (const task of tasks) {
    if (task.projectId && nameById.has(task.projectId)) {
      const bucket = named.get(task.projectId) ?? [];
      bucket.push(task);
      named.set(task.projectId, bucket);
    } else {
      // Covers both a null projectId and a dangling id whose project was removed after the task
      // was filed (the FK's ON DELETE SET NULL should prevent the latter, but be defensive).
      unassigned.push(task);
    }
  }

  const groups: TaskProjectGroup<T>[] = [...named.entries()]
    .map(([projectId, groupTasks]) => ({
      projectId,
      name: nameById.get(projectId) ?? NO_PROJECT_LABEL,
      tasks: groupTasks,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  if (unassigned.length > 0) {
    groups.push({ projectId: null, name: NO_PROJECT_LABEL, tasks: unassigned });
  }

  return groups;
}

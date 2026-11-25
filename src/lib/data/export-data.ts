import { listWorkDays } from "@/lib/data/workday";
import { listProjects } from "@/lib/data/project";
import { getWorkingDays } from "@/lib/data/settings";
import { fillMissingExportDays } from "@/lib/domain/workday";
import type { ExportWorkDay } from "@/lib/excel/export";

// Read-only overview-style computation (same reasoning as Dashboard/Calendar/Reports, CLAUDE.md
// §3) — used only to cap how far fillMissingExportDays back-fills blank rows, not to record
// anything, so server-UTC "today" being off by a few hours at a timezone boundary is harmless.
export function getServerToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Everything buildWorkLogWorkbook needs for one user + range. Shared by the /api/export download
// and the Google Sheets sync so both always contain exactly the same rows.
export async function loadExportData(
  userId: string,
  range: { from: Date; to: Date },
  project: { id: string } | null,
): Promise<{ workDays: ExportWorkDay[]; workingDays: number[] }> {
  const [workDays, workingDays, projects] = await Promise.all([
    listWorkDays(userId, range),
    getWorkingDays(userId),
    // Only needed for the all-projects export, to tag each task row with its project name.
    project ? Promise.resolve([]) : listProjects(userId),
  ]);
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  const scoped = workDays.map((workDay) => ({
    ...workDay,
    tasks: project
      ? // A project filter keeps every work day (so its timings still export) but limits each
        // day's task rows to that project — a day with no matching task renders timings-only.
        workDay.tasks.filter((task) => task.projectId === project.id)
      : // All-projects export: append " (Project Name)" to each task's Task List cell.
        workDay.tasks.map((task) => ({
          ...task,
          projectName: task.projectId ? (projectNameById.get(task.projectId) ?? null) : null,
        })),
  }));

  return { workDays: fillMissingExportDays(scoped, range, getServerToday()), workingDays };
}

import { formatDateOnly } from "./date";
import { calculateNetWorkSeconds, calculateTotalTaskSeconds, sumNetWorkSeconds } from "./workday";

type ReportWorkDay = {
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  breakSeconds: number;
};

export type ReportTask = {
  taskId: string;
  durationSeconds: number;
  workDay: { date: Date };
  skills: { skill: { id: string; name: string } }[];
};

export type WorkSummary = {
  totalWorkingDays: number;
  totalHoursSeconds: number;
  averageDailyHoursSeconds: number;
  totalTaskDurationSeconds: number;
};

// "Working day" = a day work actually started (checkIn set) — holidays and never-visited
// NOT_STARTED days don't count, but a day that's checked in but not yet checked out still does,
// since work genuinely happened on it (spec §31: "total working days").
export function buildWorkSummary(
  workDays: ReportWorkDay[],
  tasks: { durationSeconds: number }[],
): WorkSummary {
  const totalWorkingDays = workDays.filter((workDay) => workDay.checkIn !== null).length;
  const totalHoursSeconds = sumNetWorkSeconds(workDays);
  const totalTaskDurationSeconds = calculateTotalTaskSeconds(tasks);
  const averageDailyHoursSeconds =
    totalWorkingDays > 0 ? Math.round(totalHoursSeconds / totalWorkingDays) : 0;

  return { totalWorkingDays, totalHoursSeconds, averageDailyHoursSeconds, totalTaskDurationSeconds };
}

export type TasksByDate = { date: Date; taskCount: number; totalDurationSeconds: number };

export function groupTasksByDate(tasks: ReportTask[]): TasksByDate[] {
  const byDate = new Map<string, TasksByDate>();

  for (const task of tasks) {
    const key = formatDateOnly(task.workDay.date);
    const existing = byDate.get(key);
    if (existing) {
      existing.taskCount += 1;
      existing.totalDurationSeconds += task.durationSeconds;
    } else {
      byDate.set(key, {
        date: task.workDay.date,
        taskCount: 1,
        totalDurationSeconds: task.durationSeconds,
      });
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export type TasksByTaskId = { taskId: string; count: number; totalDurationSeconds: number };

export function groupTasksByTaskId(tasks: ReportTask[]): TasksByTaskId[] {
  const byTaskId = new Map<string, TasksByTaskId>();

  for (const task of tasks) {
    const existing = byTaskId.get(task.taskId);
    if (existing) {
      existing.count += 1;
      existing.totalDurationSeconds += task.durationSeconds;
    } else {
      byTaskId.set(task.taskId, {
        taskId: task.taskId,
        count: 1,
        totalDurationSeconds: task.durationSeconds,
      });
    }
  }

  return [...byTaskId.values()].sort((a, b) => a.taskId.localeCompare(b.taskId));
}

export type SkillUsage = {
  skillId: string;
  skillName: string;
  taskCount: number;
  totalDurationSeconds: number;
};

// A task with multiple associated skills contributes its full duration to each skill — the
// time isn't split/divided across a task's skills, since each skill was genuinely exercised for
// the task's whole duration, not a fraction of it.
export function groupTasksBySkill(tasks: ReportTask[]): SkillUsage[] {
  const bySkill = new Map<string, SkillUsage>();

  for (const task of tasks) {
    for (const { skill } of task.skills) {
      const existing = bySkill.get(skill.id);
      if (existing) {
        existing.taskCount += 1;
        existing.totalDurationSeconds += task.durationSeconds;
      } else {
        bySkill.set(skill.id, {
          skillId: skill.id,
          skillName: skill.name,
          taskCount: 1,
          totalDurationSeconds: task.durationSeconds,
        });
      }
    }
  }

  return [...bySkill.values()].sort((a, b) => a.skillName.localeCompare(b.skillName));
}

export type MonthlySummary = {
  month: string; // "YYYY-MM"
  totalHoursSeconds: number;
  taskCount: number;
  totalTaskDurationSeconds: number;
};

export function buildMonthlySummary(
  workDays: ReportWorkDay[],
  tasks: ReportTask[],
): MonthlySummary[] {
  const byMonth = new Map<string, MonthlySummary>();

  const getEntry = (month: string): MonthlySummary => {
    const existing = byMonth.get(month);
    if (existing) return existing;
    const created: MonthlySummary = { month, totalHoursSeconds: 0, taskCount: 0, totalTaskDurationSeconds: 0 };
    byMonth.set(month, created);
    return created;
  };

  for (const workDay of workDays) {
    const entry = getEntry(formatDateOnly(workDay.date).slice(0, 7));
    entry.totalHoursSeconds += calculateNetWorkSeconds(workDay) ?? 0;
  }

  for (const task of tasks) {
    const entry = getEntry(formatDateOnly(task.workDay.date).slice(0, 7));
    entry.taskCount += 1;
    entry.totalTaskDurationSeconds += task.durationSeconds;
  }

  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

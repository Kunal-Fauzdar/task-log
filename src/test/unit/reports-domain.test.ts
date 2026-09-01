import { describe, expect, it } from "vitest";

import { parseDateOnly } from "@/lib/domain/date";
import {
  buildMonthlySummary,
  buildWorkSummary,
  groupTasksByDate,
  groupTasksBySkill,
  groupTasksByTaskId,
  type ReportTask,
} from "@/lib/domain/reports";

function task(overrides: Partial<ReportTask> & { workDayDate: string }): ReportTask {
  return {
    taskId: "T-1",
    durationSeconds: 3600,
    skills: [],
    ...overrides,
    workDay: { date: parseDateOnly(overrides.workDayDate) },
  };
}

describe("buildWorkSummary", () => {
  it("counts only days with checkIn set as working days", () => {
    const workDays = [
      { date: parseDateOnly("2026-08-01"), checkIn: parseDateOnly("2026-08-01"), checkOut: null, breakSeconds: 0 },
      { date: parseDateOnly("2026-08-02"), checkIn: null, checkOut: null, breakSeconds: 0 },
      { date: parseDateOnly("2026-08-03"), checkIn: null, checkOut: null, breakSeconds: 0 }, // holiday-shaped, no checkIn
    ];
    const summary = buildWorkSummary(workDays, []);
    expect(summary.totalWorkingDays).toBe(1);
  });

  it("computes total hours and total task duration", () => {
    const eightHourDay = (dateStr: string) => {
      const checkIn = parseDateOnly(dateStr);
      const checkOut = new Date(checkIn.getTime() + 8 * 3600 * 1000);
      return { date: checkIn, checkIn, checkOut, breakSeconds: 0 };
    };
    const workDays = [eightHourDay("2026-08-01"), eightHourDay("2026-08-02")];
    const tasks = [{ durationSeconds: 3600 }, { durationSeconds: 1800 }];

    const summary = buildWorkSummary(workDays, tasks);

    expect(summary.totalHoursSeconds).toBe(16 * 3600);
    expect(summary.totalTaskDurationSeconds).toBe(5400);
  });

  it("returns zeroed totals when there are no working days", () => {
    const summary = buildWorkSummary([], []);
    expect(summary.totalWorkingDays).toBe(0);
    expect(summary.totalHoursSeconds).toBe(0);
  });
});

describe("groupTasksByDate", () => {
  it("groups tasks by their WorkDay's date, sorted ascending", () => {
    const tasks = [
      task({ workDayDate: "2026-08-02", durationSeconds: 1000 }),
      task({ workDayDate: "2026-08-01", durationSeconds: 500 }),
      task({ workDayDate: "2026-08-01", durationSeconds: 700 }),
    ];

    const grouped = groupTasksByDate(tasks);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].date.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(grouped[0].taskCount).toBe(2);
    expect(grouped[0].totalDurationSeconds).toBe(1200);
    expect(grouped[1].date.toISOString().slice(0, 10)).toBe("2026-08-02");
    expect(grouped[1].taskCount).toBe(1);
  });

  it("returns an empty array for no tasks", () => {
    expect(groupTasksByDate([])).toEqual([]);
  });
});

describe("groupTasksByTaskId", () => {
  it("groups recurring Task IDs across days, sorted alphabetically", () => {
    const tasks = [
      task({ workDayDate: "2026-08-01", taskId: "T-2039", durationSeconds: 1000 }),
      task({ workDayDate: "2026-08-02", taskId: "T-1039", durationSeconds: 500 }),
      task({ workDayDate: "2026-08-03", taskId: "T-1039", durationSeconds: 700 }),
    ];

    const grouped = groupTasksByTaskId(tasks);

    expect(grouped).toEqual([
      { taskId: "T-1039", count: 2, totalDurationSeconds: 1200 },
      { taskId: "T-2039", count: 1, totalDurationSeconds: 1000 },
    ]);
  });
});

describe("groupTasksBySkill", () => {
  it("attributes a task's full duration to every associated skill", () => {
    const tasks = [
      task({
        workDayDate: "2026-08-01",
        durationSeconds: 1000,
        skills: [
          { skill: { id: "s1", name: "React" } },
          { skill: { id: "s2", name: "TypeScript" } },
        ],
      }),
      task({
        workDayDate: "2026-08-02",
        durationSeconds: 500,
        skills: [{ skill: { id: "s1", name: "React" } }],
      }),
    ];

    const grouped = groupTasksBySkill(tasks);

    expect(grouped).toEqual([
      { skillId: "s1", skillName: "React", taskCount: 2, totalDurationSeconds: 1500 },
      { skillId: "s2", skillName: "TypeScript", taskCount: 1, totalDurationSeconds: 1000 },
    ]);
  });

  it("excludes tasks with no skills from the result entirely", () => {
    const tasks = [task({ workDayDate: "2026-08-01", skills: [] })];
    expect(groupTasksBySkill(tasks)).toEqual([]);
  });
});

describe("buildMonthlySummary", () => {
  it("aggregates hours and task stats per month, sorted chronologically", () => {
    const augDay = {
      date: parseDateOnly("2026-08-15"),
      checkIn: parseDateOnly("2026-08-15"),
      checkOut: new Date(parseDateOnly("2026-08-15").getTime() + 4 * 3600 * 1000),
      breakSeconds: 0,
    };
    const julDay = {
      date: parseDateOnly("2026-07-10"),
      checkIn: parseDateOnly("2026-07-10"),
      checkOut: new Date(parseDateOnly("2026-07-10").getTime() + 2 * 3600 * 1000),
      breakSeconds: 0,
    };
    const tasks = [
      task({ workDayDate: "2026-08-15", durationSeconds: 900 }),
      task({ workDayDate: "2026-07-10", durationSeconds: 300 }),
    ];

    const summary = buildMonthlySummary([augDay, julDay], tasks);

    expect(summary).toEqual([
      { month: "2026-07", totalHoursSeconds: 2 * 3600, taskCount: 1, totalTaskDurationSeconds: 300 },
      { month: "2026-08", totalHoursSeconds: 4 * 3600, taskCount: 1, totalTaskDurationSeconds: 900 },
    ]);
  });

  it("includes a month with hours but no tasks, and vice versa", () => {
    const dayNoTasks = {
      date: parseDateOnly("2026-08-01"),
      checkIn: parseDateOnly("2026-08-01"),
      checkOut: new Date(parseDateOnly("2026-08-01").getTime() + 1 * 3600 * 1000),
      breakSeconds: 0,
    };
    const summary = buildMonthlySummary([dayNoTasks], []);
    expect(summary).toEqual([
      { month: "2026-08", totalHoursSeconds: 3600, taskCount: 0, totalTaskDurationSeconds: 0 },
    ]);
  });
});

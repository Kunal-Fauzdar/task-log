// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createWorkDay, listWorkDays } from "@/lib/data/workday";
import { createTask } from "@/lib/data/task";
import { createSkill, deleteSkill } from "@/lib/data/skill";
import { setTaskSkills } from "@/lib/data/task";
import { getTasksInRange } from "@/lib/data/reports";
import {
  buildMonthlySummary,
  buildWorkSummary,
  groupTasksByDate,
  groupTasksBySkill,
  groupTasksByTaskId,
} from "@/lib/domain/reports";

const TEST_DATE_A = new Date("2099-12-01");
const TEST_DATE_B = new Date("2099-12-02");
const SKILL_NAME = "Reports Test Skill 2099";

afterEach(async () => {
  await prisma.workDay.deleteMany({ where: { date: { in: [TEST_DATE_A, TEST_DATE_B] } } });
  const skill = await prisma.skill.findUnique({ where: { name: SKILL_NAME } });
  if (skill) await deleteSkill(skill.id);
});

describe("getTasksInRange + reports domain — real database data end to end", () => {
  it("aggregates work days, tasks, and skills across a real range", async () => {
    const skill = await createSkill({ name: SKILL_NAME, proficiencyPercentage: 50 });

    const workDayA = await createWorkDay({ date: TEST_DATE_A });
    await prisma.workDay.update({
      where: { id: workDayA.id },
      data: {
        checkIn: new Date(Date.UTC(2099, 11, 1, 9, 0, 0)),
        checkOut: new Date(Date.UTC(2099, 11, 1, 17, 0, 0)),
        status: "COMPLETED",
      },
    });
    const taskA1 = await createTask({
      workDayId: workDayA.id,
      taskId: "T-3001",
      description: "First task",
      durationSeconds: 3600,
    });
    await setTaskSkills(taskA1.id, [skill.id]);
    await createTask({
      workDayId: workDayA.id,
      taskId: "T-3002",
      description: "Second task",
      durationSeconds: 1800,
    });

    const workDayB = await createWorkDay({ date: TEST_DATE_B });
    await prisma.workDay.update({
      where: { id: workDayB.id },
      data: {
        checkIn: new Date(Date.UTC(2099, 11, 2, 9, 0, 0)),
        checkOut: new Date(Date.UTC(2099, 11, 2, 13, 0, 0)),
        status: "COMPLETED",
      },
    });
    const taskB1 = await createTask({
      workDayId: workDayB.id,
      taskId: "T-3001",
      description: "Recurring Task ID on a different day",
      durationSeconds: 900,
    });
    await setTaskSkills(taskB1.id, [skill.id]);

    const range = { from: TEST_DATE_A, to: TEST_DATE_B };
    const [workDays, tasks] = await Promise.all([listWorkDays(range), getTasksInRange(range)]);

    expect(tasks).toHaveLength(3);

    const workSummary = buildWorkSummary(workDays, tasks);
    expect(workSummary.totalWorkingDays).toBe(2);
    expect(workSummary.totalHoursSeconds).toBe(12 * 3600); // 8h + 4h
    expect(workSummary.averageDailyHoursSeconds).toBe(6 * 3600);
    expect(workSummary.totalTaskDurationSeconds).toBe(3600 + 1800 + 900);

    const byDate = groupTasksByDate(tasks);
    expect(byDate).toHaveLength(2);
    expect(byDate[0].taskCount).toBe(2);
    expect(byDate[1].taskCount).toBe(1);

    const byTaskId = groupTasksByTaskId(tasks);
    const recurring = byTaskId.find((row) => row.taskId === "T-3001");
    expect(recurring?.count).toBe(2);
    expect(recurring?.totalDurationSeconds).toBe(4500);

    const bySkill = groupTasksBySkill(tasks);
    expect(bySkill).toHaveLength(1);
    expect(bySkill[0].skillName).toBe(SKILL_NAME);
    expect(bySkill[0].taskCount).toBe(2);
    expect(bySkill[0].totalDurationSeconds).toBe(4500);

    const monthly = buildMonthlySummary(workDays, tasks);
    expect(monthly).toHaveLength(1);
    expect(monthly[0].month).toBe("2099-12");
    expect(monthly[0].taskCount).toBe(3);
  });
});

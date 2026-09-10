// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createWorkDay, listWorkDays } from "@/lib/data/workday";
import { createTask, setTaskSkills } from "@/lib/data/task";
import { createSkill } from "@/lib/data/skill";
import { getTasksInRange } from "@/lib/data/reports";
import {
  buildMonthlySummary,
  buildWorkSummary,
  groupTasksByDate,
  groupTasksBySkill,
  groupTasksByTaskId,
} from "@/lib/domain/reports";
import { createTestUser, deleteTestUser } from "@/test/helpers/user";

const TEST_DATE_A = new Date("2099-12-01");
const TEST_DATE_B = new Date("2099-12-02");
const SKILL_NAME = "Reports Test Skill 2099";

let userId: string;

beforeAll(async () => {
  userId = (await createTestUser()).id;
});

afterAll(async () => {
  await deleteTestUser(userId);
});

afterEach(async () => {
  await prisma.workDay.deleteMany({ where: { userId, date: { in: [TEST_DATE_A, TEST_DATE_B] } } });
  await prisma.skill.deleteMany({ where: { userId, name: SKILL_NAME } });
});

describe("getTasksInRange + reports domain — real database data end to end", () => {
  it("aggregates work days, tasks, and skills across a real range", async () => {
    const skill = await createSkill({ userId, name: SKILL_NAME, proficiencyPercentage: 50 });

    const workDayA = await createWorkDay({ userId, date: TEST_DATE_A });
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
    await setTaskSkills(userId, taskA1.id, [skill.id]);
    await createTask({
      workDayId: workDayA.id,
      taskId: "T-3002",
      description: "Second task",
      durationSeconds: 1800,
    });

    const workDayB = await createWorkDay({ userId, date: TEST_DATE_B });
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
    await setTaskSkills(userId, taskB1.id, [skill.id]);

    const range = { from: TEST_DATE_A, to: TEST_DATE_B };
    const [workDays, tasks] = await Promise.all([
      listWorkDays(userId, range),
      getTasksInRange(userId, range),
    ]);

    expect(tasks).toHaveLength(3);

    const workSummary = buildWorkSummary(workDays, tasks);
    expect(workSummary.totalWorkingDays).toBe(2);
    expect(workSummary.totalHoursSeconds).toBe(12 * 3600); // 8h + 4h
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

  it("getTasksInRange never returns another user's tasks", async () => {
    const other = await createTestUser();
    try {
      const otherDay = await createWorkDay({ userId: other.id, date: TEST_DATE_A });
      await createTask({ workDayId: otherDay.id, taskId: "T-X", description: "Theirs" });

      const tasks = await getTasksInRange(userId, { from: TEST_DATE_A, to: TEST_DATE_B });
      expect(tasks).toEqual([]);
    } finally {
      await deleteTestUser(other.id);
    }
  });
});

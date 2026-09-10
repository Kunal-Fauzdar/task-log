// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createWorkDay } from "@/lib/data/workday";
import { createSkill } from "@/lib/data/skill";
import { createProject } from "@/lib/data/project";
import {
  createTask,
  deleteTask,
  duplicateTask,
  getTasksByWorkDay,
  reorderTasks,
  setTaskSkills,
  updateTask,
} from "@/lib/data/task";
import { createTestUser, deleteTestUser } from "@/test/helpers/user";

const TEST_DATE = new Date("2099-03-01");
const TEST_SKILL_NAME_A = "__test__ TaskSkill A";
const TEST_SKILL_NAME_B = "__test__ TaskSkill B";
const TEST_PROJECT_NAME = "__test__ Task Project";

let userId: string;

beforeAll(async () => {
  userId = (await createTestUser()).id;
});

afterAll(async () => {
  await deleteTestUser(userId);
});

afterEach(async () => {
  await prisma.workDay.deleteMany({ where: { userId, date: TEST_DATE } });
  await prisma.skill.deleteMany({ where: { userId, name: { in: [TEST_SKILL_NAME_A, TEST_SKILL_NAME_B] } } });
  await prisma.project.deleteMany({ where: { userId, name: TEST_PROJECT_NAME } });
});

function seedWorkDay() {
  return createWorkDay({ userId, date: TEST_DATE });
}

describe("Task CRUD", () => {
  it("auto-assigns incrementing order when not specified", async () => {
    const workDay = await seedWorkDay();
    const t1 = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "First" });
    const t2 = await createTask({ workDayId: workDay.id, taskId: "T-2", description: "Second" });

    expect(t1.order).toBe(0);
    expect(t2.order).toBe(1);
  });

  it("updates a task's fields", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "Draft" });

    const updated = await updateTask(userId, task.id, { description: "Final", durationSeconds: 1800 });

    if (!updated) throw new Error("expected updateTask to return the updated task");
    expect(updated.description).toBe("Final");
    expect(updated.durationSeconds).toBe(1800);
  });

  it("deletes a task", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "Temp" });

    await deleteTask(userId, task.id);

    const remaining = await getTasksByWorkDay(userId, workDay.id);
    expect(remaining).toHaveLength(0);
  });

  it("duplicates a task, appending it after the existing tasks", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({
      workDayId: workDay.id,
      taskId: "T-1",
      description: "Original",
      durationSeconds: 900,
      link: "https://example.com",
    });

    const copy = await duplicateTask(userId, task.id);

    if (!copy) throw new Error("expected duplicateTask to return the new task");
    expect(copy.id).not.toBe(task.id);
    expect(copy.taskId).toBe("T-1");
    expect(copy.description).toBe("Original");
    expect(copy.durationSeconds).toBe(900);
    expect(copy.order).toBe(1);
  });

  it("stores a task's projectId and carries it through duplicate/update", async () => {
    const workDay = await seedWorkDay();
    const project = await createProject({ userId, name: TEST_PROJECT_NAME });

    const task = await createTask({
      workDayId: workDay.id,
      taskId: "T-1",
      description: "Filed",
      projectId: project.id,
    });
    expect(task.projectId).toBe(project.id);

    const copy = await duplicateTask(userId, task.id);
    expect(copy?.projectId).toBe(project.id);

    const cleared = await updateTask(userId, task.id, { projectId: null });
    expect(cleared?.projectId).toBeNull();
  });

  it("mutating a task that no longer exists returns null instead of throwing", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "Temp" });
    await deleteTask(userId, task.id);

    await expect(updateTask(userId, task.id, { description: "Too late" })).resolves.toBeNull();
    await expect(deleteTask(userId, task.id)).resolves.toBeNull();
    await expect(duplicateTask(userId, task.id)).resolves.toBeNull();
  });

  it("does not mutate another user's task", async () => {
    const other = await createTestUser();
    try {
      const otherDay = await createWorkDay({ userId: other.id, date: TEST_DATE });
      const otherTask = await createTask({
        workDayId: otherDay.id,
        taskId: "T-X",
        description: "Theirs",
      });
      await expect(updateTask(userId, otherTask.id, { description: "hijack" })).resolves.toBeNull();
      await expect(deleteTask(userId, otherTask.id)).resolves.toBeNull();
      expect(await prisma.task.findUnique({ where: { id: otherTask.id } })).not.toBeNull();
    } finally {
      await deleteTestUser(other.id);
    }
  });

  it("reorders tasks according to the given id sequence", async () => {
    const workDay = await seedWorkDay();
    const t1 = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "A" });
    const t2 = await createTask({ workDayId: workDay.id, taskId: "T-2", description: "B" });
    const t3 = await createTask({ workDayId: workDay.id, taskId: "T-3", description: "C" });

    await reorderTasks(userId, [t3.id, t1.id, t2.id]);

    const ordered = await getTasksByWorkDay(userId, workDay.id);
    expect(ordered.map((t) => t.id)).toEqual([t3.id, t1.id, t2.id]);
  });
});

describe("setTaskSkills", () => {
  it("associates skills with a task", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "A" });
    const skillA = await createSkill({ userId, name: TEST_SKILL_NAME_A, proficiencyPercentage: 50 });
    const skillB = await createSkill({ userId, name: TEST_SKILL_NAME_B, proficiencyPercentage: 60 });

    await setTaskSkills(userId, task.id, [skillA.id, skillB.id]);

    const links = await prisma.taskSkill.findMany({ where: { taskId: task.id } });
    expect(links.map((l) => l.skillId).sort()).toEqual([skillA.id, skillB.id].sort());
  });

  it("replaces the association set rather than appending to it", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "A" });
    const skillA = await createSkill({ userId, name: TEST_SKILL_NAME_A, proficiencyPercentage: 50 });
    const skillB = await createSkill({ userId, name: TEST_SKILL_NAME_B, proficiencyPercentage: 60 });

    await setTaskSkills(userId, task.id, [skillA.id]);
    await setTaskSkills(userId, task.id, [skillB.id]);

    const links = await prisma.taskSkill.findMany({ where: { taskId: task.id } });
    expect(links.map((l) => l.skillId)).toEqual([skillB.id]);
  });

  it("an empty list clears all associations", async () => {
    const workDay = await seedWorkDay();
    const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "A" });
    const skillA = await createSkill({ userId, name: TEST_SKILL_NAME_A, proficiencyPercentage: 50 });

    await setTaskSkills(userId, task.id, [skillA.id]);
    await setTaskSkills(userId, task.id, []);

    const links = await prisma.taskSkill.findMany({ where: { taskId: task.id } });
    expect(links).toHaveLength(0);
  });

  it("ignores skill ids that belong to another user", async () => {
    const other = await createTestUser();
    try {
      const workDay = await seedWorkDay();
      const task = await createTask({ workDayId: workDay.id, taskId: "T-1", description: "A" });
      const foreignSkill = await createSkill({
        userId: other.id,
        name: TEST_SKILL_NAME_A,
        proficiencyPercentage: 50,
      });

      await setTaskSkills(userId, task.id, [foreignSkill.id]);

      const links = await prisma.taskSkill.findMany({ where: { taskId: task.id } });
      expect(links).toHaveLength(0);
    } finally {
      await deleteTestUser(other.id);
    }
  });
});

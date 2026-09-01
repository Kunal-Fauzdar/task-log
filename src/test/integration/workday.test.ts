// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createWorkDay,
  deleteWorkDay,
  findOrCreateWorkDayByDate,
  getWorkDayByDate,
  listWorkDays,
  resetWorkDayTimes,
  updateWorkDay,
} from "@/lib/data/workday";
import { createTask } from "@/lib/data/task";

// Distinct, clearly-fake dates so these tests can never collide with real logged work days.
const TEST_DATE_A = new Date("2099-01-01");
const TEST_DATE_B = new Date("2099-01-02");

afterEach(async () => {
  await prisma.workDay.deleteMany({
    where: { date: { in: [TEST_DATE_A, TEST_DATE_B] } },
  });
});

describe("WorkDay + Task", () => {
  it("creates a WorkDay and attaches tasks to it", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_A });
    await createTask({
      workDayId: workDay.id,
      taskId: "T-0001",
      description: "First task",
      durationSeconds: 3600,
      order: 0,
    });
    await createTask({
      workDayId: workDay.id,
      taskId: "T-0002",
      description: "Second task",
      durationSeconds: 1800,
      order: 1,
    });

    const found = await getWorkDayByDate(TEST_DATE_A);

    expect(found).not.toBeNull();
    expect(found?.tasks).toHaveLength(2);
    expect(found?.tasks.map((t) => t.taskId)).toEqual(["T-0001", "T-0002"]);
  });

  it("rejects a second WorkDay on the same date", async () => {
    await createWorkDay({ date: TEST_DATE_A });

    await expect(createWorkDay({ date: TEST_DATE_A })).rejects.toThrow();
  });

  it("cascades: deleting a WorkDay deletes its tasks", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_A });
    const task = await createTask({
      workDayId: workDay.id,
      taskId: "T-0003",
      description: "Will be cascade-deleted",
    });

    await deleteWorkDay(workDay.id);

    const orphan = await prisma.task.findUnique({ where: { id: task.id } });
    expect(orphan).toBeNull();
    expect(await prisma.workDay.findUnique({ where: { id: workDay.id } })).toBeNull();
  });

  it("tolerates deleting a WorkDay that's already gone (P2025)", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_A });
    await deleteWorkDay(workDay.id);

    await expect(deleteWorkDay(workDay.id)).resolves.toBeNull();
  });

  it("lists work days within a date range", async () => {
    await createWorkDay({ date: TEST_DATE_A });
    await createWorkDay({ date: TEST_DATE_B });

    const results = await listWorkDays({ from: TEST_DATE_A, to: TEST_DATE_B });
    const dates = results.map((w) => w.date.toISOString().slice(0, 10));

    expect(dates).toContain("2099-01-01");
    expect(dates).toContain("2099-01-02");
  });
});

describe("findOrCreateWorkDayByDate", () => {
  it("creates a WorkDay on first call and reuses it on subsequent calls", async () => {
    const first = await findOrCreateWorkDayByDate(TEST_DATE_A);
    const second = await findOrCreateWorkDayByDate(TEST_DATE_A);

    expect(second?.id).toBe(first?.id);
    const count = await prisma.workDay.count({ where: { date: TEST_DATE_A } });
    expect(count).toBe(1);
  });

  it("does not crash on a unique-constraint race when called concurrently for a new date", async () => {
    // Regression test: this used to be a get-then-create pair, which raced under concurrent
    // calls for a brand-new date and crashed the loser on the `date` unique constraint —
    // caught via manual browser verification (Next.js's document + RSC-flight requests hit
    // the same new date concurrently). Now an atomic upsert.
    const [a, b, c] = await Promise.all([
      findOrCreateWorkDayByDate(TEST_DATE_A),
      findOrCreateWorkDayByDate(TEST_DATE_A),
      findOrCreateWorkDayByDate(TEST_DATE_A),
    ]);

    expect(a.id).toBe(b.id);
    expect(b.id).toBe(c.id);
    const count = await prisma.workDay.count({ where: { date: TEST_DATE_A } });
    expect(count).toBe(1);
  });
});

describe("updateWorkDay", () => {
  it("updates notes without touching day-type fields", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_A });
    const updated = await updateWorkDay(workDay.id, { notes: "Worked from home" });
    expect(updated.notes).toBe("Worked from home");
    expect(updated.dayType).toBe("WORKING");
  });

  it("setting dayType HOLIDAY also sets status to HOLIDAY", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_A });
    const updated = await updateWorkDay(workDay.id, {
      dayType: "HOLIDAY",
      dayNote: "Company holiday",
    });
    expect(updated.status).toBe("HOLIDAY");
    expect(updated.dayNote).toBe("Company holiday");
  });

  it("setting dayType LEAVE also sets status to LEAVE", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_A });
    const updated = await updateWorkDay(workDay.id, { dayType: "LEAVE", dayNote: "Sick" });
    expect(updated.status).toBe("LEAVE");
    expect(updated.dayNote).toBe("Sick");
  });

  it("reverting dayType to WORKING reverts status to NOT_STARTED", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_A });
    await updateWorkDay(workDay.id, { dayType: "HOLIDAY" });
    const reverted = await updateWorkDay(workDay.id, { dayType: "WORKING", dayNote: null });
    expect(reverted.status).toBe("NOT_STARTED");
    expect(reverted.dayNote).toBeNull();
  });
});

describe("resetWorkDayTimes", () => {
  it("clears check-in/out and break, and reverts status to NOT_STARTED", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_A });
    await prisma.workDay.update({
      where: { id: workDay.id },
      data: {
        checkIn: new Date(Date.UTC(2099, 0, 1, 9, 0)),
        checkOut: new Date(Date.UTC(2099, 0, 1, 17, 0)),
        breakSeconds: 1800,
        breakStartedAt: new Date(),
        status: "COMPLETED",
      },
    });

    const reset = await resetWorkDayTimes(workDay.id);
    expect(reset.checkIn).toBeNull();
    expect(reset.checkOut).toBeNull();
    expect(reset.breakSeconds).toBe(0);
    expect(reset.breakStartedAt).toBeNull();
    expect(reset.status).toBe("NOT_STARTED");
  });

  it("keeps status HOLIDAY when the day is a holiday", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_A });
    await updateWorkDay(workDay.id, { dayType: "HOLIDAY" });
    await prisma.workDay.update({
      where: { id: workDay.id },
      data: { checkIn: new Date(Date.UTC(2099, 0, 1, 9, 0)), breakSeconds: 600 },
    });

    const reset = await resetWorkDayTimes(workDay.id);
    expect(reset.checkIn).toBeNull();
    expect(reset.breakSeconds).toBe(0);
    expect(reset.status).toBe("HOLIDAY");
  });

  it("does not touch tasks", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_A });
    await createTask({ workDayId: workDay.id, taskId: "T-9999", description: "Keep me", order: 0 });
    await prisma.workDay.update({
      where: { id: workDay.id },
      data: { checkIn: new Date(Date.UTC(2099, 0, 1, 9, 0)) },
    });

    await resetWorkDayTimes(workDay.id);
    const tasks = await prisma.task.findMany({ where: { workDayId: workDay.id } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskId).toBe("T-9999");
  });
});

describe("Task <-> Skill association", () => {
  it("links a task to a skill via TaskSkill and reads it both directions", async () => {
    const workDay = await createWorkDay({ date: TEST_DATE_A });
    const task = await createTask({
      workDayId: workDay.id,
      taskId: "T-0004",
      description: "Build dashboard",
    });
    const skill = await prisma.skill.create({
      data: { name: "__test__ React.js", proficiencyPercentage: 85, category: "MORE_THAN_70" },
    });

    await prisma.taskSkill.create({ data: { taskId: task.id, skillId: skill.id } });

    const taskWithSkills = await prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      include: { skills: { include: { skill: true } } },
    });
    const skillWithTasks = await prisma.skill.findUniqueOrThrow({
      where: { id: skill.id },
      include: { tasks: true },
    });

    expect(taskWithSkills.skills[0]?.skill.name).toBe("__test__ React.js");
    expect(skillWithTasks.tasks).toHaveLength(1);

    await prisma.skill.delete({ where: { id: skill.id } });
  });
});

// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";

const TEST_DATE = new Date("2099-08-01");
const SKILL_NAME = "DB Constraint Test Skill 2099";

afterEach(async () => {
  await prisma.workDay.deleteMany({ where: { date: TEST_DATE } });
  const skill = await prisma.skill.findUnique({ where: { name: SKILL_NAME } });
  if (skill) await prisma.skill.delete({ where: { id: skill.id } });
});

// Phase 10 (Security & Hardening): the app's Zod layer already rejects these values before they
// ever reach Prisma — these tests instead call prisma.*.create directly, bypassing that layer
// entirely, to prove the database itself enforces the invariant as defense-in-depth (e.g. against
// a future bug in a data-layer function that skips validation). See the migration.sql in
// prisma/migrations/20260825115715_add_check_constraints for the constraints themselves.
describe("database CHECK constraints — defense in depth against invalid writes", () => {
  it("rejects a negative WorkDay.breakSeconds even when Prisma is called directly", async () => {
    await expect(
      prisma.workDay.create({ data: { date: TEST_DATE, breakSeconds: -1 } }),
    ).rejects.toThrow();
  });

  it("rejects Check Out before Check In even when Prisma is called directly", async () => {
    await expect(
      prisma.workDay.create({
        data: {
          date: TEST_DATE,
          checkIn: new Date(Date.UTC(2099, 7, 1, 17, 0)),
          checkOut: new Date(Date.UTC(2099, 7, 1, 9, 0)),
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a negative Task.durationSeconds even when Prisma is called directly", async () => {
    const workDay = await prisma.workDay.create({ data: { date: TEST_DATE } });
    await expect(
      prisma.task.create({
        data: {
          workDayId: workDay.id,
          taskId: "T-1",
          description: "test",
          durationSeconds: -1,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects an out-of-range Skill.proficiencyPercentage even when Prisma is called directly", async () => {
    await expect(
      prisma.skill.create({
        data: { name: SKILL_NAME, category: "MORE_THAN_70", proficiencyPercentage: 150 },
      }),
    ).rejects.toThrow();
  });
});
